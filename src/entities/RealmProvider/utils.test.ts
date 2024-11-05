import fetch from "node-fetch"

import { hotSceneGenesisPlaza } from "../../__data__/hotSceneGenesisPlaza"
import RealmProvider, { getHotScenes } from "./utils"

jest.mock("node-fetch", () => jest.fn())
jest.mock("decentraland-gatsby/dist/utils/env", () =>
  jest.fn(() => "https://realm-provider/")
)

describe("RealmProvider", () => {
  const url = "https://realm-provider/hot-scenes"
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should fetch hot scenes successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(hotSceneGenesisPlaza),
    } as any)

    const realmProvider = RealmProvider.get()
    const hotScenes = await realmProvider.getHotScenes()

    expect(mockFetch).toHaveBeenCalledWith(url, expect.any(Object))
    expect(hotScenes).toEqual(hotSceneGenesisPlaza)
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
})
