import fetch from "node-fetch"

import { hotSceneGenesisPlaza } from "../../__data__/hotSceneGenesisPlaza"
import RealmProvider, {
  fetchHotScenesAndUpdateCache,
  getHotScenes,
} from "./utils"

jest.mock("node-fetch", () => jest.fn())
jest.mock("decentraland-gatsby/dist/utils/env", () => {
  return jest.fn((key: string) => {
    switch (key) {
      case "REALM_PROVIDER_URL":
        return "https://realm-provider/"
      case "ARCHIPELAGO_URL":
        return "https://archipelago-provider/"
      default:
        return "https://default-provider/"
    }
  })
})

describe("RealmProvider", () => {
  const url = "https://archipelago-provider/hot-scenes"
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should fetch hot scenes successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce([hotSceneGenesisPlaza]),
    } as any)

    const realmProvider = RealmProvider.get()
    const hotScenes = await realmProvider.getHotScenes()
    expect(mockFetch).toHaveBeenCalledWith(url, expect.any(Object))
    expect(hotScenes[0]).toEqual(hotSceneGenesisPlaza)
  })

  it("should handle fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Internal Server Error",
    } as any)

    const realmProvider = RealmProvider.get()

    await expect(realmProvider.getHotScenes()).rejects.toThrow(
      "Failed to fetch hot scenes: Internal Server Error"
    )
  })

  describe("fetchHotScenesAndUpdateCache", () => {
    describe("when archipelago returns the hot scenes", () => {
      it("should update the cache with the new hot scenes", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce([hotSceneGenesisPlaza]),
        } as any)
        await fetchHotScenesAndUpdateCache()
        const result = getHotScenes()
        expect(result).toHaveLength(1)
        expect(result[0].usersTotalCount).toBe(10)
      })
    })
  })
})
