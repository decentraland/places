import { SQL } from "decentraland-gatsby/dist/entities/Database/utils"

import { DeploymentToSqs } from "../../src/entities/CheckScenes/task/consumer"
import { extractSceneJsonData } from "../../src/entities/CheckScenes/task/extractSceneJsonData"
import { handleWorldScenesUndeployment } from "../../src/entities/CheckScenes/task/handleWorldScenesUndeployment"
import { processEntityId } from "../../src/entities/CheckScenes/task/processEntityId"
import { taskRunnerSqs } from "../../src/entities/CheckScenes/task/taskRunnerSqs"
import PlaceModel from "../../src/entities/Place/model"
import WorldSceneUndeploymentModel from "../../src/entities/WorldSceneUndeployment/model"
import { WorldSceneUndeploymentAttributes } from "../../src/entities/WorldSceneUndeployment/types"
import {
  createWorldContentEntityScene,
  createWorldDeploymentMessage,
} from "../fixtures/deploymentEvent"
import { createWorldScenesUndeploymentEvent } from "../fixtures/undeploymentEvent"
import { cleanTables, closeTestDb, initTestDb } from "../setup/db"

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

jest.mock("../../src/entities/Slack/utils", () => ({
  notifyDowngradeRating: jest.fn(),
  notifyUpgradingRating: jest.fn(),
  notifyError: jest.fn(),
  notifyNewPlace: jest.fn(),
  notifyUpdatePlace: jest.fn(),
  notifyDisablePlaces: jest.fn(),
}))

jest.mock("../../src/entities/CheckScenes/utils", () => ({
  ...jest.requireActual("../../src/entities/CheckScenes/utils"),
  updateGenesisCityManifest: jest.fn(),
  fetchNameOwner: jest.fn().mockResolvedValue(undefined),
}))

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

async function undeployScene(options: {
  worldName: string
  entityId: string
  base: string
  emittedAt: number
}): Promise<void> {
  await handleWorldScenesUndeployment(
    createWorldScenesUndeploymentEvent(
      options.worldName,
      [
        {
          entityId: options.entityId,
          baseParcel: options.base,
          parcels: [options.base],
        },
      ],
      { timestamp: options.emittedAt }
    )
  )
}

describe("when a world deployment is resolved against undeployment history", () => {
  const day = 24 * 60 * 60 * 1000
  let olderAt: number
  let replacementAt: number
  let emittedAt: number

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
    olderAt = Date.now() - 2 * day
    replacementAt = Date.now() - day
    emittedAt = replacementAt + 1000
  })

  describe("and a distinct-identity deployment lands on a base an undeployment already cleared", () => {
    describe("and it legitimately replaces a different scene", () => {
      const worldName = "contract-legit-replacement.dcl.eth"
      let enabledTitles: Array<string | null>

      beforeEach(async () => {
        await deliverDeployment({
          worldName,
          entityId: "entity-replaced",
          timestamp: olderAt,
          title: "Replaced Scene",
          base: "0,0",
          parcels: ["0,0"],
        })
        await undeployScene({
          worldName,
          entityId: "entity-replaced",
          base: "0,0",
          emittedAt,
        })
        await deliverDeployment({
          worldName,
          entityId: "entity-replacement",
          timestamp: replacementAt,
          title: "Replacement Scene",
          base: "0,0",
          parcels: ["0,0"],
        })

        enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
          (place) => place.title
        )
      })

      it("should admit the replacement", () => {
        expect(enabledTitles).toEqual(["Replacement Scene"])
      })
    })

    describe("and it is only a stale older revision of the removed scene", () => {
      const worldName = "contract-stale-older.dcl.eth"
      let enabledTitles: Array<string | null>

      beforeEach(async () => {
        await deliverDeployment({
          worldName,
          entityId: "entity-newer-revision",
          timestamp: replacementAt,
          title: "Newer Revision",
          base: "0,0",
          parcels: ["0,0"],
        })
        await undeployScene({
          worldName,
          entityId: "entity-newer-revision",
          base: "0,0",
          emittedAt,
        })
        await deliverDeployment({
          worldName,
          entityId: "entity-older-revision",
          timestamp: olderAt,
          title: "Older Revision",
          base: "0,0",
          parcels: ["0,0"],
        })

        enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
          (place) => place.title
        )
      })

      it("should admit it too, because its deploy-path inputs are identical to a replacement", () => {
        expect(enabledTitles).toEqual(["Older Revision"])
      })
    })
  })

  describe("and the exact tombstoned entity is redelivered", () => {
    const worldName = "contract-same-entity.dcl.eth"
    let enabledTitles: Array<string | null>

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-gone",
        timestamp: olderAt,
        title: "Gone Scene",
        base: "0,0",
        parcels: ["0,0"],
      })
      await undeployScene({
        worldName,
        entityId: "entity-gone",
        base: "0,0",
        emittedAt,
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-gone",
        timestamp: olderAt,
        title: "Gone Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should keep the redelivered tombstoned entity disabled", () => {
      expect(enabledTitles).toEqual([])
    })
  })

  describe("and a genuinely newer real place already covers the base", () => {
    const worldName = "contract-newer-real-place.dcl.eth"
    let enabledTitles: Array<string | null>

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-current",
        timestamp: replacementAt,
        title: "Current Scene",
        base: "0,0",
        parcels: ["0,0"],
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-late-older",
        timestamp: olderAt,
        title: "Late Older Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should let the newer real place supersede the older delivery", () => {
      expect(enabledTitles).toEqual(["Current Scene"])
    })
  })

  describe("and the undeployment tombstone is stamped after the replacement it clears", () => {
    const worldName = "contract-emission-time.dcl.eth"
    let tombstoneUndeployedAt: number
    let replacementDeployedAt: number
    let replacementEnabled: boolean

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-cleared",
        timestamp: olderAt,
        title: "Cleared Scene",
        base: "0,0",
        parcels: ["0,0"],
      })
      await undeployScene({
        worldName,
        entityId: "entity-cleared",
        base: "0,0",
        emittedAt,
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-admitted",
        timestamp: replacementAt,
        title: "Admitted Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      const [tombstone] =
        await WorldSceneUndeploymentModel.find<WorldSceneUndeploymentAttributes>(
          { world_id: worldName, deployment_id: "entity-cleared" }
        )
      const [place] = await PlaceModel.namedQuery<{ deployed_at: Date }>(
        "contract_read_replacement_deployed_at",
        SQL`SELECT "deployed_at" FROM places WHERE "deployment_id" = ${"entity-admitted"}`
      )

      tombstoneUndeployedAt = new Date(tombstone.undeployed_at).getTime()
      replacementDeployedAt = new Date(place.deployed_at).getTime()
      replacementEnabled = (
        await PlaceModel.findEnabledWorldName(worldName)
      ).some((row) => row.deployment_id === "entity-admitted")
    })

    it("should stamp the tombstone later than the replacement it clears", () => {
      expect(tombstoneUndeployedAt).toBeGreaterThan(replacementDeployedAt)
    })

    it("should still admit the replacement despite the newer tombstone timestamp", () => {
      expect(replacementEnabled).toBe(true)
    })
  })
})
