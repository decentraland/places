import { sceneStatsGenesisPlaza } from "../../__data__/sceneStatsGenesisPlaza"
import DataTeam from "../SceneStats/utils"

describe("DataTeam", () => {
  const url = "https://cdn-url/"

  describe("from", () => {
    it("should return a DataTeam instance from cache if exists", () => {
      const instance = DataTeam.from(url)
      const cachedInstance = DataTeam.from(url)
      expect(instance).toBe(cachedInstance)
    })

    it("should create a new DataTeam instance if not in cache", () => {
      const instance = DataTeam.from(url)
      expect(instance).toBeInstanceOf(DataTeam)
    })
  })

  describe("get", () => {
    it("should return a DataTeam instance with default URL", () => {
      const instance = DataTeam.get()
      expect(instance).toBeInstanceOf(DataTeam)
    })
  })

  describe("getSceneStats", () => {
    let mockFetch: jest.SpyInstance

    beforeEach(() => {
      mockFetch = jest.spyOn(globalThis, "fetch")
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it("should fetch scene stats and return the data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(sceneStatsGenesisPlaza),
      } as unknown as Response)

      const instance = DataTeam.from(url)
      const data = await instance.getSceneStats()
      expect(mockFetch).toHaveBeenCalledWith(`${url}scenes/scene-stats.json`)
      expect(data).toEqual(sceneStatsGenesisPlaza)
    })

    it("should throw an error if fetch fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Not Found",
      } as unknown as Response)

      const instance = DataTeam.from(url)
      await expect(instance.getSceneStats()).rejects.toThrow(
        "Failed to fetch scene stats: Not Found"
      )
    })
  })
})
