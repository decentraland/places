import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import WorldModel from "../model"
import { AggregateWorldAttributes } from "../types"

import type * as FeaturedModule from "./featured"

const VALID_TOKEN = "test-service-token-12345"
const world_id = "brai.dcl.eth"

let mockEnvToken: string | undefined = VALID_TOKEN

jest.mock("decentraland-gatsby/dist/utils/env", () => {
  return jest.fn((key: string, defaultValue?: string) => {
    if (key === "PLACES_ADMIN_AUTH_TOKEN") {
      return mockEnvToken ?? defaultValue
    }
    return defaultValue
  })
})

const baseAggregateWorld: AggregateWorldAttributes = {
  id: world_id,
  world_name: world_id,
  title: "The house of dToxic",
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
  user_like: false,
  user_dislike: false,
  user_favorite: false,
  user_visits: 0,
  world: true,
  contact_name: null,
  base_position: "0,0",
  deployed_at: null,
}

const findByIdWithAggregates = jest.spyOn(WorldModel, "findByIdWithAggregates")
const updateHighlighted = jest.spyOn(WorldModel, "updateHighlighted")

const buildAuthenticatedRequest = (method: "PUT" | "DELETE") => {
  const request = new Request("/", { method })
  request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)
  return request
}

const buildUrl = () => new URL("https://localhost/")

let featureWorld: typeof FeaturedModule.featureWorld
let unfeatureWorld: typeof FeaturedModule.unfeatureWorld

beforeAll(async () => {
  mockEnvToken = VALID_TOKEN
  const mod = await import("./featured")
  featureWorld = mod.featureWorld
  unfeatureWorld = mod.unfeatureWorld
})

beforeEach(() => {
  mockEnvToken = VALID_TOKEN
})

afterEach(() => {
  findByIdWithAggregates.mockReset()
  updateHighlighted.mockReset()
})

describe("world featured endpoints", () => {
  describe("authentication", () => {
    test.each([["PUT"], ["DELETE"]] as const)(
      "%s returns 401 when authorization header is missing",
      async (method) => {
        const handler = method === "PUT" ? featureWorld : unfeatureWorld
        await expect(() =>
          handler({
            request: new Request("/", { method }),
            params: { world_id },
            url: buildUrl(),
          } as any)
        ).rejects.toThrow("Missing Authorization")
      }
    )

    test.each([["PUT"], ["DELETE"]] as const)(
      "%s returns 403 when authorization token is invalid",
      async (method) => {
        const handler = method === "PUT" ? featureWorld : unfeatureWorld
        const request = new Request("/", { method })
        request.headers.set("Authorization", "Bearer invalid-token")

        await expect(() =>
          handler({
            request,
            params: { world_id },
            url: buildUrl(),
          } as any)
        ).rejects.toThrow("Invalid Bearer Token")
      }
    )

    test.each([["PUT"], ["DELETE"]] as const)(
      "%s rejects request when PLACES_ADMIN_AUTH_TOKEN is not configured",
      async (method) => {
        mockEnvToken = ""

        await jest.isolateModulesAsync(async () => {
          const freshModule = await import("./featured")
          const handler =
            method === "PUT"
              ? freshModule.featureWorld
              : freshModule.unfeatureWorld

          await expect(() =>
            handler({
              request: buildAuthenticatedRequest(method),
              params: { world_id },
              url: buildUrl(),
            } as any)
          ).rejects.toThrow("Invalid Bearer Token")
        })
      }
    )
  })

  describe("world lookup", () => {
    test.each([["PUT"], ["DELETE"]] as const)(
      "%s returns 404 when world does not exist",
      async (method) => {
        const handler = method === "PUT" ? featureWorld : unfeatureWorld
        findByIdWithAggregates.mockResolvedValueOnce(null)

        await expect(() =>
          handler({
            request: buildAuthenticatedRequest(method),
            params: { world_id },
            url: buildUrl(),
          } as any)
        ).rejects.toThrow(`Not found world "${world_id}"`)
      }
    )
  })

  describe("featureWorld", () => {
    test("sets highlighted to true and returns updated world", async () => {
      findByIdWithAggregates.mockResolvedValueOnce({
        ...baseAggregateWorld,
        highlighted: false,
      })
      updateHighlighted.mockResolvedValueOnce()

      const response = await featureWorld({
        request: buildAuthenticatedRequest("PUT"),
        params: { world_id: baseAggregateWorld.id },
        url: buildUrl(),
      } as any)

      expect(updateHighlighted).toHaveBeenCalledWith(
        baseAggregateWorld.id,
        true
      )
      expect(response.body.data.highlighted).toBe(true)
      expect(response.body.data.world_name).toBe(baseAggregateWorld.world_name)
    })

    test("propagates errors from updateHighlighted", async () => {
      findByIdWithAggregates.mockResolvedValueOnce({
        ...baseAggregateWorld,
        highlighted: false,
      })
      updateHighlighted.mockRejectedValueOnce(new Error("db write failed"))

      await expect(() =>
        featureWorld({
          request: buildAuthenticatedRequest("PUT"),
          params: { world_id: baseAggregateWorld.id },
          url: buildUrl(),
        } as any)
      ).rejects.toThrow("db write failed")
    })
  })

  describe("unfeatureWorld", () => {
    test("sets highlighted to false and returns updated world", async () => {
      findByIdWithAggregates.mockResolvedValueOnce({
        ...baseAggregateWorld,
        highlighted: true,
      })
      updateHighlighted.mockResolvedValueOnce()

      const response = await unfeatureWorld({
        request: buildAuthenticatedRequest("DELETE"),
        params: { world_id: baseAggregateWorld.id },
        url: buildUrl(),
      } as any)

      expect(updateHighlighted).toHaveBeenCalledWith(
        baseAggregateWorld.id,
        false
      )
      expect(response.body.data.highlighted).toBe(false)
      expect(response.body.data.world_name).toBe(baseAggregateWorld.world_name)
    })

    test("propagates errors from updateHighlighted", async () => {
      findByIdWithAggregates.mockResolvedValueOnce({
        ...baseAggregateWorld,
        highlighted: true,
      })
      updateHighlighted.mockRejectedValueOnce(new Error("db write failed"))

      await expect(() =>
        unfeatureWorld({
          request: buildAuthenticatedRequest("DELETE"),
          params: { world_id: baseAggregateWorld.id },
          url: buildUrl(),
        } as any)
      ).rejects.toThrow("db write failed")
    })
  })
})
