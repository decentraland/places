import { PoiFeedError, fetchPois } from "./pois"

describe("when fetching the POI feed", () => {
  let fetchMock: jest.SpyInstance

  beforeEach(() => {
    fetchMock = jest.spyOn(global, "fetch")
  })

  afterEach(() => jest.restoreAllMocks())

  describe("and the feed is valid but empty", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }))
      )
    })

    it("should preserve an authoritative empty list", async () => {
      await expect(fetchPois()).resolves.toEqual([])
    })
  })

  describe("and the feed has valid positions", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: ["0,0", "-12,31"] }))
      )
    })

    it("should return the positions", async () => {
      await expect(fetchPois()).resolves.toEqual(["0,0", "-12,31"])
    })
  })

  describe("and fetching fails", () => {
    beforeEach(() => {
      fetchMock.mockRejectedValueOnce(new Error("private transport failure"))
    })

    it("should stop instead of clearing every membership", async () => {
      await expect(fetchPois()).rejects.toBeInstanceOf(PoiFeedError)
    })
  })

  describe("and the server reports failure", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(new Response("{}", { status: 503 }))
    })

    it("should stop rather than return an empty list", async () => {
      await expect(fetchPois()).rejects.toBeInstanceOf(PoiFeedError)
    })
  })

  describe("and JSON parsing fails", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(new Response("not JSON"))
    })

    it("should report a safe feed error", async () => {
      await expect(fetchPois()).rejects.toThrow("retain existing memberships")
    })
  })

  describe("and the payload shape is invalid", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: ["not-a-position"] }))
      )
    })

    it("should reject the entire result before the job runs", async () => {
      await expect(fetchPois()).rejects.toBeInstanceOf(PoiFeedError)
    })
  })
})
