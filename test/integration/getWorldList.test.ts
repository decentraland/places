import { randomUUID } from "crypto"

import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import supertest from "supertest"

import PlaceModel from "../../src/entities/Place/model"
import { PlaceAttributes } from "../../src/entities/Place/types"
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

const app = createTestApp()

async function seedWorld(name: string): Promise<void> {
  await WorldModel.insertWorldIfNotExists({
    world_name: name,
    title: `World ${name}`,
    description: "A test world",
    show_in_places: true,
    single_player: false,
    skybox_time: null,
    is_private: false,
  })
}

async function seedPlaceForWorld(worldId: string): Promise<void> {
  const place: PlaceAttributes = {
    id: randomUUID(),
    title: "World Scene",
    description: "A scene in a world",
    image: "https://example.com/image.png",
    owner: null,
    positions: [],
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
    created_at: new Date(),
    updated_at: new Date(),
    highlighted: false,
    highlighted_image: null,
    world: true,
    world_name: worldId,
    world_id: worldId,
    deployed_at: new Date(),
    textsearch: null,
    creator_address: null,
    sdk: null,
    ranking: 0,
  }
  await PlaceModel.create(place)
}

describe("when fetching worlds via GET /worlds", () => {
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

  describe("and worlds exist", () => {
    beforeEach(async () => {
      await seedWorld("alpha.dcl.eth")
      await seedPlaceForWorld("alpha.dcl.eth")
      await seedWorld("beta.dcl.eth")
      await seedPlaceForWorld("beta.dcl.eth")
    })

    it("should return disabled as false for every world", async () => {
      const response = await supertest(app).get("/api/worlds").expect(200)

      expect(response.body.data.length).toBeGreaterThanOrEqual(2)
      for (const world of response.body.data) {
        expect(world.disabled).toBe(false)
      }
    })

    it("should return disabled_at as null for every world", async () => {
      const response = await supertest(app).get("/api/worlds").expect(200)

      expect(response.body.data.length).toBeGreaterThanOrEqual(2)
      for (const world of response.body.data) {
        expect(world.disabled_at).toBeNull()
      }
    })
  })
})
