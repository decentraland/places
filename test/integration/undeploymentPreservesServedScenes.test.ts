import { SQL } from "decentraland-gatsby/dist/entities/Database/utils"

import { DeploymentToSqs } from "../../src/entities/CheckScenes/task/consumer"
import { extractSceneJsonData } from "../../src/entities/CheckScenes/task/extractSceneJsonData"
import {
  fetchWorldActiveScenes,
  fetchWorldActiveScenesAtPositions,
} from "../../src/entities/CheckScenes/task/fetchWorldActiveScenes"
import { handleWorldScenesUndeployment } from "../../src/entities/CheckScenes/task/handleWorldScenesUndeployment"
import { handleWorldUndeployment } from "../../src/entities/CheckScenes/task/handleWorldUndeployment"
import { processEntityId } from "../../src/entities/CheckScenes/task/processEntityId"
import { taskRunnerSqs } from "../../src/entities/CheckScenes/task/taskRunnerSqs"
import PlaceModel from "../../src/entities/Place/model"
import { DisabledReason } from "../../src/entities/Place/types"
import {
  createWorldContentEntityScene,
  createWorldDeploymentMessage,
} from "../fixtures/deploymentEvent"
import {
  createWorldScenesUndeploymentEvent,
  createWorldUndeploymentEvent,
} from "../fixtures/undeploymentEvent"
import { cleanTables, closeTestDb, initTestDb } from "../setup/db"

// Mock external HTTP calls
jest.mock("../../src/entities/CheckScenes/task/processEntityId")
jest.mock("../../src/entities/CheckScenes/task/extractSceneJsonData")
jest.mock("../../src/entities/CheckScenes/task/fetchWorldActiveScenes", () => ({
  fetchWorldActiveScenes: jest.fn(async () => ({
    deploymentIds: [],
    positions: [],
  })),
  fetchWorldActiveScenesAtPositions: jest.fn(async () => ({
    deploymentIds: [],
    positions: [],
  })),
}))

// Mock Slack notifications to prevent HTTP calls during tests
jest.mock("../../src/entities/Slack/utils", () => ({
  notifyDowngradeRating: jest.fn(),
  notifyUpgradingRating: jest.fn(),
  notifyError: jest.fn(),
  notifyNewPlace: jest.fn(),
  notifyUpdatePlace: jest.fn(),
  notifyDisablePlaces: jest.fn(),
}))

// Mock the genesis city manifest update (requires S3) and name owner fetch (requires subgraph)
jest.mock("../../src/entities/CheckScenes/utils", () => ({
  ...jest.requireActual("../../src/entities/CheckScenes/utils"),
  updateGenesisCityManifest: jest.fn(),
  fetchNameOwner: jest.fn().mockResolvedValue(undefined),
}))

// Mock modules with persistent timers to prevent Jest from hanging
jest.mock("../../src/modules/hotScenes", () => ({
  getHotScenes: jest.fn().mockReturnValue([]),
}))
jest.mock("../../src/modules/sceneStats", () => ({
  getSceneStats: jest.fn().mockResolvedValue({}),
}))
jest.mock("../../src/modules/worldsLiveData", () => ({
  getWorldsLiveData: jest.fn().mockResolvedValue({
    perWorld: [],
    totalUsers: 0,
  }),
}))

const mockProcessEntityId = processEntityId as jest.MockedFunction<
  typeof processEntityId
>
const mockExtractSceneJsonData = extractSceneJsonData as jest.MockedFunction<
  typeof extractSceneJsonData
>
const mockFetchWorldActiveScenes =
  fetchWorldActiveScenes as jest.MockedFunction<typeof fetchWorldActiveScenes>
const mockFetchScenesAtPositions =
  fetchWorldActiveScenesAtPositions as jest.MockedFunction<
    typeof fetchWorldActiveScenesAtPositions
  >

async function deliverDeployment(options: {
  worldName: string
  entityId: string
  timestamp: number
  title: string
  base: string
  parcels: string[]
}): Promise<void> {
  const scene = createWorldContentEntityScene({
    worldName: options.worldName,
    title: options.title,
    base: options.base,
    parcels: options.parcels,
  })
  scene.timestamp = options.timestamp

  mockProcessEntityId.mockResolvedValueOnce(scene)
  mockExtractSceneJsonData.mockResolvedValueOnce({
    creator: null,
    runtimeVersion: null,
  })

  const message = createWorldDeploymentMessage()
  const job: DeploymentToSqs = {
    ...message,
    entity: { ...message.entity, entityId: options.entityId },
  }

  await taskRunnerSqs(job)
}

/**
 * Replacing a world's scene set makes the content server remove the scenes it displaced, and the
 * removal is emitted after the replacement was signed. Every undeployment predicate that leans on
 * timestamps, base parcels or footprints therefore mistakes the replacement for the content it
 * replaced. Only the scene set the world still serves separates them.
 */
describe("when an undeployment follows the deployment that caused it", () => {
  // Day-scale gaps: deployed_at is a `timestamp without time zone`, so a stored date read back into
  // JS is shifted by the process UTC offset. Staleness is decided in JS, so minute-scale gaps would
  // make these tests depend on TZ.
  const day = 24 * 60 * 60 * 1000
  let replacedDeployedAt: number
  let replacementDeployedAt: number
  let undeploymentEmittedAt: number

  beforeAll(async () => {
    await initTestDb()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  afterEach(async () => {
    await cleanTables()
    jest.clearAllMocks()
  })

  beforeEach(() => {
    replacedDeployedAt = Date.now() - 2 * day
    replacementDeployedAt = Date.now() - day
    undeploymentEmittedAt = replacementDeployedAt + 1000
  })

  describe("and the scene undeployment names the replaced scene at the same base", () => {
    const worldName = "served-replacement.dcl.eth"
    let replacement: {
      title: string | null
      disabled: boolean
      reason: DisabledReason | null
    }

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-replaced",
        timestamp: replacedDeployedAt,
        title: "Replaced Scene",
        base: "0,0",
        parcels: ["0,0", "0,1"],
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-replacement",
        timestamp: replacementDeployedAt,
        title: "Replacement Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      mockFetchScenesAtPositions.mockResolvedValueOnce({
        deploymentIds: ["entity-replacement"],
        positions: ["0,0"],
      })

      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [
            {
              entityId: "entity-replaced",
              baseParcel: "0,0",
              parcels: ["0,0", "0,1"],
            },
          ],
          { timestamp: undeploymentEmittedAt }
        )
      )

      const [place] = await PlaceModel.namedQuery<{
        title: string | null
        disabled: boolean
        disabled_reason: DisabledReason | null
      }>(
        "find_place_by_deployment_id_for_test",
        SQL`SELECT "title", "disabled", "disabled_reason" FROM places WHERE "deployment_id" = ${"entity-replacement"}`
      )
      replacement = {
        title: place?.title ?? null,
        disabled: !!place?.disabled,
        reason: place?.disabled_reason ?? null,
      }
    })

    it("should leave the scene the world still serves enabled", () => {
      expect(replacement).toEqual({
        title: "Replacement Scene",
        disabled: false,
        reason: null,
      })
    })
  })

  describe("and the replacement carries no deployment id", () => {
    const worldName = "served-legacy-replacement.dcl.eth"
    let enabledTitles: Array<string | null>

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-legacy-replaced",
        timestamp: replacedDeployedAt,
        title: "Legacy Replaced Scene",
        base: "0,0",
        parcels: ["0,0", "0,1"],
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-legacy-replacement",
        timestamp: replacementDeployedAt,
        title: "Legacy Replacement Scene",
        base: "0,0",
        parcels: ["0,0"],
      })
      // Rows created before deployment ids were stored can only be recognised by their footprint
      await PlaceModel.namedQuery(
        "clear_deployment_id_for_test",
        SQL`UPDATE places SET "deployment_id" = NULL WHERE "world_id" = ${worldName} AND "disabled" IS FALSE`
      )

      mockFetchScenesAtPositions.mockResolvedValueOnce({
        deploymentIds: ["entity-legacy-replacement"],
        positions: ["0,0"],
      })

      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [
            {
              entityId: "entity-legacy-replaced",
              baseParcel: "0,0",
              parcels: ["0,0", "0,1"],
            },
          ],
          { timestamp: undeploymentEmittedAt }
        )
      )

      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should keep the legacy row a served scene still covers enabled", () => {
      expect(enabledTitles).toEqual(["Legacy Replacement Scene"])
    })
  })

  describe("and a world undeployment arrives for a world that was reshaped", () => {
    const worldName = "reshaped-world.dcl.eth"
    let enabledTitles: Array<string | null>

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-removed-a",
        timestamp: replacedDeployedAt,
        title: "Removed Scene A",
        base: "7,89",
        parcels: ["7,89"],
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-removed-b",
        timestamp: replacedDeployedAt,
        title: "Removed Scene B",
        base: "-7,75",
        parcels: ["-7,75"],
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-surviving",
        timestamp: replacementDeployedAt,
        title: "Surviving Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      mockFetchWorldActiveScenes.mockResolvedValueOnce({
        deploymentIds: ["entity-surviving"],
        positions: ["0,0"],
      })

      await handleWorldUndeployment(
        createWorldUndeploymentEvent(worldName, {
          timestamp: undeploymentEmittedAt,
        })
      )

      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should disable only the scenes the world stopped serving", () => {
      expect(enabledTitles).toEqual(["Surviving Scene"])
    })
  })

  describe("and a world undeployment arrives for a world that serves nothing", () => {
    const worldName = "torn-down-world.dcl.eth"
    let enabledTitles: Array<string | null>

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-torn-down",
        timestamp: replacementDeployedAt,
        title: "Torn Down Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      await handleWorldUndeployment(
        createWorldUndeploymentEvent(worldName, {
          timestamp: undeploymentEmittedAt,
        })
      )

      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should disable every place of the world", () => {
      expect(enabledTitles).toEqual([])
    })
  })

  describe("and the replacement deployment is delivered after the undeployment", () => {
    const worldName = "late-replacement.dcl.eth"
    let enabledTitles: Array<string | null>

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-late-replaced",
        timestamp: replacedDeployedAt,
        title: "Late Replaced Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      mockFetchScenesAtPositions.mockResolvedValueOnce({
        deploymentIds: ["entity-late-replacement"],
        positions: ["0,0"],
      })

      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-late-replaced", baseParcel: "0,0" }],
          { timestamp: undeploymentEmittedAt }
        )
      )

      await deliverDeployment({
        worldName,
        entityId: "entity-late-replacement",
        timestamp: replacementDeployedAt,
        title: "Late Replacement Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should let the watermark accept the deployment that superseded the removed scene", () => {
      expect(enabledTitles).toEqual(["Late Replacement Scene"])
    })
  })
})
