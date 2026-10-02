import { randomUUID } from "crypto"

import database from "decentraland-gatsby/dist/entities/Database/database"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import PlaceModel from "../../src/entities/Place/model"
import { DisabledReason, PlaceAttributes } from "../../src/entities/Place/types"
import PlacePositionModel from "../../src/entities/PlacePosition/model"
import WorldModel from "../../src/entities/World/model"
import { cleanTables, closeTestDb, initTestDb } from "../setup/db"

interface ResolutionRow {
  place_id: string
  world: boolean
  world_name: string | null
  position: string
}

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

async function seedWorldPlace(
  overrides: Partial<PlaceAttributes> = {}
): Promise<PlaceAttributes> {
  await WorldModel.insertWorldIfNotExists({
    world_name: "Alpha.dcl.eth",
    title: "Alpha",
    description: "A test world",
    show_in_places: true,
    single_player: false,
    skybox_time: null,
    is_private: false,
  })
  const place = createPlaceAttributes({
    world: true,
    world_name: "Alpha.dcl.eth",
    world_id: "alpha.dcl.eth",
    base_position: "0,0",
    positions: ["0,0"],
    ...overrides,
  })
  await PlaceModel.create(place)
  return place
}

async function seedGenesisPlace(
  overrides: Partial<PlaceAttributes> = {}
): Promise<PlaceAttributes> {
  const place = createPlaceAttributes({
    world: false,
    base_position: "10,20",
    positions: ["10,20", "10,21"],
    ...overrides,
  })
  await PlaceModel.create(place)
  await PlacePositionModel.syncBasePosition({
    base_position: place.base_position,
    positions: place.positions,
  })
  return place
}

async function resolve(
  world: boolean,
  worldName: string | null,
  position: string
): Promise<ResolutionRow[]> {
  return (await database.query(
    `SELECT place_id, world, world_name, position
     FROM place_scene_resolution
     WHERE world = $1
       AND ($2::text IS NULL OR world_name = $2)
       AND position = $3`,
    [world, worldName, position]
  )) as ResolutionRow[]
}

describe("when resolving place ids through place_scene_resolution", () => {
  beforeAll(async () => {
    await initTestDb()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  afterEach(async () => {
    await cleanTables()
  })

  describe("and a world place has opted out", () => {
    let place: PlaceAttributes

    beforeEach(async () => {
      place = await seedWorldPlace({
        positions: ["10,20"],
        disabled: true,
        disabled_reason: DisabledReason.OPT_OUT,
      })
    })

    it("should resolve its id by lowercased world_name and position", async () => {
      const rows = await resolve(true, "alpha.dcl.eth", "10,20")

      expect(rows).toHaveLength(1)
      expect(rows[0].place_id).toBe(place.id)
    })
  })

  describe("and a genesis place is active across several parcels", () => {
    let place: PlaceAttributes

    beforeEach(async () => {
      place = await seedGenesisPlace({
        base_position: "10,20",
        positions: ["10,20", "10,21"],
      })
    })

    it("should resolve its id by any occupied position", async () => {
      const first = await resolve(false, null, "10,20")
      const second = await resolve(false, null, "10,21")

      expect(first).toHaveLength(1)
      expect(first[0].place_id).toBe(place.id)
      expect(second).toHaveLength(1)
      expect(second[0].place_id).toBe(place.id)
    })
  })

  describe("and places are active (not disabled)", () => {
    it("should resolve both world and genesis ids", async () => {
      const world = await seedWorldPlace({ positions: ["1,1"] })
      const genesis = await seedGenesisPlace({
        base_position: "5,5",
        positions: ["5,5"],
      })

      const worldRows = await resolve(true, "alpha.dcl.eth", "1,1")
      const genesisRows = await resolve(false, null, "5,5")

      expect(worldRows).toHaveLength(1)
      expect(worldRows[0].place_id).toBe(world.id)
      expect(genesisRows).toHaveLength(1)
      expect(genesisRows[0].place_id).toBe(genesis.id)
    })
  })

  describe("and a place is disabled for a reason other than opt_out", () => {
    it.each([
      DisabledReason.UNDEPLOYMENT,
      DisabledReason.OVERWRITTEN,
      DisabledReason.MODERATION,
    ])("should exclude a world place disabled by %s", async (reason) => {
      await seedWorldPlace({
        positions: ["7,7"],
        disabled: true,
        disabled_reason: reason,
      })

      const rows = await resolve(true, "alpha.dcl.eth", "7,7")

      expect(rows).toHaveLength(0)
    })

    it.each([
      DisabledReason.UNDEPLOYMENT,
      DisabledReason.OVERWRITTEN,
      DisabledReason.MODERATION,
    ])("should exclude a genesis place disabled by %s", async (reason) => {
      await seedGenesisPlace({
        base_position: "8,8",
        positions: ["8,8"],
        disabled: true,
        disabled_reason: reason,
      })

      const rows = await resolve(false, null, "8,8")

      expect(rows).toHaveLength(0)
    })
  })

  describe("and compared against the model methods it mirrors", () => {
    it("should resolve the same world id as findActiveByWorldIdAndPositions", async () => {
      await seedWorldPlace({
        positions: ["42,42"],
        disabled: true,
        disabled_reason: DisabledReason.OPT_OUT,
      })

      const viewRows = await resolve(true, "alpha.dcl.eth", "42,42")
      const modelRows = await PlaceModel.findActiveByWorldIdAndPositions(
        "alpha.dcl.eth",
        ["42,42"]
      )

      expect(viewRows).toHaveLength(1)
      expect(modelRows).toHaveLength(1)
      expect(viewRows[0].place_id).toBe(modelRows[0].id)
    })

    it("should resolve the same genesis id as findEnabledByPositions", async () => {
      const place = await seedGenesisPlace({
        base_position: "43,43",
        positions: ["43,43"],
      })

      const viewRows = await resolve(false, null, "43,43")
      const modelRows = await PlaceModel.findEnabledByPositions(["43,43"])

      expect(viewRows).toHaveLength(1)
      expect(modelRows).toHaveLength(1)
      expect(viewRows[0].place_id).toBe(place.id)
      expect(viewRows[0].place_id).toBe(modelRows[0].id)
    })
  })
})
