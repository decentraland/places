import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"

import { allPlacesWithAggregatedAttributes } from "../../../__data__/allPlacesWithAggregatedAttributes"
import { hotSceneGenesisPlaza } from "../../../__data__/hotSceneGenesisPlaza"
import { sceneStatsGenesisPlaza } from "../../../__data__/sceneStatsGenesisPlaza"
import { worldsLiveData } from "../../../__data__/worldsLiveData"
import PlaceModel from "../../Place/model"
import * as hotScenes from "../../RealmProvider/utils"
import * as sceneStats from "../../SceneStats/utils"
import * as worldsUtils from "../../World/utils"
import { getAllPlacesList } from "./getAllPlacesList"

const find = jest.spyOn(PlaceModel, "namedQuery")
const catalystHotScenes = jest.spyOn(hotScenes, "getHotScenes")
const catalystSceneStats = jest.spyOn(sceneStats, "getSceneStats")
const worldsContentServerLiveData = jest.spyOn(worldsUtils, "getWorldsLiveData")

afterEach(() => {
  find.mockReset()
  catalystHotScenes.mockReset()
  catalystSceneStats.mockReset()
  worldsContentServerLiveData.mockReset()
})

test("should return a list of places with no query", async () => {
  find.mockResolvedValueOnce(Promise.resolve(allPlacesWithAggregatedAttributes))
  find.mockResolvedValueOnce(Promise.resolve([{ total: 2 }]))
  catalystHotScenes.mockReturnValueOnce([hotSceneGenesisPlaza])
  catalystSceneStats.mockResolvedValueOnce(
    Promise.resolve(sceneStatsGenesisPlaza)
  )
  worldsContentServerLiveData.mockReturnValueOnce(worldsLiveData)
  const request = new Request("/")
  const url = new URL("https://localhost/")
  const placeResponse = await getAllPlacesList({
    request,
    url,
  })
  expect(placeResponse.body).toEqual({
    ok: true,
    total: 2,
    data: [
      {
        ...allPlacesWithAggregatedAttributes[0],
        user_count: hotSceneGenesisPlaza.usersTotalCount,
        user_visits: sceneStatsGenesisPlaza["-9,-9"].last_30d.users,
      },
      {
        ...allPlacesWithAggregatedAttributes[1],
        user_count: worldsLiveData.totalUsers,
        // TODO: Get user visits from world stats
        user_visits: 0,
      },
    ],
  })
  expect(find.mock.calls.length).toBe(2)
  expect(catalystHotScenes.mock.calls.length).toBe(1)
  expect(catalystSceneStats.mock.calls.length).toBe(1)
  expect(worldsContentServerLiveData.mock.calls.length).toBe(1)
})

test("should return a list of places with query", async () => {
  find.mockResolvedValueOnce(
    Promise.resolve(allPlacesWithAggregatedAttributes.slice(0, 1))
  )
  find.mockResolvedValueOnce(Promise.resolve([{ total: 1 }]))
  catalystHotScenes.mockReturnValueOnce([hotSceneGenesisPlaza])
  catalystSceneStats.mockResolvedValueOnce(
    Promise.resolve(sceneStatsGenesisPlaza)
  )
  worldsContentServerLiveData.mockReturnValueOnce(worldsLiveData)
  const request = new Request("/")
  const url = new URL(
    "https://localhost/?position=-9,-9&limit=1&offset=1&order_by=like_rate&order=asc"
  )
  const placeResponse = await getAllPlacesList({
    request,
    url,
  })

  expect(placeResponse.body).toEqual({
    ok: true,
    total: 1,
    data: [
      {
        ...allPlacesWithAggregatedAttributes[0],
        user_count: hotSceneGenesisPlaza.usersTotalCount,
        user_visits: sceneStatsGenesisPlaza["-9,-9"].last_30d.users,
      },
    ],
  })
  expect(find.mock.calls.length).toBe(2)
  expect(catalystHotScenes.mock.calls.length).toBe(1)
  expect(catalystSceneStats.mock.calls.length).toBe(1)
  expect(worldsContentServerLiveData.mock.calls.length).toBe(1)
})

test("should return a list of places with order by most_active", async () => {
  find.mockResolvedValueOnce(Promise.resolve(allPlacesWithAggregatedAttributes))
  catalystHotScenes.mockReturnValueOnce([hotSceneGenesisPlaza])
  catalystSceneStats.mockResolvedValueOnce(
    Promise.resolve(sceneStatsGenesisPlaza)
  )
  worldsContentServerLiveData.mockReturnValueOnce(worldsLiveData)
  const request = new Request("/")
  const url = new URL("https://localhost/?&order_by=most_active")
  const placeResponse = await getAllPlacesList({
    request,
    url,
  })

  expect(placeResponse.body).toEqual({
    ok: true,
    total: 2,
    data: [
      {
        ...allPlacesWithAggregatedAttributes[1],
        user_count: worldsLiveData.totalUsers,
        // TODO: Get user visits from world stats
        user_visits: 0,
      },
      {
        ...allPlacesWithAggregatedAttributes[0],
        user_count: hotSceneGenesisPlaza.usersTotalCount,
        user_visits: sceneStatsGenesisPlaza["-9,-9"].last_30d.users,
      },
    ],
  })
  expect(find.mock.calls.length).toBe(1)
  expect(catalystHotScenes.mock.calls.length).toBe(1)
  expect(catalystSceneStats.mock.calls.length).toBe(1)
  expect(worldsContentServerLiveData.mock.calls.length).toBe(1)
})

test("should return a list of places with Realm details", async () => {
  find.mockResolvedValueOnce(Promise.resolve(allPlacesWithAggregatedAttributes))
  find.mockResolvedValueOnce(Promise.resolve([{ total: 2 }]))
  catalystHotScenes.mockReturnValueOnce([hotSceneGenesisPlaza])
  catalystSceneStats.mockResolvedValueOnce(
    Promise.resolve(sceneStatsGenesisPlaza)
  )
  worldsContentServerLiveData.mockReturnValueOnce(worldsLiveData)
  const request = new Request("/")
  const url = new URL("https://localhost/?with_realms_detail=true")
  const placeResponse = await getAllPlacesList({
    request,
    url,
  })
  expect(placeResponse.body).toEqual({
    ok: true,
    total: 2,
    data: [
      {
        ...allPlacesWithAggregatedAttributes[0],
        user_count: hotSceneGenesisPlaza.usersTotalCount,
        user_visits: sceneStatsGenesisPlaza["-9,-9"].last_30d.users,
        realms_detail: hotSceneGenesisPlaza.realms,
      },
      {
        ...allPlacesWithAggregatedAttributes[1],
        user_count: worldsLiveData.totalUsers,
        // TODO: Get user visits from world stats
        user_visits: 0,
      },
    ],
  })
  expect(find.mock.calls.length).toBe(2)
  expect(catalystHotScenes.mock.calls.length).toBe(1)
  expect(catalystSceneStats.mock.calls.length).toBe(1)
  expect(worldsContentServerLiveData.mock.calls.length).toBe(1)
})

test("should return 0 as total list when query onlyFavorites with no auth", async () => {
  const request = new Request("/")
  const url = new URL("https://localhost/?only_favorites=true")
  const placeResponse = await getAllPlacesList({
    request,
    url,
  })

  expect(placeResponse.body).toEqual({
    ok: true,
    total: 0,
    data: [],
  })
  expect(find.mock.calls.length).toBe(0)
})

test("should return an error when a wrong value has been sent in the query", async () => {
  const request = new Request("/")
  const url = new URL("https://localhost/?order_by=fake")

  expect(async () =>
    getAllPlacesList({
      request,
      url,
    })
  ).rejects.toThrowError()
})
