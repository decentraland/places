import { randomUUID } from "crypto"

import database from "decentraland-gatsby/dist/entities/Database/database"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import supertest from "supertest"

import PlaceModel from "../../src/entities/Place/model"
import { DisabledReason, PlaceAttributes } from "../../src/entities/Place/types"
import WorldModel from "../../src/entities/World/model"
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

const LANTERN_WORLD = "lantern.dcl.eth"

async function seedLanternWorld(): Promise<void> {
  await WorldModel.insertWorldIfNotExists({
    world_name: LANTERN_WORLD,
    title: "Lantern",
    description: "A world for testing opt out",
    show_in_places: false,
    single_player: false,
    skybox_time: null,
    is_private: false,
  })
}

async function seedLanternScene(scene: {
  title: string
  position: string
  disabled_reason: DisabledReason | null
  highlighted?: boolean
  like_score?: number
  deployed_at?: Date
}): Promise<PlaceAttributes> {
  return seedPlace({
    title: scene.title,
    base_position: scene.position,
    positions: [scene.position],
    world: true,
    world_name: LANTERN_WORLD,
    world_id: LANTERN_WORLD,
    disabled: scene.disabled_reason !== null,
    disabled_at: scene.disabled_reason !== null ? new Date() : null,
    disabled_reason: scene.disabled_reason,
    highlighted: scene.highlighted ?? false,
    like_score: scene.like_score ?? null,
    deployed_at: scene.deployed_at ?? new Date(),
  })
}

function titles(response: supertest.Response): string[] {
  return response.body.data.map((p: { title: string }) => p.title)
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

  describe("and the search filter is applied", () => {
    beforeEach(async () => {
      await seedPlace({
        title: "Franky's Tavern",
        base_position: "10,10",
        positions: ["10,10"],
        deployed_at: new Date("2024-01-01"),
      })
      await seedPlace({
        title: "Another Place",
        base_position: "20,20",
        positions: ["20,20"],
        deployed_at: new Date("2024-01-01"),
      })
    })

    it("should find a place when searching with an apostrophe in the name", async () => {
      const response = await supertest(app)
        .get("/api/places")
        .query({ search: "Franky's Tavern" })
        .expect(200)

      expect(response.body.ok).toBe(true)
      expect(response.body.total).toBe(1)
      expect(response.body.data[0].title).toBe("Franky's Tavern")
    })

    it("should find a place when searching without the apostrophe", async () => {
      const response = await supertest(app)
        .get("/api/places")
        .query({ search: "Franky Tavern" })
        .expect(200)

      expect(response.body.ok).toBe(true)
      expect(response.body.total).toBe(1)
      expect(response.body.data[0].title).toBe("Franky's Tavern")
    })
  })
  describe("and the ranking exclusion filter is applied", () => {
    beforeEach(async () => {
      await seedPlace({
        title: "Gathering Hall",
        base_position: "30,30",
        positions: ["30,30"],
        exclude_from_ranking: true,
      })
      await seedPlace({
        title: "Still Ranked",
        base_position: "31,31",
        positions: ["31,31"],
        exclude_from_ranking: false,
      })
    })

    // Without a server side filter the only way to answer "what is excluded" is to page the whole
    // catalogue, and production holds more than 24,000 places against a limit capped at 100. A
    // caller would read one page, find nothing, and report that no place is excluded.
    it("should return only the excluded place", async () => {
      const response = await supertest(app)
        .get("/api/places")
        .query({ only_excluded_from_ranking: "true" })
        .expect(200)

      expect(response.body.data.map((p: { title: string }) => p.title)).toEqual(
        ["Gathering Hall"]
      )
    })

    it("should count only the excluded place", async () => {
      const response = await supertest(app)
        .get("/api/places")
        .query({ only_excluded_from_ranking: "true" })
        .expect(200)

      expect(response.body.total).toBe(1)
    })

    it("should return both places when the filter is not asked for", async () => {
      const response = await supertest(app).get("/api/places").expect(200)

      expect(response.body.total).toBe(2)
    })

    // `/api/places` hands these two orderings to their own handlers, which parse the query
    // themselves. A filter wired only into the default path is silently dropped here.
    // `/api/places` hands most_active to its own handler, which parses the query itself, so a
    // filter wired only into the default path is silently dropped there. The sibling user_visits
    // handler gets the same wiring but cannot be covered: it passes an order_by its own validator
    // rejects, so that ordering answers 400 to everyone, with or without this parameter.
    it.each([["most_active"]])(
      "should still filter when ordering by %s",
      async (orderBy) => {
        const response = await supertest(app)
          .get("/api/places")
          .query({ only_excluded_from_ranking: "true", order_by: orderBy })
          .expect(200)

        expect(
          response.body.data.map((p: { title: string }) => p.title)
        ).toEqual(["Gathering Hall"])
      }
    )
  })

  describe("and the world has scenes disabled for every reason", () => {
    let response: supertest.Response

    beforeEach(async () => {
      await seedLanternWorld()
      await seedLanternScene({
        title: "Opted Out Scene",
        position: "0,0",
        disabled_reason: DisabledReason.OPT_OUT,
        highlighted: true,
      })
      await seedLanternScene({
        title: "Moderated Scene",
        position: "5,5",
        disabled_reason: DisabledReason.MODERATION,
      })
      await seedLanternScene({
        title: "Undeployed Scene",
        position: "6,6",
        disabled_reason: DisabledReason.UNDEPLOYMENT,
      })
      await seedLanternScene({
        title: "Overwritten Scene",
        position: "7,7",
        disabled_reason: DisabledReason.OVERWRITTEN,
      })
    })

    describe("and include_opted_out is true with the world name and positions", () => {
      beforeEach(async () => {
        response = await supertest(app)
          .get("/api/places")
          .query({
            names: LANTERN_WORLD,
            positions: ["0,0", "5,5", "6,6", "7,7"],
            include_opted_out: "true",
          })
      })

      it("should return only the opted-out scene", () => {
        expect(response.status).toBe(200)
        expect(titles(response)).toEqual(["Opted Out Scene"])
      })

      it("should count only the opted-out scene", () => {
        expect(response.body.total).toBe(1)
      })
    })

    describe("and include_opted_out is true with only the world name", () => {
      beforeEach(async () => {
        response = await supertest(app)
          .get("/api/places")
          .query({ names: LANTERN_WORLD, include_opted_out: "true" })
      })

      it("should return only the opted-out scene", () => {
        expect(titles(response)).toEqual(["Opted Out Scene"])
      })
    })

    describe("and include_opted_out is true without a world name", () => {
      beforeEach(async () => {
        response = await supertest(app)
          .get("/api/places")
          .query({ only_highlighted: "true", include_opted_out: "true" })
      })

      it("should not list the opted-out scene", () => {
        expect(response.status).toBe(200)
        expect(response.body.data).toEqual([])
        expect(response.body.total).toBe(0)
      })
    })

    describe("and include_opted_out is not asked for", () => {
      beforeEach(async () => {
        response = await supertest(app)
          .get("/api/places")
          .query({ names: LANTERN_WORLD, positions: ["0,0", "5,5"] })
      })

      it("should return no scenes", () => {
        expect(response.status).toBe(200)
        expect(response.body.data).toEqual([])
        expect(response.body.total).toBe(0)
      })
    })
  })

  describe("and a stale opt_out scene overlaps a live scene of the same world", () => {
    let response: supertest.Response

    beforeEach(async () => {
      await seedLanternWorld()
      // The March 2026 backfill tagged superseded world scenes as opt_out; one that kept a
      // better like score than its replacement would win the default ordering.
      await seedLanternScene({
        title: "Stale Scene",
        position: "0,0",
        disabled_reason: DisabledReason.OPT_OUT,
        like_score: 0.9,
        deployed_at: new Date("2026-01-01T00:00:00Z"),
      })
      await seedLanternScene({
        title: "Live Scene",
        position: "0,0",
        disabled_reason: null,
        like_score: 0.1,
        deployed_at: new Date("2025-06-01T00:00:00Z"),
      })
      response = await supertest(app).get("/api/places").query({
        names: LANTERN_WORLD,
        positions: "0,0",
        include_opted_out: "true",
      })
    })

    it("should return the live scene first", () => {
      expect(titles(response)).toEqual(["Live Scene", "Stale Scene"])
    })
  })

  describe("and a stale opt_out scene ranks higher in a search than the live scene", () => {
    let response: supertest.Response

    beforeEach(async () => {
      await seedLanternWorld()
      await seedLanternScene({
        title: "Lantern Lantern Lantern",
        position: "0,0",
        disabled_reason: DisabledReason.OPT_OUT,
        deployed_at: new Date("2026-01-01T00:00:00Z"),
      })
      await seedLanternScene({
        title: "Lantern Hall",
        position: "0,0",
        disabled_reason: null,
        deployed_at: new Date("2025-06-01T00:00:00Z"),
      })
      response = await supertest(app).get("/api/places").query({
        names: LANTERN_WORLD,
        positions: "0,0",
        search: "lantern",
        include_opted_out: "true",
      })
    })

    it("should return the live scene first", () => {
      expect(titles(response)).toEqual([
        "Lantern Hall",
        "Lantern Lantern Lantern",
      ])
    })
  })

  describe("and two opt_out scenes of the same world overlap", () => {
    let response: supertest.Response

    beforeEach(async () => {
      await seedLanternWorld()
      await seedLanternScene({
        title: "Older Scene",
        position: "0,0",
        disabled_reason: DisabledReason.OPT_OUT,
        like_score: 0.9,
        deployed_at: new Date("2026-01-01T00:00:00Z"),
      })
      await seedLanternScene({
        title: "Newer Scene",
        position: "0,0",
        disabled_reason: DisabledReason.OPT_OUT,
        like_score: 0.1,
        deployed_at: new Date("2026-06-01T00:00:00Z"),
      })
      response = await supertest(app).get("/api/places").query({
        names: LANTERN_WORLD,
        positions: "0,0",
        include_opted_out: "true",
      })
    })

    it("should return the newest deployment first", () => {
      expect(titles(response)).toEqual(["Newer Scene", "Older Scene"])
    })
  })
})
