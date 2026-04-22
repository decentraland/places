import { randomUUID } from "crypto"

import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"

import { placeGenesisPlazaWithAggregatedAttributes } from "../../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import { worldPlaceParalaxWithAggregated } from "../../../__data__/world"
import PlaceModel from "../model"

import type * as FeaturedModule from "./featured"

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

let featurePlace: typeof FeaturedModule.featurePlace
let unfeaturePlace: typeof FeaturedModule.unfeaturePlace

beforeAll(async () => {
  mockEnvToken = VALID_TOKEN
  const mod = await import("./featured")
  featurePlace = mod.featurePlace
  unfeaturePlace = mod.unfeaturePlace
})

beforeEach(() => {
  mockEnvToken = VALID_TOKEN
})

afterEach(() => {
  findByIdWithAggregates.mockReset()
  updatePlace.mockReset()
})

describe("featured endpoints", () => {
  describe("authentication", () => {
    test.each([["PUT"], ["DELETE"]] as const)(
      "%s returns 401 when authorization header is missing",
      async (method) => {
        const handler = method === "PUT" ? featurePlace : unfeaturePlace
        await expect(() =>
          handler({
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
        const handler = method === "PUT" ? featurePlace : unfeaturePlace
        const request = new Request("/", { method })
        request.headers.set("Authorization", "Bearer invalid-token")

        await expect(() =>
          handler({
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

        await jest.isolateModulesAsync(async () => {
          const freshModule = await import("./featured")
          const handler =
            method === "PUT"
              ? freshModule.featurePlace
              : freshModule.unfeaturePlace

          await expect(() =>
            handler({
              request: buildAuthenticatedRequest(method),
              params: { place_id },
              url: buildUrl(),
            } as any)
          ).rejects.toThrow("Invalid Bearer Token")
        })
      }
    )
  })

  describe("validation", () => {
    test.each([["PUT"], ["DELETE"]] as const)(
      "%s returns 400 when place_id is not a valid UUID",
      async (method) => {
        const handler = method === "PUT" ? featurePlace : unfeaturePlace
        await expect(() =>
          handler({
            request: buildAuthenticatedRequest(method),
            params: { place_id: "invalid-uuid" },
            url: buildUrl(),
          } as any)
        ).rejects.toThrow("Invalid data was sent to the server")
      }
    )
  })

  describe("place lookup", () => {
    test.each([["PUT"], ["DELETE"]] as const)(
      "%s returns 404 when place does not exist",
      async (method) => {
        const handler = method === "PUT" ? featurePlace : unfeaturePlace
        findByIdWithAggregates.mockResolvedValueOnce(null as any)

        await expect(() =>
          handler({
            request: buildAuthenticatedRequest(method),
            params: { place_id },
            url: buildUrl(),
          } as any)
        ).rejects.toThrow(`Not found place "${place_id}"`)
      }
    )
  })

  describe("featurePlace", () => {
    test("sets highlighted to true and returns updated place", async () => {
      findByIdWithAggregates.mockResolvedValueOnce({
        ...placeGenesisPlazaWithAggregatedAttributes,
        highlighted: false,
      })
      updatePlace.mockResolvedValueOnce([] as any)

      const response = await featurePlace({
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

    test("sets highlighted to true on a world place", async () => {
      findByIdWithAggregates.mockResolvedValueOnce({
        ...worldPlaceParalaxWithAggregated,
        highlighted: false,
      })
      updatePlace.mockResolvedValueOnce([] as any)

      const response = await featurePlace({
        request: buildAuthenticatedRequest("PUT"),
        params: { place_id: worldPlaceParalaxWithAggregated.id },
        url: buildUrl(),
      } as any)

      expect(updatePlace).toHaveBeenCalledWith(
        expect.objectContaining({
          highlighted: true,
          world: true,
          world_name: worldPlaceParalaxWithAggregated.world_name,
        }),
        ["highlighted"]
      )
      expect(response.body.data.highlighted).toBe(true)
    })

    test("propagates errors from updatePlace", async () => {
      findByIdWithAggregates.mockResolvedValueOnce({
        ...placeGenesisPlazaWithAggregatedAttributes,
        highlighted: false,
      })
      updatePlace.mockRejectedValueOnce(new Error("db write failed"))

      await expect(() =>
        featurePlace({
          request: buildAuthenticatedRequest("PUT"),
          params: { place_id: placeGenesisPlazaWithAggregatedAttributes.id },
          url: buildUrl(),
        } as any)
      ).rejects.toThrow("db write failed")
    })
  })

  describe("unfeaturePlace", () => {
    test("sets highlighted to false and returns updated place", async () => {
      findByIdWithAggregates.mockResolvedValueOnce({
        ...placeGenesisPlazaWithAggregatedAttributes,
        highlighted: true,
      })
      updatePlace.mockResolvedValueOnce([] as any)

      const response = await unfeaturePlace({
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

    test("sets highlighted to false on a world place", async () => {
      findByIdWithAggregates.mockResolvedValueOnce({
        ...worldPlaceParalaxWithAggregated,
        highlighted: true,
      })
      updatePlace.mockResolvedValueOnce([] as any)

      const response = await unfeaturePlace({
        request: buildAuthenticatedRequest("DELETE"),
        params: { place_id: worldPlaceParalaxWithAggregated.id },
        url: buildUrl(),
      } as any)

      expect(updatePlace).toHaveBeenCalledWith(
        expect.objectContaining({
          highlighted: false,
          world: true,
          world_name: worldPlaceParalaxWithAggregated.world_name,
        }),
        ["highlighted"]
      )
      expect(response.body.data.highlighted).toBe(false)
    })

    test("propagates errors from updatePlace", async () => {
      findByIdWithAggregates.mockResolvedValueOnce({
        ...placeGenesisPlazaWithAggregatedAttributes,
        highlighted: true,
      })
      updatePlace.mockRejectedValueOnce(new Error("db write failed"))

      await expect(() =>
        unfeaturePlace({
          request: buildAuthenticatedRequest("DELETE"),
          params: { place_id: placeGenesisPlazaWithAggregatedAttributes.id },
          url: buildUrl(),
        } as any)
      ).rejects.toThrow("db write failed")
    })
  })
})
