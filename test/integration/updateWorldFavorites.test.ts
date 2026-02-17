import supertest from "supertest"

import WorldModel from "../../src/entities/World/model"
import { cleanTables, closeTestDb, initTestDb } from "../setup/db"
import { createTestApp } from "../setup/server"

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
const worldName = "favtest.dcl.eth"

async function seedWorld(name: string): Promise<void> {
  await WorldModel.insertWorldIfNotExists({
    world_name: name,
    title: "Favorites Test World",
    description: "A world for testing favorites",
    show_in_places: true,
    single_player: false,
    skybox_time: null,
    is_private: false,
  })
}

describe("when updating favorites on a world via PATCH /worlds/:world_id/favorites", () => {
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

  describe("and the world does not exist", () => {
    it("should respond with a 404", async () => {
      const response = await supertest(app)
        .patch("/api/worlds/nonexistent.dcl.eth/favorites")
        .send({ favorites: true })

      expect(response.status).toBe(404)
    })
  })

  describe("and the world exists", () => {
    beforeEach(async () => {
      await seedWorld(worldName)
    })

    describe("and the user adds it as a favorite", () => {
      it("should increment the favorites count and set user_favorite to true", async () => {
        const response = await supertest(app)
          .patch(`/api/worlds/${worldName}/favorites`)
          .send({ favorites: true })
          .expect(200)

        expect(response.body.ok).toBe(true)
        expect(response.body.data.favorites).toBe(1)
        expect(response.body.data.user_favorite).toBe(true)
      })
    })

    describe("and the user removes it as a favorite", () => {
      beforeEach(async () => {
        await supertest(app)
          .patch(`/api/worlds/${worldName}/favorites`)
          .send({ favorites: true })
          .expect(200)
      })

      it("should decrement the favorites count and set user_favorite to false", async () => {
        const response = await supertest(app)
          .patch(`/api/worlds/${worldName}/favorites`)
          .send({ favorites: false })
          .expect(200)

        expect(response.body.ok).toBe(true)
        expect(response.body.data.favorites).toBe(0)
        expect(response.body.data.user_favorite).toBe(false)
      })
    })

    describe("and the favorite state already matches", () => {
      it("should return the current state without changes", async () => {
        const response = await supertest(app)
          .patch(`/api/worlds/${worldName}/favorites`)
          .send({ favorites: false })
          .expect(200)

        expect(response.body.ok).toBe(true)
        expect(response.body.data.favorites).toBe(0)
        expect(response.body.data.user_favorite).toBe(false)
      })
    })

    describe("and the favorites count is persisted in the database", () => {
      beforeEach(async () => {
        await supertest(app)
          .patch(`/api/worlds/${worldName}/favorites`)
          .send({ favorites: true })
          .expect(200)
      })

      it("should reflect the updated count when fetching the world", async () => {
        const response = await supertest(app)
          .get(`/api/worlds/${worldName}`)
          .expect(200)

        expect(response.body.data.favorites).toBe(1)
        expect(response.body.data.user_favorite).toBe(true)
      })
    })
  })
})

describe("when updating favorites on a world via PATCH /places/:entity_id/favorites (retro-compatibility)", () => {
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

  describe("and the world exists", () => {
    beforeEach(async () => {
      await seedWorld(worldName)
    })

    describe("and the user adds it as a favorite through the places endpoint", () => {
      it("should increment the favorites count and set user_favorite to true", async () => {
        const response = await supertest(app)
          .patch(`/api/places/${worldName}/favorites`)
          .send({ favorites: true })
          .expect(200)

        expect(response.body.ok).toBe(true)
        expect(response.body.data.favorites).toBe(1)
        expect(response.body.data.user_favorite).toBe(true)
      })
    })

    describe("and the favorites count is persisted in the database via the places endpoint", () => {
      beforeEach(async () => {
        await supertest(app)
          .patch(`/api/places/${worldName}/favorites`)
          .send({ favorites: true })
          .expect(200)
      })

      it("should reflect the updated count when fetching the world", async () => {
        const response = await supertest(app)
          .get(`/api/worlds/${worldName}`)
          .expect(200)

        expect(response.body.data.favorites).toBe(1)
        expect(response.body.data.user_favorite).toBe(true)
      })
    })
  })
})
