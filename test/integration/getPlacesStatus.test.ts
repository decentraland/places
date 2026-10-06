import { randomUUID } from "crypto"

import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import supertest from "supertest"

import PlaceModel from "../../src/entities/Place/model"
import { DisabledReason, PlaceAttributes } from "../../src/entities/Place/types"
import WorldModel from "../../src/entities/World/model"
import { cleanTables, closeTestDb, initTestDb } from "../setup/db"
import { createTestApp } from "../setup/server"

jest.mock(
  "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth",
  () => {
    const userAddress = "0x1234567890123456789012345678901234567890"
    const mockWithAuth = jest.fn().mockResolvedValue({
      address: userAddress,
      metadata: {},
    })
    return {
      __esModule: true,
      default: jest.fn(() => mockWithAuth),
      withAuth: mockWithAuth,
      withAuthOptional: jest.fn().mockResolvedValue({
        address: userAddress,
        metadata: {},
      }),
    }
  }
)

jest.mock("../../src/entities/Snapshot/utils", () => ({
  fetchScore: jest.fn().mockResolvedValue(150),
}))

jest.mock("../../src/entities/Slack/utils", () => ({
  notifyDowngradeRating: jest.fn(),
  notifyUpgradingRating: jest.fn(),
  notifyError: jest.fn(),
  notifyNewPlace: jest.fn(),
  notifyUpdatePlace: jest.fn(),
  notifyDisablePlaces: jest.fn(),
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

jest.mock("../../src/api/CatalystAPI", () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockReturnValue({
      getAllOperatedLands: jest.fn().mockResolvedValue([]),
    }),
  },
}))

const app = createTestApp()

function createPlaceAttributes(
  overrides: Partial<PlaceAttributes> = {}
): PlaceAttributes {
  return {
    id: randomUUID(),
    title: "Lantern Court",
    description: "A test place",
    image: "https://example.com/image.png",
    owner: null,
    positions: ["0,0"],
    base_position: "0,0",
    contact_name: null,
    contact_email: null,
    content_rating: SceneContentRating.RATING_PENDING,
    categories: [],
    likes: 0,
    dislikes: 0,
    favorites: 0,
    like_rate: null,
    like_score: null,
    disabled: false,
    disabled_at: null,
    disabled_reason: null,
    created_at: new Date(),
    updated_at: new Date(),
    highlighted: false,
    highlighted_image: null,
    exclude_from_ranking: false,
    world: false,
    world_name: null,
    world_id: null,
    deployed_at: new Date(),
    deployment_id: null,
    textsearch: null,
    creator_address: null,
    sdk: null,
    ranking: 0,
    ...overrides,
  }
}

describe("when fetching place status via POST /api/places/status", () => {
  let optedOutPlace: PlaceAttributes
  let response: supertest.Response

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

  describe("and the place is a world scene whose owner opted out", () => {
    beforeEach(async () => {
      await WorldModel.insertWorldIfNotExists({
        world_name: "lantern.dcl.eth",
        title: "Lantern",
        description: "A world for testing opt out",
        show_in_places: false,
        single_player: false,
        skybox_time: null,
        is_private: false,
      })
      optedOutPlace = createPlaceAttributes({
        world: true,
        world_name: "lantern.dcl.eth",
        world_id: "lantern.dcl.eth",
        disabled: true,
        disabled_at: new Date(),
        disabled_reason: DisabledReason.OPT_OUT,
      })
      await PlaceModel.create(optedOutPlace)
      response = await supertest(app)
        .post("/api/places/status")
        .send([optedOutPlace.id])
    })

    it("should respond with the place flagged as disabled by opt out", () => {
      expect(response.status).toBe(201)
      expect(response.body.data).toEqual([
        {
          id: optedOutPlace.id,
          disabled: true,
          disabled_reason: DisabledReason.OPT_OUT,
          world: true,
          world_name: "lantern.dcl.eth",
          base_position: "0,0",
        },
      ])
    })
  })
})
