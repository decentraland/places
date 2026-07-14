import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import WorldModel from "../model"
import { AggregateWorldAttributes } from "../types"
import { updateWorldRanking } from "./updateWorldRanking"

const DATA_TEAM_TOKEN = "test-data-team-token-12345"
const ADMIN_TOKEN = "test-admin-token-67890"
const world_id = "brai.dcl.eth"

let mockDataTeamToken: string | undefined = DATA_TEAM_TOKEN
let mockAdminToken: string | undefined = ADMIN_TOKEN

jest.mock("decentraland-gatsby/dist/utils/env", () => {
  return jest.fn((key: string, defaultValue?: string) => {
    if (key === "DATA_TEAM_AUTH_TOKEN") {
      return mockDataTeamToken ?? defaultValue
    }
    if (key === "PLACES_ADMIN_AUTH_TOKEN") {
      return mockAdminToken ?? defaultValue
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
const updateRankingSpy = jest.spyOn(WorldModel, "updateRanking")

const buildRequest = (token?: string) => {
  const request = new Request("http://0.0.0.0/", { method: "PUT" })
  if (token !== undefined) {
    request.headers.set("Authorization", `Bearer ${token}`)
  }
  return request
}

const buildUrl = () => new URL("https://localhost/")

beforeEach(() => {
  mockDataTeamToken = DATA_TEAM_TOKEN
  mockAdminToken = ADMIN_TOKEN
})

afterEach(() => {
  findByIdWithAggregates.mockReset()
  updateRankingSpy.mockReset()
})

describe("updateWorldRanking", () => {
  describe("authentication", () => {
    test("should accept the data team token", async () => {
      findByIdWithAggregates.mockResolvedValueOnce(baseAggregateWorld)
      updateRankingSpy.mockResolvedValueOnce(undefined)

      const response = await updateWorldRanking({
        request: buildRequest(DATA_TEAM_TOKEN),
        params: { world_id },
        body: { ranking: 0.85 },
        url: buildUrl(),
      } as any)

      expect(response.body.ok).toBe(true)
      expect(response.body.data.ranking).toBe(0.85)
      expect(updateRankingSpy).toHaveBeenCalledWith(world_id, 0.85)
    })

    test("should accept the places admin token", async () => {
      findByIdWithAggregates.mockResolvedValueOnce(baseAggregateWorld)
      updateRankingSpy.mockResolvedValueOnce(undefined)

      const response = await updateWorldRanking({
        request: buildRequest(ADMIN_TOKEN),
        params: { world_id },
        body: { ranking: 0.85 },
        url: buildUrl(),
      } as any)

      expect(response.body.ok).toBe(true)
      expect(updateRankingSpy).toHaveBeenCalledWith(world_id, 0.85)
    })

    test("should reject an invalid token", async () => {
      await expect(() =>
        updateWorldRanking({
          request: buildRequest("invalid-token"),
          params: { world_id },
          body: { ranking: 0.85 },
          url: buildUrl(),
        } as any)
      ).rejects.toThrow("Invalid Bearer Token")

      expect(updateRankingSpy).not.toHaveBeenCalled()
    })

    test("should reject when authorization header is missing", async () => {
      await expect(() =>
        updateWorldRanking({
          request: buildRequest(),
          params: { world_id },
          body: { ranking: 0.85 },
          url: buildUrl(),
        } as any)
      ).rejects.toThrow("Missing Authorization")
    })

    test("should reject when no ranking token is configured", async () => {
      mockDataTeamToken = ""
      mockAdminToken = ""

      await expect(() =>
        updateWorldRanking({
          request: buildRequest(DATA_TEAM_TOKEN),
          params: { world_id },
          body: { ranking: 0.85 },
          url: buildUrl(),
        } as any)
      ).rejects.toThrow("Invalid Bearer Token")
    })
  })
})
