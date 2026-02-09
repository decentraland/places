import Events from "./Events"

describe("Events API", () => {
  let fetchMock: jest.SpyInstance

  beforeEach(() => {
    // Clear both caches before each test
    ;(Events as any).Cache.clear()
    ;(Events as any).liveEventCache.clear()
  })

  afterEach(() => {
    fetchMock?.mockRestore()
    jest.clearAllMocks()
  })

  describe("when checking live events for multiple destinations", () => {
    describe("and the API returns live events for some destinations", () => {
      let result: Map<string, boolean>

      beforeEach(async () => {
        fetchMock = jest.spyOn(Events.get(), "fetch").mockResolvedValueOnce({
          ok: true,
          data: {
            events: [
              { id: "event-1", place_id: "place-1", live: true },
              { id: "event-world", place_id: "world-id", live: true },
            ],
            total: 2,
          },
        })

        result = await Events.get().checkLiveEventsForDestinations([
          "place-1",
          "place-2",
          "world-id",
        ])
      })

      it("should return true for destinations with live events", () => {
        expect(result.get("place-1")).toBe(true)
        expect(result.get("world-id")).toBe(true)
      })

      it("should return false for destinations without live events", () => {
        expect(result.get("place-2")).toBe(false)
      })

      it("should call the events API search endpoint with list=live query param", () => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/events/search?list=live",
          expect.anything()
        )
      })
    })

    describe("and the API returns no live events", () => {
      let result: Map<string, boolean>

      beforeEach(async () => {
        fetchMock = jest.spyOn(Events.get(), "fetch").mockResolvedValueOnce({
          ok: true,
          data: {
            events: [],
            total: 0,
          },
        })

        result = await Events.get().checkLiveEventsForDestinations([
          "place-1",
          "place-2",
        ])
      })

      it("should return false for all destinations", () => {
        expect(result.get("place-1")).toBe(false)
        expect(result.get("place-2")).toBe(false)
      })
    })

    describe("and the API call fails", () => {
      let result: Map<string, boolean>
      let consoleErrorSpy: jest.SpyInstance

      beforeEach(async () => {
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()
        fetchMock = jest
          .spyOn(Events.get(), "fetch")
          .mockRejectedValueOnce(new Error("Network error"))

        result = await Events.get().checkLiveEventsForDestinations([
          "place-1",
          "place-2",
        ])
      })

      afterEach(() => {
        consoleErrorSpy.mockRestore()
      })

      it("should return false for all destinations", () => {
        expect(result.get("place-1")).toBe(false)
        expect(result.get("place-2")).toBe(false)
      })

      it("should log the error", () => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error checking live events for destinations:",
          expect.any(Error)
        )
      })
    })

    describe("and the result is cached", () => {
      beforeEach(async () => {
        fetchMock = jest.spyOn(Events.get(), "fetch").mockResolvedValueOnce({
          ok: true,
          data: {
            events: [{ id: "event-1", place_id: "place-1", live: true }],
            total: 1,
          },
        })

        // First call - should fetch
        await Events.get().checkLiveEventsForDestinations([
          "place-1",
          "place-2",
        ])
        // Second call - should use cache
        await Events.get().checkLiveEventsForDestinations([
          "place-1",
          "place-2",
        ])
      })

      it("should only call the API once", () => {
        expect(fetchMock).toHaveBeenCalledTimes(1)
      })
    })

    describe("and requesting new IDs alongside cached IDs", () => {
      let result: Map<string, boolean>

      beforeEach(async () => {
        fetchMock = jest
          .spyOn(Events.get(), "fetch")
          // First call for place-1, place-2
          .mockResolvedValueOnce({
            ok: true,
            data: {
              events: [{ id: "event-1", place_id: "place-1", live: true }],
              total: 1,
            },
          })
          // Second call for only place-3 (place-1 and place-2 are cached)
          .mockResolvedValueOnce({
            ok: true,
            data: {
              events: [{ id: "event-3", place_id: "place-3", live: true }],
              total: 1,
            },
          })

        // First call - fetch place-1, place-2
        await Events.get().checkLiveEventsForDestinations([
          "place-1",
          "place-2",
        ])
        // Second call - place-1 and place-2 are cached, only fetch place-3
        result = await Events.get().checkLiveEventsForDestinations([
          "place-1",
          "place-2",
          "place-3",
        ])
      })

      it("should only fetch uncached IDs", () => {
        expect(fetchMock).toHaveBeenCalledTimes(2)
      })

      it("should return correct live status for all IDs", () => {
        expect(result.get("place-1")).toBe(true) // from cache
        expect(result.get("place-2")).toBe(false) // from cache
        expect(result.get("place-3")).toBe(true) // freshly fetched
      })
    })

    describe("and an empty array is passed", () => {
      let result: Map<string, boolean>

      beforeEach(async () => {
        fetchMock = jest.spyOn(Events.get(), "fetch")
        result = await Events.get().checkLiveEventsForDestinations([])
      })

      it("should return an empty map", () => {
        expect(result.size).toBe(0)
      })

      it("should not call the API", () => {
        expect(fetchMock).not.toHaveBeenCalled()
      })
    })
  })
})
