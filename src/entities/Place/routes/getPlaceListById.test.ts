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

test("should throw an error when body is not an array", async () => {
  const request = new Request("/")
  const url = new URL("https://localhost/")

  await expect(
    getPlaceListById({
      request,
      url,
      body: "not-an-array",
    } as any)
  ).rejects.toThrow("Invalid request body. Expected an array of place IDs.")
})

test("should throw an error when requesting more than 100 places", async () => {
  const request = new Request("/")
  const url = new URL("https://localhost/")
  const tooManyIds = Array.from({ length: 101 }, (_, i) => `id-${i}`)

  await expect(
    getPlaceListById({
      request,
      url,
      body: tooManyIds,
    } as any)
  ).rejects.toThrow("Cannot request more than 100 places at once")
})
