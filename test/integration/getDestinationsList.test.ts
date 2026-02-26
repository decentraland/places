import { randomUUID } from "crypto"

import database from "decentraland-gatsby/dist/entities/Database/database"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import supertest from "supertest"

import PlaceModel from "../../src/entities/Place/model"
import { PlaceAttributes } from "../../src/entities/Place/types"
import { DEFAULT_WORLD_IMAGE } from "../../src/entities/shared/constants"
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

async function seedWorldWithOptions(
  name: string,
  overrides: {
    title?: string
    description?: string
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
    title: overrides.title ?? "Test World",
    description: overrides.description ?? "A test world",
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
        base_position: "10,10",
        positions: ["10,10"],
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

      it("should return DEFAULT_WORLD_IMAGE for worlds without a configured image", async () => {
        const response = await supertest(app)
          .get("/api/destinations")
          .query({ only_worlds: "true" })
          .expect(200)

        const world = response.body.data.find(
          (d: { world_name: string }) => d.world_name === "regular.dcl.eth"
        )
        expect(world).toBeDefined()
        expect(world.image).toBe(DEFAULT_WORLD_IMAGE)
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
            ["10,10", placeMuseum.base_position] as string[]
          )
        })

        it("should filter places by position and return all worlds", async () => {
          const response = await supertest(app)
            .get("/api/destinations?pointer=10%2C10")
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
            (d) => !d.world && d.base_position === "10,10"
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
        it("should order them by like_score descending", async () => {
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
              (d.base_position === "10,10" || d.base_position === "20,20")
          )
          const indexMuseum = mostActivePlaces.findIndex(
            (d) => d.base_position === "10,10"
          )
          const indexGarden = mostActivePlaces.findIndex(
            (d) => d.base_position === "20,20"
          )
          expect(indexMuseum).toBeLessThan(indexGarden)
          expect(mostActivePlaces[indexMuseum].like_score).toBe(30)
          expect(mostActivePlaces[indexGarden].like_score).toBe(10)
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
})
