import isAdmin from "decentraland-gatsby/dist/entities/Auth/isAdmin"
import * as decentralandAuth from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { AggregateWorldAttributes } from "../types"
import WorldModel from "../model"
import { updateWorldHighlight } from "./updateWorldHighlight"

jest.mock("decentraland-gatsby/dist/entities/Auth/isAdmin")

const world_id = "testworld.dcl.eth"
const adminAddress = "0x1234567890123456789012345678901234567890"
const nonAdminAddress = "0x0987654321098765432109876543210987654321"

const mockWithAuth = jest.spyOn(decentralandAuth, "withAuth")
const findByIdWithAggregates = jest.spyOn(WorldModel, "findByIdWithAggregates")
const updateHighlighted = jest.spyOn(WorldModel, "updateHighlighted")

const worldFixture: AggregateWorldAttributes = {
  id: world_id,
  title: "Test World",
  description: "A test world",
  image: "https://example.com/image.png",
  owner: adminAddress,
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

beforeEach(() => {
  jest.clearAllMocks()
  mockWithAuth.mockResolvedValue({
    address: adminAddress,
    metadata: {},
  } as any)
  ;(isAdmin as jest.Mock).mockReturnValue(true)
  findByIdWithAggregates.mockResolvedValue({ ...worldFixture })
  updateHighlighted.mockResolvedValue(undefined)
})

describe("when updating the highlight status of a world", () => {
  describe("when user is not authenticated", () => {
    beforeEach(() => {
      mockWithAuth.mockRejectedValue(new Error("Unauthorized"))
    })

    it("should throw unauthorized error", async () => {
      const request = new Request("/", { method: "PUT" })

      await expect(() =>
        updateWorldHighlight({
          request,
          params: { world_id },
          body: { highlighted: true },
        })
      ).rejects.toThrow("Unauthorized")
    })
  })

  describe("when user is authenticated but not admin", () => {
    beforeEach(() => {
      mockWithAuth.mockResolvedValue({
        address: nonAdminAddress,
        metadata: {},
      } as any)
      ;(isAdmin as jest.Mock).mockReturnValue(false)
    })

    it("should throw forbidden error", async () => {
      const request = new Request("/", { method: "PUT" })

      await expect(() =>
        updateWorldHighlight({
          request,
          params: { world_id },
          body: { highlighted: true },
        })
      ).rejects.toThrow("Only admin allowed to update highlight")
    })
  })

  describe("when user is admin", () => {
    describe("and world does not exist", () => {
      beforeEach(() => {
        findByIdWithAggregates.mockResolvedValue(null)
      })

      it("should throw not found error", async () => {
        const request = new Request("/", { method: "PUT" })

        await expect(() =>
          updateWorldHighlight({
            request,
            params: { world_id },
            body: { highlighted: true },
          })
        ).rejects.toThrow(`Not found world "${world_id}"`)
      })
    })

    describe("and world exists", () => {
      describe("and highlighted is set to true", () => {
        it("should update world highlight to true", async () => {
          const request = new Request("/", { method: "PUT" })

          const response = await updateWorldHighlight({
            request,
            params: { world_id },
            body: { highlighted: true },
          })

          expect(updateHighlighted).toHaveBeenCalledWith(world_id, true)
          expect(response.body).toEqual({
            ok: true,
            data: expect.objectContaining({ highlighted: true }),
          })
        })
      })

      describe("and highlighted is set to false", () => {
        it("should update world highlight to false", async () => {
          const request = new Request("/", { method: "PUT" })

          const response = await updateWorldHighlight({
            request,
            params: { world_id },
            body: { highlighted: false },
          })

          expect(updateHighlighted).toHaveBeenCalledWith(world_id, false)
          expect(response.body).toEqual({
            ok: true,
            data: expect.objectContaining({ highlighted: false }),
          })
        })
      })
    })
  })

  describe("when body is invalid", () => {
    it("should throw validation error for missing highlighted field", async () => {
      const request = new Request("/", { method: "PUT" })

      await expect(() =>
        updateWorldHighlight({
          request,
          params: { world_id },
          body: {} as any,
        })
      ).rejects.toThrow()
    })
  })
})
