import { randomUUID } from "crypto"

import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"

import { hotSceneGenesisPlaza } from "../../../__data__/hotSceneGenesisPlaza"
import { placeGenesisPlazaWithAggregatedAttributes } from "../../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import { sceneStatsGenesisPlaza } from "../../../__data__/sceneStatsGenesisPlaza"
import DataTeam from "../../../api/DataTeam"
import * as hotScenesModule from "../../../modules/hotScenes"
import PlaceCategories from "../../PlaceCategories/model"
import PlaceModel from "../model"
import { getPlace } from "./getPlace"

const place_id = randomUUID()
const findOne = jest.spyOn(PlaceModel, "namedQuery")
const catalystHotScenes = jest.spyOn(hotScenesModule, "getHotScenes")
const findPC = jest.spyOn(PlaceCategories, "namedQuery")
const catalystSceneStats = jest.spyOn(DataTeam.get(), "getSceneStats")

afterEach(() => {
  findOne.mockReset()
  catalystHotScenes.mockReset()
  findPC.mockReset()
})
test("should return 400 when UUID is incorrect", async () => {
  const request = new Request("/")
  const url = new URL("https://localhost/")
  await expect(() =>
    getPlace({ request, params: { place_id: "123" }, url })
  ).rejects.toThrowError()
  expect(findOne.mock.calls.length).toBe(0)
})
test("should return 404 when UUID do not exist in the model", async () => {
  findOne.mockResolvedValueOnce(Promise.resolve([]))
  findPC.mockResolvedValueOnce(Promise.resolve([]))

  const request = new Request("/")
  const url = new URL("https://localhost/")
  await expect(async () =>
    getPlace({ request, params: { place_id: place_id }, url })
  ).rejects.toThrowError(new Error(`Not found place "${place_id}"`))
  expect(findOne.mock.calls.length).toBe(1)
})
test("should return place if the module found it", async () => {
  findOne.mockResolvedValueOnce(
    Promise.resolve([placeGenesisPlazaWithAggregatedAttributes])
  )

  findPC.mockResolvedValueOnce(Promise.resolve([]))

  catalystHotScenes.mockReturnValueOnce([hotSceneGenesisPlaza])
  catalystSceneStats.mockResolvedValueOnce(
    Promise.resolve(sceneStatsGenesisPlaza)
  )
  const request = new Request("/")
  const url = new URL("https://localhost/")
  const placeResponse = await getPlace({
    request,
    params: { place_id: place_id },
    url,
  })
  expect(placeResponse.body).toEqual({
    ok: true,
    data: {
      ...placeGenesisPlazaWithAggregatedAttributes,
      user_count: hotSceneGenesisPlaza.usersTotalCount,
      user_visits: sceneStatsGenesisPlaza["-9,-9"].last_30d.users,
    },
  })
  expect(findOne.mock.calls.length).toBe(1)
  expect(catalystHotScenes.mock.calls.length).toBe(1)
  expect(catalystSceneStats.mock.calls.length).toBe(1)
})
test("should return place with Realms detail", async () => {
  findOne.mockResolvedValueOnce(
    Promise.resolve([placeGenesisPlazaWithAggregatedAttributes])
  )
  findPC.mockResolvedValueOnce(Promise.resolve([]))

  catalystHotScenes.mockReturnValueOnce([hotSceneGenesisPlaza])
  catalystSceneStats.mockResolvedValueOnce(
    Promise.resolve(sceneStatsGenesisPlaza)
  )
  const request = new Request("/")
  const url = new URL("https://localhost/?with_realms_detail=true")

  const placeResponse = await getPlace({
    request,
    params: { place_id: place_id },
    url,
  })
  expect(placeResponse.body).toEqual({
    ok: true,
    data: {
      ...placeGenesisPlazaWithAggregatedAttributes,
      user_count: hotSceneGenesisPlaza.usersTotalCount,
      user_visits: sceneStatsGenesisPlaza["-9,-9"].last_30d.users,
      realms_detail: hotSceneGenesisPlaza.realms,
    },
  })
  expect(findOne.mock.calls.length).toBe(1)
  expect(catalystHotScenes.mock.calls.length).toBe(1)
  expect(catalystSceneStats.mock.calls.length).toBe(1)
})
