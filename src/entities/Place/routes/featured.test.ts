import { randomUUID } from "crypto"

import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"

import { placeGenesisPlazaWithAggregatedAttributes } from "../../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import PlaceModel from "../model"
import { featured } from "./featured"

const VALID_TOKEN = "test-service-token-12345"
const place_id = randomUUID()

let mockEnvToken: string | undefined = VALID_TOKEN

jest.mock("decentraland-gatsby/dist/utils/env", () => {
  return jest.fn((key: string, defaultValue?: string) => {
    if (key === "PLACES_ADMIN_AUTH_TOKEN") {
      return mockEnvToken ?? defaultValue
    }
    return defaultValue
  })
})

const findByIdWithAggregates = jest.spyOn(PlaceModel, "findByIdWithAggregates")
const updatePlace = jest.spyOn(PlaceModel, "updatePlace")

const buildAuthenticatedRequest = (method: "PUT" | "DELETE") => {
  const request = new Request("/", { method })
  request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)
  return request
}

const buildUrl = () => new URL("https://localhost/")

beforeEach(() => {
  mockEnvToken = VALID_TOKEN
})

afterEach(() => {
  findByIdWithAggregates.mockReset()
  updatePlace.mockReset()
})

describe("featured", () => {
  describe("authentication", () => {
    test.each([["PUT"], ["DELETE"]] as const)(
      "%s returns 401 when authorization header is missing",
      async (method) => {
        await expect(() =>
          featured({
            request: new Request("/", { method }),
            params: { place_id },
            url: buildUrl(),
          } as any)
        ).rejects.toThrow("Missing Authorization")
      }
    )

    test.each([["PUT"], ["DELETE"]] as const)(
      "%s returns 403 when authorization token is invalid",
      async (method) => {
        const request = new Request("/", { method })
        request.headers.set("Authorization", "Bearer invalid-token")

        await expect(() =>
          featured({
            request,
            params: { place_id },
            url: buildUrl(),
          } as any)
        ).rejects.toThrow("Invalid Bearer Token")
      }
    )

    test.each([["PUT"], ["DELETE"]] as const)(
      "%s rejects request when PLACES_ADMIN_AUTH_TOKEN is not configured",
      async (method) => {
        mockEnvToken = ""

        await expect(() =>
          featured({
            request: buildAuthenticatedRequest(method),
            params: { place_id },
            url: buildUrl(),
          } as any)
        ).rejects.toThrow("Invalid Bearer Token")
      }
    )
  })

  describe("validation", () => {
    test.each([["PUT"], ["DELETE"]] as const)(
      "%s returns 400 when place_id is not a valid UUID",
      async (method) => {
        await expect(() =>
          featured({
            request: buildAuthenticatedRequest(method),
            params: { place_id: "invalid-uuid" },
            url: buildUrl(),
          } as any)
        ).rejects.toThrow()
      }
    )
  })

  describe("place lookup", () => {
    test.each([["PUT"], ["DELETE"]] as const)(
      "%s returns 404 when place does not exist",
      async (method) => {
        findByIdWithAggregates.mockResolvedValueOnce(null as any)

        await expect(() =>
          featured({
            request: buildAuthenticatedRequest(method),
            params: { place_id },
            url: buildUrl(),
          } as any)
        ).rejects.toThrow(`Not found place "${place_id}"`)
      }
    )
  })

  describe("PUT", () => {
    test("sets highlighted to true and returns updated place", async () => {
      findByIdWithAggregates.mockResolvedValueOnce({
        ...placeGenesisPlazaWithAggregatedAttributes,
        highlighted: false,
      })
      updatePlace.mockResolvedValueOnce([] as any)

      const response = await featured({
        request: buildAuthenticatedRequest("PUT"),
        params: { place_id: placeGenesisPlazaWithAggregatedAttributes.id },
        url: buildUrl(),
      } as any)

      expect(updatePlace).toHaveBeenCalledWith(
        expect.objectContaining({ highlighted: true }),
        ["highlighted"]
      )
      expect(response.body.data.highlighted).toBe(true)
    })
  })

  describe("DELETE", () => {
    test("sets highlighted to false and returns updated place", async () => {
      findByIdWithAggregates.mockResolvedValueOnce({
        ...placeGenesisPlazaWithAggregatedAttributes,
        highlighted: true,
      })
      updatePlace.mockResolvedValueOnce([] as any)

      const response = await featured({
        request: buildAuthenticatedRequest("DELETE"),
        params: { place_id: placeGenesisPlazaWithAggregatedAttributes.id },
        url: buildUrl(),
      } as any)

      expect(updatePlace).toHaveBeenCalledWith(
        expect.objectContaining({ highlighted: false }),
        ["highlighted"]
      )
      expect(response.body.data.highlighted).toBe(false)
    })
  })
})
