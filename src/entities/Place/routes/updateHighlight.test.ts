import { randomUUID } from "crypto"

import isAdmin from "decentraland-gatsby/dist/entities/Auth/isAdmin"
import * as decentralandAuth from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"

import { placeGenesisPlazaWithAggregatedAttributes } from "../../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import PlaceModel from "../model"
import { updateHighlight } from "./updateHighlight"

jest.mock("decentraland-gatsby/dist/entities/Auth/isAdmin")

const place_id = randomUUID()
const adminAddress = "0x1234567890123456789012345678901234567890"
const nonAdminAddress = "0x0987654321098765432109876543210987654321"

const mockWithAuth = jest.spyOn(decentralandAuth, "withAuth")
const findByIdWithAggregates = jest.spyOn(PlaceModel, "findByIdWithAggregates")
const updatePlace = jest.spyOn(PlaceModel, "updatePlace")

beforeEach(() => {
  jest.clearAllMocks()
})

describe("when updating the highlight status of a place", () => {
  describe("when user is not authenticated", () => {
    it("should throw unauthorized error", async () => {
      mockWithAuth.mockRejectedValueOnce(new Error("Unauthorized"))

      const request = new Request("/", { method: "PUT" })

      await expect(() =>
        updateHighlight({
          request,
          params: { place_id },
          body: { highlighted: true },
        })
      ).rejects.toThrow("Unauthorized")
    })
  })

  describe("when user is authenticated but not admin", () => {
    it("should throw forbidden error", async () => {
      mockWithAuth.mockResolvedValueOnce({
        address: nonAdminAddress,
        metadata: {},
      } as any)
      ;(isAdmin as jest.Mock).mockReturnValue(false)

      const request = new Request("/", { method: "PUT" })

      await expect(() =>
        updateHighlight({
          request,
          params: { place_id },
          body: { highlighted: true },
        })
      ).rejects.toThrow("Only admin allowed to update highlight")
    })
  })

  describe("when user is admin", () => {
    beforeEach(() => {
      mockWithAuth.mockResolvedValue({
        address: adminAddress,
        metadata: {},
      } as any)
      ;(isAdmin as jest.Mock).mockReturnValue(true)
    })

    describe("and place does not exist", () => {
      it("should throw not found error", async () => {
        findByIdWithAggregates.mockResolvedValueOnce(null as any)

        const request = new Request("/", { method: "PUT" })

        await expect(() =>
          updateHighlight({
            request,
            params: { place_id },
            body: { highlighted: true },
          })
        ).rejects.toThrow(`Not found place "${place_id}"`)
      })
    })

    describe("and place exists", () => {
      const existingPlace = {
        ...placeGenesisPlazaWithAggregatedAttributes,
        id: place_id,
        highlighted: false,
      }

      beforeEach(() => {
        findByIdWithAggregates.mockResolvedValue(existingPlace as any)
        updatePlace.mockResolvedValue([] as any)
      })

      it("should update place highlight to true", async () => {
        const request = new Request("/", { method: "PUT" })

        const response = await updateHighlight({
          request,
          params: { place_id },
          body: { highlighted: true },
        })

        expect(updatePlace).toHaveBeenCalledWith(
          expect.objectContaining({ highlighted: true }),
          ["highlighted"]
        )
        expect(response.body).toEqual({
          ok: true,
          data: expect.objectContaining({ highlighted: true }),
        })
      })

      it("should update place highlight to false", async () => {
        const request = new Request("/", { method: "PUT" })

        const response = await updateHighlight({
          request,
          params: { place_id },
          body: { highlighted: false },
        })

        expect(updatePlace).toHaveBeenCalledWith(
          expect.objectContaining({ highlighted: false }),
          ["highlighted"]
        )
        expect(response.body).toEqual({
          ok: true,
          data: expect.objectContaining({ highlighted: false }),
        })
      })
    })
  })

  describe("when place_id is invalid", () => {
    it("should throw validation error", async () => {
      mockWithAuth.mockResolvedValue({
        address: adminAddress,
        metadata: {},
      } as any)
      ;(isAdmin as jest.Mock).mockReturnValue(true)

      const request = new Request("/", { method: "PUT" })

      await expect(() =>
        updateHighlight({
          request,
          params: { place_id: "invalid-uuid" },
          body: { highlighted: true },
        })
      ).rejects.toThrow()
    })
  })

  describe("when body is invalid", () => {
    it("should throw validation error for missing highlighted field", async () => {
      mockWithAuth.mockResolvedValue({
        address: adminAddress,
        metadata: {},
      } as any)
      ;(isAdmin as jest.Mock).mockReturnValue(true)

      const request = new Request("/", { method: "PUT" })

      await expect(() =>
        updateHighlight({
          request,
          params: { place_id },
          body: {} as any,
        })
      ).rejects.toThrow()
    })
  })
})
