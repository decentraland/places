import { randomUUID } from "crypto"

import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"

import { placeGenesisPlazaWithAggregatedAttributes } from "../../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import PlaceModel from "../model"
import { updateRanking } from "./updateRanking"

const VALID_TOKEN = "test-service-token-12345"
const place_id = randomUUID()

let mockEnvToken: string | undefined = VALID_TOKEN

// Mock the env module
jest.mock("decentraland-gatsby/dist/utils/env", () => {
  return jest.fn((key: string, defaultValue?: string) => {
    if (key === "DATA_TEAM_AUTH_TOKEN") {
      return mockEnvToken ?? defaultValue
    }
    return defaultValue
  })
})

const findByIdWithAggregates = jest.spyOn(PlaceModel, "findByIdWithAggregates")
const updatePlace = jest.spyOn(PlaceModel, "updatePlace")

beforeEach(() => {
  mockEnvToken = VALID_TOKEN
})

afterEach(() => {
  findByIdWithAggregates.mockReset()
  updatePlace.mockReset()
})

describe("updateRanking", () => {
  describe("authentication", () => {
    test("should return 401 when authorization header is missing", async () => {
      const request = new Request("/")
      const url = new URL("https://localhost/")

      await expect(() =>
        updateRanking({
          request,
          params: { place_id },
          body: { ranking: 0.85 },
          url,
        } as any)
      ).rejects.toThrow("Authorization required")
    })

    test("should return 403 when authorization token is invalid", async () => {
      const request = new Request("/")
      request.headers.set("Authorization", "Bearer invalid-token")
      const url = new URL("https://localhost/")

      await expect(() =>
        updateRanking({
          request,
          params: { place_id },
          body: { ranking: 0.85 },
          url,
        } as any)
      ).rejects.toThrow("Invalid authorization token")
    })

    test("should return 500 when DATA_TEAM_AUTH_TOKEN is not configured", async () => {
      mockEnvToken = ""

      const request = new Request("/")
      request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)
      const url = new URL("https://localhost/")

      await expect(() =>
        updateRanking({
          request,
          params: { place_id },
          body: { ranking: 0.85 },
          url,
        } as any)
      ).rejects.toThrow("Service authentication not configured")
    })

    test("should accept token with Bearer prefix", async () => {
      findByIdWithAggregates.mockResolvedValueOnce(
        placeGenesisPlazaWithAggregatedAttributes
      )
      updatePlace.mockResolvedValueOnce([] as any)

      const request = new Request("/")
      request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)
      const url = new URL("https://localhost/")

      const response = await updateRanking({
        request,
        params: { place_id: placeGenesisPlazaWithAggregatedAttributes.id },
        body: { ranking: 0.85 },
        url,
      } as any)

      expect(response.body.ok).toBe(true)
    })

    test("should accept token without Bearer prefix", async () => {
      findByIdWithAggregates.mockResolvedValueOnce(
        placeGenesisPlazaWithAggregatedAttributes
      )
      updatePlace.mockResolvedValueOnce([] as any)

      const request = new Request("/")
      request.headers.set("Authorization", VALID_TOKEN)
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
      const request = new Request("/")
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
      const request = new Request("/")
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
      const request = new Request("/")
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

      const request = new Request("/")
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
      findByIdWithAggregates.mockResolvedValueOnce(
        placeGenesisPlazaWithAggregatedAttributes
      )
      updatePlace.mockResolvedValueOnce([] as any)

      const request = new Request("/")
      request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)
      const url = new URL("https://localhost/")

      const response = await updateRanking({
        request,
        params: { place_id: placeGenesisPlazaWithAggregatedAttributes.id },
        body: { ranking: 0.85 },
        url,
      } as any)

      expect(response.body).toEqual({
        ok: true,
        data: {
          ...placeGenesisPlazaWithAggregatedAttributes,
          ranking: 0.85,
        },
      })
      expect(updatePlace).toHaveBeenCalledWith(
        { ...placeGenesisPlazaWithAggregatedAttributes, ranking: 0.85 },
        ["ranking"]
      )
    })

    test("should update ranking to zero", async () => {
      findByIdWithAggregates.mockResolvedValueOnce(
        placeGenesisPlazaWithAggregatedAttributes
      )
      updatePlace.mockResolvedValueOnce([] as any)

      const request = new Request("/")
      request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)
      const url = new URL("https://localhost/")

      const response = await updateRanking({
        request,
        params: { place_id: placeGenesisPlazaWithAggregatedAttributes.id },
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
      findByIdWithAggregates.mockResolvedValueOnce(
        placeGenesisPlazaWithAggregatedAttributes
      )
      updatePlace.mockResolvedValueOnce([] as any)

      const request = new Request("/")
      request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)
      const url = new URL("https://localhost/")

      const response = await updateRanking({
        request,
        params: { place_id: placeGenesisPlazaWithAggregatedAttributes.id },
        body: { ranking: -0.5 },
        url,
      } as any)

      expect(response.body.data.ranking).toBe(-0.5)
    })

    test("should set ranking to null", async () => {
      findByIdWithAggregates.mockResolvedValueOnce(
        placeGenesisPlazaWithAggregatedAttributes
      )
      updatePlace.mockResolvedValueOnce([] as any)

      const request = new Request("/")
      request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)
      const url = new URL("https://localhost/")

      const response = await updateRanking({
        request,
        params: { place_id: placeGenesisPlazaWithAggregatedAttributes.id },
        body: { ranking: null },
        url,
      } as any)

      expect(response.body).toEqual({
        ok: true,
        data: {
          ...placeGenesisPlazaWithAggregatedAttributes,
          ranking: null,
        },
      })
      expect(updatePlace).toHaveBeenCalledWith(
        { ...placeGenesisPlazaWithAggregatedAttributes, ranking: null },
        ["ranking"]
      )
    })
  })
})
