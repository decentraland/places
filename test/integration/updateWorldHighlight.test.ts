import { randomUUID } from "crypto"

import isAdmin from "decentraland-gatsby/dist/entities/Auth/isAdmin"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import supertest from "supertest"

import PlaceModel from "../../src/entities/Place/model"
import { PlaceAttributes } from "../../src/entities/Place/types"
import WorldModel from "../../src/entities/World/model"
import { cleanTables, closeTestDb, initTestDb } from "../setup/db"
import { createTestApp } from "../setup/server"

jest.mock("decentraland-gatsby/dist/entities/Auth/isAdmin")

// Mock authentication to return a fixed user address
const adminAddress = "0x1234567890123456789012345678901234567890"

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
const worldName = "highlighttest.dcl.eth"

async function seedWorld(name: string): Promise<void> {
  await WorldModel.insertWorldIfNotExists({
    world_name: name,
    title: "Highlight Test World",
    description: "A world for testing highlights",
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

describe("when updating the highlight status of a world via PUT /worlds/:world_id/highlight", () => {
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

  describe("and the user is not admin", () => {
    beforeEach(() => {
      ;(isAdmin as jest.Mock).mockReturnValue(false)
    })

    it("should respond with a 403", async () => {
      const response = await supertest(app)
        .put(`/api/worlds/${worldName}/highlight`)
        .send({ highlighted: true })

      expect(response.status).toBe(403)
    })
  })

  describe("and the user is admin", () => {
    beforeEach(() => {
      ;(isAdmin as jest.Mock).mockReturnValue(true)
    })

    describe("and the world does not exist", () => {
      it("should respond with a 404", async () => {
        const response = await supertest(app)
          .put("/api/worlds/nonexistent.dcl.eth/highlight")
          .send({ highlighted: true })

        expect(response.status).toBe(404)
      })
    })

    describe("and the world exists", () => {
      beforeEach(async () => {
        await seedWorld(worldName)
        await seedPlaceForWorld(worldName)
      })

      describe("and highlighted is set to true", () => {
        it("should update world highlight to true and persist it", async () => {
          const response = await supertest(app)
            .put(`/api/worlds/${worldName}/highlight`)
            .send({ highlighted: true })
            .expect(201)

          expect(response.body.ok).toBe(true)
          expect(response.body.data.highlighted).toBe(true)

          const world = await WorldModel.findByIdWithAggregates(worldName, {
            user: adminAddress,
          })
          expect(world?.highlighted).toBe(true)
        })
      })

      describe("and highlighted is set to false", () => {
        beforeEach(async () => {
          await WorldModel.updateHighlighted(worldName, true)
        })

        it("should update world highlight to false and persist it", async () => {
          const response = await supertest(app)
            .put(`/api/worlds/${worldName}/highlight`)
            .send({ highlighted: false })
            .expect(201)

          expect(response.body.ok).toBe(true)
          expect(response.body.data.highlighted).toBe(false)

          const world = await WorldModel.findByIdWithAggregates(worldName, {
            user: adminAddress,
          })
          expect(world?.highlighted).toBe(false)
        })
      })
    })
  })

  describe("and the body is invalid", () => {
    beforeEach(() => {
      ;(isAdmin as jest.Mock).mockReturnValue(true)
    })

    it("should respond with a 400 for missing highlighted field", async () => {
      const response = await supertest(app)
        .put(`/api/worlds/${worldName}/highlight`)
        .send({})

      expect(response.status).toBe(400)
    })
  })
})
