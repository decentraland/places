import { randomUUID } from "crypto"

import isAdmin from "decentraland-gatsby/dist/entities/Auth/isAdmin"
import * as decentralandAuth from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { placeGenesisPlazaWithAggregatedAttributes } from "../../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import PlaceModel from "../model"
import { updateRating } from "./updateRating"

jest.mock("decentraland-gatsby/dist/entities/Auth/isAdmin")
jest.mock("../../Slack/utils")

describe("place rating updates", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("when an administrator updates a place rating", () => {
    let placeId: string
    let request: Request
    let resolveUpdate: (updatedCount: number) => void
    let updatePromise: Promise<number>
    let updateRatingWithAuditMock: jest.SpiedFunction<
      typeof PlaceModel.updateRatingWithAudit
    >

    beforeEach(() => {
      placeId = randomUUID()
      request = new Request("http://0.0.0.0/", { method: "PUT" })
      updatePromise = new Promise<number>((resolve) => {
        resolveUpdate = resolve
      })

      jest.spyOn(decentralandAuth, "withAuth").mockResolvedValue({
        address: "0x1234567890123456789012345678901234567890",
        metadata: {},
      })
      jest.mocked(isAdmin).mockReturnValue(true)
      jest.spyOn(PlaceModel, "findByIdWithAggregates").mockResolvedValue({
        ...placeGenesisPlazaWithAggregatedAttributes,
        id: placeId,
        content_rating: SceneContentRating.EVERYONE,
      })
      updateRatingWithAuditMock = jest
        .spyOn(PlaceModel, "updateRatingWithAudit")
        .mockReturnValue(updatePromise)
    })

    it("should wait for the atomic database write before responding", async () => {
      const responsePromise = updateRating({
        request,
        params: { place_id: placeId },
        body: { content_rating: "T" },
      })
      const state = await Promise.race([
        responsePromise.then(() => "resolved"),
        Promise.resolve("pending"),
      ])

      resolveUpdate(1)
      await responsePromise

      expect(state).toBe("pending")
    })

    describe("and no eligible database row remains", () => {
      beforeEach(() => {
        updateRatingWithAuditMock.mockResolvedValueOnce(0)
      })

      it("should respond with a conflict", async () => {
        const responsePromise = updateRating({
          request,
          params: { place_id: placeId },
          body: { content_rating: "T" },
        })

        await expect(responsePromise).rejects.toMatchObject({
          status: Response.Conflict,
        })
      })
    })
  })
})
