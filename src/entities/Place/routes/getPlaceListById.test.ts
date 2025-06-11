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

test("should return a list of places by ids with no query", async () => {
  find.mockResolvedValueOnce([placeGenesisPlazaWithAggregatedAttributes])
  countByIds.mockResolvedValueOnce(1)

  const request = new Request("/")
  const url = new URL("https://localhost/")
  const placeResponse = await getPlaceListById({
    request,
    url,
    body: [placeGenesisPlazaWithAggregatedAttributes.id],
  } as any)

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

  const request = new Request("/")
  const url = new URL(
    "https://localhost/?limit=1&offset=1&order_by=like_rate&order=asc"
  )
  const placeResponse = await getPlaceListById({
    request,
    url,
    body: [placeGenesisPlazaWithAggregatedAttributes.id],
  } as any)

  expect(placeResponse.body).toEqual({
    ok: true,
    total: 1,
    data: [placeGenesisPlazaWithAggregatedAttributes],
  })
  expect(find.mock.calls.length).toBe(1)
  expect(countByIds.mock.calls.length).toBe(1)
})

test("should return an empty list when no ids are provided", async () => {
  const request = new Request("/")
  const url = new URL("https://localhost/")
  const placeResponse = await getPlaceListById({
    request,
    url,
    body: null,
  } as any)

  expect(placeResponse.body).toEqual({
    ok: true,
    total: 0,
    data: [],
  })
  expect(find.mock.calls.length).toBe(0)
  expect(countByIds.mock.calls.length).toBe(0)
})

test("should return an error when a wrong value has been sent in the query", async () => {
  const request = new Request("/")
  const url = new URL("https://localhost/?order_by=fake")

  expect(async () =>
    getPlaceListById({
      request,
      url,
      body: [placeGenesisPlazaWithAggregatedAttributes.id],
    } as any)
  ).rejects.toThrowError()
})

test("should return a list of places by ids with authenticated user", async () => {
  find.mockResolvedValueOnce([placeGenesisPlazaWithAggregatedAttributes])
  countByIds.mockResolvedValueOnce(1)

  const request = new Request("/")
  request.headers.set(
    "Authorization",
    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoiMHgxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwIn0.123"
  )
  const url = new URL("https://localhost/")
  const placeResponse = await getPlaceListById({
    request,
    url,
    body: [placeGenesisPlazaWithAggregatedAttributes.id],
  } as any)

  expect(placeResponse.body).toEqual({
    ok: true,
    total: 1,
    data: [placeGenesisPlazaWithAggregatedAttributes],
  })
  expect(find.mock.calls.length).toBe(1)
  expect(countByIds.mock.calls.length).toBe(1)
})
