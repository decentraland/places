import { randomUUID } from "crypto"

import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"

import { placeGenesisPlazaWithAggregatedAttributes } from "../../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import PlaceCategories from "../../PlaceCategories/model"
import PlaceModel from "../model"
import { addFeatured, removeFeatured } from "./featured"

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
const overrideCategories = jest.spyOn(PlaceModel, "overrideCategories")
const addCategoryToPlace = jest.spyOn(PlaceCategories, "addCategoryToPlace")
const removeCategoryFromPlace = jest.spyOn(
  PlaceCategories,
  "removeCategoryFromPlace"
)

const buildAuthenticatedRequest = () => {
  const request = new Request("/")
  request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)
  return request
}

const buildUrl = () => new URL("https://localhost/")

beforeEach(() => {
  mockEnvToken = VALID_TOKEN
})

afterEach(() => {
  findByIdWithAggregates.mockReset()
  overrideCategories.mockReset()
  addCategoryToPlace.mockReset()
  removeCategoryFromPlace.mockReset()
})

describe("featured", () => {
  describe("authentication", () => {
    test.each([
      ["addFeatured", addFeatured],
      ["removeFeatured", removeFeatured],
    ])(
      "%s returns 401 when authorization header is missing",
      async (_, handler) => {
        await expect(() =>
          handler({
            request: new Request("/"),
            params: { place_id },
            url: buildUrl(),
          } as any)
        ).rejects.toThrow("Missing Authorization")
      }
    )

    test.each([
      ["addFeatured", addFeatured],
      ["removeFeatured", removeFeatured],
    ])(
      "%s returns 403 when authorization token is invalid",
      async (_, handler) => {
        const request = new Request("/")
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

    test.each([
      ["addFeatured", addFeatured],
      ["removeFeatured", removeFeatured],
    ])(
      "%s rejects request when PLACES_ADMIN_AUTH_TOKEN is not configured",
      async (_, handler) => {
        mockEnvToken = ""

        await expect(() =>
          handler({
            request: buildAuthenticatedRequest(),
            params: { place_id },
            url: buildUrl(),
          } as any)
        ).rejects.toThrow("Invalid Bearer Token")
      }
    )
  })

  describe("validation", () => {
    test.each([
      ["addFeatured", addFeatured],
      ["removeFeatured", removeFeatured],
    ])(
      "%s returns 400 when place_id is not a valid UUID",
      async (_, handler) => {
        await expect(() =>
          handler({
            request: buildAuthenticatedRequest(),
            params: { place_id: "invalid-uuid" },
            url: buildUrl(),
          } as any)
        ).rejects.toThrow()
      }
    )
  })

  describe("place lookup", () => {
    test.each([
      ["addFeatured", addFeatured],
      ["removeFeatured", removeFeatured],
    ])("%s returns 404 when place does not exist", async (_, handler) => {
      findByIdWithAggregates.mockResolvedValueOnce(null as any)

      await expect(() =>
        handler({
          request: buildAuthenticatedRequest(),
          params: { place_id },
          url: buildUrl(),
        } as any)
      ).rejects.toThrow(`Not found place "${place_id}"`)
    })
  })

  describe("addFeatured", () => {
    test("adds featured category, syncs place.categories array, and returns updated place", async () => {
      findByIdWithAggregates.mockResolvedValueOnce({
        ...placeGenesisPlazaWithAggregatedAttributes,
        categories: ["game"],
      })
      addCategoryToPlace.mockResolvedValueOnce(undefined)
      overrideCategories.mockResolvedValueOnce([] as any)

      const response = await addFeatured({
        request: buildAuthenticatedRequest(),
        params: { place_id: placeGenesisPlazaWithAggregatedAttributes.id },
        url: buildUrl(),
      } as any)

      expect(addCategoryToPlace).toHaveBeenCalledWith(
        placeGenesisPlazaWithAggregatedAttributes.id,
        "featured"
      )
      expect(overrideCategories).toHaveBeenCalledWith(
        placeGenesisPlazaWithAggregatedAttributes.id,
        ["game", "featured"]
      )
      expect(response.body.data.categories).toEqual(["game", "featured"])
    })

    test("is a no-op when place is already featured", async () => {
      findByIdWithAggregates.mockResolvedValueOnce({
        ...placeGenesisPlazaWithAggregatedAttributes,
        categories: ["featured", "game"],
      })

      const response = await addFeatured({
        request: buildAuthenticatedRequest(),
        params: { place_id: placeGenesisPlazaWithAggregatedAttributes.id },
        url: buildUrl(),
      } as any)

      expect(addCategoryToPlace).not.toHaveBeenCalled()
      expect(overrideCategories).not.toHaveBeenCalled()
      expect(response.body.data.categories).toEqual(["featured", "game"])
    })
  })

  describe("removeFeatured", () => {
    test("removes featured category, syncs place.categories array, and returns updated place", async () => {
      findByIdWithAggregates.mockResolvedValueOnce({
        ...placeGenesisPlazaWithAggregatedAttributes,
        categories: ["featured", "game"],
      })
      removeCategoryFromPlace.mockResolvedValueOnce(undefined)
      overrideCategories.mockResolvedValueOnce([] as any)

      const response = await removeFeatured({
        request: buildAuthenticatedRequest(),
        params: { place_id: placeGenesisPlazaWithAggregatedAttributes.id },
        url: buildUrl(),
      } as any)

      expect(removeCategoryFromPlace).toHaveBeenCalledWith(
        placeGenesisPlazaWithAggregatedAttributes.id,
        "featured"
      )
      expect(overrideCategories).toHaveBeenCalledWith(
        placeGenesisPlazaWithAggregatedAttributes.id,
        ["game"]
      )
      expect(response.body.data.categories).toEqual(["game"])
    })

    test("is a no-op when place is not featured", async () => {
      findByIdWithAggregates.mockResolvedValueOnce({
        ...placeGenesisPlazaWithAggregatedAttributes,
        categories: ["game"],
      })

      const response = await removeFeatured({
        request: buildAuthenticatedRequest(),
        params: { place_id: placeGenesisPlazaWithAggregatedAttributes.id },
        url: buildUrl(),
      } as any)

      expect(removeCategoryFromPlace).not.toHaveBeenCalled()
      expect(overrideCategories).not.toHaveBeenCalled()
      expect(response.body.data.categories).toEqual(["game"])
    })
  })
})
