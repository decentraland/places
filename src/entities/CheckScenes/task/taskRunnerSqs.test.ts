import {
  ContentEntityScene,
  SceneContentRating,
} from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { extractSceneJsonData } from "./extractSceneJsonData"
import { createPlaceFromContentEntityScene } from "./processContentEntityScene"
import { processEntityId } from "./processEntityId"
import { taskRunnerSqs } from "./taskRunnerSqs"
import { sqsMessageWorld } from "../../../__data__/sqs"
import { worldContentEntitySceneParalax } from "../../../__data__/world"
import PlaceModel from "../../Place/model"
import WorldModel from "../../World/model"
import { fetchNameOwner, findNewDeployedPlace } from "../utils"

jest.mock("./processEntityId")
jest.mock("./extractSceneJsonData")
jest.mock("./processContentEntityScene")
jest.mock("../utils", () => ({
  fetchNameOwner: jest.fn(),
  findNewDeployedPlace: jest.fn(),
  updateGenesisCityManifest: jest.fn(),
}))
jest.mock("../../World/model", () => ({
  __esModule: true,
  default: {
    insertWorldIfNotExists: jest.fn(),
    upsertWorld: jest.fn(),
  },
}))
jest.mock("../../Place/model", () => ({
  __esModule: true,
  default: {
    findActiveByWorldIdAndPositions: jest.fn(),
    findEnabledByPositions: jest.fn(),
    insertPlace: jest.fn(),
    updatePlace: jest.fn(),
    disablePlaces: jest.fn(),
    overrideCategories: jest.fn(),
  },
}))
jest.mock("../../PlaceContentRating/model", () => ({
  __esModule: true,
  default: { create: jest.fn() },
}))
jest.mock("../../PlacePosition/model", () => ({
  __esModule: true,
  default: { syncBasePosition: jest.fn(), removePositions: jest.fn() },
}))
jest.mock("../../Slack/utils", () => ({
  notifyNewPlace: jest.fn(),
  notifyUpdatePlace: jest.fn(),
  notifyDisablePlaces: jest.fn(),
}))
jest.mock("../model", () => ({
  __esModule: true,
  default: { createOne: jest.fn(), createMany: jest.fn() },
}))

const mockProcessEntityId = processEntityId as jest.MockedFunction<
  typeof processEntityId
>
const mockExtractSceneJsonData = extractSceneJsonData as jest.MockedFunction<
  typeof extractSceneJsonData
>
const mockCreatePlace =
  createPlaceFromContentEntityScene as jest.MockedFunction<
    typeof createPlaceFromContentEntityScene
  >
const mockFetchNameOwner = fetchNameOwner as jest.MockedFunction<
  typeof fetchNameOwner
>
const mockFindNewDeployedPlace = findNewDeployedPlace as jest.MockedFunction<
  typeof findNewDeployedPlace
>

const WORLD_NAME = "paralax.dcl.eth"
const NAME_OWNER = "0x1111111111111111111111111111111111111111"

// A world (re)deploy whose scene carries fresh display metadata and an SDK
// content rating, modelled on the existing world fixture.
function buildWorldScene(
  display: { title?: string; description?: string },
  contentRating: SceneContentRating
): ContentEntityScene {
  return {
    ...worldContentEntitySceneParalax,
    metadata: {
      ...worldContentEntitySceneParalax.metadata,
      display: {
        ...worldContentEntitySceneParalax.metadata.display,
        ...display,
      },
      tags: [],
      policy: {
        contentRating,
        fly: true,
        voiceEnabled: true,
        blacklist: [],
        teleportPosition: "0,0,0",
      },
    },
  }
}

describe("taskRunnerSqs", () => {
  describe("when a world scene is deployed", () => {
    let upsertArg: Record<string, unknown>

    beforeEach(async () => {
      mockProcessEntityId.mockResolvedValue(
        buildWorldScene(
          { title: "Updated Title", description: "Updated description" },
          SceneContentRating.TEEN
        )
      )
      mockExtractSceneJsonData.mockResolvedValue({
        creator: null,
        runtimeVersion: null,
      })
      mockFetchNameOwner.mockResolvedValue(NAME_OWNER)
      mockFindNewDeployedPlace.mockReturnValue(null)
      mockCreatePlace.mockReturnValue({
        id: "place-1",
        positions: ["0,0"],
        base_position: "0,0",
        content_rating: SceneContentRating.TEEN,
      } as unknown as ReturnType<typeof createPlaceFromContentEntityScene>)
      ;(WorldModel.insertWorldIfNotExists as jest.Mock).mockResolvedValue(
        WORLD_NAME
      )
      ;(WorldModel.upsertWorld as jest.Mock).mockResolvedValue({})
      ;(
        PlaceModel.findActiveByWorldIdAndPositions as jest.Mock
      ).mockResolvedValue([])
      ;(PlaceModel.insertPlace as jest.Mock).mockResolvedValue(undefined)

      await taskRunnerSqs(sqsMessageWorld)

      upsertArg = (WorldModel.upsertWorld as jest.Mock).mock.calls[0][0]
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it("should set content_rating on the first insert", () => {
      expect(WorldModel.insertWorldIfNotExists).toHaveBeenCalledWith(
        expect.objectContaining({
          world_name: WORLD_NAME,
          content_rating: SceneContentRating.TEEN,
        })
      )
    })

    it("should refresh the world title and description from the latest scene display", () => {
      expect(upsertArg).toMatchObject({
        world_name: WORLD_NAME,
        title: "Updated Title",
        description: "Updated description",
      })
    })

    it("should keep the world owner in sync with the on-chain name owner", () => {
      expect(upsertArg.owner).toBe(NAME_OWNER)
    })

    it("should not clobber moderator-managed fields on redeploy", () => {
      expect(upsertArg).not.toHaveProperty("content_rating")
      expect(upsertArg).not.toHaveProperty("categories")
      expect(upsertArg).not.toHaveProperty("highlighted")
      expect(upsertArg).not.toHaveProperty("ranking")
      expect(upsertArg).not.toHaveProperty("show_in_places")
    })

    it("should not write an image so the world keeps falling back to the latest place thumbnail", () => {
      expect(upsertArg).not.toHaveProperty("image")
    })
  })
})
