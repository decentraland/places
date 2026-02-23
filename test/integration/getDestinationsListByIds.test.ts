import { randomUUID } from "crypto"

import database from "decentraland-gatsby/dist/entities/Database/database"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import supertest from "supertest"

import PlaceModel from "../../src/entities/Place/model"
import { PlaceAttributes } from "../../src/entities/Place/types"
import UserFavoriteModel from "../../src/entities/UserFavorite/model"
import WorldModel from "../../src/entities/World/model"
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

describe("when fetching destinations by IDs via POST /destinations", () => {
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

  describe("and the body is not an array", () => {
    it("should respond with a 400", async () => {
      const response = await supertest(app)
        .post("/api/destinations")
        .send({ ids: ["some-id"] })

      expect(response.status).toBe(400)
    })
  })

  describe("and the body has more than 100 IDs", () => {
    it("should respond with a 400", async () => {
      const ids = Array.from({ length: 101 }, () => randomUUID())
      const response = await supertest(app).post("/api/destinations").send(ids)

      expect(response.status).toBe(400)
    })
  })

  describe("and an empty array is provided", () => {
    it("should return an empty list", async () => {
      const response = await supertest(app)
        .post("/api/destinations")
        .send([])
        .expect(201)

      expect(response.body.ok).toBe(true)
      expect(response.body.data).toHaveLength(0)
    })
  })

  describe("and the body contains non-existent IDs", () => {
    it("should return an empty list", async () => {
      const response = await supertest(app)
        .post("/api/destinations")
        .send([randomUUID()])
        .expect(201)

      expect(response.body.ok).toBe(true)
      expect(response.body.data).toHaveLength(0)
    })
  })

  describe("and both places and worlds exist", () => {
    let placeA: PlaceAttributes
    let placeB: PlaceAttributes
    let placeHighlighted: PlaceAttributes

    beforeEach(async () => {
      placeA = await seedPlace({
        title: "Place Alpha",
        description: "First test place",
        base_position: "1,1",
        positions: ["1,1"],
        highlighted: false,
        ranking: 0,
        owner: OWNER_A,
        creator_address: CREATOR_A,
        sdk: "7",
        like_score: 40,
        created_at: new Date("2024-01-01"),
        updated_at: new Date("2024-06-01"),
      })

      placeB = await seedPlace({
        title: "Place Beta",
        description: "Second test place",
        base_position: "2,2",
        positions: ["2,2"],
        highlighted: false,
        ranking: 0,
        owner: OWNER_B,
        creator_address: CREATOR_B,
        sdk: "6",
        like_score: 20,
        created_at: new Date("2025-01-01"),
        updated_at: new Date("2025-06-01"),
      })

      placeHighlighted = await seedPlace({
        title: "Highlighted Place",
        description: "A featured place",
        base_position: "3,3",
        positions: ["3,3"],
        highlighted: true,
        ranking: 1,
        owner: OWNER_A,
        creator_address: CREATOR_A,
        sdk: "7",
        like_score: 60,
      })

      await database.query(
        `INSERT INTO place_categories (place_id, category_id) VALUES ($1, $2)`,
        [placeA.id, "art"] as string[]
      )
      await database.query(
        `INSERT INTO place_categories (place_id, category_id) VALUES ($1, $2)`,
        [placeB.id, "education"] as string[]
      )

      await seedWorldWithOptions("world-alpha.dcl.eth", {
        title: "World Alpha",
        highlighted: false,
        ranking: 3,
        owner: OWNER_A,
        categories: ["art"],
      })
      await seedWorldPlace("world-alpha.dcl.eth", {
        sdk: "7",
        creator_address: CREATOR_A,
      })

      await seedWorldWithOptions("world-beta.dcl.eth", {
        title: "World Beta",
        highlighted: true,
        ranking: 7,
        owner: OWNER_B,
        categories: ["social"],
      })
      await seedWorldPlace("world-beta.dcl.eth", {
        sdk: "6",
        creator_address: CREATOR_B,
      })
    })

    describe("and the body contains place IDs", () => {
      it("should return only the matching places", async () => {
        const response = await supertest(app)
          .post("/api/destinations")
          .send([placeA.id])
          .expect(201)

        expect(response.body.ok).toBe(true)
        expect(response.body.data).toHaveLength(1)
        expect(response.body.data[0].id).toBe(placeA.id)
        expect(response.body.data[0].title).toBe("Place Alpha")
      })
    })

    describe("and the body contains world IDs", () => {
      it("should return only the matching worlds", async () => {
        const response = await supertest(app)
          .post("/api/destinations")
          .send(["world-alpha.dcl.eth"])
          .expect(201)

        expect(response.body.ok).toBe(true)
        expect(response.body.data).toHaveLength(1)
        expect(response.body.data[0].title).toBe("World Alpha")
        expect(response.body.data[0].world).toBe(true)
      })
    })

    describe("and the body contains IDs for both places and worlds", () => {
      it("should return both matching places and worlds", async () => {
        const response = await supertest(app)
          .post("/api/destinations")
          .send([placeA.id, "world-alpha.dcl.eth"])
          .expect(201)

        expect(response.body.ok).toBe(true)
        expect(response.body.data).toHaveLength(2)

        const placeResult = response.body.data.find(
          (d: { id: string }) => d.id === placeA.id
        )
        const worldResult = response.body.data.find(
          (d: { world: boolean }) => d.world === true
        )

        expect(placeResult).toBeDefined()
        expect(placeResult.world).toBe(false)
        expect(worldResult).toBeDefined()
        expect(worldResult.title).toBe("World Alpha")
      })
    })

    describe("and the body contains a mix of existing and non-existent IDs", () => {
      it("should return only the existing destinations", async () => {
        const response = await supertest(app)
          .post("/api/destinations")
          .send([placeA.id, randomUUID(), "nonexistent.dcl.eth"])
          .expect(201)

        expect(response.body.ok).toBe(true)
        expect(response.body.data).toHaveLength(1)
        expect(response.body.data[0].id).toBe(placeA.id)
      })
    })

    describe("and the only_places filter is applied as a query param", () => {
      it("should return only matching places even if world IDs are in the body", async () => {
        const response = await supertest(app)
          .post("/api/destinations")
          .query({ only_places: "true" })
          .send([placeA.id, "world-alpha.dcl.eth"])
          .expect(201)

        expect(response.body.ok).toBe(true)
        expect(
          response.body.data.every((d: { world: boolean }) => d.world === false)
        ).toBe(true)
        expect(response.body.data).toHaveLength(1)
        expect(response.body.data[0].id).toBe(placeA.id)
      })
    })

    describe("and the only_worlds filter is applied as a query param", () => {
      it("should return only matching worlds even if place IDs are in the body", async () => {
        const response = await supertest(app)
          .post("/api/destinations")
          .query({ only_worlds: "true" })
          .send([placeA.id, "world-alpha.dcl.eth"])
          .expect(201)

        expect(response.body.ok).toBe(true)
        expect(
          response.body.data.every((d: { world: boolean }) => d.world === true)
        ).toBe(true)
        expect(response.body.data).toHaveLength(1)
        expect(response.body.data[0].title).toBe("World Alpha")
      })
    })

    describe("and neither the only_places nor the only_worlds filter is applied", () => {
      describe("and the only_highlighted filter is applied", () => {
        it("should return only highlighted destinations from the provided IDs", async () => {
          const response = await supertest(app)
            .post("/api/destinations")
            .query({ only_highlighted: "true" })
            .send([
              placeA.id,
              placeHighlighted.id,
              "world-alpha.dcl.eth",
              "world-beta.dcl.eth",
            ])
            .expect(201)

          expect(response.body.ok).toBe(true)
          expect(
            response.body.data.every(
              (d: { highlighted: boolean }) => d.highlighted === true
            )
          ).toBe(true)

          const titles = response.body.data.map(
            (d: { title: string }) => d.title
          )
          expect(titles).toContain("Highlighted Place")
          expect(titles).toContain("World Beta")
          expect(titles).not.toContain("Place Alpha")
          expect(titles).not.toContain("World Alpha")
        })
      })

      describe("and the search filter is applied", () => {
        it("should return only matching places from the provided IDs", async () => {
          const response = await supertest(app)
            .post("/api/destinations")
            .query({ search: "alpha" })
            .send([placeA.id, placeB.id, "world-alpha.dcl.eth"])
            .expect(201)

          expect(response.body.ok).toBe(true)
          expect(response.body.data.length).toBeGreaterThanOrEqual(1)

          const titles = response.body.data.map(
            (d: { title: string }) => d.title
          )
          expect(titles).toContain("Place Alpha")
        })

        it("should return only matching worlds from the provided IDs", async () => {
          const response = await supertest(app)
            .post("/api/destinations")
            .query({ search: "beta" })
            .send(["world-alpha.dcl.eth", "world-beta.dcl.eth"])
            .expect(201)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(1)
          expect(response.body.data[0].title).toBe("World Beta")
          expect(response.body.data[0].world).toBe(true)
        })

        describe("and the search term is less than 3 characters", () => {
          it("should return an empty list", async () => {
            const response = await supertest(app)
              .post("/api/destinations")
              .query({ search: "ab" })
              .send([placeA.id, "world-alpha.dcl.eth"])
              .expect(201)

            expect(response.body.ok).toBe(true)
            expect(response.body.data).toEqual([])
            expect(response.body.total).toBe(0)
          })
        })
      })

      describe("and the owner filter is applied", () => {
        it("should return both places and worlds belonging to the owner from the provided IDs", async () => {
          const response = await supertest(app)
            .post("/api/destinations")
            .query({ owner: OWNER_A })
            .send([
              placeA.id,
              placeB.id,
              "world-alpha.dcl.eth",
              "world-beta.dcl.eth",
            ])
            .expect(201)

          expect(response.body.ok).toBe(true)

          const placeResults = response.body.data.filter(
            (d: { world: boolean }) => !d.world
          )
          const worldResults = response.body.data.filter(
            (d: { world: boolean }) => d.world
          )

          expect(placeResults).toHaveLength(1)
          expect(placeResults[0].id).toBe(placeA.id)
          expect(worldResults).toHaveLength(1)
          expect(worldResults[0].title).toBe("World Alpha")
        })
      })

      describe("and the categories filter is applied", () => {
        it("should return both places and worlds matching the category from the provided IDs", async () => {
          const response = await supertest(app)
            .post("/api/destinations")
            .query({ categories: "art" })
            .send([
              placeA.id,
              placeB.id,
              "world-alpha.dcl.eth",
              "world-beta.dcl.eth",
            ])
            .expect(201)

          expect(response.body.ok).toBe(true)

          const placeResults = response.body.data.filter(
            (d: { world: boolean }) => !d.world
          )
          const worldResults = response.body.data.filter(
            (d: { world: boolean }) => d.world
          )

          expect(placeResults).toHaveLength(1)
          expect(placeResults[0].id).toBe(placeA.id)
          expect(worldResults).toHaveLength(1)
          expect(worldResults[0].title).toBe("World Alpha")
        })
      })

      describe("and the world_names filter is applied", () => {
        it("should filter worlds by exact name and return all matching places from the provided IDs", async () => {
          const response = await supertest(app)
            .post("/api/destinations")
            .query({ world_names: "world-alpha.dcl.eth" })
            .send([
              placeA.id,
              placeB.id,
              "world-alpha.dcl.eth",
              "world-beta.dcl.eth",
            ])
            .expect(201)

          expect(response.body.ok).toBe(true)

          const placeResults = response.body.data.filter(
            (d: { world: boolean }) => !d.world
          )
          const worldResults = response.body.data.filter(
            (d: { world: boolean }) => d.world
          )

          expect(placeResults).toHaveLength(2)
          expect(worldResults).toHaveLength(1)
          expect(worldResults[0].title).toBe("World Alpha")
        })
      })

      describe("and the pointer filter is applied", () => {
        beforeEach(async () => {
          await database.query(
            `INSERT INTO place_positions (position, base_position)
             VALUES ($1, $2)
             ON CONFLICT (position) DO NOTHING`,
            ["1,1", placeA.base_position] as string[]
          )
        })

        it("should filter places by position and return all matching worlds", async () => {
          const response = await supertest(app)
            .post("/api/destinations?pointer=1%2C1")
            .send([
              placeA.id,
              placeB.id,
              "world-alpha.dcl.eth",
              "world-beta.dcl.eth",
            ])
            .expect(201)

          expect(response.body.ok).toBe(true)

          const placeResults = response.body.data.filter(
            (d: { world: boolean }) => !d.world
          )
          const worldResults = response.body.data.filter(
            (d: { world: boolean }) => d.world
          )

          expect(placeResults).toHaveLength(1)
          expect(placeResults[0].id).toBe(placeA.id)
          expect(worldResults).toHaveLength(2)
        })
      })

      describe("and the names filter is applied", () => {
        it("should filter worlds by partial name from the provided IDs", async () => {
          const response = await supertest(app)
            .post("/api/destinations?names=alpha")
            .send([
              placeA.id,
              placeB.id,
              "world-alpha.dcl.eth",
              "world-beta.dcl.eth",
            ])
            .expect(201)

          expect(response.body.ok).toBe(true)

          const worldResults = response.body.data.filter(
            (d: { world: boolean }) => d.world
          )

          expect(worldResults).toHaveLength(1)
          expect(worldResults[0].title).toBe("World Alpha")
        })
      })

      describe("and the creator_address filter is applied", () => {
        it("should filter both places and worlds by creator address", async () => {
          const response = await supertest(app)
            .post("/api/destinations")
            .query({ creator_address: CREATOR_B })
            .send([
              placeA.id,
              placeB.id,
              "world-alpha.dcl.eth",
              "world-beta.dcl.eth",
            ])
            .expect(201)

          expect(response.body.ok).toBe(true)

          const placeResults = response.body.data.filter(
            (d: { world: boolean }) => !d.world
          )
          const worldResults = response.body.data.filter(
            (d: { world: boolean }) => d.world
          )

          expect(placeResults).toHaveLength(1)
          expect(placeResults[0].id).toBe(placeB.id)
          expect(worldResults).toHaveLength(1)
          expect(worldResults[0].title).toBe("World Beta")
        })
      })

      describe("and the sdk filter is applied", () => {
        it("should filter both places and worlds by SDK version", async () => {
          const response = await supertest(app)
            .post("/api/destinations")
            .query({ sdk: "6" })
            .send([
              placeA.id,
              placeB.id,
              "world-alpha.dcl.eth",
              "world-beta.dcl.eth",
            ])
            .expect(201)

          expect(response.body.ok).toBe(true)

          const placeResults = response.body.data.filter(
            (d: { world: boolean }) => !d.world
          )
          const worldResults = response.body.data.filter(
            (d: { world: boolean }) => d.world
          )

          expect(placeResults).toHaveLength(1)
          expect(placeResults[0].id).toBe(placeB.id)
          expect(worldResults).toHaveLength(1)
          expect(worldResults[0].title).toBe("World Beta")
        })
      })

      describe("and order_by is like_score", () => {
        it("should order results by like_score descending by default", async () => {
          const response = await supertest(app)
            .post("/api/destinations")
            .query({ order_by: "like_score" })
            .send([placeA.id, placeB.id])
            .expect(201)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(2)
          expect(response.body.data[0].id).toBe(placeA.id)
          expect(response.body.data[1].id).toBe(placeB.id)
        })

        describe("and order is asc", () => {
          it("should order results by like_score ascending", async () => {
            const response = await supertest(app)
              .post("/api/destinations")
              .query({ order_by: "like_score", order: "asc" })
              .send([placeA.id, placeB.id])
              .expect(201)

            expect(response.body.ok).toBe(true)
            expect(response.body.data).toHaveLength(2)
            expect(response.body.data[0].id).toBe(placeB.id)
            expect(response.body.data[1].id).toBe(placeA.id)
          })
        })
      })

      describe("and order_by is created_at", () => {
        it("should order results by created_at descending by default", async () => {
          const response = await supertest(app)
            .post("/api/destinations")
            .query({ order_by: "created_at" })
            .send([placeA.id, placeB.id, "world-alpha.dcl.eth"])
            .expect(201)

          const data = response.body.data
          for (let i = 0; i < data.length - 1; i++) {
            const current = new Date(data[i].created_at).getTime()
            const next = new Date(data[i + 1].created_at).getTime()
            expect(current).toBeGreaterThanOrEqual(next)
          }
        })

        describe("and order is asc", () => {
          it("should order results by created_at ascending", async () => {
            const response = await supertest(app)
              .post("/api/destinations")
              .query({ order_by: "created_at", order: "asc" })
              .send([placeA.id, placeB.id])
              .expect(201)

            expect(response.body.ok).toBe(true)
            expect(response.body.data).toHaveLength(2)
            expect(response.body.data[0].id).toBe(placeA.id)
            expect(response.body.data[1].id).toBe(placeB.id)
          })
        })
      })

      describe("and order_by is updated_at", () => {
        it("should order results by updated_at descending by default", async () => {
          const response = await supertest(app)
            .post("/api/destinations")
            .query({ order_by: "updated_at" })
            .send([placeA.id, placeB.id])
            .expect(201)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(2)
          expect(response.body.data[0].id).toBe(placeB.id)
          expect(response.body.data[1].id).toBe(placeA.id)
        })
      })

      describe("and pagination is applied", () => {
        describe("when limit is set to 2", () => {
          let limitValue: number
          let allIds: string[]

          beforeEach(() => {
            limitValue = 2
            allIds = [
              placeA.id,
              placeB.id,
              placeHighlighted.id,
              "world-alpha.dcl.eth",
              "world-beta.dcl.eth",
            ]
          })

          it("should return only 2 results from both places and worlds", async () => {
            const response = await supertest(app)
              .post("/api/destinations")
              .query({ limit: limitValue, offset: 0 })
              .send(allIds)
              .expect(201)

            expect(response.body.ok).toBe(true)
            expect(response.body.data).toHaveLength(2)
            expect(response.body.total).toBe(5)
          })
        })

        describe("when fetching two pages of 2 results each", () => {
          let limitValue: number
          let allIds: string[]

          beforeEach(() => {
            limitValue = 2
            allIds = [
              placeA.id,
              placeB.id,
              placeHighlighted.id,
              "world-alpha.dcl.eth",
              "world-beta.dcl.eth",
            ]
          })

          it("should return non-overlapping results across pages", async () => {
            const page1 = await supertest(app)
              .post("/api/destinations")
              .query({ limit: limitValue, offset: 0 })
              .send(allIds)
              .expect(201)

            const page2 = await supertest(app)
              .post("/api/destinations")
              .query({ limit: limitValue, offset: limitValue })
              .send(allIds)
              .expect(201)

            expect(page1.body.data).toHaveLength(2)
            expect(page2.body.data).toHaveLength(2)

            const page1Ids = page1.body.data.map((d: { id: string }) => d.id)
            const page2Ids = page2.body.data.map((d: { id: string }) => d.id)
            const overlap = page1Ids.filter((id: string) =>
              page2Ids.includes(id)
            )
            expect(overlap).toHaveLength(0)
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
            entity_id: placeA.id,
            created_at: new Date(),
          })
          await UserFavoriteModel.create({
            user: MOCK_USER_ADDRESS,
            user_activity: 100,
            entity_id: "world-beta.dcl.eth",
            created_at: new Date(),
          })
        })

        it("should return only the favorited destinations from the provided IDs", async () => {
          const response = await supertest(app)
            .post("/api/destinations")
            .query({ only_favorites: "true" })
            .send([
              placeA.id,
              placeB.id,
              "world-alpha.dcl.eth",
              "world-beta.dcl.eth",
            ])
            .expect(201)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(2)

          const ids = response.body.data.map((d: { id: string }) => d.id)
          expect(ids).toContain(placeA.id)
          expect(ids).toContain("world-beta.dcl.eth")
        })

        it("should mark user_favorite as true on the returned destinations", async () => {
          const response = await supertest(app)
            .post("/api/destinations")
            .query({ only_favorites: "true" })
            .send([placeA.id, placeB.id, "world-beta.dcl.eth"])
            .expect(201)

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
            .post("/api/destinations")
            .query({ only_favorites: "true" })
            .send([placeA.id, "world-alpha.dcl.eth"])
            .expect(201)

          expect(response.body.ok).toBe(true)
          expect(response.body.data).toHaveLength(0)
          expect(response.body.total).toBe(0)
        })
      })
    })
  })
})
