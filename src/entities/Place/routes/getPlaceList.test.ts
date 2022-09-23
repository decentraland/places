import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"
import { ParsedQs } from "qs"

import PlaceModel from "../model"
import { getPlaceList } from "./getPlaceList"

const find = jest.spyOn(PlaceModel, "namedQuery")
afterEach(() => {
  find.mockReset()
})

test("should return a list of places with no query", async () => {
  find.mockResolvedValueOnce(Promise.resolve([{}]))
  find.mockResolvedValueOnce(Promise.resolve([{ total: 0 }]))
  const request = new Request("/")
  const url = new URL("https://localhost/")
  const placeResponse = await getPlaceList({
    request,
    url,
  })
  expect(placeResponse.body).toEqual({
    ok: true,
    total: 0,
    data: [{}],
  })
  expect(find.mock.calls.length).toBe(2)
})

test("should return a list of places with query", async () => {
  find.mockResolvedValueOnce(Promise.resolve([{}]))
  find.mockResolvedValueOnce(Promise.resolve([{ total: 0 }]))
  const request = new Request("/")
  const url = new URL(
    "https://localhost/?position=123,123&position=234,234&limit=1&offset=1&order_by=popularity&order=asc"
  )
  const placeResponse = await getPlaceList({
    request,
    url,
  })

  expect(placeResponse.body).toEqual({
    ok: true,
    total: 0,
    data: [{}],
  })
  expect(find.mock.calls.length).toBe(2)
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
