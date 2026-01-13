import DataTeam from "./DataTeam"
import { sceneStatsGenesisPlaza } from "../__data__/sceneStatsGenesisPlaza"

const catalystSceneStats = jest.spyOn(DataTeam.get(), "getSceneStats")

describe("getSceneStats", () => {
  test("should return the scene stats", async () => {
    catalystSceneStats.mockResolvedValueOnce(
      Promise.resolve(sceneStatsGenesisPlaza)
    )
    const sceneStats = await DataTeam.get().getSceneStats()

    expect(sceneStats).toEqual(sceneStatsGenesisPlaza)
    expect(catalystSceneStats.mock.calls.length).toBe(1)
  })
})
