import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"

import { getUnifiedDestinationsList } from "./getUnifiedDestinationsList"
import { allPlacesWithAggregatedAttributes } from "../../../__data__/allPlacesWithAggregatedAttributes"
import { hotSceneGenesisPlaza } from "../../../__data__/hotSceneGenesisPlaza"
import { placeGenesisPlazaWithAggregatedAttributes } from "../../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import { sceneStatsGenesisPlaza } from "../../../__data__/sceneStatsGenesisPlaza"
import { worldsLiveData } from "../../../__data__/worldsLiveData"
import CatalystAPI from "../../../api/CatalystAPI"
import DataTeam from "../../../api/DataTeam"
import * as hotScenesModule from "../../../modules/hotScenes"
import PlaceModel from "../../Place/model"
import * as worldUtilsModule from "../../World/utils"

const find = jest.spyOn(PlaceModel, "namedQuery")
const catalystHotScenes = jest.spyOn(hotScenesModule, "getHotScenes")
const catalystSceneStats = jest.spyOn(DataTeam.get(), "getSceneStats")
const getWorldsLiveDataMock = jest.spyOn(worldUtilsModule, "getWorldsLiveData")
const catalystAPI = jest.spyOn(CatalystAPI, "get")

afterEach(() => {
  find.mockReset()
  catalystHotScenes.mockReset()
  catalystSceneStats.mockReset()
  getWorldsLiveDataMock.mockReset()
})

describe("getUnifiedDestinationsList", () => {
  describe("when called with no query parameters", () => {
    it("should return a list of unified destinations", async () => {
      find.mockResolvedValueOnce(
        Promise.resolve([placeGenesisPlazaWithAggregatedAttributes])
      )
      find.mockResolvedValueOnce(Promise.resolve([{ total: 1 }]))
      catalystHotScenes.mockReturnValueOnce([hotSceneGenesisPlaza])
      catalystSceneStats.mockResolvedValueOnce(
        Promise.resolve(sceneStatsGenesisPlaza)
      )
      getWorldsLiveDataMock.mockReturnValueOnce(worldsLiveData)

      const request = new Request("/")
      const url = new URL("https://localhost/")
      const response = await getUnifiedDestinationsList({
        request,
        url,
      })

      expect(response.body).toEqual({
        ok: true,
        total: 1,
        data: [
          {
            ...placeGenesisPlazaWithAggregatedAttributes,
            user_count: hotSceneGenesisPlaza.usersTotalCount,
            user_visits: sceneStatsGenesisPlaza["0,0"].last_30d.users,
          },
        ],
      })
      expect(find.mock.calls.length).toBe(2)
      expect(catalystHotScenes.mock.calls.length).toBe(1)
      expect(catalystSceneStats.mock.calls.length).toBe(1)
    })
  })

  describe("when called with positions filter", () => {
    it("should return destinations filtered by positions", async () => {
      find.mockResolvedValueOnce(
        Promise.resolve([placeGenesisPlazaWithAggregatedAttributes])
      )
      find.mockResolvedValueOnce(Promise.resolve([{ total: 1 }]))
      catalystHotScenes.mockReturnValueOnce([hotSceneGenesisPlaza])
      catalystSceneStats.mockResolvedValueOnce(
        Promise.resolve(sceneStatsGenesisPlaza)
      )
      getWorldsLiveDataMock.mockReturnValueOnce(worldsLiveData)

      const request = new Request("/")
      const url = new URL("https://localhost/?positions=0,0")
      const response = await getUnifiedDestinationsList({
        request,
        url,
      })

      expect(response.body).toEqual({
        ok: true,
        total: 1,
        data: [
          {
            ...placeGenesisPlazaWithAggregatedAttributes,
            user_count: hotSceneGenesisPlaza.usersTotalCount,
            user_visits: sceneStatsGenesisPlaza["0,0"].last_30d.users,
          },
        ],
      })
      expect(find.mock.calls.length).toBe(2)
    })
  })

  describe("when called with names filter", () => {
    it("should return destinations filtered by world names using LIKE matching", async () => {
      const worldDestination = allPlacesWithAggregatedAttributes[1] // world with world_name: "test.dcl.eth"

      find.mockResolvedValueOnce(Promise.resolve([worldDestination]))
      find.mockResolvedValueOnce(Promise.resolve([{ total: 1 }]))
      catalystHotScenes.mockReturnValueOnce([])
      catalystSceneStats.mockResolvedValueOnce(Promise.resolve({}))
      getWorldsLiveDataMock.mockReturnValueOnce(worldsLiveData)

      const request = new Request("/")
      const url = new URL("https://localhost/?names=test")
      const response = await getUnifiedDestinationsList({
        request,
        url,
      })

      expect(response.body).toEqual({
        ok: true,
        total: 1,
        data: [
          {
            ...worldDestination,
            user_count: 30, // from worldsLiveData
            user_visits: 0, // worlds don't have scene stats
          },
        ],
      })
      expect(find.mock.calls.length).toBe(2)
    })
  })

  describe("when called with sdk filter", () => {
    it("should return destinations filtered by SDK version", async () => {
      const sdk7Place = {
        ...placeGenesisPlazaWithAggregatedAttributes,
        sdk: "7",
      }

      find.mockResolvedValueOnce(Promise.resolve([sdk7Place]))
      find.mockResolvedValueOnce(Promise.resolve([{ total: 1 }]))
      catalystHotScenes.mockReturnValueOnce([hotSceneGenesisPlaza])
      catalystSceneStats.mockResolvedValueOnce(
        Promise.resolve(sceneStatsGenesisPlaza)
      )
      getWorldsLiveDataMock.mockReturnValueOnce(worldsLiveData)

      const request = new Request("/")
      const url = new URL("https://localhost/?sdk=7")
      const response = await getUnifiedDestinationsList({
        request,
        url,
      })

      expect(response.body).toEqual({
        ok: true,
        total: 1,
        data: [
          {
            ...sdk7Place,
            user_count: hotSceneGenesisPlaza.usersTotalCount,
            user_visits: sceneStatsGenesisPlaza["0,0"].last_30d.users,
          },
        ],
      })
      expect(find.mock.calls.length).toBe(2)
    })
  })

  describe("when called with only_places filter", () => {
    it("should return only places, excluding worlds", async () => {
      find.mockResolvedValueOnce(
        Promise.resolve([placeGenesisPlazaWithAggregatedAttributes])
      )
      find.mockResolvedValueOnce(Promise.resolve([{ total: 1 }]))
      catalystHotScenes.mockReturnValueOnce([hotSceneGenesisPlaza])
      catalystSceneStats.mockResolvedValueOnce(
        Promise.resolve(sceneStatsGenesisPlaza)
      )
      getWorldsLiveDataMock.mockReturnValueOnce(worldsLiveData)

      const request = new Request("/")
      const url = new URL("https://localhost/?only_places=true")
      const response = await getUnifiedDestinationsList({
        request,
        url,
      })

      expect(response.body).toEqual({
        ok: true,
        total: 1,
        data: [
          {
            ...placeGenesisPlazaWithAggregatedAttributes,
            user_count: hotSceneGenesisPlaza.usersTotalCount,
            user_visits: sceneStatsGenesisPlaza["0,0"].last_30d.users,
          },
        ],
      })
      expect(find.mock.calls.length).toBe(2)
    })
  })

  describe("when called with only_worlds filter", () => {
    it("should return only worlds, excluding places", async () => {
      const worldDestination = allPlacesWithAggregatedAttributes[1]

      find.mockResolvedValueOnce(Promise.resolve([worldDestination]))
      find.mockResolvedValueOnce(Promise.resolve([{ total: 1 }]))
      catalystHotScenes.mockReturnValueOnce([])
      catalystSceneStats.mockResolvedValueOnce(Promise.resolve({}))
      getWorldsLiveDataMock.mockReturnValueOnce(worldsLiveData)

      const request = new Request("/")
      const url = new URL("https://localhost/?only_worlds=true")
      const response = await getUnifiedDestinationsList({
        request,
        url,
      })

      expect(response.body).toEqual({
        ok: true,
        total: 1,
        data: [
          {
            ...worldDestination,
            user_count: 30,
            user_visits: 0, // worlds don't have scene stats
          },
        ],
      })
      expect(find.mock.calls.length).toBe(2)
    })
  })

  describe("when called with only_favorites without authentication", () => {
    it("should return empty list with total 0", async () => {
      const request = new Request("/")
      const url = new URL("https://localhost/?only_favorites=true")
      const response = await getUnifiedDestinationsList({
        request,
        url,
      })

      expect(response.body).toEqual({
        ok: true,
        total: 0,
        data: [],
      })
      expect(find.mock.calls.length).toBe(0)
    })
  })

  describe("when called with pagination parameters", () => {
    it("should return paginated results", async () => {
      find.mockResolvedValueOnce(
        Promise.resolve([placeGenesisPlazaWithAggregatedAttributes])
      )
      find.mockResolvedValueOnce(Promise.resolve([{ total: 10 }]))
      catalystHotScenes.mockReturnValueOnce([hotSceneGenesisPlaza])
      catalystSceneStats.mockResolvedValueOnce(
        Promise.resolve(sceneStatsGenesisPlaza)
      )
      getWorldsLiveDataMock.mockReturnValueOnce(worldsLiveData)

      const request = new Request("/")
      const url = new URL("https://localhost/?limit=1&offset=0")
      const response = await getUnifiedDestinationsList({
        request,
        url,
      })

      expect(response.body).toEqual({
        ok: true,
        total: 10,
        data: [
          {
            ...placeGenesisPlazaWithAggregatedAttributes,
            user_count: hotSceneGenesisPlaza.usersTotalCount,
            user_visits: sceneStatsGenesisPlaza["0,0"].last_30d.users,
          },
        ],
      })
      expect(find.mock.calls.length).toBe(2)
    })
  })

  describe("when called with order_by parameter", () => {
    it("should return destinations ordered by specified field", async () => {
      find.mockResolvedValueOnce(
        Promise.resolve([placeGenesisPlazaWithAggregatedAttributes])
      )
      find.mockResolvedValueOnce(Promise.resolve([{ total: 1 }]))
      catalystHotScenes.mockReturnValueOnce([hotSceneGenesisPlaza])
      catalystSceneStats.mockResolvedValueOnce(
        Promise.resolve(sceneStatsGenesisPlaza)
      )
      getWorldsLiveDataMock.mockReturnValueOnce(worldsLiveData)

      const request = new Request("/")
      const url = new URL("https://localhost/?order_by=created_at&order=asc")
      const response = await getUnifiedDestinationsList({
        request,
        url,
      })

      expect(response.body).toEqual({
        ok: true,
        total: 1,
        data: [
          {
            ...placeGenesisPlazaWithAggregatedAttributes,
            user_count: hotSceneGenesisPlaza.usersTotalCount,
            user_visits: sceneStatsGenesisPlaza["0,0"].last_30d.users,
          },
        ],
      })
      expect(find.mock.calls.length).toBe(2)
    })
  })

  describe("when called with with_realms_detail parameter", () => {
    it("should return destinations with realm details", async () => {
      find.mockResolvedValueOnce(
        Promise.resolve([placeGenesisPlazaWithAggregatedAttributes])
      )
      find.mockResolvedValueOnce(Promise.resolve([{ total: 1 }]))
      catalystHotScenes.mockReturnValueOnce([hotSceneGenesisPlaza])
      catalystSceneStats.mockResolvedValueOnce(
        Promise.resolve(sceneStatsGenesisPlaza)
      )
      getWorldsLiveDataMock.mockReturnValueOnce(worldsLiveData)

      const request = new Request("/")
      const url = new URL("https://localhost/?with_realms_detail=true")
      const response = await getUnifiedDestinationsList({
        request,
        url,
      })

      expect(response.body).toEqual({
        ok: true,
        total: 1,
        data: [
          {
            ...placeGenesisPlazaWithAggregatedAttributes,
            user_count: hotSceneGenesisPlaza.usersTotalCount,
            user_visits: sceneStatsGenesisPlaza["0,0"].last_30d.users,
            realms_detail: hotSceneGenesisPlaza.realms,
          },
        ],
      })
      expect(find.mock.calls.length).toBe(2)
    })
  })

  describe("when called with owner parameter", () => {
    it("should return destinations including operated lands", async () => {
      const mockCatalystInstance = {
        getAllOperatedLands: jest.fn().mockResolvedValue([
          { x: "0", y: "0" },
          { x: "-9", y: "-9" },
        ]),
      }
      catalystAPI.mockReturnValue(mockCatalystInstance as any)

      find.mockResolvedValueOnce(
        Promise.resolve([placeGenesisPlazaWithAggregatedAttributes])
      )
      find.mockResolvedValueOnce(Promise.resolve([{ total: 1 }]))
      catalystHotScenes.mockReturnValueOnce([hotSceneGenesisPlaza])
      catalystSceneStats.mockResolvedValueOnce(
        Promise.resolve(sceneStatsGenesisPlaza)
      )
      getWorldsLiveDataMock.mockReturnValueOnce(worldsLiveData)

      const request = new Request("/")
      const url = new URL(
        "https://localhost/?owner=0x1234567890123456789012345678901234567890"
      )
      const response = await getUnifiedDestinationsList({
        request,
        url,
      })

      expect(response.body).toEqual({
        ok: true,
        total: 1,
        data: [
          {
            ...placeGenesisPlazaWithAggregatedAttributes,
            user_count: hotSceneGenesisPlaza.usersTotalCount,
            user_visits: sceneStatsGenesisPlaza["0,0"].last_30d.users,
          },
        ],
      })

      expect(catalystAPI).toHaveBeenCalled()
      expect(mockCatalystInstance.getAllOperatedLands).toHaveBeenCalledWith(
        "0x1234567890123456789012345678901234567890"
      )
      expect(find.mock.calls.length).toBe(2)
    })
  })

  describe("highlighted destinations ordering", () => {
    it("should return highlighted destinations first regardless of other sorting", async () => {
      const highlightedPlace = {
        ...placeGenesisPlazaWithAggregatedAttributes,
        id: "highlighted-place-id",
        highlighted: true,
        title: "Highlighted Place",
      }
      const regularPlace = {
        ...placeGenesisPlazaWithAggregatedAttributes,
        id: "regular-place-id",
        highlighted: false,
        title: "Regular Place",
      }

      // Return places in wrong order (regular first) to test that SQL orders correctly
      find.mockResolvedValueOnce(
        Promise.resolve([highlightedPlace, regularPlace])
      )
      find.mockResolvedValueOnce(Promise.resolve([{ total: 2 }]))
      catalystHotScenes.mockReturnValueOnce([hotSceneGenesisPlaza])
      catalystSceneStats.mockResolvedValueOnce(
        Promise.resolve(sceneStatsGenesisPlaza)
      )
      getWorldsLiveDataMock.mockReturnValueOnce(worldsLiveData)

      const request = new Request("/")
      const url = new URL("https://localhost/")
      const response = await getUnifiedDestinationsList({
        request,
        url,
      })

      // Verify the highlighted place comes first
      expect(response.body.data[0].highlighted).toBe(true)
      expect(response.body.data[0].title).toBe("Highlighted Place")
      expect(find.mock.calls.length).toBe(2)
    })
  })
})
