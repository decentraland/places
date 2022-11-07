import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"
import { v4 as uuid } from "uuid"

import PlaceModel from "../model"
import { getPlace } from "./getPlace"

const place_id = uuid()
const findOne = jest.spyOn(PlaceModel, "namedQuery")
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
  findOne.mockResolvedValueOnce(Promise.resolve([{}]))
  const request = new Request("/")
  const placeResponse = await getPlace({
    request,
    params: { place_id: place_id },
  })
  expect(placeResponse.body).toEqual({
    ok: true,
    data: { user_count: 0, user_visits: 0 },
  })
  expect(findOne.mock.calls.length).toBe(1)
})
