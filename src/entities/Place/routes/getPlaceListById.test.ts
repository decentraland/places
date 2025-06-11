import Logger from "decentraland-gatsby/dist/entities/Logger"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"

import { placeGenesisPlazaWithAggregatedAttributes } from "../../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import PlaceModel from "../model"
import { getPlaceListById } from "./getPlaceListById"

const find = jest.spyOn(PlaceModel, "namedQuery")
const countByIds = jest.spyOn(PlaceModel, "countByIds")

afterEach(() => {
  find.mockReset()
  countByIds.mockReset()
})

function createContext(body: any): Context {
  const request = new Request("/")
  const url = new URL("https://localhost/")
  return {
    request,
    url,
    body,
    query: {},
    params: {},
    routePath: "",
    logger: new Logger("test"),
    headers: {},
    method: "GET",
    path: "/",
    hostname: "localhost",
    protocol: "https",
    secure: true,
    ip: "127.0.0.1",
    ips: ["127.0.0.1"],
  }
}

test("should return a list of places by ids with no query", async () => {
  find.mockResolvedValueOnce([placeGenesisPlazaWithAggregatedAttributes])
  countByIds.mockResolvedValueOnce(1)

  const ctx = createContext([placeGenesisPlazaWithAggregatedAttributes.id])
  const placeResponse = await getPlaceListById(ctx)

  expect(placeResponse.body).toEqual({
    ok: true,
    total: 1,
    data: [placeGenesisPlazaWithAggregatedAttributes],
  })
  expect(find.mock.calls.length).toBe(1)
  expect(countByIds.mock.calls.length).toBe(1)
})

test("should return a list of places by ids with query", async () => {
  find.mockResolvedValueOnce([placeGenesisPlazaWithAggregatedAttributes])
  countByIds.mockResolvedValueOnce(1)

  const ctx = createContext([placeGenesisPlazaWithAggregatedAttributes.id])
  ctx.url = new URL(
    "https://localhost/?limit=1&offset=1&order_by=like_rate&order=asc"
  )
  const placeResponse = await getPlaceListById(ctx)

  expect(placeResponse.body).toEqual({
    ok: true,
    total: 1,
    data: [placeGenesisPlazaWithAggregatedAttributes],
  })
  expect(find.mock.calls.length).toBe(1)
  expect(countByIds.mock.calls.length).toBe(1)
})

test("should return an empty list when no ids are provided", async () => {
  const ctx = createContext(null)
  const placeResponse = await getPlaceListById(ctx)

  expect(placeResponse.body).toEqual({
    ok: true,
    total: 0,
    data: [],
  })
  expect(find.mock.calls.length).toBe(0)
  expect(countByIds.mock.calls.length).toBe(0)
})

test("should return an error when a wrong value has been sent in the query", async () => {
  const ctx = createContext([placeGenesisPlazaWithAggregatedAttributes.id])
  ctx.url = new URL("https://localhost/?order_by=fake")

  expect(async () => getPlaceListById(ctx)).rejects.toThrowError()
})

test("should return a list of places by ids with authenticated user", async () => {
  find.mockResolvedValueOnce([placeGenesisPlazaWithAggregatedAttributes])
  countByIds.mockResolvedValueOnce(1)

  const ctx = createContext([placeGenesisPlazaWithAggregatedAttributes.id])
  ctx.request.headers.set(
    "Authorization",
    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoiMHgxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwIn0.123"
  )
  const placeResponse = await getPlaceListById(ctx)

  expect(placeResponse.body).toEqual({
    ok: true,
    total: 1,
    data: [placeGenesisPlazaWithAggregatedAttributes],
  })
  expect(find.mock.calls.length).toBe(1)
  expect(countByIds.mock.calls.length).toBe(1)
})
