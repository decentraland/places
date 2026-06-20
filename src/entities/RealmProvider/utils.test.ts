import RealmProvider from "./utils"
import { hotSceneGenesisPlaza } from "../../__data__/hotSceneGenesisPlaza"

jest.mock("decentraland-gatsby/dist/utils/env", () =>
  jest.fn(() => "https://realm-provider/")
)

describe("RealmProvider", () => {
  const url = "https://realm-provider/hot-scenes"
  let mockFetch: jest.SpyInstance

  beforeEach(() => {
    mockFetch = jest.spyOn(globalThis, "fetch")
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("should fetch hot scenes successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(hotSceneGenesisPlaza),
    } as unknown as Response)

    const realmProvider = RealmProvider.get()
    const hotScenes = await realmProvider.getHotScenes()

    expect(mockFetch).toHaveBeenCalledWith(url, expect.any(Object))
    expect(hotScenes).toEqual(hotSceneGenesisPlaza)
  })

  it("should handle fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Internal Server Error",
    } as unknown as Response)

    const realmProvider = RealmProvider.get()

    await expect(realmProvider.getHotScenes()).rejects.toThrow(
      "Failed to fetch hot scenes: Internal Server Error"
    )
  })
})
