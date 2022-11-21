import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"
import Catalyst from "decentraland-gatsby/dist/utils/api/Catalyst"

import {
  entitySceneGenesisPlaza,
  hotSceneGenesisPlaza,
  placeGenesisPlaza,
  sceneStatsGenesisPlaza,
} from "../../../__data__/entities"
import DataTeam from "../../../api/DataTeam"
import PlaceModel from "../model"
import { getPlaceList } from "./getPlaceList"

const find = jest.spyOn(PlaceModel, "namedQuery")
const catalystHotScenes = jest.spyOn(Catalyst.get(), "getHostScenes")
const catalystEntityScenes = jest.spyOn(Catalyst.get(), "getEntityScenes")
const catalystSceneStats = jest.spyOn(DataTeam.get(), "getSceneStats")

afterEach(() => {
  find.mockReset()
})

test("should return a list of places with no query", async () => {
  find.mockResolvedValueOnce(Promise.resolve([placeGenesisPlaza]))
  find.mockResolvedValueOnce(Promise.resolve([{ total: 1 }]))
  catalystHotScenes.mockResolvedValueOnce(
    Promise.resolve([hotSceneGenesisPlaza])
  )
  catalystEntityScenes.mockResolvedValueOnce(
    Promise.resolve([entitySceneGenesisPlaza])
  )
  catalystSceneStats.mockResolvedValueOnce(
    Promise.resolve(sceneStatsGenesisPlaza)
  )
  const request = new Request("/")
  const url = new URL("https://localhost/")
  const placeResponse = await getPlaceList({
    request,
    url,
  })
  expect(placeResponse.body).toEqual({
    ok: true,
    total: 1,
    data: [
      {
        ...placeGenesisPlaza,
        user_count: hotSceneGenesisPlaza.usersTotalCount,
        user_visits: sceneStatsGenesisPlaza["-9,-9"].last_30d.users,
        last_deployed_at: new Date(entitySceneGenesisPlaza.timestamp),
      },
    ],
  })
  expect(find.mock.calls.length).toBe(2)
  expect(catalystHotScenes.mock.calls.length).toBe(1)
  expect(catalystEntityScenes.mock.calls.length).toBe(1)
  expect(catalystSceneStats.mock.calls.length).toBe(1)
})

test("should return a list of places with query", async () => {
  find.mockResolvedValueOnce(Promise.resolve([placeGenesisPlaza]))
  find.mockResolvedValueOnce(Promise.resolve([{ total: 1 }]))
  catalystHotScenes.mockResolvedValueOnce(
    Promise.resolve([hotSceneGenesisPlaza])
  )
  catalystEntityScenes.mockResolvedValueOnce(
    Promise.resolve([entitySceneGenesisPlaza])
  )
  catalystSceneStats.mockResolvedValueOnce(
    Promise.resolve(sceneStatsGenesisPlaza)
  )
  const request = new Request("/")
  const url = new URL(
    "https://localhost/?position=-9,-9&limit=1&offset=1&order_by=like_rate&order=asc"
  )
  const placeResponse = await getPlaceList({
    request,
    url,
  })

  expect(placeResponse.body).toEqual({
    ok: true,
    total: 1,
    data: [
      {
        ...placeGenesisPlaza,
        user_count: hotSceneGenesisPlaza.usersTotalCount,
        user_visits: sceneStatsGenesisPlaza["-9,-9"].last_30d.users,
        last_deployed_at: new Date(entitySceneGenesisPlaza.timestamp),
      },
    ],
  })
  expect(find.mock.calls.length).toBe(2)
  expect(catalystHotScenes.mock.calls.length).toBe(1)
  expect(catalystEntityScenes.mock.calls.length).toBe(1)
  expect(catalystSceneStats.mock.calls.length).toBe(1)
})

test("should return a list of places with order by most_active", async () => {
  find.mockResolvedValueOnce(Promise.resolve([placeGenesisPlaza]))
  catalystHotScenes.mockResolvedValueOnce(
    Promise.resolve([hotSceneGenesisPlaza])
  )
  catalystEntityScenes.mockResolvedValueOnce(
    Promise.resolve([entitySceneGenesisPlaza])
  )
  catalystSceneStats.mockResolvedValueOnce(
    Promise.resolve(sceneStatsGenesisPlaza)
  )
  const request = new Request("/")
  const url = new URL("https://localhost/?&order_by=most_active&limit=1")
  const placeResponse = await getPlaceList({
    request,
    url,
  })

  expect(placeResponse.body).toEqual({
    ok: true,
    total: 1,
    data: [
      {
        ...placeGenesisPlaza,
        user_count: hotSceneGenesisPlaza.usersTotalCount,
        user_visits: sceneStatsGenesisPlaza["-9,-9"].last_30d.users,
        last_deployed_at: new Date(entitySceneGenesisPlaza.timestamp),
      },
    ],
  })
  expect(find.mock.calls.length).toBe(1)
  expect(catalystHotScenes.mock.calls.length).toBe(1)
  expect(catalystEntityScenes.mock.calls.length).toBe(1)
  expect(catalystSceneStats.mock.calls.length).toBe(1)
})

test("should return 0 as total list when query onlyFavorites with no auth", async () => {
  const request = new Request("/")
  const url = new URL("https://localhost/?only_favorites=true")
  const placeResponse = await getPlaceList({
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
    getPlaceList({
      request,
      url,
    })
  ).rejects.toThrowError()
})
