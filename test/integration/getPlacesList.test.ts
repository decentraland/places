import { randomUUID } from "crypto"

import database from "decentraland-gatsby/dist/entities/Database/database"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import supertest from "supertest"

import PlaceModel from "../../src/entities/Place/model"
import { PlaceAttributes } from "../../src/entities/Place/types"
import * as hotScenesModule from "../../src/modules/hotScenes"
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

async function seedPlace(
  overrides: Partial<PlaceAttributes> = {}
): Promise<PlaceAttributes> {
  const place = createPlaceAttributes(overrides)
  await PlaceModel.create(place)

  if (place.title || place.description || place.owner) {
    await database.query(
      `UPDATE places SET textsearch = (
        setweight(to_tsvector(coalesce($1, '')), 'A') ||
        setweight(to_tsvector(coalesce($2, '')), 'B') ||
        setweight(to_tsvector(coalesce($3, '')), 'C')
      ) WHERE id = $4`,
      [place.title, place.description, place.owner, place.id] as string[]
    )
  }

  return place
}

describe("when fetching places via GET /api/places", () => {
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

  describe("and no places exist", () => {
    it("should respond with an empty list and total 0", async () => {
      const response = await supertest(app).get("/api/places").expect(200)

      expect(response.body.ok).toBe(true)
      expect(response.body.data).toEqual([])
      expect(response.body.total).toBe(0)
    })
  })

  describe("and the sdk filter is applied", () => {
    let placeSdk6: PlaceAttributes
    let placeSdk6Patch: PlaceAttributes
    let placeSdk7: PlaceAttributes
    let placeSdkNull: PlaceAttributes

    beforeEach(async () => {
      placeSdk6 = await seedPlace({
        title: "Place SDK 6",
        base_position: "0,0",
        positions: ["0,0"],
        sdk: "6",
        deployed_at: new Date("2024-01-01"),
      })
      placeSdk6Patch = await seedPlace({
        title: "Place SDK 6.5",
        base_position: "1,1",
        positions: ["1,1"],
        sdk: "6.5.0",
        deployed_at: new Date("2024-02-01"),
      })
      placeSdk7 = await seedPlace({
        title: "Place SDK 7",
        base_position: "2,2",
        positions: ["2,2"],
        sdk: "7",
        deployed_at: new Date("2025-01-01"),
      })
      placeSdkNull = await seedPlace({
        title: "Legacy Place No SDK",
        base_position: "3,3",
        positions: ["3,3"],
        sdk: null,
        deployed_at: new Date("2023-01-01"),
      })
    })

    describe("with sdk=6", () => {
      it("should return places with SDK 6, 6.x (prefix match), and null SDK (legacy scenes)", async () => {
        const response = await supertest(app)
          .get("/api/places")
          .query({ sdk: "6" })
          .expect(200)

        expect(response.body.ok).toBe(true)
        expect(response.body.total).toBe(3)

        const ids = response.body.data.map((d: { id: string }) => d.id)
        expect(ids).toContain(placeSdk6.id)
        expect(ids).toContain(placeSdk6Patch.id)
        expect(ids).toContain(placeSdkNull.id)
        expect(ids).not.toContain(placeSdk7.id)
      })
    })

    describe("with sdk=7", () => {
      it("should return only places with SDK 7 or 7.x, and not include null SDK", async () => {
        const response = await supertest(app)
          .get("/api/places")
          .query({ sdk: "7" })
          .expect(200)

        expect(response.body.ok).toBe(true)
        expect(response.body.total).toBe(1)
        expect(response.body.data[0].id).toBe(placeSdk7.id)
        expect(response.body.data[0].sdk).toBe("7")
      })
    })
  })
})
