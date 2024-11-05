import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"

import { hotSceneGenesisPlaza } from "../../../__data__/hotSceneGenesisPlaza"
import { placeGenesisPlazaWithAggregatedAttributes } from "../../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import { sceneStatsGenesisPlaza } from "../../../__data__/sceneStatsGenesisPlaza"
import PlaceModel from "../../Place/model"
import * as hotScenes from "../../RealmProvider/utils"
import * as sceneStats from "../../SceneStats/utils"
import { getMapPlaces } from "./getMapPlaces"

const find = jest.spyOn(PlaceModel, "namedQuery")
const catalystHotScenes = jest.spyOn(hotScenes, "getHotScenes")
const catalystSceneStats = jest.spyOn(sceneStats, "getSceneStats")

afterEach(() => {
  find.mockReset()
  catalystHotScenes.mockReset()
  catalystSceneStats.mockReset()
})

test("should return a object of places with no query", async () => {
  find.mockResolvedValueOnce(
    Promise.resolve([placeGenesisPlazaWithAggregatedAttributes])
  )
  find.mockResolvedValueOnce(Promise.resolve([{ total: 1 }]))
  catalystHotScenes.mockReturnValueOnce([hotSceneGenesisPlaza])
  catalystSceneStats.mockResolvedValueOnce(
    Promise.resolve(sceneStatsGenesisPlaza)
  )
  const request = new Request("/")
  const url = new URL("https://localhost/")
  const placeResponse = await getMapPlaces({
    request,
    url,
  })
  expect(placeResponse.body).toEqual({
    ok: true,
    total: 1,
    data: {
      ["-9,-9"]: {
        ...placeGenesisPlazaWithAggregatedAttributes,
        user_count: hotSceneGenesisPlaza.usersTotalCount,
        user_visits: sceneStatsGenesisPlaza["-9,-9"].last_30d.users,
        positions: undefined,
      },
    },
  })
  expect(find.mock.calls.length).toBe(2)
  expect(catalystHotScenes.mock.calls.length).toBe(1)
  expect(catalystSceneStats.mock.calls.length).toBe(1)
})

test("should return a object of places with query", async () => {
  find.mockResolvedValueOnce(
    Promise.resolve([placeGenesisPlazaWithAggregatedAttributes])
  )
  find.mockResolvedValueOnce(Promise.resolve([{ total: 1 }]))
  catalystHotScenes.mockReturnValueOnce([hotSceneGenesisPlaza])

  catalystSceneStats.mockResolvedValueOnce(
    Promise.resolve(sceneStatsGenesisPlaza)
  )
  const request = new Request("/")
  const url = new URL(
    "https://localhost/?position=-9,-9&limit=1&offset=1&order_by=like_rate&order=asc"
  )
  const placeResponse = await getMapPlaces({
    request,
    url,
  })

  expect(placeResponse.body).toEqual({
    ok: true,
    total: 1,
    data: {
      ["-9,-9"]: {
        ...placeGenesisPlazaWithAggregatedAttributes,
        user_count: hotSceneGenesisPlaza.usersTotalCount,
        user_visits: sceneStatsGenesisPlaza["-9,-9"].last_30d.users,
        positions: undefined,
      },
    },
  })
  expect(find.mock.calls.length).toBe(2)
  expect(catalystHotScenes.mock.calls.length).toBe(1)
  expect(catalystSceneStats.mock.calls.length).toBe(1)
})

test("should return a object of places with order by most_active", async () => {
  find.mockResolvedValueOnce(
    Promise.resolve([placeGenesisPlazaWithAggregatedAttributes])
  )
  catalystHotScenes.mockReturnValueOnce([hotSceneGenesisPlaza])

  catalystSceneStats.mockResolvedValueOnce(
    Promise.resolve(sceneStatsGenesisPlaza)
  )
  const request = new Request("/")
  const url = new URL("https://localhost/?&order_by=most_active&limit=1")
  const placeResponse = await getMapPlaces({
    request,
    url,
  })

  expect(placeResponse.body).toEqual({
    ok: true,
    total: 1,
    data: {
      ["-9,-9"]: {
        ...placeGenesisPlazaWithAggregatedAttributes,
        user_count: hotSceneGenesisPlaza.usersTotalCount,
        user_visits: sceneStatsGenesisPlaza["-9,-9"].last_30d.users,
        positions: undefined,
      },
    },
  })
  expect(find.mock.calls.length).toBe(1)
  expect(catalystHotScenes.mock.calls.length).toBe(1)
  expect(catalystSceneStats.mock.calls.length).toBe(1)
})

test("should return a object of places with Realm details", async () => {
  find.mockResolvedValueOnce(
    Promise.resolve([placeGenesisPlazaWithAggregatedAttributes])
  )
  find.mockResolvedValueOnce(Promise.resolve([{ total: 1 }]))
  catalystHotScenes.mockReturnValueOnce([hotSceneGenesisPlaza])

  catalystSceneStats.mockResolvedValueOnce(
    Promise.resolve(sceneStatsGenesisPlaza)
  )
  const request = new Request("/")
  const url = new URL("https://localhost/?with_realms_detail=true")
  const placeResponse = await getMapPlaces({
    request,
    url,
  })
  expect(placeResponse.body).toEqual({
    ok: true,
    total: 1,
    data: {
      ["-9,-9"]: {
        ...placeGenesisPlazaWithAggregatedAttributes,
        user_count: hotSceneGenesisPlaza.usersTotalCount,
        user_visits: sceneStatsGenesisPlaza["-9,-9"].last_30d.users,
        realms_detail: hotSceneGenesisPlaza.realms,
        positions: undefined,
      },
    },
  })
  expect(find.mock.calls.length).toBe(2)
  expect(catalystHotScenes.mock.calls.length).toBe(1)
  expect(catalystSceneStats.mock.calls.length).toBe(1)
})

test("should return 0 as total list when query onlyFavorites with no auth", async () => {
  const request = new Request("/")
  const url = new URL("https://localhost/?only_favorites=true")
  const placeResponse = await getMapPlaces({
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
    getMapPlaces({
      request,
      url,
    })
  ).rejects.toThrowError()
})
