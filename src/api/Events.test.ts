import Events from "./Events"

describe("Events API", () => {
  let fetchMock: jest.SpyInstance

  afterEach(() => {
    fetchMock?.mockRestore()
    jest.clearAllMocks()
    // Clear cache between tests
    ;(Events as any).liveEventCache.clear()
  })

  describe("when checking if a destination has a live event", () => {
    describe("and the API returns live events", () => {
      let result: boolean

      beforeEach(async () => {
        fetchMock = jest.spyOn(Events.get(), "fetch").mockResolvedValueOnce({
          ok: true,
          data: [{ id: "event-1", live: true }],
        })

        result = await Events.get().hasLiveEvent("destination-123")
      })

      it("should return true", () => {
        expect(result).toBe(true)
      })

      it("should call the events API with correct parameters", () => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/events?places_ids=destination-123&list=live",
          expect.anything()
        )
      })
    })

    describe("and the API returns no live events", () => {
      let result: boolean

      beforeEach(async () => {
        fetchMock = jest.spyOn(Events.get(), "fetch").mockResolvedValueOnce({
          ok: true,
          data: [],
        })

        result = await Events.get().hasLiveEvent("destination-456")
      })

      it("should return false", () => {
        expect(result).toBe(false)
      })
    })

    describe("and the API call fails", () => {
      let result: boolean
      let consoleErrorSpy: jest.SpyInstance

      beforeEach(async () => {
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()
        fetchMock = jest
          .spyOn(Events.get(), "fetch")
          .mockRejectedValueOnce(new Error("Network error"))

        result = await Events.get().hasLiveEvent("destination-error")
      })

      afterEach(() => {
        consoleErrorSpy.mockRestore()
      })

      it("should return false", () => {
        expect(result).toBe(false)
      })

      it("should log the error", () => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error checking live events for destination destination-error:",
          expect.any(Error)
        )
      })
    })

    describe("and the result is cached", () => {
      beforeEach(async () => {
        fetchMock = jest.spyOn(Events.get(), "fetch").mockResolvedValueOnce({
          ok: true,
          data: [{ id: "event-1", live: true }],
        })

        // First call - should fetch
        await Events.get().hasLiveEvent("destination-cached")
        // Second call - should use cache
        await Events.get().hasLiveEvent("destination-cached")
      })

      it("should only call the API once", () => {
        expect(fetchMock).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe("when checking live events for multiple destinations", () => {
    let result: Map<string, boolean>

    beforeEach(async () => {
      fetchMock = jest
        .spyOn(Events.get(), "fetch")
        // First call for place-1
        .mockResolvedValueOnce({
          ok: true,
          data: [{ id: "event-1", live: true }],
        })
        // Second call for place-2
        .mockResolvedValueOnce({
          ok: true,
          data: [],
        })
        // Third call for world-id
        .mockResolvedValueOnce({
          ok: true,
          data: [{ id: "event-world", live: true }],
        })

      result = await Events.get().checkLiveEventsForDestinations([
        "place-1",
        "place-2",
        "world-id",
      ])
    })

    it("should return a map with live status for each destination", () => {
      expect(result.get("place-1")).toBe(true)
      expect(result.get("place-2")).toBe(false)
      expect(result.get("world-id")).toBe(true)
    })

    it("should call the API for each destination", () => {
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })
  })
})
