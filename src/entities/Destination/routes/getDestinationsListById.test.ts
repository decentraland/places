import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"

import { getDestinationsListById } from "./getDestinationsListById"
import { allPlacesWithAggregatedAttributes } from "../../../__data__/allPlacesWithAggregatedAttributes"
import { hotSceneGenesisPlaza } from "../../../__data__/hotSceneGenesisPlaza"
import { placeGenesisPlazaWithAggregatedAttributes } from "../../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import { sceneStatsGenesisPlaza } from "../../../__data__/sceneStatsGenesisPlaza"
import { worldsLiveData } from "../../../__data__/worldsLiveData"
import CommsGatekeeper from "../../../api/CommsGatekeeper"
import DataTeam from "../../../api/DataTeam"
import * as hotScenesModule from "../../../modules/hotScenes"
import PlaceModel from "../../Place/model"
import WorldModel from "../../World/model"
import * as worldUtilsModule from "../../World/utils"

const find = jest.spyOn(PlaceModel, "namedQuery")
const worldFind = jest.spyOn(WorldModel, "namedQuery")
const catalystHotScenes = jest.spyOn(hotScenesModule, "getHotScenes")
const catalystSceneStats = jest.spyOn(DataTeam.get(), "getSceneStats")
const getWorldsLiveDataMock = jest.spyOn(worldUtilsModule, "getWorldsLiveData")
const commsGatekeeperGet = jest.spyOn(CommsGatekeeper, "get")

afterEach(() => {
  find.mockReset()
  worldFind.mockReset()
  catalystHotScenes.mockReset()
  catalystSceneStats.mockReset()
  getWorldsLiveDataMock.mockReset()
  commsGatekeeperGet.mockReset()
})

describe("getDestinationsListById", () => {
  describe("when the request body is valid", () => {
    let destinationId: string

    beforeEach(() => {
      destinationId = placeGenesisPlazaWithAggregatedAttributes.id
    })

    describe("and no query parameters are provided", () => {
      it("should return destinations by IDs with default options", async () => {
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
        const response = await getDestinationsListById({
          request,
          url,
          body: [destinationId],
        } as any)

        expect(response.body).toEqual({
          ok: true,
          total: 1,
          data: [
            {
              ...placeGenesisPlazaWithAggregatedAttributes,
              is_private: false,
              user_count: hotSceneGenesisPlaza.usersTotalCount,
              user_visits: sceneStatsGenesisPlaza["0,0"].last_30d.users,
            },
          ],
        })
        expect(find.mock.calls.length).toBe(2)
      })
    })

    describe("and query parameters are provided", () => {
      it("should return destinations with query parameters applied", async () => {
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
          "https://localhost/?limit=10&offset=0&order_by=like_score&order=desc"
        )
        const response = await getDestinationsListById({
          request,
          url,
          body: [destinationId],
        } as any)

        expect(response.body).toEqual({
          ok: true,
          total: 1,
          data: [
            {
              ...placeGenesisPlazaWithAggregatedAttributes,
              is_private: false,
              user_count: hotSceneGenesisPlaza.usersTotalCount,
              user_visits: sceneStatsGenesisPlaza["0,0"].last_30d.users,
            },
          ],
        })
      })
    })

    describe("and with_connected_users is true", () => {
      it("should return destinations with connected_addresses", async () => {
        const mockCommsInstance = {
          getSceneParticipants: jest
            .fn()
            .mockResolvedValue([
              "0x1234567890abcdef1234567890abcdef12345678",
              "0xabcdef1234567890abcdef1234567890abcdef12",
            ]),
          getWorldParticipants: jest.fn().mockResolvedValue([]),
        }
        commsGatekeeperGet.mockReturnValue(mockCommsInstance as any)

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
        const url = new URL("https://localhost/?with_connected_users=true")
        const response = await getDestinationsListById({
          request,
          url,
          body: [destinationId],
        } as any)

        expect(response.body.data[0].connected_addresses).toEqual([
          "0x1234567890abcdef1234567890abcdef12345678",
          "0xabcdef1234567890abcdef1234567890abcdef12",
        ])
        expect(mockCommsInstance.getSceneParticipants).toHaveBeenCalledWith(
          "0,0"
        )
      })
    })

    describe("and multiple destination IDs are provided", () => {
      it("should return all matching destinations", async () => {
        const worldDestination = allPlacesWithAggregatedAttributes[1]
        const destinationIds = [
          placeGenesisPlazaWithAggregatedAttributes.id,
          worldDestination.id,
        ]

        find.mockResolvedValueOnce(
          Promise.resolve([
            placeGenesisPlazaWithAggregatedAttributes,
            worldDestination,
          ])
        )
        find.mockResolvedValueOnce(Promise.resolve([{ total: 2 }]))
        catalystHotScenes.mockReturnValueOnce([hotSceneGenesisPlaza])
        catalystSceneStats.mockResolvedValueOnce(
          Promise.resolve(sceneStatsGenesisPlaza)
        )
        getWorldsLiveDataMock.mockReturnValueOnce(worldsLiveData)

        const request = new Request("/")
        const url = new URL("https://localhost/")
        const response = await getDestinationsListById({
          request,
          url,
          body: destinationIds,
        } as any)

        expect(response.body.total).toBe(2)
        expect(response.body.data.length).toBe(2)
      })
    })
  })

  describe("when the request body is invalid", () => {
    describe("and body is not an array", () => {
      it("should throw an error with BadRequest status", async () => {
        const request = new Request("/")
        const url = new URL("https://localhost/")

        await expect(
          getDestinationsListById({
            request,
            url,
            body: "not-an-array",
          } as any)
        ).rejects.toThrow(
          "Invalid request body. Expected an array of destination IDs."
        )
      })
    })

    describe("and more than 100 IDs are provided", () => {
      it("should throw an error with BadRequest status", async () => {
        const request = new Request("/")
        const url = new URL("https://localhost/")
        const tooManyIds = Array.from({ length: 101 }, (_, i) => `id-${i}`)

        await expect(
          getDestinationsListById({
            request,
            url,
            body: tooManyIds,
          } as any)
        ).rejects.toThrow("Cannot request more than 100 destinations at once")
      })
    })
  })

  describe("when only_favorites is true", () => {
    describe("and user is not authenticated", () => {
      it("should return empty array with total 0", async () => {
        const request = new Request("/")
        const url = new URL("https://localhost/?only_favorites=true")
        const response = await getDestinationsListById({
          request,
          url,
          body: [placeGenesisPlazaWithAggregatedAttributes.id],
        } as any)

        expect(response.body).toEqual({
          ok: true,
          total: 0,
          data: [],
        })
      })
    })
  })

  describe("when with_connected_users is false", () => {
    it("should not include connected_addresses in response", async () => {
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
      const url = new URL("https://localhost/?with_connected_users=false")
      const response = await getDestinationsListById({
        request,
        url,
        body: [placeGenesisPlazaWithAggregatedAttributes.id],
      } as any)

      expect(response.body.data[0]).not.toHaveProperty("connected_addresses")
      expect(commsGatekeeperGet).not.toHaveBeenCalled()
    })
  })

  describe("when destinations list is empty", () => {
    it("should not call comms-gatekeeper even if with_connected_users is true", async () => {
      find.mockResolvedValueOnce(Promise.resolve([]))
      find.mockResolvedValueOnce(Promise.resolve([{ total: 0 }]))
      catalystHotScenes.mockReturnValueOnce([])
      catalystSceneStats.mockResolvedValueOnce(Promise.resolve({}))
      getWorldsLiveDataMock.mockReturnValueOnce(worldsLiveData)

      const request = new Request("/")
      const url = new URL("https://localhost/?with_connected_users=true")
      const response = await getDestinationsListById({
        request,
        url,
        body: ["non-existent-id"],
      } as any)

      expect(response.body.data).toEqual([])
      expect(commsGatekeeperGet).not.toHaveBeenCalled()
    })
  })
})
