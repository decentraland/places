import { randomUUID } from "crypto"

import database from "decentraland-gatsby/dist/entities/Database/database"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import supertest from "supertest"

import PlaceModel from "../../src/entities/Place/model"
import { PlaceAttributes } from "../../src/entities/Place/types"
import UserFavoriteModel from "../../src/entities/UserFavorite/model"
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

const MOCK_USER_ADDRESS = "0x1234567890123456789012345678901234567890"
const OWNER_A = "0x000000000000000000000000000000000000000a"
const OWNER_B = "0x000000000000000000000000000000000000000b"
const CREATOR_A = "0x000000000000000000000000000000000000000c"
const CREATOR_B = "0x000000000000000000000000000000000000000d"
const OWNER_JUNK = "0x000000000000000000000000000000000000000e"
const CREATOR_JUNK = "0x000000000000000000000000000000000000000f"

/** A thumbnail that came from the scene itself, i.e. the one shape the filter must keep. */
const REAL_IMAGE = "https://example.com/real-thumbnail.png"
/** The Genesis City map render the Land API stores when a scene ships no navmap thumbnail. */
const MAP_FALLBACK_IMAGE =
  "https://api.decentraland.org/v2/map.png?height=1024&width=1024&selected=1%2C1"
/** The generic thumbnail the deployment pipeline stores for a world scene that ships none. */
const WORLD_DEFAULT_THUMBNAIL_IMAGE =
  "https://worlds-content-server.decentraland.org/contents/bafkreidj26s7aenyxfthfdibnqonzqm5ptc4iamml744gmcyuokewkr76y"
/** One of the placeholder thumbnails listed in `unwantedThumbnailHash`. */
const UNWANTED_THUMBNAIL_IMAGE =
  "https://peer.decentraland.org/content/contents/bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku"

type DestinationsResponse = {
  body: { data: { id: string; world: boolean }[] }
}

/**
 * Ids of the returned destinations, sorted so an assertion does not depend on the feed order.
 * Only meaningful for tests that assert on membership rather than on ranking.
 */
function sortedDestinationIds(response: DestinationsResponse): string[] {
  return response.body.data.map((destination) => destination.id).sort()
}

function sortedPlaceIds(response: DestinationsResponse): string[] {
  return response.body.data
    .filter((destination) => !destination.world)
    .map((destination) => destination.id)
    .sort()
}

function sortedWorldIds(response: DestinationsResponse): string[] {
  return response.body.data
    .filter((destination) => destination.world)
    .map((destination) => destination.id)
    .sort()
}

function createPlaceAttributes(
  overrides: Partial<PlaceAttributes> = {}
): PlaceAttributes {
  return {
    id: randomUUID(),
    title: "Amber Hollow",
    description: "A test place",
    image: "https://example.com/image.png",
    owner: null,
    positions: ["0,0"],
    base_position: "0,0",
    // Every real scene names someone, and the feed now requires it, so the default fixture has to
    // as well. The tests that exercise the identity rule override this back to null.
    contact_name: "Amber Hollow Studio",
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

async function seedWorldWithOptions(
  name: string,
  overrides: {
    title?: string
    description?: string
    image?: string | null
    highlighted?: boolean
    ranking?: number
    created_at?: Date
    updated_at?: Date
    owner?: string
    categories?: string[]
  } = {}
): Promise<void> {
  await WorldModel.insertWorldIfNotExists({
    world_name: name,
    title: overrides.title ?? "Solstice Gallery",
    description: overrides.description ?? "A test world",
    image: overrides.image,
    show_in_places: true,
    single_player: false,
    skybox_time: null,
    is_private: false,
    owner: overrides.owner,
    categories: overrides.categories,
  })

  const setClauses: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (overrides.highlighted !== undefined) {
    setClauses.push(`highlighted = $${paramIndex++}`)
    values.push(overrides.highlighted)
  }
  if (overrides.ranking !== undefined) {
    setClauses.push(`ranking = $${paramIndex++}`)
    values.push(overrides.ranking)
  }
  if (overrides.created_at !== undefined) {
    setClauses.push(`created_at = $${paramIndex++}`)
    values.push(overrides.created_at)
  }
  if (overrides.updated_at !== undefined) {
    setClauses.push(`updated_at = $${paramIndex++}`)
    values.push(overrides.updated_at)
  }

  if (setClauses.length > 0) {
    const worldId = name.toLowerCase()
    values.push(worldId)
    await database.query(
      `UPDATE worlds SET ${setClauses.join(", ")} WHERE id = $${paramIndex}`,
      values as string[]
    )
  }
}

async function seedWorldPlace(
  worldName: string,
  overrides: Partial<PlaceAttributes> = {}
): Promise<PlaceAttributes> {
  return seedPlace({
    world: true,
    world_name: worldName,
    world_id: worldName,
    base_position: "0,0",
    positions: [],
    ...overrides,
  })
}

describe("when fetching destinations via GET /destinations", () => {
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

  describe("and no destinations exist", () => {
    it("should respond with an empty list and total 0", async () => {
      const response = await supertest(app).get("/api/destinations").expect(200)

      expect(response.body.ok).toBe(true)
      expect(response.body.data).toEqual([])
      expect(response.body.total).toBe(0)
    })
  })

  describe("and both places and worlds exist", () => {
    let placeGenesis: PlaceAttributes
    let placeMuseum: PlaceAttributes
    let placeGarden: PlaceAttributes

    beforeEach(async () => {
      placeGenesis = await seedPlace({
        title: "Genesis Plaza",
        description: "The central hub of Decentraland",
        base_position: "0,0",
        positions: ["0,0"],
        owner: OWNER_A,
        creator_address: CREATOR_A,
        highlighted: true,
        ranking: 10,
        like_score: 50,
        sdk: "7",
        created_at: new Date("2025-01-01"),
        updated_at: new Date("2025-06-01"),
        deployed_at: new Date("2025-01-01"),
      })

      placeMuseum = await seedPlace({
        title: "Museum District",
        description: "Art and culture exhibition space",
        base_position: "12,12",
        positions: ["12,12"],
        owner: OWNER_B,
        creator_address: CREATOR_B,
        highlighted: false,
        ranking: 0,
        like_score: 30,
        sdk: "7",
        created_at: new Date("2024-01-01"),
        updated_at: new Date("2024-06-01"),
        deployed_at: new Date("2024-01-01"),
      })

      placeGarden = await seedPlace({
        title: "Hidden Garden",
        description: "A peaceful garden retreat",
        base_position: "20,20",
        positions: ["20,20"],
        owner: OWNER_A,
        creator_address: CREATOR_A,
        highlighted: false,
        ranking: 0,
        like_score: 10,
        sdk: "6",
        created_at: new Date("2023-01-01"),
        updated_at: new Date("2023-06-01"),
        deployed_at: new Date("2023-01-01"),
      })

      await seedPlace({
        title: "Disabled Place",
        base_position: "30,30",
        positions: ["30,30"],
        disabled: true,
      })

      await database.query(
        `INSERT INTO place_categories (place_id, category_id) VALUES ($1, $2)`,
        [placeGenesis.id, "art"] as string[]
      )
      await database.query(
        `INSERT INTO place_categories (place_id, category_id) VALUES ($1, $2)`,
        [placeMuseum.id, "education"] as string[]
      )
      await database.query(
        `INSERT INTO place_categories (place_id, category_id) VALUES ($1, $2)`,
        [placeGarden.id, "art"] as string[]
      )

      await seedWorldWithOptions("highlighted.dcl.eth", {
        title: "Highlighted World",
        description: "A featured world experience",
        highlighted: true,
        ranking: 8,
        owner: OWNER_A,
        categories: ["social"],
        created_at: new Date("2025-03-01"),
        updated_at: new Date("2025-07-01"),
      })
      await seedWorldPlace("highlighted.dcl.eth", {
        sdk: "7",
        creator_address: CREATOR_A,
      })

      await seedWorldWithOptions("regular.dcl.eth", {
        title: "Regular World",
        description: "An ordinary world experience",
        highlighted: false,
        ranking: 0,
        owner: OWNER_B,
        categories: ["game"],
        created_at: new Date("2024-03-01"),
        updated_at: new Date("2024-07-01"),
      })
      await seedWorldPlace("regular.dcl.eth", {
        sdk: "7",
        creator_address: CREATOR_B,
      })

      await seedWorldWithOptions("searchable.dcl.eth", {
        title: "Searchable Galaxy World",
        description: "A world for galaxy explorers",
        highlighted: false,
        ranking: 0,
        categories: ["art"],
        created_at: new Date("2023-03-01"),
        updated_at: new Date("2023-07-01"),
      })
      await seedWorldPlace("searchable.dcl.eth", {
        sdk: "6",
        creator_address: CREATOR_A,
      })
    })

    it("should return both places and worlds", async () => {
      const response = await supertest(app).get("/api/destinations").expect(200)

      expect(response.body.ok).toBe(true)

      const places = response.body.data.filter(
        (d: { world: boolean }) => d.world === false
      )
      const worlds = response.body.data.filter(
        (d: { world: boolean }) => d.world === true
      )

      expect(places.length).toBe(3)
      expect(worlds.length).toBe(3)
      expect(response.body.total).toBe(6)
    })

    it("should not return disabled destinations", async () => {
      const response = await supertest(app).get("/api/destinations").expect(200)

      const disabledResult = response.body.data.find(
        (d: { title: string }) => d.title === "Disabled Place"
      )
      expect(disabledResult).toBeUndefined()
    })

    it("should return disabled as false for world destinations", async () => {
      const response = await supertest(app).get("/api/destinations").expect(200)

      const worlds = response.body.data.filter(
        (d: { world: boolean }) => d.world === true
      )

      expect(worlds.length).toBeGreaterThanOrEqual(1)
      for (const world of worlds) {
        expect(world.disabled).toBe(false)
      }
    })

    it("should return disabled_at as null for world destinations", async () => {
      const response = await supertest(app).get("/api/destinations").expect(200)

      const worlds = response.body.data.filter(
        (d: { world: boolean }) => d.world === true
      )

      expect(worlds.length).toBeGreaterThanOrEqual(1)
      for (const world of worlds) {
        expect(world.disabled_at).toBeNull()
      }
    })

    it("should return highlighted destinations before non-highlighted ones", async () => {
      const response = await supertest(app).get("/api/destinations").expect(200)

      const firstHighlightedIndex = response.body.data.findIndex(
        (d: { highlighted: boolean }) => d.highlighted === true
      )
      const lastNonHighlightedIndex = response.body.data.findLastIndex(
        (d: { highlighted: boolean }) => d.highlighted === false
      )

      expect(firstHighlightedIndex).toBeLessThan(lastNonHighlightedIndex)
    })

    it("should return higher-ranked destinations before lower-ranked ones within the same highlighted group", async () => {
      const response = await supertest(app)
        .get("/api/destinations")
        .query({ only_places: "true" })
        .expect(200)

      const nonHighlighted = response.body.data.filter(
        (d: { highlighted: boolean }) => d.highlighted === false
      )

      for (let i = 0; i < nonHighlighted.length - 1; i++) {
        expect(nonHighlighted[i].ranking).toBeGreaterThanOrEqual(
          nonHighlighted[i + 1].ranking
        )
      }
    })

    describe("and the only_places filter is applied", () => {
      it("should return only places and exclude worlds", async () => {
        const response = await supertest(app)
          .get("/api/destinations")
          .query({ only_places: "true" })
          .expect(200)

        expect(response.body.ok).toBe(true)
        expect(
          response.body.data.every((d: { world: boolean }) => d.world === false)
        ).toBe(true)
        expect(response.body.total).toBe(3)
      })

      describe("and order_by is created_at", () => {
        it("should order places by created_at descending by default", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_places: "true", order_by: "created_at" })
            .expect(200)

          const nonHighlighted = response.body.data.filter(
            (d: { highlighted: boolean }) => !d.highlighted
          )
          expect(nonHighlighted[0].id).toBe(placeMuseum.id)
          expect(nonHighlighted[1].id).toBe(placeGarden.id)
        })

        describe("and order is asc", () => {
          it("should order places by created_at ascending", async () => {
            const response = await supertest(app)
              .get("/api/destinations")
              .query({
                only_places: "true",
                order_by: "created_at",
                order: "asc",
              })
              .expect(200)

            const nonHighlighted = response.body.data.filter(
              (d: { highlighted: boolean }) => !d.highlighted
            )
            expect(nonHighlighted[0].id).toBe(placeGarden.id)
            expect(nonHighlighted[1].id).toBe(placeMuseum.id)
          })
        })
      })

      describe("and order_by is updated_at", () => {
        it("should order places by updated_at descending by default", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_places: "true", order_by: "updated_at" })
            .expect(200)

          const nonHighlighted = response.body.data.filter(
            (d: { highlighted: boolean }) => !d.highlighted
          )
          expect(nonHighlighted[0].id).toBe(placeMuseum.id)
          expect(nonHighlighted[1].id).toBe(placeGarden.id)
        })
      })

      describe("and the only_highlighted filter is applied", () => {
        it("should return only highlighted places", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_places: "true", only_highlighted: "true" })
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(1)
          expect(response.body.data[0].id).toBe(placeGenesis.id)
          expect(response.body.data[0].highlighted).toBe(true)
          expect(response.body.data[0].world).toBe(false)
        })
      })

      describe("and the owner filter is applied", () => {
        it("should return only places belonging to the specified owner", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_places: "true", owner: OWNER_A })
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(2)
          expect(
            response.body.data.every(
              (d: { id: string }) =>
                d.id === placeGenesis.id || d.id === placeGarden.id
            )
          ).toBe(true)
        })
      })

      describe("and the creator_address filter is applied", () => {
        it("should return only places with the matching creator address", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_places: "true", creator_address: CREATOR_B })
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(1)
          expect(response.body.data[0].id).toBe(placeMuseum.id)
        })
      })

      describe("and the sdk filter is applied", () => {
        it("should return only places with the specified SDK version", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_places: "true", sdk: "6" })
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(1)
          expect(response.body.data[0].id).toBe(placeGarden.id)
        })
      })

      describe("and the search filter is applied", () => {
        it("should return places matching the search text", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_places: "true", search: "genesis" })
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(1)
          expect(response.body.data[0].id).toBe(placeGenesis.id)
        })
      })

      describe("and the pointer filter is applied", () => {
        beforeEach(async () => {
          await database.query(
            `INSERT INTO place_positions (position, base_position)
             VALUES ($1, $2)
             ON CONFLICT (position) DO NOTHING`,
            ["0,0", placeGenesis.base_position] as string[]
          )
        })

        it("should return only places at the specified position", async () => {
          const response = await supertest(app)
            .get("/api/destinations?only_places=true&pointer=0%2C0")
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(1)
          expect(response.body.data[0].id).toBe(placeGenesis.id)
        })
      })

      describe("and the categories filter is applied", () => {
        it("should return only places matching the category", async () => {
          const response = await supertest(app)
            .get("/api/destinations?only_places=true&categories=art")
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(2)

          const ids = response.body.data.map((d: { id: string }) => d.id)
          expect(ids).toContain(placeGenesis.id)
          expect(ids).toContain(placeGarden.id)
        })
      })
    })

    describe("and the only_worlds filter is applied", () => {
      it("should return only worlds and exclude places", async () => {
        const response = await supertest(app)
          .get("/api/destinations")
          .query({ only_worlds: "true" })
          .expect(200)

        expect(response.body.ok).toBe(true)
        expect(
          response.body.data.every((d: { world: boolean }) => d.world === true)
        ).toBe(true)
        expect(response.body.total).toBe(3)
      })

      describe("and order_by is created_at", () => {
        it("should order worlds by created_at descending by default", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_worlds: "true", order_by: "created_at" })
            .expect(200)

          const nonHighlighted = response.body.data.filter(
            (d: { highlighted: boolean }) => !d.highlighted
          )
          expect(nonHighlighted[0].title).toBe("Regular World")
          expect(nonHighlighted[1].title).toBe("Searchable Galaxy World")
        })

        describe("and order is asc", () => {
          it("should order worlds by created_at ascending", async () => {
            const response = await supertest(app)
              .get("/api/destinations")
              .query({
                only_worlds: "true",
                order_by: "created_at",
                order: "asc",
              })
              .expect(200)

            const nonHighlighted = response.body.data.filter(
              (d: { highlighted: boolean }) => !d.highlighted
            )
            expect(nonHighlighted[0].title).toBe("Searchable Galaxy World")
            expect(nonHighlighted[1].title).toBe("Regular World")
          })
        })
      })

      describe("and order_by is updated_at", () => {
        it("should order worlds by updated_at descending by default", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_worlds: "true", order_by: "updated_at" })
            .expect(200)

          const nonHighlighted = response.body.data.filter(
            (d: { highlighted: boolean }) => !d.highlighted
          )
          expect(nonHighlighted[0].title).toBe("Regular World")
          expect(nonHighlighted[1].title).toBe("Searchable Galaxy World")
        })
      })

      describe("and the only_highlighted filter is applied", () => {
        it("should return only highlighted worlds", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_worlds: "true", only_highlighted: "true" })
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(1)
          expect(response.body.data[0].title).toBe("Highlighted World")
          expect(response.body.data[0].highlighted).toBe(true)
          expect(response.body.data[0].world).toBe(true)
        })
      })

      describe("and the owner filter is applied", () => {
        it("should return only worlds belonging to the specified owner", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_worlds: "true", owner: OWNER_B })
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(1)
          expect(response.body.data[0].title).toBe("Regular World")
        })
      })

      describe("and the world_names filter is applied", () => {
        it("should return only worlds matching the exact names", async () => {
          const response = await supertest(app)
            .get(
              "/api/destinations?only_worlds=true&world_names=regular.dcl.eth"
            )
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(1)
          expect(response.body.data[0].title).toBe("Regular World")
        })
      })

      describe("and the names filter is applied", () => {
        it("should return worlds matching the partial name", async () => {
          const response = await supertest(app)
            .get("/api/destinations?only_worlds=true&names=searchable")
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(1)
          expect(response.body.data[0].title).toBe("Searchable Galaxy World")
        })
      })

      describe("and the search filter is applied", () => {
        it("should return worlds matching the search text", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_worlds: "true", search: "galaxy" })
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(1)
          expect(response.body.data[0].title).toBe("Searchable Galaxy World")
        })
      })

      describe("and the categories filter is applied", () => {
        it("should return only worlds matching the category", async () => {
          const response = await supertest(app)
            .get("/api/destinations?only_worlds=true&categories=art")
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(1)
          expect(response.body.data[0].title).toBe("Searchable Galaxy World")
        })
      })

      describe("and the sdk filter is applied", () => {
        it("should return only worlds that have a linked place with the specified SDK", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_worlds: "true", sdk: "6" })
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(1)
          expect(response.body.data[0].title).toBe("Searchable Galaxy World")
        })
      })

      describe("and the creator_address filter is applied", () => {
        it("should return only worlds that have a linked place with the specified creator address", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_worlds: "true", creator_address: CREATOR_B })
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(1)
          expect(response.body.data[0].title).toBe("Regular World")
        })
      })
    })

    describe("and neither the only_places nor the only_worlds filter is applied", () => {
      describe("and the only_highlighted filter is applied", () => {
        it("should return only highlighted destinations from both places and worlds", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_highlighted: "true" })
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(2)
          expect(
            response.body.data.every(
              (d: { highlighted: boolean }) => d.highlighted === true
            )
          ).toBe(true)

          const titles = response.body.data.map(
            (d: { title: string }) => d.title
          )
          expect(titles).toContain("Genesis Plaza")
          expect(titles).toContain("Highlighted World")
        })
      })

      describe("and the search filter is applied", () => {
        it("should return matching places from the search text", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ search: "museum" })
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(1)
          expect(response.body.data[0].id).toBe(placeMuseum.id)
        })

        it("should return matching worlds from the search text", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ search: "galaxy" })
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(1)
          expect(response.body.data[0].title).toBe("Searchable Galaxy World")
          expect(response.body.data[0].world).toBe(true)
        })

        describe("and the search term is less than 3 characters", () => {
          it("should return an empty list", async () => {
            const response = await supertest(app)
              .get("/api/destinations")
              .query({ search: "ab" })
              .expect(200)

            expect(response.body.ok).toBe(true)
            expect(response.body.data).toEqual([])
            expect(response.body.total).toBe(0)
          })
        })
      })

      describe("and the owner filter is applied", () => {
        it("should return both places and worlds belonging to the owner", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ owner: OWNER_A })
            .expect(200)

          expect(response.body.ok).toBe(true)

          const placeResults = response.body.data.filter(
            (d: { world: boolean }) => !d.world
          )
          const worldResults = response.body.data.filter(
            (d: { world: boolean }) => d.world
          )

          expect(placeResults.length).toBe(2)
          expect(worldResults.length).toBe(1)
          expect(worldResults[0].title).toBe("Highlighted World")
        })
      })

      describe("and the categories filter is applied", () => {
        it("should return both places and worlds matching the category", async () => {
          const response = await supertest(app)
            .get("/api/destinations?categories=art")
            .expect(200)

          expect(response.body.ok).toBe(true)

          const placeResults = response.body.data.filter(
            (d: { world: boolean }) => !d.world
          )
          const worldResults = response.body.data.filter(
            (d: { world: boolean }) => d.world
          )

          expect(placeResults.length).toBe(2)
          const placeIds = placeResults.map((d: { id: string }) => d.id)
          expect(placeIds).toContain(placeGenesis.id)
          expect(placeIds).toContain(placeGarden.id)

          expect(worldResults.length).toBe(1)
          expect(worldResults[0].title).toBe("Searchable Galaxy World")
        })
      })

      describe("and the sdk filter is applied", () => {
        it("should filter both places and worlds by SDK", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ sdk: "6" })
            .expect(200)

          expect(response.body.ok).toBe(true)

          const placeResults = response.body.data.filter(
            (d: { world: boolean }) => !d.world
          )
          const worldResults = response.body.data.filter(
            (d: { world: boolean }) => d.world
          )

          expect(placeResults).toHaveLength(1)
          expect(placeResults[0].id).toBe(placeGarden.id)
          expect(worldResults).toHaveLength(1)
          expect(worldResults[0].title).toBe("Searchable Galaxy World")
        })
      })

      describe("and the creator_address filter is applied", () => {
        it("should filter both places and worlds by creator address", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ creator_address: CREATOR_B })
            .expect(200)

          expect(response.body.ok).toBe(true)

          const placeResults = response.body.data.filter(
            (d: { world: boolean }) => !d.world
          )
          const worldResults = response.body.data.filter(
            (d: { world: boolean }) => d.world
          )

          expect(placeResults).toHaveLength(1)
          expect(placeResults[0].id).toBe(placeMuseum.id)
          expect(worldResults).toHaveLength(1)
          expect(worldResults[0].title).toBe("Regular World")
        })
      })

      describe("and the pointer filter is applied", () => {
        beforeEach(async () => {
          await database.query(
            `INSERT INTO place_positions (position, base_position)
             VALUES ($1, $2)
             ON CONFLICT (position) DO NOTHING`,
            ["12,12", placeMuseum.base_position] as string[]
          )
        })

        it("should filter places by position and return all worlds", async () => {
          const response = await supertest(app)
            .get("/api/destinations?pointer=12%2C12")
            .expect(200)

          expect(response.body.ok).toBe(true)

          const placeResults = response.body.data.filter(
            (d: { world: boolean }) => !d.world
          )
          const worldResults = response.body.data.filter(
            (d: { world: boolean }) => d.world
          )

          expect(placeResults).toHaveLength(1)
          expect(placeResults[0].id).toBe(placeMuseum.id)
          expect(worldResults).toHaveLength(3)
        })
      })

      describe("and the world_names filter is applied", () => {
        it("should filter worlds by exact name and return all places", async () => {
          const response = await supertest(app)
            .get("/api/destinations?world_names=regular.dcl.eth")
            .expect(200)

          expect(response.body.ok).toBe(true)

          const placeResults = response.body.data.filter(
            (d: { world: boolean }) => !d.world
          )
          const worldResults = response.body.data.filter(
            (d: { world: boolean }) => d.world
          )

          expect(placeResults).toHaveLength(3)
          expect(worldResults).toHaveLength(1)
          expect(worldResults[0].title).toBe("Regular World")
        })
      })

      describe("and the names filter is applied", () => {
        it("should filter worlds by partial name", async () => {
          const response = await supertest(app)
            .get("/api/destinations?names=searchable")
            .expect(200)

          expect(response.body.ok).toBe(true)

          const worldResults = response.body.data.filter(
            (d: { world: boolean }) => d.world
          )

          expect(worldResults).toHaveLength(1)
          expect(worldResults[0].title).toBe("Searchable Galaxy World")
        })
      })

      describe("and order_by is created_at", () => {
        it("should order all destinations by created_at descending by default", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ order_by: "created_at" })
            .expect(200)

          const nonHighlighted = response.body.data.filter(
            (d: { highlighted: boolean }) => !d.highlighted
          )

          for (let i = 0; i < nonHighlighted.length - 1; i++) {
            const current = new Date(nonHighlighted[i].created_at).getTime()
            const next = new Date(nonHighlighted[i + 1].created_at).getTime()
            expect(current).toBeGreaterThanOrEqual(next)
          }
        })

        describe("and order is asc", () => {
          it("should order all destinations by created_at ascending", async () => {
            const response = await supertest(app)
              .get("/api/destinations")
              .query({ order_by: "created_at", order: "asc" })
              .expect(200)

            const nonHighlighted = response.body.data.filter(
              (d: { highlighted: boolean }) => !d.highlighted
            )

            for (let i = 0; i < nonHighlighted.length - 1; i++) {
              const current = new Date(nonHighlighted[i].created_at).getTime()
              const next = new Date(nonHighlighted[i + 1].created_at).getTime()
              expect(current).toBeLessThanOrEqual(next)
            }
          })
        })
      })

      describe("and order_by is updated_at", () => {
        it("should order all destinations by updated_at descending by default", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ order_by: "updated_at" })
            .expect(200)

          const nonHighlighted = response.body.data.filter(
            (d: { highlighted: boolean }) => !d.highlighted
          )

          for (let i = 0; i < nonHighlighted.length - 1; i++) {
            const current = new Date(nonHighlighted[i].updated_at).getTime()
            const next = new Date(nonHighlighted[i + 1].updated_at).getTime()
            expect(current).toBeGreaterThanOrEqual(next)
          }
        })
      })

      describe("and pagination is applied", () => {
        describe("when limit is set to 2", () => {
          let limitValue: number

          beforeEach(() => {
            limitValue = 2
          })

          it("should return only 2 results from both places and worlds", async () => {
            const response = await supertest(app)
              .get("/api/destinations")
              .query({ limit: limitValue })
              .expect(200)

            expect(response.body.ok).toBe(true)
            expect(response.body.data).toHaveLength(2)
            expect(response.body.total).toBe(6)
          })
        })

        describe("when limit is 2 and offset is 4", () => {
          let limitValue: number
          let offsetValue: number

          beforeEach(() => {
            limitValue = 2
            offsetValue = 4
          })

          it("should return the last 2 results from both places and worlds", async () => {
            const response = await supertest(app)
              .get("/api/destinations")
              .query({ limit: limitValue, offset: offsetValue })
              .expect(200)

            expect(response.body.ok).toBe(true)
            expect(response.body.data).toHaveLength(2)
            expect(response.body.total).toBe(6)
          })
        })

        describe("when fetching two pages of 3 results each", () => {
          let limitValue: number

          beforeEach(() => {
            limitValue = 3
          })

          it("should return non-overlapping results across pages", async () => {
            const page1 = await supertest(app)
              .get("/api/destinations")
              .query({ limit: limitValue, offset: 0 })
              .expect(200)

            const page2 = await supertest(app)
              .get("/api/destinations")
              .query({ limit: limitValue, offset: limitValue })
              .expect(200)

            const page1Ids = page1.body.data.map((d: { id: string }) => d.id)
            const page2Ids = page2.body.data.map((d: { id: string }) => d.id)

            expect(page1Ids).toHaveLength(3)
            expect(page2Ids).toHaveLength(3)
            expect(new Set([...page1Ids, ...page2Ids]).size).toBe(6)
          })
        })
      })
    })

    describe("and the only_favorites filter is applied", () => {
      describe("and the user has favorited a place and a world", () => {
        beforeEach(async () => {
          await UserFavoriteModel.create({
            user: MOCK_USER_ADDRESS,
            user_activity: 100,
            entity_id: placeGenesis.id,
            created_at: new Date(),
          })
          await UserFavoriteModel.create({
            user: MOCK_USER_ADDRESS,
            user_activity: 100,
            entity_id: "highlighted.dcl.eth",
            created_at: new Date(),
          })
        })

        it("should return only the favorited destinations", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_favorites: "true" })
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(2)

          const ids = response.body.data.map((d: { id: string }) => d.id)
          expect(ids).toContain(placeGenesis.id)
          expect(ids).toContain("highlighted.dcl.eth")
        })

        it("should mark user_favorite as true on the returned destinations", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_favorites: "true" })
            .expect(200)

          expect(
            response.body.data.every(
              (d: { user_favorite: boolean }) => d.user_favorite === true
            )
          ).toBe(true)
        })
      })

      describe("and the user has no favorites", () => {
        it("should return an empty list", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_favorites: "true" })
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(0)
          expect(response.body.total).toBe(0)
        })
      })
    })

    describe("and order_by is like_score", () => {
      it("should order destinations by like_score descending by default", async () => {
        const response = await supertest(app)
          .get("/api/destinations")
          .query({ order_by: "like_score" })
          .expect(200)

        expect(response.body.ok).toBe(true)

        const nonHighlighted = response.body.data.filter(
          (d: { highlighted: boolean; ranking: number }) =>
            !d.highlighted && d.ranking === 0
        )

        for (let i = 0; i < nonHighlighted.length - 1; i++) {
          const current = nonHighlighted[i].like_score ?? -Infinity
          const next = nonHighlighted[i + 1].like_score ?? -Infinity
          expect(current).toBeGreaterThanOrEqual(next)
        }
      })

      describe("and order is asc", () => {
        it("should order destinations by like_score ascending", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ order_by: "like_score", order: "asc" })
            .expect(200)

          expect(response.body.ok).toBe(true)

          const nonHighlighted = response.body.data.filter(
            (d: { highlighted: boolean; ranking: number }) =>
              !d.highlighted && d.ranking === 0
          )

          for (let i = 0; i < nonHighlighted.length - 1; i++) {
            const current = nonHighlighted[i].like_score ?? -Infinity
            const next = nonHighlighted[i + 1].like_score ?? -Infinity
            expect(current).toBeLessThanOrEqual(next)
          }
        })
      })
    })

    describe("and order_by is most_active", () => {
      beforeEach(() => {
        ;(hotScenesModule.getHotScenes as jest.Mock).mockReturnValue([
          {
            id: "hot-scene-museum",
            name: "Museum Hot Scene",
            baseCoords: [10, 10],
            usersTotalCount: 5,
            parcels: [[10, 10]],
            realms: [],
          },
          {
            id: "hot-scene-garden",
            name: "Garden Hot Scene",
            baseCoords: [20, 20],
            usersTotalCount: 15,
            parcels: [[20, 20]],
            realms: [],
          },
        ])
      })

      describe("and the list includes both most_active and non-most_active destinations", () => {
        it("should return most_active destinations before non-most_active ones", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ order_by: "most_active", offset: 0, limit: 100 })
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(Array.isArray(response.body.data)).toBe(true)
          expect(typeof response.body.total).toBe("number")

          const data = response.body.data as Array<{
            id: string
            base_position: string
            world: boolean
          }>
          const indexOf = (predicate: (d: (typeof data)[0]) => boolean) =>
            data.findIndex(predicate)
          const indexMuseum = indexOf(
            (d) => !d.world && d.base_position === "12,12"
          )
          const indexGarden = indexOf(
            (d) => !d.world && d.base_position === "20,20"
          )
          const indexRegularWorld = indexOf((d) => d.id === "regular.dcl.eth")

          expect(indexMuseum).toBeGreaterThanOrEqual(0)
          expect(indexGarden).toBeGreaterThanOrEqual(0)
          expect(indexRegularWorld).toBeGreaterThanOrEqual(0)
          // is_most_active_place DESC: both hot-scene places must appear before the non–most_active world
          expect(indexMuseum).toBeLessThan(indexRegularWorld)
          expect(indexGarden).toBeLessThan(indexRegularWorld)
        })
      })

      describe("and there are multiple most_active places", () => {
        it("should order them by live connected users descending", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ order_by: "most_active", offset: 0, limit: 100 })
            .expect(200)

          const data = response.body.data as Array<{
            id: string
            base_position: string
            world: boolean
            like_score: number | null
          }>
          const mostActivePlaces = data.filter(
            (d) =>
              !d.world &&
              (d.base_position === "12,12" || d.base_position === "20,20")
          )
          const indexMuseum = mostActivePlaces.findIndex(
            (d) => d.base_position === "12,12"
          )
          const indexGarden = mostActivePlaces.findIndex(
            (d) => d.base_position === "20,20"
          )
          // Garden (20,20) has 15 live users vs Museum (10,10) with 5, so it ranks first
          // even though Museum has the higher like_score (30 vs 10). See #7344.
          expect(indexGarden).toBeLessThan(indexMuseum)
          expect(mostActivePlaces[indexGarden].base_position).toBe("20,20")
          expect(mostActivePlaces[indexMuseum].base_position).toBe("12,12")
        })
      })
    })

    describe("and pagination is applied", () => {
      describe("when limit is set to 2", () => {
        let limitValue: number

        beforeEach(() => {
          limitValue = 2
        })

        it("should return only 2 results", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ limit: limitValue })
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(2)
          expect(response.body.total).toBe(6)
        })
      })

      describe("when limit is 2 and offset is 4", () => {
        let limitValue: number
        let offsetValue: number

        beforeEach(() => {
          limitValue = 2
          offsetValue = 4
        })

        it("should return the last 2 results", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ limit: limitValue, offset: offsetValue })
            .expect(200)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(2)
          expect(response.body.total).toBe(6)
        })
      })

      describe("when fetching two pages of 3 results each", () => {
        let limitValue: number

        beforeEach(() => {
          limitValue = 3
        })

        it("should return different pages with non-overlapping results", async () => {
          const page1 = await supertest(app)
            .get("/api/destinations")
            .query({ limit: limitValue, offset: 0 })
            .expect(200)

          const page2 = await supertest(app)
            .get("/api/destinations")
            .query({ limit: limitValue, offset: limitValue })
            .expect(200)

          const page1Ids = page1.body.data.map((d: { id: string }) => d.id)
          const page2Ids = page2.body.data.map((d: { id: string }) => d.id)

          expect(page1Ids).toHaveLength(3)
          expect(page2Ids).toHaveLength(3)
          expect(new Set([...page1Ids, ...page2Ids]).size).toBe(6)
        })
      })

      describe("and combined with only_worlds", () => {
        let limitValue: number

        beforeEach(() => {
          limitValue = 2
        })

        it("should paginate correctly within the worlds-only result set", async () => {
          const page1 = await supertest(app)
            .get("/api/destinations")
            .query({ only_worlds: "true", limit: limitValue, offset: 0 })
            .expect(200)

          const page2 = await supertest(app)
            .get("/api/destinations")
            .query({
              only_worlds: "true",
              limit: limitValue,
              offset: limitValue,
            })
            .expect(200)

          expect(page1.body.data).toHaveLength(2)
          expect(page1.body.total).toBe(3)
          expect(page2.body.data).toHaveLength(1)
          expect(page2.body.total).toBe(3)

          const allIds = [
            ...page1.body.data.map((d: { id: string }) => d.id),
            ...page2.body.data.map((d: { id: string }) => d.id),
          ]
          expect(new Set(allIds).size).toBe(3)
        })
      })

      describe("and combined with only_places", () => {
        let limitValue: number

        beforeEach(() => {
          limitValue = 2
        })

        it("should paginate correctly within the places-only result set", async () => {
          const page1 = await supertest(app)
            .get("/api/destinations")
            .query({ only_places: "true", limit: limitValue, offset: 0 })
            .expect(200)

          const page2 = await supertest(app)
            .get("/api/destinations")
            .query({
              only_places: "true",
              limit: limitValue,
              offset: limitValue,
            })
            .expect(200)

          expect(page1.body.data).toHaveLength(2)
          expect(page1.body.total).toBe(3)
          expect(page2.body.data).toHaveLength(1)
          expect(page2.body.total).toBe(3)
        })
      })
    })
  })

  /**
   * The content-quality filter keeps a destination when `highlighted IS TRUE OR (the image is not
   * a known fallback AND the title is not blank or a placeholder)`.
   *
   * These tests execute the predicate against Postgres and assert on the response body on purpose.
   * The unit suite around `DestinationModel` only inspects the emitted SQL text, so deleting a
   * whole term from the predicate leaves it green.
   */
  describe("and destinations carry fallback images or placeholder titles", () => {
    describe("and the request is the generic feed", () => {
      let placeWithContent: PlaceAttributes

      beforeEach(async () => {
        placeWithContent = await seedPlace({
          title: "Amber Hollow",
          image: REAL_IMAGE,
          base_position: "100,100",
          positions: ["100,100"],
        })
      })

      it("should return a place whose title and image both come from its scene", async () => {
        const response = await supertest(app)
          .get("/api/destinations")
          .expect(200)

        expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
      })

      describe("and a place image is the Genesis City map render", () => {
        beforeEach(async () => {
          await seedPlace({
            title: "Basalt Terrace",
            image: MAP_FALLBACK_IMAGE,
            base_position: "101,101",
            positions: ["101,101"],
          })
        })

        it("should not return the place with the map render", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })
      })

      describe("and a place has no owner and no contact name", () => {
        beforeEach(async () => {
          await seedPlace({
            title: "Verdant Annex",
            image: REAL_IMAGE,
            owner: null,
            contact_name: null,
            base_position: "121,121",
            positions: ["121,121"],
          })
        })

        it("should not return the place nobody claims", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })
      })

      describe("and a place carries only the sdk template contact name", () => {
        beforeEach(async () => {
          await seedPlace({
            title: "Slate Foundry",
            image: REAL_IMAGE,
            owner: null,
            contact_name: "SDK",
            base_position: "122,122",
            positions: ["122,122"],
          })
        })

        it("should not return the place whose contact is the template default", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })
      })

      describe("and a place has a contact name but no owner", () => {
        let contactOnlyPlace: PlaceAttributes

        beforeEach(async () => {
          contactOnlyPlace = await seedPlace({
            title: "Halcyon Works",
            image: REAL_IMAGE,
            owner: null,
            contact_name: "METATIGER",
            base_position: "123,123",
            positions: ["123,123"],
          })
        })

        it("should return the place whose creator is named", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual(
            [placeWithContent.id, contactOnlyPlace.id].sort()
          )
        })
      })

      describe("and a place sits on a road parcel", () => {
        beforeEach(async () => {
          // -1,-10 is a road on the Genesis City map, seeded into road_positions by migration.
          // Everything else about this place is legitimate, so only the road rule can hide it.
          const roadPlace = await seedPlace({
            title: "Kerbside Gallery",
            image: REAL_IMAGE,
            contact_name: "Decentraland Foundation",
            base_position: "-1,-10",
            positions: ["-1,-10"],
          })
          // pointer lookups resolve through place_positions, which seedPlace does not populate.
          await database.query(
            `INSERT INTO place_positions (position, base_position) VALUES ($1, $2)`,
            ["-1,-10", roadPlace.base_position] as string[]
          )
        })

        it("should not return the place built on a road", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })

        it("should still return the road place when its parcel is asked for by pointer", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ pointer: "-1,-10" })
            .expect(200)

          expect(
            response.body.data.map((d: { title: string }) => d.title)
          ).toEqual(["Kerbside Gallery"])
        })
      })

      describe("and a place has no image at all", () => {
        beforeEach(async () => {
          await seedPlace({
            title: "Cinder Wharf",
            image: null,
            base_position: "102,102",
            positions: ["102,102"],
          })
        })

        it("should not return the place without an image", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })
      })

      describe("and a place image is an empty string", () => {
        beforeEach(async () => {
          await seedPlace({
            title: "Hollow Quay",
            image: "",
            base_position: "103,103",
            positions: ["103,103"],
          })
        })

        it("should not return the place with a blank image", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })
      })

      describe("and a place image is only whitespace", () => {
        beforeEach(async () => {
          await seedPlace({
            title: "Pale Cistern",
            image: "   ",
            base_position: "104,104",
            positions: ["104,104"],
          })
        })

        it("should not return the place with a whitespace-only image", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })
      })

      describe("and a place image carries the world default thumbnail hash", () => {
        beforeEach(async () => {
          await seedPlace({
            title: "Driftwood Pier",
            image: WORLD_DEFAULT_THUMBNAIL_IMAGE,
            base_position: "103,103",
            positions: ["103,103"],
          })
        })

        it("should not return the place with the default world thumbnail", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })
      })

      describe("and a place image carries an unwanted thumbnail hash", () => {
        beforeEach(async () => {
          await seedPlace({
            title: "Ember Courtyard",
            image: UNWANTED_THUMBNAIL_IMAGE,
            base_position: "104,104",
            positions: ["104,104"],
          })
        })

        it("should not return the place with the unwanted thumbnail", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })
      })

      describe("and a place title joins test to another word with an underscore", () => {
        beforeEach(async () => {
          await seedPlace({
            title: "streaming_test",
            image: REAL_IMAGE,
            base_position: "111,111",
            positions: ["111,111"],
          })
        })

        it("should not return the underscored test place", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })
      })

      describe("and a place title is a placeholder with a trailing counter", () => {
        beforeEach(async () => {
          await seedPlace({
            title: "New Scene 6",
            image: REAL_IMAGE,
            base_position: "112,112",
            positions: ["112,112"],
          })
        })

        it("should not return the numbered placeholder place", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })
      })

      describe("and a place is titled after the bare template word", () => {
        beforeEach(async () => {
          await seedPlace({
            title: "Scene 5",
            image: REAL_IMAGE,
            base_position: "113,113",
            positions: ["113,113"],
          })
        })

        it("should not return the place titled Scene with a counter", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })
      })

      describe("and a place title merely ends in a number", () => {
        let numberedPlace: PlaceAttributes

        beforeEach(async () => {
          numberedPlace = await seedPlace({
            title: "The Land 5",
            image: REAL_IMAGE,
            base_position: "114,114",
            positions: ["114,114"],
          })
        })

        it("should return the place whose number is part of its name", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual(
            [placeWithContent.id, numberedPlace.id].sort()
          )
        })
      })

      describe("and a place title glues test to another word in camel case", () => {
        beforeEach(async () => {
          await seedPlace({
            title: "conTest",
            image: REAL_IMAGE,
            base_position: "115,115",
            positions: ["115,115"],
          })
        })

        it("should not return the camel-cased test place", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })
      })

      describe("and a place title glues test after an uppercase letter", () => {
        beforeEach(async () => {
          // Seen on zone: the letter before "Test" is itself a capital, so a rule that only
          // accepted a lowercase neighbour let this through.
          await seedPlace({
            title: "ABTestScene1",
            image: REAL_IMAGE,
            base_position: "117,117",
            positions: ["117,117"],
          })
        })

        it("should not return the test place named after an initialism", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })
      })

      describe("and a place title is the ordinary word contest", () => {
        let contestPlace: PlaceAttributes

        beforeEach(async () => {
          contestPlace = await seedPlace({
            title: "contest",
            image: REAL_IMAGE,
            base_position: "116,116",
            positions: ["116,116"],
          })
        })

        it("should return the place named after a real word", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual(
            [placeWithContent.id, contestPlace.id].sort()
          )
        })
      })

      describe("and a place title uses test as a whole word", () => {
        beforeEach(async () => {
          await seedPlace({
            title: "Test Plaza",
            image: REAL_IMAGE,
            base_position: "105,105",
            positions: ["105,105"],
          })
        })

        it("should not return the place titled Test Plaza", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })
      })

      describe("and a place title is a placeholder from the template list", () => {
        beforeEach(async () => {
          await seedPlace({
            title: "Untitled",
            image: REAL_IMAGE,
            base_position: "106,106",
            positions: ["106,106"],
          })
        })

        it("should not return the place titled Untitled", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })
      })

      describe("and a place title is a placeholder padded with a trailing space", () => {
        beforeEach(async () => {
          await seedPlace({
            title: "Untitled ",
            image: REAL_IMAGE,
            base_position: "107,107",
            positions: ["107,107"],
          })
        })

        it("should not return the place titled Untitled with a trailing space", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })
      })

      describe("and a place title is an empty string", () => {
        beforeEach(async () => {
          await seedPlace({
            title: "",
            description: "Faded Kiln",
            image: REAL_IMAGE,
            base_position: "108,108",
            positions: ["108,108"],
          })
        })

        it("should not return the place with an empty title", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })
      })

      describe("and a place title is only whitespace", () => {
        beforeEach(async () => {
          await seedPlace({
            title: "   ",
            description: "Glass Aviary",
            image: REAL_IMAGE,
            base_position: "109,109",
            positions: ["109,109"],
          })
        })

        it("should not return the place with a whitespace-only title", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })
      })

      describe("and a place has no title at all", () => {
        beforeEach(async () => {
          await seedPlace({
            title: null,
            description: "Hollow Belfry",
            image: REAL_IMAGE,
            base_position: "110,110",
            positions: ["110,110"],
          })
        })

        it("should not return the place without a title", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })
      })

      describe("and a place title is a placeholder that the whole-word regex cannot catch", () => {
        beforeEach(async () => {
          await seedPlace({
            title: "TheTestScene",
            image: REAL_IMAGE,
            base_position: "111,111",
            positions: ["111,111"],
          })
        })

        it("should not return the place titled TheTestScene", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([placeWithContent.id])
        })
      })

      describe("and place titles merely contain test inside a longer word", () => {
        let placeContest: PlaceAttributes
        let placeLatest: PlaceAttributes
        let placeTesting: PlaceAttributes

        beforeEach(async () => {
          placeContest = await seedPlace({
            title: "Contest Arena",
            image: REAL_IMAGE,
            base_position: "112,112",
            positions: ["112,112"],
          })
          placeLatest = await seedPlace({
            title: "Latest News",
            image: REAL_IMAGE,
            base_position: "113,113",
            positions: ["113,113"],
          })
          placeTesting = await seedPlace({
            title: "Testing Grounds",
            image: REAL_IMAGE,
            base_position: "114,114",
            positions: ["114,114"],
          })
        })

        it("should return the place titled Contest Arena", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toContain(placeContest.id)
        })

        it("should return the place titled Latest News", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toContain(placeLatest.id)
        })

        it("should return the place titled Testing Grounds", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toContain(placeTesting.id)
        })
      })

      describe("and a place with a fallback image and a placeholder title is highlighted", () => {
        let placeCurated: PlaceAttributes

        beforeEach(async () => {
          placeCurated = await seedPlace({
            title: "Untitled",
            image: MAP_FALLBACK_IMAGE,
            highlighted: true,
            base_position: "115,115",
            positions: ["115,115"],
          })
        })

        it("should return the highlighted place regardless of its columns", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .expect(200)

          expect(sortedDestinationIds(response)).toContain(placeCurated.id)
        })
      })
    })

    describe("and the generic feed mixes passing and failing places", () => {
      beforeEach(async () => {
        await seedPlace({
          title: "Ironwood Atrium",
          image: REAL_IMAGE,
          base_position: "120,120",
          positions: ["120,120"],
        })
        await seedPlace({
          title: "Jasper Bazaar",
          image: REAL_IMAGE,
          base_position: "121,121",
          positions: ["121,121"],
        })
        await seedPlace({
          title: "Kelp Observatory",
          image: REAL_IMAGE,
          base_position: "122,122",
          positions: ["122,122"],
        })
        await seedPlace({
          title: "Lantern Bridge",
          image: MAP_FALLBACK_IMAGE,
          base_position: "123,123",
          positions: ["123,123"],
        })
        await seedPlace({
          title: "Marble Foundry",
          image: null,
          base_position: "124,124",
          positions: ["124,124"],
        })
        await seedPlace({
          title: "Untitled",
          image: REAL_IMAGE,
          base_position: "125,125",
          positions: ["125,125"],
        })
        await seedPlace({
          title: "Test Depot",
          image: REAL_IMAGE,
          base_position: "126,126",
          positions: ["126,126"],
        })
      })

      it("should count only the passing places in the total", async () => {
        const response = await supertest(app)
          .get("/api/destinations")
          .expect(200)

        expect(response.body.total).toBe(3)
      })

      it("should return one entry per passing place", async () => {
        const response = await supertest(app)
          .get("/api/destinations")
          .expect(200)

        expect(response.body.data).toHaveLength(3)
      })
    })

    describe("and the request carries a filter that bypasses the check", () => {
      /**
       * Deliberate negative fixture, kept on purpose: it fails BOTH halves of the predicate at
       * once (a placeholder title and a map fallback image). The generic-feed test below asserts it
       * is absent, and every bypass test asserts the very same row comes back once the request
       * names it. Remove it and nothing proves the bypasses reach the rows the filter hides.
       */
      let junkPlace: PlaceAttributes
      let qualityPlace: PlaceAttributes

      beforeEach(async () => {
        junkPlace = await seedPlace({
          title: "Untitled",
          description: "Quarrystone Lookout",
          image: MAP_FALLBACK_IMAGE,
          owner: OWNER_JUNK,
          creator_address: CREATOR_JUNK,
          base_position: "150,150",
          positions: ["150,150"],
        })
        qualityPlace = await seedPlace({
          title: "Nettle Conservatory",
          image: REAL_IMAGE,
          base_position: "151,151",
          positions: ["151,151"],
        })

        await seedWorldWithOptions("junk.dcl.eth", { title: "Untitled" })
        await seedWorldPlace("junk.dcl.eth", { image: MAP_FALLBACK_IMAGE })

        await seedWorldWithOptions("quality.dcl.eth", {
          title: "Obsidian Atelier",
        })
        await seedWorldPlace("quality.dcl.eth", { image: REAL_IMAGE })
      })

      it("should hide both junk destinations from the unfiltered feed", async () => {
        const response = await supertest(app)
          .get("/api/destinations")
          .expect(200)

        expect(sortedDestinationIds(response)).toEqual(
          [qualityPlace.id, "quality.dcl.eth"].sort()
        )
      })

      describe("and the filter is search", () => {
        it("should return the junk place matching the search text", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ search: "quarrystone" })
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([junkPlace.id])
        })
      })

      describe("and the filter is owner", () => {
        it("should return the junk place owned by the requested address", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ owner: OWNER_JUNK })
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([junkPlace.id])
        })
      })

      describe("and the filter is creator_address", () => {
        it("should return the junk place created by the requested address", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ creator_address: CREATOR_JUNK })
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([junkPlace.id])
        })
      })

      describe("and the filter is only_favorites", () => {
        beforeEach(async () => {
          await UserFavoriteModel.create({
            user: MOCK_USER_ADDRESS,
            user_activity: 100,
            entity_id: junkPlace.id,
            created_at: new Date(),
          })
        })

        it("should return the junk place the user favorited", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_favorites: "true" })
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([junkPlace.id])
        })
      })

      describe("and the filter is pointer", () => {
        beforeEach(async () => {
          await database.query(
            `INSERT INTO place_positions (position, base_position)
             VALUES ($1, $2)
             ON CONFLICT (position) DO NOTHING`,
            ["150,150", junkPlace.base_position] as string[]
          )
        })

        it("should return the junk place at the requested pointer", async () => {
          const response = await supertest(app)
            .get("/api/destinations?pointer=150%2C150")
            .expect(200)

          expect(sortedPlaceIds(response)).toEqual([junkPlace.id])
        })

        it("should keep hiding the junk world while pointer names parcels", async () => {
          const response = await supertest(app)
            .get("/api/destinations?pointer=150%2C150")
            .expect(200)

          expect(sortedWorldIds(response)).toEqual(["quality.dcl.eth"])
        })
      })

      describe("and the filter is world_names", () => {
        it("should return the junk world named in the request", async () => {
          const response = await supertest(app)
            .get("/api/destinations?world_names=junk.dcl.eth")
            .expect(200)

          expect(sortedWorldIds(response)).toEqual(["junk.dcl.eth"])
        })

        it("should keep hiding the junk place while world_names names worlds", async () => {
          const response = await supertest(app)
            .get("/api/destinations?world_names=junk.dcl.eth")
            .expect(200)

          expect(sortedPlaceIds(response)).toEqual([qualityPlace.id])
        })
      })

      // `names` scopes the places branch to the places of the matching worlds, so unlike
      // `world_names` it leaves no non-world place in the answer to assert the places branch is
      // still filtered. The per-branch check lives in the `world_names` block above.
      describe("and the filter is names", () => {
        it("should return the junk world matched by partial name", async () => {
          const response = await supertest(app)
            .get("/api/destinations?names=junk")
            .expect(200)

          expect(sortedWorldIds(response)).toEqual(["junk.dcl.eth"])
        })
      })
    })

    describe("and the request carries a filter that does not bypass the check", () => {
      let qualityPlace: PlaceAttributes

      beforeEach(async () => {
        qualityPlace = await seedPlace({
          title: "Petrichor Gardens",
          image: REAL_IMAGE,
          base_position: "160,160",
          positions: ["160,160"],
          sdk: "7",
        })
        const junkPlace = await seedPlace({
          title: "Untitled",
          image: MAP_FALLBACK_IMAGE,
          base_position: "161,161",
          positions: ["161,161"],
          sdk: "7",
        })

        await database.query(
          `INSERT INTO place_categories (place_id, category_id) VALUES ($1, $2)`,
          [qualityPlace.id, "art"] as string[]
        )
        await database.query(
          `INSERT INTO place_categories (place_id, category_id) VALUES ($1, $2)`,
          [junkPlace.id, "art"] as string[]
        )
      })

      describe("and the filter is categories", () => {
        it("should keep hiding the junk place in the requested category", async () => {
          const response = await supertest(app)
            .get("/api/destinations?categories=art")
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([qualityPlace.id])
        })
      })

      describe("and the filter is sdk", () => {
        it("should keep hiding the junk place on the requested sdk", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ sdk: "7" })
            .expect(200)

          expect(sortedDestinationIds(response)).toEqual([qualityPlace.id])
        })
      })
    })

    describe("and a world inherits its image from its latest enabled place", () => {
      beforeEach(async () => {
        await seedWorldWithOptions("inherited.dcl.eth", {
          title: "Rosewood Pavilion",
        })
        await seedWorldPlace("inherited.dcl.eth", { image: REAL_IMAGE })
      })

      it("should return the world whose own image column is null", async () => {
        const response = await supertest(app)
          .get("/api/destinations")
          .query({ only_worlds: "true" })
          .expect(200)

        expect(sortedWorldIds(response)).toEqual(["inherited.dcl.eth"])
      })

      describe("and the world image and its latest place image are both fallbacks", () => {
        beforeEach(async () => {
          await seedWorldWithOptions("fallback.dcl.eth", {
            title: "Saffron Terrace",
            image: MAP_FALLBACK_IMAGE,
          })
          await seedWorldPlace("fallback.dcl.eth", {
            image: WORLD_DEFAULT_THUMBNAIL_IMAGE,
          })
        })

        it("should not return the world without any real image", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_worlds: "true" })
            .expect(200)

          expect(sortedWorldIds(response)).toEqual(["inherited.dcl.eth"])
        })
      })

      describe("and neither the world nor its latest place names a creator", () => {
        beforeEach(async () => {
          await seedWorldWithOptions("nobody.dcl.eth", {
            title: "Cinder Loft",
          })
          await seedWorldPlace("nobody.dcl.eth", {
            image: REAL_IMAGE,
            contact_name: null,
            creator_address: null,
          })
        })

        it("should not return the world nobody claims", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_worlds: "true" })
            .expect(200)

          expect(sortedWorldIds(response)).toEqual(["inherited.dcl.eth"])
        })
      })

      describe("and the world has an owner while its latest place names nobody", () => {
        beforeEach(async () => {
          await seedWorldWithOptions("owned.dcl.eth", {
            title: "Basalt Commons",
            owner: OWNER_JUNK,
          })
          await seedWorldPlace("owned.dcl.eth", {
            image: REAL_IMAGE,
            contact_name: null,
            creator_address: null,
          })
        })

        it("should return the world whose owner stands in for the creator", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_worlds: "true" })
            .expect(200)

          expect(sortedWorldIds(response)).toEqual(
            ["inherited.dcl.eth", "owned.dcl.eth"].sort()
          )
        })
      })

      describe("and the world has no owner while its latest place records who deployed it", () => {
        beforeEach(async () => {
          await seedWorldWithOptions("deployed.dcl.eth", {
            title: "Juniper Hall",
          })
          await seedWorldPlace("deployed.dcl.eth", {
            image: REAL_IMAGE,
            contact_name: null,
            creator_address: CREATOR_JUNK,
          })
        })

        it("should return the world whose deployer stands in for the creator", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_worlds: "true" })
            .expect(200)

          expect(sortedWorldIds(response)).toEqual(
            ["deployed.dcl.eth", "inherited.dcl.eth"].sort()
          )
        })
      })

      describe("and the world carries a real image while its latest place image is a fallback", () => {
        beforeEach(async () => {
          await seedWorldWithOptions("ownimage.dcl.eth", {
            title: "Thistle Rotunda",
            image: REAL_IMAGE,
          })
          await seedWorldPlace("ownimage.dcl.eth", {
            image: MAP_FALLBACK_IMAGE,
          })
        })

        it("should return the world with its own real image", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_worlds: "true" })
            .expect(200)

          expect(sortedWorldIds(response)).toEqual(
            ["inherited.dcl.eth", "ownimage.dcl.eth"].sort()
          )
        })
      })

      describe("and the world title is a placeholder", () => {
        beforeEach(async () => {
          await seedWorldWithOptions("untitled.dcl.eth", { title: "Untitled" })
          await seedWorldPlace("untitled.dcl.eth", { image: REAL_IMAGE })
        })

        it("should not return the world with a placeholder title", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_worlds: "true" })
            .expect(200)

          expect(sortedWorldIds(response)).toEqual(["inherited.dcl.eth"])
        })
      })

      describe("and a world with a fallback image and a placeholder title is highlighted", () => {
        beforeEach(async () => {
          await seedWorldWithOptions("curated.dcl.eth", {
            title: "Untitled",
            image: MAP_FALLBACK_IMAGE,
            highlighted: true,
          })
          await seedWorldPlace("curated.dcl.eth", {
            image: MAP_FALLBACK_IMAGE,
          })
        })

        it("should return the highlighted world regardless of its columns", async () => {
          const response = await supertest(app)
            .get("/api/destinations")
            .query({ only_worlds: "true" })
            .expect(200)

          expect(sortedWorldIds(response)).toContain("curated.dcl.eth")
        })
      })
    })
  })
})
