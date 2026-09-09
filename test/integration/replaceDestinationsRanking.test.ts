import { randomUUID } from "crypto"

import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import supertest from "supertest"

import PlaceModel from "../../src/entities/Place/model"
import { PlaceAttributes } from "../../src/entities/Place/types"
import WorldModel from "../../src/entities/World/model"
import { cleanTables, closeTestDb, initTestDb } from "../setup/db"
import { createTestApp } from "../setup/server"

const DATA_TEAM_TOKEN = "test-data-team-token"
const ADMIN_TOKEN = "test-admin-token"

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
      if (key === "PLACES_ADMIN_AUTH_TOKEN") {
        return "test-admin-token"
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

async function seedWorld(
  name: string,
  overrides: Partial<{ highlighted: boolean; excluded: boolean }> = {}
): Promise<void> {
  await WorldModel.insertWorldIfNotExists({
    world_name: name,
    title: `World ${name}`,
    description: "A world for testing the ranking replace",
    show_in_places: true,
    single_player: false,
    skybox_time: null,
    is_private: false,
  })
  if (overrides.highlighted) {
    await WorldModel.updateHighlighted(name, true)
  }
  if (overrides.excluded) {
    await WorldModel.updateExcludeFromRanking(name, true)
  }
}

async function seedPlace(
  overrides: Partial<PlaceAttributes> = {}
): Promise<PlaceAttributes> {
  const place: PlaceAttributes = {
    id: randomUUID(),
    title: "A Scene",
    description: "A scene for testing the ranking replace",
    image: "https://example.com/image.png",
    owner: null,
    positions: [],
    base_position: "1,1",
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
  await PlaceModel.create(place)
  return place
}

async function rankingOfPlace(id: string): Promise<number | null> {
  const place = await PlaceModel.findByIdWithAggregates(id, { user: undefined })
  return place?.ranking ?? null
}

async function rankingOfWorld(id: string): Promise<number | null> {
  const world = await WorldModel.findByIdWithAggregates(id, { user: undefined })
  return world?.ranking ?? null
}

function replace(entries: unknown[]) {
  return supertest(app)
    .put("/api/destinations/ranking")
    .set("Authorization", `Bearer ${DATA_TEAM_TOKEN}`)
    .send({ entries })
}

describe("when replacing the automated ranking set via PUT /destinations/ranking", () => {
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
      await supertest(app)
        .put("/api/destinations/ranking")
        .send({ entries: [] })
        .expect(401)
    })
  })

  describe("and a destination appears twice in the payload", () => {
    let place: PlaceAttributes

    beforeEach(async () => {
      place = await seedPlace({ ranking: 5 })
    })

    it("should reject the whole request", async () => {
      await replace([
        { entity_type: "place", id: place.id, ranking: 10 },
        { entity_type: "place", id: place.id, ranking: 20 },
      ]).expect(400)
    })

    it("should not write anything", async () => {
      await replace([
        { entity_type: "place", id: place.id, ranking: 10 },
        { entity_type: "place", id: place.id, ranking: 20 },
      ])

      await expect(rankingOfPlace(place.id)).resolves.toBe(5)
    })
  })

  describe("and the payload names some destinations and omits others", () => {
    let named: PlaceAttributes
    let omitted: PlaceAttributes

    beforeEach(async () => {
      named = await seedPlace({ base_position: "2,2", ranking: 0 })
      omitted = await seedPlace({ base_position: "3,3", ranking: 177 })
      await seedWorld("named.dcl.eth")
      await seedWorld("omitted.dcl.eth")
      await WorldModel.updateRanking("omitted.dcl.eth", 190)

      await replace([
        { entity_type: "place", id: named.id, ranking: 122 },
        { entity_type: "world", id: "named.dcl.eth", ranking: 121 },
      ]).expect(201)
    })

    it("should write the ranking of the named place", async () => {
      await expect(rankingOfPlace(named.id)).resolves.toBe(122)
    })

    it("should write the ranking of the named world", async () => {
      await expect(rankingOfWorld("named.dcl.eth")).resolves.toBe(121)
    })

    // This is the whole point of the endpoint: a per-row write cannot say what stopped ranking,
    // so a destination that dropped out of the eligible set keeps its number forever.
    it("should clear the ranking of the omitted place", async () => {
      await expect(rankingOfPlace(omitted.id)).resolves.toBe(0)
    })

    it("should clear the ranking of the omitted world", async () => {
      await expect(rankingOfWorld("omitted.dcl.eth")).resolves.toBe(0)
    })
  })

  describe("and a curated destination is omitted from the payload", () => {
    let highlighted: PlaceAttributes
    let excluded: PlaceAttributes

    beforeEach(async () => {
      highlighted = await seedPlace({
        base_position: "4,4",
        highlighted: true,
        ranking: 1900,
      })
      excluded = await seedPlace({
        base_position: "5,5",
        exclude_from_ranking: true,
        ranking: 42,
      })
      await seedWorld("curatedworld.dcl.eth", { highlighted: true })
      await WorldModel.updateRanking("curatedworld.dcl.eth", 1800)

      await replace([]).expect(201)
    })

    it("should leave the highlighted place's ranking untouched", async () => {
      await expect(rankingOfPlace(highlighted.id)).resolves.toBe(1900)
    })

    it("should leave the excluded place's ranking untouched", async () => {
      await expect(rankingOfPlace(excluded.id)).resolves.toBe(42)
    })

    it("should leave the highlighted world's ranking untouched", async () => {
      await expect(rankingOfWorld("curatedworld.dcl.eth")).resolves.toBe(1800)
    })
  })

  describe("and the payload names a curated destination", () => {
    let highlighted: PlaceAttributes
    let response: Awaited<ReturnType<typeof replace>>

    beforeEach(async () => {
      highlighted = await seedPlace({
        base_position: "6,6",
        highlighted: true,
        ranking: 1900,
      })

      response = await replace([
        { entity_type: "place", id: highlighted.id, ranking: 7 },
      ]).expect(201)
    })

    it("should refuse the write", async () => {
      await expect(rankingOfPlace(highlighted.id)).resolves.toBe(1900)
    })

    it("should report which destination it skipped", () => {
      expect(response.body.data.places.skipped_curated).toEqual([
        highlighted.id,
      ])
    })
  })

  describe("and a place backing a world carries a stale ranking", () => {
    let inner: PlaceAttributes

    beforeEach(async () => {
      await seedWorld("innerworld.dcl.eth")
      inner = await seedPlace({
        base_position: "7,7",
        world: true,
        world_name: "innerworld.dcl.eth",
        world_id: "innerworld.dcl.eth",
        ranking: 24,
      })
    })

    // Browse orders worlds by their own column and never reads the ranking of the places behind
    // them, so a value there is dead weight the clear should remove.
    it("should clear it when the payload omits it", async () => {
      await replace([]).expect(201)

      await expect(rankingOfPlace(inner.id)).resolves.toBe(0)
    })

    // Ranking one is a category error on the caller's side, and silently accepting it would put a
    // number somewhere nothing reads.
    it("should refuse to rank it", async () => {
      const response = await replace([
        { entity_type: "place", id: inner.id, ranking: 30 },
      ]).expect(201)

      expect(response.body.data.places.skipped_world_backed).toEqual([inner.id])
    })
  })

  // The route classifies before writing, so these predicates are unreachable through HTTP. They
  // are the second half of the guarantee: clearing what is missing is dangerous enough that the
  // protection belongs in the same statement as the write, not only in the caller.
  describe("and the write predicate is exercised directly", () => {
    it("should refuse to rank a place backing a world", async () => {
      await seedWorld("directworld.dcl.eth")
      const inner = await seedPlace({
        base_position: "8,8",
        world: true,
        world_name: "directworld.dcl.eth",
        world_id: "directworld.dcl.eth",
      })

      await expect(
        PlaceModel.applyRankingReplace([{ id: inner.id, ranking: 30 }])
      ).resolves.toMatchObject({ applied: 0 })
    })

    it("should refuse to rank a highlighted place", async () => {
      const curated = await seedPlace({
        base_position: "9,9",
        highlighted: true,
        ranking: 1900,
      })

      await expect(
        PlaceModel.applyRankingReplace([{ id: curated.id, ranking: 30 }])
      ).resolves.toMatchObject({ applied: 0 })
    })

    it("should refuse to rank an excluded world", async () => {
      await seedWorld("excludedworld.dcl.eth", { excluded: true })

      await expect(
        WorldModel.applyRankingReplace([
          { id: "excludedworld.dcl.eth", ranking: 30 },
        ])
      ).resolves.toMatchObject({ applied: 0 })
    })

    it("should leave a curated place out of the clear", async () => {
      const curated = await seedPlace({
        base_position: "10,10",
        exclude_from_ranking: true,
        ranking: 42,
      })

      await PlaceModel.applyRankingReplace([])

      await expect(rankingOfPlace(curated.id)).resolves.toBe(42)
    })
  })

  describe("and the payload names a destination that does not exist", () => {
    it("should report it as missing", async () => {
      const absent = randomUUID()

      const response = await replace([
        { entity_type: "place", id: absent, ranking: 9 },
      ]).expect(201)

      expect(response.body.data.places.skipped_missing).toEqual([absent])
    })
  })
})
