import { randomUUID } from "crypto"

import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"

import { placeGenesisPlazaWithAggregatedAttributes } from "../../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import PlaceModel from "../model"
import { updateRanking } from "./updateRanking"

const VALID_TOKEN = "test-service-token-12345"
const ADMIN_TOKEN = "test-admin-token-67890"
const place_id = randomUUID()

let mockDataTeamToken: string | undefined = VALID_TOKEN
let mockAdminToken: string | undefined = ADMIN_TOKEN

// Mock the env module
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

// The Genesis Plaza fixture is highlighted, and a highlighted place accepts only the
// admin token. Cases that exercise the data team path need an uncurated place.
const uncuratedPlace = {
  ...placeGenesisPlazaWithAggregatedAttributes,
  highlighted: false,
}

const findByIdWithAggregates = jest.spyOn(PlaceModel, "findByIdWithAggregates")
const updatePlace = jest.spyOn(PlaceModel, "updatePlace")

beforeEach(() => {
  mockDataTeamToken = VALID_TOKEN
  mockAdminToken = ADMIN_TOKEN
})

afterEach(() => {
  findByIdWithAggregates.mockReset()
  updatePlace.mockReset()
})

describe("updateRanking", () => {
  describe("authentication", () => {
    test("should return 401 when authorization header is missing", async () => {
      const request = new Request("http://0.0.0.0/")
      const url = new URL("https://localhost/")

      await expect(() =>
        updateRanking({
          request,
          params: { place_id },
          body: { ranking: 0.85 },
          url,
        } as any)
      ).rejects.toThrow("Missing Authorization")
    })

    test("should return 403 when authorization token is invalid", async () => {
      const request = new Request("http://0.0.0.0/")
      request.headers.set("Authorization", "Bearer invalid-token")
      const url = new URL("https://localhost/")

      await expect(() =>
        updateRanking({
          request,
          params: { place_id },
          body: { ranking: 0.85 },
          url,
        } as any)
      ).rejects.toThrow("Invalid Bearer Token")
    })

    test("should return error when no ranking token is configured", async () => {
      mockDataTeamToken = ""
      mockAdminToken = ""

      const request = new Request("http://0.0.0.0/")
      request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)
      const url = new URL("https://localhost/")

      await expect(() =>
        updateRanking({
          request,
          params: { place_id },
          body: { ranking: 0.85 },
          url,
        } as any)
      ).rejects.toThrow("Invalid Bearer Token")
    })

    test("should accept token with Bearer prefix", async () => {
      findByIdWithAggregates.mockResolvedValueOnce(uncuratedPlace)
      updatePlace.mockResolvedValueOnce([] as any)

      const request = new Request("http://0.0.0.0/")
      request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)
      const url = new URL("https://localhost/")

      const response = await updateRanking({
        request,
        params: { place_id: uncuratedPlace.id },
        body: { ranking: 0.85 },
        url,
      } as any)

      expect(response.body.ok).toBe(true)
    })

    test("should accept the places admin token", async () => {
      findByIdWithAggregates.mockResolvedValueOnce(
        placeGenesisPlazaWithAggregatedAttributes
      )
      updatePlace.mockResolvedValueOnce([] as any)

      const request = new Request("http://0.0.0.0/")
      request.headers.set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      const url = new URL("https://localhost/")

      const response = await updateRanking({
        request,
        params: { place_id: placeGenesisPlazaWithAggregatedAttributes.id },
        body: { ranking: 0.85 },
        url,
      } as any)

      expect(response.body.ok).toBe(true)
    })

    test("should accept the admin token when the data team token is not configured", async () => {
      mockDataTeamToken = ""
      findByIdWithAggregates.mockResolvedValueOnce(
        placeGenesisPlazaWithAggregatedAttributes
      )
      updatePlace.mockResolvedValueOnce([] as any)

      const request = new Request("http://0.0.0.0/")
      request.headers.set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      const url = new URL("https://localhost/")

      const response = await updateRanking({
        request,
        params: { place_id: placeGenesisPlazaWithAggregatedAttributes.id },
        body: { ranking: 0.85 },
        url,
      } as any)

      expect(response.body.ok).toBe(true)
    })
  })

  describe("validation", () => {
    test("should return 400 when place_id is not a valid UUID", async () => {
      const request = new Request("http://0.0.0.0/")
      request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)
      const url = new URL("https://localhost/")

      await expect(() =>
        updateRanking({
          request,
          params: { place_id: "invalid-uuid" },
          body: { ranking: 0.85 },
          url,
        } as any)
      ).rejects.toThrow()
    })

    test("should return 400 when ranking is not provided", async () => {
      const request = new Request("http://0.0.0.0/")
      request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)
      const url = new URL("https://localhost/")

      await expect(() =>
        updateRanking({
          request,
          params: { place_id },
          body: {},
          url,
        } as any)
      ).rejects.toThrow()
    })

    test("should return 400 when ranking is a string", async () => {
      const request = new Request("http://0.0.0.0/")
      request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)
      const url = new URL("https://localhost/")

      await expect(() =>
        updateRanking({
          request,
          params: { place_id },
          body: { ranking: "high" },
          url,
        } as any)
      ).rejects.toThrow()
    })
  })

  describe("place lookup", () => {
    test("should return 404 when place does not exist", async () => {
      findByIdWithAggregates.mockResolvedValueOnce(null as any)

      const request = new Request("http://0.0.0.0/")
      request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)
      const url = new URL("https://localhost/")

      await expect(() =>
        updateRanking({
          request,
          params: { place_id },
          body: { ranking: 0.85 },
          url,
        } as any)
      ).rejects.toThrow(`Not found place "${place_id}"`)

      expect(findByIdWithAggregates).toHaveBeenCalledWith(place_id, {
        user: undefined,
      })
    })
  })

  describe("successful updates", () => {
    test("should update ranking to a positive number", async () => {
      findByIdWithAggregates.mockResolvedValueOnce(uncuratedPlace)
      updatePlace.mockResolvedValueOnce([] as any)

      const request = new Request("http://0.0.0.0/")
      request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)
      const url = new URL("https://localhost/")

      const response = await updateRanking({
        request,
        params: { place_id: uncuratedPlace.id },
        body: { ranking: 0.85 },
        url,
      } as any)

      expect(response.body).toEqual({
        ok: true,
        data: {
          ...uncuratedPlace,
          ranking: 0.85,
        },
      })
      expect(updatePlace).toHaveBeenCalledWith(
        { ...uncuratedPlace, ranking: 0.85 },
        ["ranking"]
      )
    })

    test("should update ranking to zero", async () => {
      findByIdWithAggregates.mockResolvedValueOnce(uncuratedPlace)
      updatePlace.mockResolvedValueOnce([] as any)

      const request = new Request("http://0.0.0.0/")
      request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)
      const url = new URL("https://localhost/")

      const response = await updateRanking({
        request,
        params: { place_id: uncuratedPlace.id },
        body: { ranking: 0 },
        url,
      } as any)

      expect(response.body.data.ranking).toBe(0)
      expect(updatePlace).toHaveBeenCalledWith(
        expect.objectContaining({ ranking: 0 }),
        ["ranking"]
      )
    })

    test("should update ranking to a negative number", async () => {
      findByIdWithAggregates.mockResolvedValueOnce(uncuratedPlace)
      updatePlace.mockResolvedValueOnce([] as any)

      const request = new Request("http://0.0.0.0/")
      request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)
      const url = new URL("https://localhost/")

      const response = await updateRanking({
        request,
        params: { place_id: uncuratedPlace.id },
        body: { ranking: -0.5 },
        url,
      } as any)

      expect(response.body.data.ranking).toBe(-0.5)
    })

    test("should set ranking to null", async () => {
      findByIdWithAggregates.mockResolvedValueOnce(uncuratedPlace)
      updatePlace.mockResolvedValueOnce([] as any)

      const request = new Request("http://0.0.0.0/")
      request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)
      const url = new URL("https://localhost/")

      const response = await updateRanking({
        request,
        params: { place_id: uncuratedPlace.id },
        body: { ranking: null },
        url,
      } as any)

      expect(response.body).toEqual({
        ok: true,
        data: {
          ...uncuratedPlace,
          ranking: null,
        },
      })
      expect(updatePlace).toHaveBeenCalledWith(
        { ...uncuratedPlace, ranking: null },
        ["ranking"]
      )
    })
  })
  describe("when the place is highlighted", () => {
    let highlightedPlace: typeof placeGenesisPlazaWithAggregatedAttributes
    let request: Request
    let url: URL

    beforeEach(() => {
      highlightedPlace = {
        ...placeGenesisPlazaWithAggregatedAttributes,
        highlighted: true,
        ranking: 1900,
      }
      url = new URL("https://localhost/")
      findByIdWithAggregates.mockResolvedValueOnce(highlightedPlace)
      updatePlace.mockResolvedValueOnce([] as any)
    })

    describe("and the data team token is used", () => {
      beforeEach(() => {
        request = new Request("http://0.0.0.0/")
        request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)
      })

      it("should reject the request as editorial", async () => {
        await expect(() =>
          updateRanking({
            request,
            params: { place_id: highlightedPlace.id },
            body: { ranking: 27 },
            url,
          } as any)
        ).rejects.toThrow(
          "The ranking of a highlighted entity is editorial and can only be changed with the admin token"
        )
      })

      it("should leave the curated ranking untouched", async () => {
        await expect(() =>
          updateRanking({
            request,
            params: { place_id: highlightedPlace.id },
            body: { ranking: 27 },
            url,
          } as any)
        ).rejects.toThrow()

        expect(updatePlace).not.toHaveBeenCalled()
      })
    })

    describe("and the admin token is used", () => {
      beforeEach(() => {
        request = new Request("http://0.0.0.0/")
        request.headers.set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      })

      it("should write the requested ranking", async () => {
        await updateRanking({
          request,
          params: { place_id: highlightedPlace.id },
          body: { ranking: 1850 },
          url,
        } as any)

        expect(updatePlace).toHaveBeenCalledWith(
          expect.objectContaining({ ranking: 1850 }),
          ["ranking"]
        )
      })
    })
  })
})
