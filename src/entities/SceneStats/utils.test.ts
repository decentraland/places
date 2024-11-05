import fetch from "node-fetch"

import { sceneStatsGenesisPlaza } from "../../__data__/sceneStatsGenesisPlaza"
import DataTeam from "../SceneStats/utils"

jest.mock("node-fetch", () => jest.fn())

describe("DataTeam", () => {
  const url = "https://cdn-url/"
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    mockFetch.mockClear()
  })

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
    it("should fetch scene stats and return the data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(sceneStatsGenesisPlaza),
      } as any)

      const instance = DataTeam.from(url)
      const data = await instance.getSceneStats()
      expect(mockFetch).toHaveBeenCalledWith(`${url}scenes/scene-stats.json`)
      expect(data).toEqual(sceneStatsGenesisPlaza)
    })

    it("should throw an error if fetch fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Not Found",
      } as any)

      const instance = DataTeam.from(url)
      await expect(instance.getSceneStats()).rejects.toThrow(
        "Failed to fetch scene stats: Not Found"
      )
    })
  })
})
