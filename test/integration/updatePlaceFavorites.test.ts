import { randomUUID } from "crypto"

import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import supertest from "supertest"

import PlaceModel from "../../src/entities/Place/model"
import { PlaceAttributes } from "../../src/entities/Place/types"
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

function createPlaceAttributes(
  overrides: Partial<PlaceAttributes> = {}
): PlaceAttributes {
  return {
    id: randomUUID(),
    title: "Test Place",
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
    created_at: new Date(),
    updated_at: new Date(),
    highlighted: false,
    highlighted_image: null,
    world: false,
    world_name: null,
    world_id: null,
    deployed_at: new Date(),
    textsearch: null,
    creator_address: null,
    sdk: null,
    ranking: 0,
    ...overrides,
  }
}

describe("when updating favorites on a place via PATCH /places/:entity_id/favorites", () => {
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

  describe("and the place does not exist", () => {
    let entityId: string

    beforeEach(() => {
      entityId = randomUUID()
    })

    it("should respond with a 404", async () => {
      const response = await supertest(app)
        .patch(`/api/places/${entityId}/favorites`)
        .send({ favorites: true })

      expect(response.status).toBe(404)
    })
  })

  describe("and the place exists", () => {
    let place: PlaceAttributes

    beforeEach(async () => {
      place = createPlaceAttributes()
      await PlaceModel.create(place)
    })

    describe("and the user adds it as a favorite", () => {
      it("should increment the favorites count and set user_favorite to true", async () => {
        const response = await supertest(app)
          .patch(`/api/places/${place.id}/favorites`)
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
          .patch(`/api/places/${place.id}/favorites`)
          .send({ favorites: true })
          .expect(200)
      })

      it("should decrement the favorites count and set user_favorite to false", async () => {
        const response = await supertest(app)
          .patch(`/api/places/${place.id}/favorites`)
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
          .patch(`/api/places/${place.id}/favorites`)
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
          .patch(`/api/places/${place.id}/favorites`)
          .send({ favorites: true })
          .expect(200)
      })

      it("should reflect the updated count when fetching the place", async () => {
        const response = await supertest(app)
          .get(`/api/places/${place.id}`)
          .expect(200)

        expect(response.body.data.favorites).toBe(1)
        expect(response.body.data.user_favorite).toBe(true)
      })
    })
  })
})
