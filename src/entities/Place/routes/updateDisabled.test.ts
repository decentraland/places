import { randomUUID } from "crypto"

import isAdmin from "decentraland-gatsby/dist/entities/Auth/isAdmin"
import * as decentralandAuth from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"

import { placeGenesisPlazaWithAggregatedAttributes } from "../../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import { notifyDisablePlaces } from "../../Slack/utils"
import PlaceModel from "../model"
import { DisabledReason } from "../types"
import { updateDisabled } from "./updateDisabled"

jest.mock("decentraland-gatsby/dist/entities/Auth/isAdmin")
jest.mock("../../Slack/utils")

const place_id = randomUUID()
const adminAddress = "0x1234567890123456789012345678901234567890"
const nonAdminAddress = "0x0987654321098765432109876543210987654321"

const mockWithAuth = jest.spyOn(decentralandAuth, "withAuth")
const findByIdWithAggregates = jest.spyOn(PlaceModel, "findByIdWithAggregates")
const updateDisabledModel = jest.spyOn(PlaceModel, "updateDisabled")

beforeEach(() => {
  jest.clearAllMocks()
  mockWithAuth.mockResolvedValue({
    address: adminAddress,
    metadata: {},
  } as any)
  ;(isAdmin as jest.Mock).mockReturnValue(true)
  findByIdWithAggregates.mockResolvedValue({
    ...placeGenesisPlazaWithAggregatedAttributes,
    id: place_id,
    disabled: false,
    disabled_at: null,
    disabled_reason: null,
  } as any)
  updateDisabledModel.mockResolvedValue([] as any)
})

describe("when updating the disabled status of a place", () => {
  describe("when user is not authenticated", () => {
    beforeEach(() => {
      mockWithAuth.mockRejectedValue(new Error("Unauthorized"))
    })

    it("should throw unauthorized error", async () => {
      const request = new Request("http://0.0.0.0/", { method: "PUT" })

      await expect(() =>
        updateDisabled({
          request,
          params: { place_id },
          body: { disabled: true },
        })
      ).rejects.toThrow("Unauthorized")
    })
  })

  describe("when user is authenticated but not admin", () => {
    beforeEach(() => {
      mockWithAuth.mockResolvedValue({
        address: nonAdminAddress,
        metadata: {},
      } as any)
      ;(isAdmin as jest.Mock).mockReturnValue(false)
    })

    it("should throw forbidden error", async () => {
      const request = new Request("http://0.0.0.0/", { method: "PUT" })

      await expect(() =>
        updateDisabled({
          request,
          params: { place_id },
          body: { disabled: true },
        })
      ).rejects.toThrow("Only admin allowed to update disabled")
    })
  })

  describe("when user is admin", () => {
    describe("and place does not exist", () => {
      beforeEach(() => {
        findByIdWithAggregates.mockResolvedValue(null as any)
      })

      it("should throw not found error", async () => {
        const request = new Request("http://0.0.0.0/", { method: "PUT" })

        await expect(() =>
          updateDisabled({
            request,
            params: { place_id },
            body: { disabled: true },
          })
        ).rejects.toThrow(`Not found place "${place_id}"`)
      })
    })

    describe("and place exists", () => {
      it("should disable the place with moderation reason", async () => {
        const request = new Request("http://0.0.0.0/", { method: "PUT" })

        const response = await updateDisabled({
          request,
          params: { place_id },
          body: { disabled: true },
        })

        expect(updateDisabledModel).toHaveBeenCalledWith(
          place_id,
          true,
          DisabledReason.MODERATION,
          expect.any(Date)
        )
        expect(response.body).toEqual({
          ok: true,
          data: expect.objectContaining({
            disabled: true,
            disabled_reason: DisabledReason.MODERATION,
          }),
        })
        expect(response.body.data.disabled_at).not.toBeNull()
      })

      it("should notify slack when disabling", async () => {
        const request = new Request("http://0.0.0.0/", { method: "PUT" })

        await updateDisabled({
          request,
          params: { place_id },
          body: { disabled: true },
        })

        expect(notifyDisablePlaces).toHaveBeenCalledWith([
          expect.objectContaining({ id: place_id, disabled: true }),
        ])
      })

      it("should re-enable the place and clear disabled fields", async () => {
        findByIdWithAggregates.mockResolvedValue({
          ...placeGenesisPlazaWithAggregatedAttributes,
          id: place_id,
          disabled: true,
          disabled_at: new Date("2026-01-01"),
          disabled_reason: DisabledReason.MODERATION,
        } as any)

        const request = new Request("http://0.0.0.0/", { method: "PUT" })

        const response = await updateDisabled({
          request,
          params: { place_id },
          body: { disabled: false },
        })

        expect(updateDisabledModel).toHaveBeenCalledWith(
          place_id,
          false,
          null,
          expect.any(Date)
        )
        expect(response.body).toEqual({
          ok: true,
          data: expect.objectContaining({
            disabled: false,
            disabled_at: null,
            disabled_reason: null,
          }),
        })
        expect(notifyDisablePlaces).not.toHaveBeenCalled()
      })
    })
  })

  describe("when disabling an already disabled place", () => {
    beforeEach(() => {
      findByIdWithAggregates.mockResolvedValue({
        ...placeGenesisPlazaWithAggregatedAttributes,
        id: place_id,
        disabled: true,
        disabled_at: new Date("2026-01-01"),
        disabled_reason: DisabledReason.MODERATION,
      } as any)
    })

    it("should succeed idempotently", async () => {
      const request = new Request("http://0.0.0.0/", { method: "PUT" })

      const response = await updateDisabled({
        request,
        params: { place_id },
        body: { disabled: true },
      })

      expect(updateDisabledModel).toHaveBeenCalledWith(
        place_id,
        true,
        DisabledReason.MODERATION,
        expect.any(Date)
      )
      expect(response.body).toEqual({
        ok: true,
        data: expect.objectContaining({
          disabled: true,
          disabled_reason: DisabledReason.MODERATION,
        }),
      })
    })
  })

  describe("when re-enabling an already enabled place", () => {
    it("should succeed idempotently", async () => {
      const request = new Request("http://0.0.0.0/", { method: "PUT" })

      const response = await updateDisabled({
        request,
        params: { place_id },
        body: { disabled: false },
      })

      expect(updateDisabledModel).toHaveBeenCalledWith(
        place_id,
        false,
        null,
        expect.any(Date)
      )
      expect(response.body).toEqual({
        ok: true,
        data: expect.objectContaining({
          disabled: false,
          disabled_at: null,
          disabled_reason: null,
        }),
      })
      expect(notifyDisablePlaces).not.toHaveBeenCalled()
    })
  })

  describe("when place_id is invalid", () => {
    it("should throw validation error", async () => {
      const request = new Request("http://0.0.0.0/", { method: "PUT" })

      await expect(() =>
        updateDisabled({
          request,
          params: { place_id: "invalid-uuid" },
          body: { disabled: true },
        })
      ).rejects.toThrow()
    })
  })

  describe("when body is invalid", () => {
    it("should throw validation error for missing disabled field", async () => {
      const request = new Request("http://0.0.0.0/", { method: "PUT" })

      await expect(() =>
        updateDisabled({
          request,
          params: { place_id },
          body: {} as any,
        })
      ).rejects.toThrow()
    })
  })
})
