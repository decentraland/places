import * as decentralandAuth from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { AggregateWorldAttributes } from "../types"
import WorldModel from "../model"
import { updateWorldRanking } from "./updateWorldRanking"

let mockEnvToken = "test-data-team-token"

jest.mock("decentraland-gatsby/dist/utils/env", () => {
  return jest.fn().mockImplementation(() => mockEnvToken)
})

const world_id = "testworld.dcl.eth"

const findByIdWithAggregates = jest.spyOn(WorldModel, "findByIdWithAggregates")
const updateRanking = jest.spyOn(WorldModel, "updateRanking")

const worldFixture: AggregateWorldAttributes = {
  id: world_id,
  title: "Test World",
  description: "A test world",
  image: "https://example.com/image.png",
  owner: "0x1234567890123456789012345678901234567890",
  world_name: "testworld.dcl.eth",
  content_rating: SceneContentRating.EVERYONE,
  categories: [],
  likes: 0,
  dislikes: 0,
  favorites: 0,
  like_rate: 0.5,
  like_score: 0,
  disabled: false,
  disabled_at: null,
  created_at: new Date("2024-01-01"),
  updated_at: new Date("2024-01-01"),
  show_in_places: true,
  single_player: false,
  skybox_time: null,
  is_private: false,
  highlighted: false,
  highlighted_image: null,
  ranking: 0,
  user_like: false,
  user_dislike: false,
  user_favorite: false,
  user_visits: 0,
  world: true,
  contact_name: null,
  base_position: "0,0",
  deployed_at: null,
}

afterEach(() => {
  jest.clearAllMocks()
})

describe("when updating the ranking of a world", () => {
  describe("when the bearer token is missing", () => {
    beforeEach(() => {
      mockEnvToken = "test-data-team-token"
    })

    it("should throw unauthorized error", async () => {
      const request = new Request("/", {
        method: "PUT",
        headers: {},
      })

      await expect(() =>
        updateWorldRanking({
          request,
          params: { world_id },
          body: { ranking: 1.5 },
        })
      ).rejects.toThrow()
    })
  })

  describe("when the bearer token is invalid", () => {
    beforeEach(() => {
      mockEnvToken = "test-data-team-token"
    })

    it("should throw unauthorized error", async () => {
      const request = new Request("/", {
        method: "PUT",
        headers: { authorization: "Bearer wrong-token" },
      })

      await expect(() =>
        updateWorldRanking({
          request,
          params: { world_id },
          body: { ranking: 1.5 },
        })
      ).rejects.toThrow()
    })
  })

  describe("when the bearer token is valid", () => {
    beforeEach(() => {
      mockEnvToken = "test-data-team-token"
      findByIdWithAggregates.mockResolvedValue({ ...worldFixture })
      updateRanking.mockResolvedValue(undefined)
    })

    describe("and the world does not exist", () => {
      beforeEach(() => {
        findByIdWithAggregates.mockResolvedValue(null)
      })

      it("should throw not found error", async () => {
        const request = new Request("/", {
          method: "PUT",
          headers: {
            authorization: "Bearer test-data-team-token",
          },
        })

        await expect(() =>
          updateWorldRanking({
            request,
            params: { world_id },
            body: { ranking: 1.5 },
          })
        ).rejects.toThrow(`Not found world "${world_id}"`)
      })
    })

    describe("and the world exists", () => {
      describe("and ranking is a number", () => {
        it("should update the world ranking", async () => {
          const request = new Request("/", {
            method: "PUT",
            headers: {
              authorization: "Bearer test-data-team-token",
            },
          })

          const response = await updateWorldRanking({
            request,
            params: { world_id },
            body: { ranking: 2.5 },
          })

          expect(updateRanking).toHaveBeenCalledWith(world_id, 2.5)
          expect(response.body).toEqual({
            ok: true,
            data: expect.objectContaining({ ranking: 2.5 }),
          })
        })
      })

      describe("and ranking is null", () => {
        it("should set the world ranking to null", async () => {
          const request = new Request("/", {
            method: "PUT",
            headers: {
              authorization: "Bearer test-data-team-token",
            },
          })

          const response = await updateWorldRanking({
            request,
            params: { world_id },
            body: { ranking: null },
          })

          expect(updateRanking).toHaveBeenCalledWith(world_id, null)
          expect(response.body).toEqual({
            ok: true,
            data: expect.objectContaining({ ranking: null }),
          })
        })
      })
    })
  })

  describe("when body is invalid", () => {
    beforeEach(() => {
      mockEnvToken = "test-data-team-token"
    })

    it("should throw validation error for missing ranking field", async () => {
      const request = new Request("/", {
        method: "PUT",
        headers: {
          authorization: "Bearer test-data-team-token",
        },
      })

      await expect(() =>
        updateWorldRanking({
          request,
          params: { world_id },
          body: {} as any,
        })
      ).rejects.toThrow()
    })
  })
})
