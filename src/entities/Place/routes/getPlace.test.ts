import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"
import Catalyst from "decentraland-gatsby/dist/utils/api/Catalyst"
import Time from "decentraland-gatsby/dist/utils/date/Time"
import { v4 as uuid } from "uuid"

import {
  entitySceneGenesisPlaza,
  hotSceneGenesisPlaza,
  placeGenesisPlaza,
  sceneStatsGenesisPlaza,
} from "../../../__data__/entities"
import DataTeam from "../../../api/DataTeam"
import { getEntityScene } from "../../../modules/entityScene"
import PlaceModel from "../model"
import { getPlace } from "./getPlace"

const place_id = uuid()
const findOne = jest.spyOn(PlaceModel, "namedQuery")
const catalystHotScenes = jest.spyOn(Catalyst.get(), "getHostScenes")
const catalystEntityScenes = jest.spyOn(Catalyst.get(), "getEntityScenes")
const catalystSceneStats = jest.spyOn(DataTeam.get(), "getSceneStats")

afterEach(() => {
  findOne.mockReset()
})
test("should return 400 when UUID is incorrect", async () => {
  const request = new Request("/")
  await expect(() =>
    getPlace({ request, params: { place_id: "123" } })
  ).rejects.toThrowError()
  expect(findOne.mock.calls.length).toBe(0)
})
test("should return 404 when UUID do not exist in the model", async () => {
  findOne.mockResolvedValueOnce(Promise.resolve([]))
  const request = new Request("/")
  await expect(async () =>
    getPlace({ request, params: { place_id: place_id } })
  ).rejects.toThrowError(new Error(`Not found place "${place_id}"`))
  expect(findOne.mock.calls.length).toBe(1)
})
test("should return place if the module found it", async () => {
  findOne.mockResolvedValueOnce(Promise.resolve([placeGenesisPlaza]))

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
  const placeResponse = await getPlace({
    request,
    params: { place_id: place_id },
  })
  expect(placeResponse.body).toEqual({
    ok: true,
    data: {
      ...placeGenesisPlaza,
      user_count: hotSceneGenesisPlaza.usersTotalCount,
      user_visits: sceneStatsGenesisPlaza["-9,-9"].last_30d.users,
      last_deployed_at: new Date(entitySceneGenesisPlaza.timestamp),
    },
  })
  expect(findOne.mock.calls.length).toBe(1)
  expect(catalystHotScenes.mock.calls.length).toBe(1)
  expect(catalystEntityScenes.mock.calls.length).toBe(1)
  expect(catalystSceneStats.mock.calls.length).toBe(1)
})
