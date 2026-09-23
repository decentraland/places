import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"

import { requireAdminTokenForCuratedRanking, requireRankingToken } from "./auth"

const DATA_TEAM_TOKEN = "test-data-team-token-12345"
const ADMIN_TOKEN = "test-admin-token-67890"

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

const buildCtx = (token?: string) => {
  const request = new Request("http://0.0.0.0/")
  if (token !== undefined) {
    request.headers.set("Authorization", `Bearer ${token}`)
  }
  return { request }
}

beforeEach(() => {
  mockDataTeamToken = DATA_TEAM_TOKEN
  mockAdminToken = ADMIN_TOKEN
})

describe("requireRankingToken", () => {
  test("should accept the data team token", async () => {
    await expect(requireRankingToken(buildCtx(DATA_TEAM_TOKEN))).resolves.toBe(
      DATA_TEAM_TOKEN
    )
  })

  test("should accept the admin token", async () => {
    await expect(requireRankingToken(buildCtx(ADMIN_TOKEN))).resolves.toBe(
      ADMIN_TOKEN
    )
  })

  test("should reject an invalid token", async () => {
    await expect(() =>
      requireRankingToken(buildCtx("other-token"))
    ).rejects.toThrow("Invalid Bearer Token")
  })

  test("should reject when the authorization header is missing", async () => {
    await expect(() => requireRankingToken(buildCtx())).rejects.toThrow(
      "Missing Authorization"
    )
  })

  test("should reject every token when neither env var is configured", async () => {
    mockDataTeamToken = ""
    mockAdminToken = ""

    await expect(() =>
      requireRankingToken(buildCtx(DATA_TEAM_TOKEN))
    ).rejects.toThrow("Invalid Bearer Token")
  })

  test("should accept the admin token when the data team token is not configured", async () => {
    mockDataTeamToken = ""

    await expect(requireRankingToken(buildCtx(ADMIN_TOKEN))).resolves.toBe(
      ADMIN_TOKEN
    )
  })

  test("should accept the data team token when the admin token is not configured", async () => {
    mockAdminToken = ""

    await expect(requireRankingToken(buildCtx(DATA_TEAM_TOKEN))).resolves.toBe(
      DATA_TEAM_TOKEN
    )
  })

  test("should reject a blank bearer token", async () => {
    await expect(() => requireRankingToken(buildCtx(""))).rejects.toThrow(
      "Invalid Authorization"
    )
  })
})

describe("requireAdminTokenForCuratedRanking", () => {
  const uncurated = { highlighted: false, exclude_from_ranking: false }
  const highlighted = { highlighted: true, exclude_from_ranking: false }
  const excluded = { highlighted: false, exclude_from_ranking: true }

  describe("when the entity is neither highlighted nor excluded", () => {
    describe("and the data team token writes a ranking", () => {
      it("should let the automated score through", () => {
        expect(() =>
          requireAdminTokenForCuratedRanking(DATA_TEAM_TOKEN, uncurated, 42)
        ).not.toThrow()
      })
    })

    describe("and the admin token writes a ranking", () => {
      it("should refuse a value the nightly replace would clear", () => {
        expect(() =>
          requireAdminTokenForCuratedRanking(ADMIN_TOKEN, uncurated, 42)
        ).toThrow(
          "An editorial ranking only holds on a curated entity. Feature it or set exclude_from_ranking first, otherwise the nightly replace clears this value."
        )
      })

      it("should accept a zero, because clearing a ranking survives the clear", () => {
        expect(() =>
          requireAdminTokenForCuratedRanking(ADMIN_TOKEN, uncurated, 0)
        ).not.toThrow()
      })

      it("should accept a null for the same reason", () => {
        expect(() =>
          requireAdminTokenForCuratedRanking(ADMIN_TOKEN, uncurated, null)
        ).not.toThrow()
      })
    })
  })

  describe("when the entity is highlighted", () => {
    it("should refuse the data team token", () => {
      expect(() =>
        requireAdminTokenForCuratedRanking(DATA_TEAM_TOKEN, highlighted, 42)
      ).toThrow(
        "The ranking of a highlighted entity is editorial and can only be changed with the admin token"
      )
    })

    it("should accept the admin token", () => {
      expect(() =>
        requireAdminTokenForCuratedRanking(ADMIN_TOKEN, highlighted, 42)
      ).not.toThrow()
    })
  })

  describe("when the entity is excluded from the automated ranking", () => {
    it("should refuse the data team token", () => {
      expect(() =>
        requireAdminTokenForCuratedRanking(DATA_TEAM_TOKEN, excluded, 42)
      ).toThrow(
        "This entity is excluded from the automated ranking and its ranking can only be changed with the admin token"
      )
    })

    it("should accept the admin token", () => {
      expect(() =>
        requireAdminTokenForCuratedRanking(ADMIN_TOKEN, excluded, 42)
      ).not.toThrow()
    })
  })
})
