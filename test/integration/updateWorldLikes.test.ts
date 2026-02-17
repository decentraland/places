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
const worldName = "liketest.dcl.eth"

async function seedWorld(name: string): Promise<void> {
  await WorldModel.insertWorldIfNotExists({
    world_name: name,
    title: "Likes Test World",
    description: "A world for testing likes",
    show_in_places: true,
    single_player: false,
    skybox_time: null,
    is_private: false,
  })
}

describe("when updating likes on a world via PATCH /worlds/:world_id/likes", () => {
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
        .patch("/api/worlds/nonexistent.dcl.eth/likes")
        .send({ like: true })

      expect(response.status).toBe(404)
    })
  })

  describe("and the world exists", () => {
    beforeEach(async () => {
      await seedWorld(worldName)
    })

    describe("and the user likes the world", () => {
      it("should persist the like and return the updated counts", async () => {
        const response = await supertest(app)
          .patch(`/api/worlds/${worldName}/likes`)
          .send({ like: true })
          .expect(200)

        expect(response.body.ok).toBe(true)
        expect(response.body.data.likes).toBe(1)
        expect(response.body.data.dislikes).toBe(0)
        expect(response.body.data.user_like).toBe(true)
        expect(response.body.data.user_dislike).toBe(false)
      })
    })

    describe("and the user dislikes the world", () => {
      it("should persist the dislike and return the updated counts", async () => {
        const response = await supertest(app)
          .patch(`/api/worlds/${worldName}/likes`)
          .send({ like: false })
          .expect(200)

        expect(response.body.ok).toBe(true)
        expect(response.body.data.likes).toBe(0)
        expect(response.body.data.dislikes).toBe(1)
        expect(response.body.data.user_like).toBe(false)
        expect(response.body.data.user_dislike).toBe(true)
      })
    })

    describe("and the user switches from like to dislike", () => {
      beforeEach(async () => {
        await supertest(app)
          .patch(`/api/worlds/${worldName}/likes`)
          .send({ like: true })
          .expect(200)
      })

      it("should update to a dislike and return the corrected counts", async () => {
        const response = await supertest(app)
          .patch(`/api/worlds/${worldName}/likes`)
          .send({ like: false })
          .expect(200)

        expect(response.body.ok).toBe(true)
        expect(response.body.data.likes).toBe(0)
        expect(response.body.data.dislikes).toBe(1)
        expect(response.body.data.user_like).toBe(false)
        expect(response.body.data.user_dislike).toBe(true)
      })
    })

    describe("and the user removes the like (null)", () => {
      beforeEach(async () => {
        await supertest(app)
          .patch(`/api/worlds/${worldName}/likes`)
          .send({ like: true })
          .expect(200)
      })

      it("should delete the like record and return zeroed counts", async () => {
        const response = await supertest(app)
          .patch(`/api/worlds/${worldName}/likes`)
          .send({ like: null })
          .expect(200)

        expect(response.body.ok).toBe(true)
        expect(response.body.data.likes).toBe(0)
        expect(response.body.data.dislikes).toBe(0)
        expect(response.body.data.user_like).toBe(false)
        expect(response.body.data.user_dislike).toBe(false)
      })
    })

    describe("and the like state already matches", () => {
      beforeEach(async () => {
        await supertest(app)
          .patch(`/api/worlds/${worldName}/likes`)
          .send({ like: true })
          .expect(200)
      })

      it("should return the current state without modifying anything", async () => {
        const response = await supertest(app)
          .patch(`/api/worlds/${worldName}/likes`)
          .send({ like: true })
          .expect(200)

        expect(response.body.ok).toBe(true)
        expect(response.body.data.likes).toBe(1)
        expect(response.body.data.dislikes).toBe(0)
        expect(response.body.data.user_like).toBe(true)
        expect(response.body.data.user_dislike).toBe(false)
      })
    })

    describe("and the likes count is persisted in the database", () => {
      beforeEach(async () => {
        await supertest(app)
          .patch(`/api/worlds/${worldName}/likes`)
          .send({ like: true })
          .expect(200)
      })

      it("should reflect the updated counts when fetching the world", async () => {
        const response = await supertest(app)
          .get(`/api/worlds/${worldName}`)
          .expect(200)

        expect(response.body.data.likes).toBe(1)
        expect(response.body.data.dislikes).toBe(0)
        expect(response.body.data.user_like).toBe(true)
        expect(response.body.data.user_dislike).toBe(false)
      })
    })
  })
})

describe("when updating likes on a world via PATCH /places/:entity_id/likes (retro-compatibility)", () => {
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

    describe("and the user likes the world through the places endpoint", () => {
      it("should persist the like and return the updated counts", async () => {
        const response = await supertest(app)
          .patch(`/api/places/${worldName}/likes`)
          .send({ like: true })
          .expect(200)

        expect(response.body.ok).toBe(true)
        expect(response.body.data.likes).toBe(1)
        expect(response.body.data.dislikes).toBe(0)
        expect(response.body.data.user_like).toBe(true)
        expect(response.body.data.user_dislike).toBe(false)
      })
    })

    describe("and the likes count is persisted in the database via the places endpoint", () => {
      beforeEach(async () => {
        await supertest(app)
          .patch(`/api/places/${worldName}/likes`)
          .send({ like: true })
          .expect(200)
      })

      it("should reflect the updated counts when fetching the world", async () => {
        const response = await supertest(app)
          .get(`/api/worlds/${worldName}`)
          .expect(200)

        expect(response.body.data.likes).toBe(1)
        expect(response.body.data.dislikes).toBe(0)
        expect(response.body.data.user_like).toBe(true)
        expect(response.body.data.user_dislike).toBe(false)
      })
    })
  })
})
