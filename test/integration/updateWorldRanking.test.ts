import { randomUUID } from "crypto"

import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import supertest from "supertest"

import PlaceModel from "../../src/entities/Place/model"
import { PlaceAttributes } from "../../src/entities/Place/types"
import WorldModel from "../../src/entities/World/model"
import { cleanTables, closeTestDb, initTestDb } from "../setup/db"
import { createTestApp } from "../setup/server"

const DATA_TEAM_TOKEN = "test-data-team-token"

// Mock env to return a known bearer token for DATA_TEAM_AUTH_TOKEN
// while passing through all other env calls to the real implementation
jest.mock("decentraland-gatsby/dist/utils/env", () => {
  const actual = jest.requireActual("decentraland-gatsby/dist/utils/env")
  const mockEnv = jest
    .fn()
    .mockImplementation((key: string, fallback?: string) => {
      if (key === "DATA_TEAM_AUTH_TOKEN") {
        return DATA_TEAM_TOKEN
      }
      return actual.default(key, fallback)
    })
  return {
    __esModule: true,
    default: mockEnv,
    Env: actual.Env,
    isEnv: actual.isEnv,
    requiredEnv: actual.requiredEnv,
    setupEnv: actual.setupEnv,
  }
})

// Mock authentication to return a fixed user address
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

// Mock Snapshot score to prevent external HTTP calls
jest.mock("../../src/entities/Snapshot/utils", () => ({
  fetchScore: jest.fn().mockResolvedValue(150),
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

const app = createTestApp()
const worldName = "rankingtest.dcl.eth"

async function seedWorld(name: string): Promise<void> {
  await WorldModel.insertWorldIfNotExists({
    world_name: name,
    title: "Ranking Test World",
    description: "A world for testing rankings",
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

describe("when updating the ranking of a world via PUT /worlds/:world_id/ranking", () => {
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

  describe("and the bearer token is missing", () => {
    it("should respond with a 401", async () => {
      const response = await supertest(app)
        .put(`/api/worlds/${worldName}/ranking`)
        .send({ ranking: 1.5 })

      expect(response.status).toBe(401)
    })
  })

  describe("and the bearer token is invalid", () => {
    it("should respond with a 403", async () => {
      const response = await supertest(app)
        .put(`/api/worlds/${worldName}/ranking`)
        .set("Authorization", "Bearer wrong-token")
        .send({ ranking: 1.5 })

      expect(response.status).toBe(403)
    })
  })

  describe("and the bearer token is valid", () => {
    describe("and the world does not exist", () => {
      it("should respond with a 404", async () => {
        const response = await supertest(app)
          .put("/api/worlds/nonexistent.dcl.eth/ranking")
          .set("Authorization", `Bearer ${DATA_TEAM_TOKEN}`)
          .send({ ranking: 1.5 })

        expect(response.status).toBe(404)
      })
    })

    describe("and the world exists", () => {
      beforeEach(async () => {
        await seedWorld(worldName)
        await seedPlaceForWorld(worldName)
      })

      describe("and ranking is a number", () => {
        it("should update the world ranking and persist it", async () => {
          const response = await supertest(app)
            .put(`/api/worlds/${worldName}/ranking`)
            .set("Authorization", `Bearer ${DATA_TEAM_TOKEN}`)
            .send({ ranking: 2.5 })
            .expect(201)

          expect(response.body.ok).toBe(true)
          expect(response.body.data.ranking).toBe(2.5)

          const world = await WorldModel.findByIdWithAggregates(worldName, {
            user: undefined,
          })
          expect(world?.ranking).toBe(2.5)
        })
      })

      describe("and ranking is null", () => {
        beforeEach(async () => {
          await WorldModel.updateRanking(worldName, 5.0)
        })

        it("should set the world ranking to null and persist it", async () => {
          const response = await supertest(app)
            .put(`/api/worlds/${worldName}/ranking`)
            .set("Authorization", `Bearer ${DATA_TEAM_TOKEN}`)
            .send({ ranking: null })
            .expect(201)

          expect(response.body.ok).toBe(true)
          expect(response.body.data.ranking).toBeNull()

          const world = await WorldModel.findByIdWithAggregates(worldName, {
            user: undefined,
          })
          expect(world?.ranking).toBeNull()
        })
      })
    })
  })

  describe("and the body is invalid", () => {
    it("should respond with a 400 for missing ranking field", async () => {
      const response = await supertest(app)
        .put(`/api/worlds/${worldName}/ranking`)
        .set("Authorization", `Bearer ${DATA_TEAM_TOKEN}`)
        .send({})

      expect(response.status).toBe(400)
    })
  })
})
