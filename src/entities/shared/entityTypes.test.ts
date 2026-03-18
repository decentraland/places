import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { isPlace, isWorld } from "./entityTypes"
import { AggregatePlaceAttributes } from "../Place/types"
import { AggregateWorldAttributes, WorldAttributes } from "../World/types"

const baseWorldAttributes: WorldAttributes = {
  id: "testworld.dcl.eth",
  world_name: "testworld.dcl.eth",
  title: "Test World",
  description: null,
  image: null,
  owner: null,
  content_rating: SceneContentRating.TEEN,
  categories: [],
  likes: 0,
  dislikes: 0,
  favorites: 0,
  like_rate: 0.5,
  like_score: 0,
  created_at: new Date(),
  updated_at: new Date(),
  show_in_places: true,
  single_player: false,
  skybox_time: null,
  is_private: false,
  highlighted: false,
  highlighted_image: null,
  ranking: null,
}

const aggregateWorldAttributes: AggregateWorldAttributes = {
  ...baseWorldAttributes,
  user_like: false,
  user_dislike: false,
  user_favorite: false,
  user_visits: 0,
  world: true,
  contact_name: null,
  base_position: "0,0",
  deployed_at: null,
}

const aggregatePlaceAttributes: AggregatePlaceAttributes = {
  id: "place-uuid",
  world_name: null,
  title: "Genesis Plaza",
  description: null,
  image: null,
  owner: null,
  content_rating: SceneContentRating.TEEN,
  categories: [],
  likes: 0,
  dislikes: 0,
  favorites: 0,
  like_rate: 0.5,
  like_score: 0,
  disabled: false,
  disabled_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  base_position: "0,0",
  positions: ["0,0"],
  contact_name: null,
  contact_email: null,
  highlighted: false,
  highlighted_image: null,
  world: false,
  world_id: null,
  deployed_at: new Date(),
  creator_address: null,
  sdk: null,
  ranking: null,
  textsearch: null,
  user_like: false,
  user_dislike: false,
  user_favorite: false,
  user_visits: 0,
}

describe("isWorld", () => {
  describe("with a non-aggregate WorldAttributes (e.g. from WorldModel.findByWorldName)", () => {
    it("returns true", () => {
      expect(isWorld(baseWorldAttributes)).toBe(true)
    })
  })

  describe("with an aggregate AggregateWorldAttributes", () => {
    it("returns true", () => {
      expect(isWorld(aggregateWorldAttributes)).toBe(true)
    })
  })

  describe("with an aggregate AggregatePlaceAttributes (world: false)", () => {
    it("returns false", () => {
      expect(isWorld(aggregatePlaceAttributes)).toBe(false)
    })
  })

  describe("with an aggregate AggregatePlaceAttributes that is a world scene (world: true)", () => {
    it("returns true via the aggregate world flag", () => {
      const worldScenePlace: AggregatePlaceAttributes = {
        ...aggregatePlaceAttributes,
        world: true,
        world_name: "myworld.dcl.eth",
      }
      expect(isWorld(worldScenePlace)).toBe(true)
    })
  })
})

describe("isPlace", () => {
  describe("with an aggregate AggregatePlaceAttributes", () => {
    it("returns true", () => {
      expect(isPlace(aggregatePlaceAttributes)).toBe(true)
    })
  })

  describe("with an aggregate AggregateWorldAttributes", () => {
    it("returns false", () => {
      expect(isPlace(aggregateWorldAttributes)).toBe(false)
    })
  })

  describe("with a non-aggregate WorldAttributes", () => {
    it("returns false", () => {
      expect(isPlace(baseWorldAttributes)).toBe(false)
    })
  })
})
