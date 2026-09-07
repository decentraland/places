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
  exclude_from_ranking: false,
  ranking: null,
  settings_version: null,
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
const updateRankingFromScore = jest.spyOn(WorldModel, "updateRankingFromScore")

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
  // The data team path writes through updateRankingFromScore, which reports how many rows it
  // touched. Default to one so the existing cases keep exercising a successful write.
  updateRankingFromScore.mockResolvedValue(1)
})

afterEach(() => {
  findByIdWithAggregates.mockReset()
  updateRankingFromScore.mockReset()
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
      expect(updateRankingFromScore).toHaveBeenCalledWith(world_id, 0.85)
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
  describe("when the world is highlighted", () => {
    let highlightedWorld: AggregateWorldAttributes

    beforeEach(() => {
      highlightedWorld = {
        ...baseAggregateWorld,
        highlighted: true,
        ranking: 1800,
      }
      findByIdWithAggregates.mockResolvedValueOnce(highlightedWorld)
      updateRankingSpy.mockResolvedValueOnce(undefined)
    })

    describe("and the data team token is used", () => {
      it("should reject the request as editorial", async () => {
        await expect(() =>
          updateWorldRanking({
            request: buildRequest(DATA_TEAM_TOKEN),
            params: { world_id },
            body: { ranking: 27 },
            url: buildUrl(),
          } as any)
        ).rejects.toThrow(
          "The ranking of a highlighted entity is editorial and can only be changed with the admin token"
        )
      })

      it("should leave the curated ranking untouched", async () => {
        await expect(() =>
          updateWorldRanking({
            request: buildRequest(DATA_TEAM_TOKEN),
            params: { world_id },
            body: { ranking: 27 },
            url: buildUrl(),
          } as any)
        ).rejects.toThrow()

        expect(updateRankingSpy).not.toHaveBeenCalled()
      })
    })

    describe("and the admin token is used", () => {
      it("should write the requested ranking", async () => {
        await updateWorldRanking({
          request: buildRequest(ADMIN_TOKEN),
          params: { world_id },
          body: { ranking: 1700 },
          url: buildUrl(),
        } as any)

        expect(updateRankingSpy).toHaveBeenCalledWith(world_id, 1700)
      })
    })
  })

  describe("when the world becomes curated while the request is in flight", () => {
    beforeEach(() => {
      // The row read at the start of the request was not curated, so the guard let it through.
      // An admin featuring or excluding the world in the meantime makes the conditional write
      // match nothing, which is the only signal that the row changed under us.
      findByIdWithAggregates.mockResolvedValueOnce({
        ...baseAggregateWorld,
        highlighted: false,
        exclude_from_ranking: false,
      })
      updateRankingFromScore.mockResolvedValueOnce(0)
    })

    it("should refuse the data team write rather than report success", async () => {
      await expect(() =>
        updateWorldRanking({
          request: buildRequest(DATA_TEAM_TOKEN),
          params: { world_id },
          body: { ranking: 42 },
          url: buildUrl(),
        } as any)
      ).rejects.toThrow(
        "The ranking of this world is editorial and can only be changed with the admin token"
      )
    })
  })

  describe("when the world is excluded from the automated ranking", () => {
    let excludedWorld: AggregateWorldAttributes

    beforeEach(() => {
      // Neither highlighted nor ranked, so the flag is the only thing standing between this world
      // and the score. Gathering Stage is exactly this: browsable, never ranked.
      excludedWorld = {
        ...baseAggregateWorld,
        highlighted: false,
        ranking: 0,
        exclude_from_ranking: true,
      }
      findByIdWithAggregates.mockResolvedValueOnce(excludedWorld)
      updateRankingSpy.mockResolvedValueOnce(undefined)
    })

    describe("and the data team token is used", () => {
      it("should reject the request", async () => {
        await expect(() =>
          updateWorldRanking({
            request: buildRequest(DATA_TEAM_TOKEN),
            params: { world_id },
            body: { ranking: 42 },
            url: buildUrl(),
          } as any)
        ).rejects.toThrow(
          "This entity is excluded from the automated ranking and its ranking can only be changed with the admin token"
        )
      })

      it("should not write anything", async () => {
        await expect(() =>
          updateWorldRanking({
            request: buildRequest(DATA_TEAM_TOKEN),
            params: { world_id },
            body: { ranking: 42 },
            url: buildUrl(),
          } as any)
        ).rejects.toThrow()

        expect(updateRankingSpy).not.toHaveBeenCalled()
      })
    })

    describe("and the admin token is used", () => {
      it("should still write the requested ranking", async () => {
        await updateWorldRanking({
          request: buildRequest(ADMIN_TOKEN),
          params: { world_id },
          body: { ranking: 500 },
          url: buildUrl(),
        } as any)

        expect(updateRankingSpy).toHaveBeenCalledWith(world_id, 500)
      })
    })
  })
})
