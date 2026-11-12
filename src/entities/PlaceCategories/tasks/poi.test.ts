import { Logger } from "decentraland-gatsby/dist/entities/Development/logger"
import * as environment from "decentraland-gatsby/dist/utils/env"

import { processNewPois } from "./poi"
import { placeGenesisPlaza } from "../../../__data__/placeGenesisPlaza"
import { placeGenesisPlazaWithAggregatedAttributes } from "../../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import PlaceModel from "../../Place/model"
import * as migration from "../migration"
import PlaceCategories from "../model"

describe("when processing the daily POI job result", () => {
  let configured: jest.SpyInstance
  let logger: Pick<Logger, "log">
  let capture: jest.SpyInstance
  let remove: jest.SpyInstance
  let add: jest.SpyInstance
  let override: jest.SpyInstance

  beforeEach(() => {
    configured = jest.spyOn(environment, "default").mockReturnValue("")
    logger = { log: jest.fn() }
    jest.spyOn(PlaceModel, "findEnabledByCategory").mockResolvedValueOnce([
      {
        ...placeGenesisPlazaWithAggregatedAttributes,
        id: "a1111111-1111-4111-8111-111111111111",
      },
    ])
    jest
      .spyOn(PlaceModel, "findEnabledByPositions")
      .mockResolvedValueOnce([
        { ...placeGenesisPlaza, id: "b1111111-1111-4111-8111-111111111111" },
      ])
    capture = jest.spyOn(migration, "applyCapturedPoiMembership")
    remove = jest.spyOn(PlaceCategories, "removeCategoryFromPlace")
    add = jest.spyOn(PlaceCategories, "addCategoriesToPlaces")
    override = jest.spyOn(PlaceModel, "overrideCategories")
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("and the capture installation is enabled", () => {
    beforeEach(() => {
      configured.mockReturnValue("true")
      capture.mockResolvedValue(undefined)
    })

    it("should record only the job's changed membership bits", async () => {
      await processNewPois(["1,1"], logger)
      expect(capture.mock.calls).toEqual([
        ["a1111111-1111-4111-8111-111111111111", false],
        ["b1111111-1111-4111-8111-111111111111", true],
      ])
      expect(override).not.toHaveBeenCalled()
      expect(remove).not.toHaveBeenCalled()
      expect(add).not.toHaveBeenCalled()
    })

    describe("and recording a result fails", () => {
      beforeEach(() => {
        capture.mockRejectedValueOnce(new migration.PoiCaptureError())
      })

      it("should stop without processing later outcomes or falling back", async () => {
        await expect(processNewPois(["1,1"], logger)).rejects.toBeInstanceOf(
          migration.PoiCaptureError
        )
        expect(capture).toHaveBeenCalledTimes(1)
        expect(override).not.toHaveBeenCalled()
      })
    })
  })

  describe("and the capture flag is absent", () => {
    beforeEach(() => {
      configured.mockReturnValue("")
      remove.mockResolvedValueOnce(undefined)
      add.mockResolvedValueOnce(undefined)
      override.mockResolvedValue([])
      jest
        .spyOn(PlaceCategories, "findCategoriesByPlaceId")
        .mockResolvedValueOnce([{ category_id: "art" }])
        .mockResolvedValueOnce([
          { category_id: "music" },
          { category_id: "poi" },
        ])
    })

    it("should keep the original normalized category refresh", async () => {
      await processNewPois(["1,1"], logger)
      expect(capture).not.toHaveBeenCalled()
      expect(override.mock.calls).toEqual([
        ["a1111111-1111-4111-8111-111111111111", ["art"]],
        ["b1111111-1111-4111-8111-111111111111", ["music", "poi"]],
      ])
    })
  })
})
