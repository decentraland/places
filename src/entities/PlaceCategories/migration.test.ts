import { PoiCaptureError, applyCapturedPoiMembership } from "./migration"
import PlaceCategories from "./model"

describe("when recording a POI job outcome", () => {
  let query: jest.SpyInstance
  let entityId: string

  beforeEach(() => {
    query = jest.spyOn(PlaceCategories, "namedQuery")
    entityId = "a1111111-1111-4111-8111-111111111111"
  })

  afterEach(() => jest.restoreAllMocks())

  describe("and source execution succeeds", () => {
    beforeEach(() => query.mockResolvedValueOnce([]))

    it("should use one parameterized source function", async () => {
      await applyCapturedPoiMembership(entityId, true)
      expect(query).toHaveBeenCalledWith(
        "apply_captured_poi_membership",
        expect.objectContaining({ values: [entityId, true] })
      )
    })
  })

  describe("and the source outcome is uncertain", () => {
    beforeEach(() => {
      query.mockRejectedValueOnce(new Error("secret database details"))
    })

    it("should stop without an unrecorded fallback", async () => {
      await expect(applyCapturedPoiMembership(entityId, false)).rejects.toThrow(
        "the job must stop without fallback"
      )
      expect(query).toHaveBeenCalledTimes(1)
    })
  })

  describe("and the identity is not a canonical Genesis UUID", () => {
    beforeEach(() => {
      entityId = "world.dcl.eth"
    })

    it("should reject before issuing SQL", async () => {
      await expect(
        applyCapturedPoiMembership(entityId, true)
      ).rejects.toBeInstanceOf(PoiCaptureError)
      expect(query).not.toHaveBeenCalled()
    })
  })
})
