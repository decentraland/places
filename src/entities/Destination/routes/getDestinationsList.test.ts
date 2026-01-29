import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"

import { getDestinationsList } from "./getDestinationsList"
import { allPlacesWithAggregatedAttributes } from "../../../__data__/allPlacesWithAggregatedAttributes"
import { hotSceneGenesisPlaza } from "../../../__data__/hotSceneGenesisPlaza"
import { placeGenesisPlazaWithAggregatedAttributes } from "../../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import { sceneStatsGenesisPlaza } from "../../../__data__/sceneStatsGenesisPlaza"
import { worldsLiveData } from "../../../__data__/worldsLiveData"
import CommsGatekeeper from "../../../api/CommsGatekeeper"
import DataTeam from "../../../api/DataTeam"
import Events from "../../../api/Events"
import * as hotScenesModule from "../../../modules/hotScenes"
import PlaceModel from "../../Place/model"
import * as worldUtilsModule from "../../World/utils"

const find = jest.spyOn(PlaceModel, "namedQuery")
const catalystHotScenes = jest.spyOn(hotScenesModule, "getHotScenes")
const catalystSceneStats = jest.spyOn(DataTeam.get(), "getSceneStats")
const getWorldsLiveDataMock = jest.spyOn(worldUtilsModule, "getWorldsLiveData")
const commsGatekeeperGet = jest.spyOn(CommsGatekeeper, "get")
const eventsGet = jest.spyOn(Events, "get")

afterEach(() => {
  find.mockReset()
  catalystHotScenes.mockReset()
  catalystSceneStats.mockReset()
  getWorldsLiveDataMock.mockReset()
  commsGatekeeperGet.mockReset()
  eventsGet.mockReset()
})

describe("getDestinationsList", () => {
  describe("when called with with_connected_users=true", () => {
    describe("and destinations include places", () => {
      it("should return destinations with connected_addresses for places", async () => {
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
        const response = await getDestinationsList({
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
              connected_addresses: [
                "0x1234567890abcdef1234567890abcdef12345678",
                "0xabcdef1234567890abcdef1234567890abcdef12",
              ],
            },
          ],
        })

        expect(commsGatekeeperGet).toHaveBeenCalled()
        expect(mockCommsInstance.getSceneParticipants).toHaveBeenCalledWith(
          "0,0"
        )
      })
    })

    describe("and destinations include worlds", () => {
      it("should return destinations with connected_addresses for worlds", async () => {
        const worldDestination = allPlacesWithAggregatedAttributes[1] // world with world_name: "test.dcl.eth"

        const mockCommsInstance = {
          getSceneParticipants: jest.fn().mockResolvedValue([]),
          getWorldParticipants: jest
            .fn()
            .mockResolvedValue(["0xabc1234567890abcdef1234567890abcdef12345"]),
        }
        commsGatekeeperGet.mockReturnValue(mockCommsInstance as any)

        find.mockResolvedValueOnce(Promise.resolve([worldDestination]))
        find.mockResolvedValueOnce(Promise.resolve([{ total: 1 }]))
        catalystHotScenes.mockReturnValueOnce([])
        catalystSceneStats.mockResolvedValueOnce(Promise.resolve({}))
        getWorldsLiveDataMock.mockReturnValueOnce(worldsLiveData)

        const request = new Request("/")
        const url = new URL(
          "https://localhost/?with_connected_users=true&only_worlds=true"
        )
        const response = await getDestinationsList({
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
              user_visits: 0,
              connected_addresses: [
                "0xabc1234567890abcdef1234567890abcdef12345",
              ],
            },
          ],
        })

        expect(commsGatekeeperGet).toHaveBeenCalled()
        expect(mockCommsInstance.getWorldParticipants).toHaveBeenCalledWith(
          "test.dcl.eth"
        )
      })
    })

    describe("and destinations have no connected users", () => {
      it("should return destinations with empty connected_addresses array", async () => {
        const mockCommsInstance = {
          getSceneParticipants: jest.fn().mockResolvedValue([]),
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
        const response = await getDestinationsList({
          request,
          url,
        })

        expect(response.body.data[0].connected_addresses).toEqual([])
      })
    })

    describe("and comms-gatekeeper returns an error", () => {
      it("should return destinations with empty connected_addresses array", async () => {
        const mockCommsInstance = {
          getSceneParticipants: jest
            .fn()
            .mockRejectedValue(new Error("Connection failed")),
          getWorldParticipants: jest
            .fn()
            .mockRejectedValue(new Error("Connection failed")),
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
        const response = await getDestinationsList({
          request,
          url,
        })

        // Should still return data without throwing
        expect(response.body.data[0].connected_addresses).toEqual([])
      })
    })
  })

  describe("when called without with_connected_users parameter", () => {
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
      const url = new URL("https://localhost/")
      const response = await getDestinationsList({
        request,
        url,
      })

      expect(response.body.data[0]).not.toHaveProperty("connected_addresses")
      expect(commsGatekeeperGet).not.toHaveBeenCalled()
    })
  })

  describe("when called with with_connected_users=false", () => {
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
      const response = await getDestinationsList({
        request,
        url,
      })

      expect(response.body.data[0]).not.toHaveProperty("connected_addresses")
      expect(commsGatekeeperGet).not.toHaveBeenCalled()
    })
  })

  describe("when called with empty destinations list", () => {
    it("should not call comms-gatekeeper", async () => {
      find.mockResolvedValueOnce(Promise.resolve([]))
      find.mockResolvedValueOnce(Promise.resolve([{ total: 0 }]))
      catalystHotScenes.mockReturnValueOnce([])
      catalystSceneStats.mockResolvedValueOnce(Promise.resolve({}))
      getWorldsLiveDataMock.mockReturnValueOnce(worldsLiveData)

      const request = new Request("/")
      const url = new URL("https://localhost/?with_connected_users=true")
      const response = await getDestinationsList({
        request,
        url,
      })

      expect(response.body.data).toEqual([])
      expect(commsGatekeeperGet).not.toHaveBeenCalled()
    })
  })

  describe("when called with with_live_events=true", () => {
    describe("and the destination has a live event", () => {
      let mockEventsInstance: any

      beforeEach(() => {
        mockEventsInstance = {
          checkLiveEventsForDestinations: jest
            .fn()
            .mockImplementation(async (destinationIds: string[]) => {
              const map = new Map<string, boolean>()
              for (const id of destinationIds) {
                map.set(id, true)
              }
              return map
            }),
        }
        eventsGet.mockReturnValue(mockEventsInstance)
      })

      it("should return destinations with live=true", async () => {
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
        const url = new URL("https://localhost/?with_live_events=true")
        const response = await getDestinationsList({
          request,
          url,
        })

        expect(response.body.data[0].live).toBe(true)
        expect(eventsGet).toHaveBeenCalled()
      })
    })

    describe("and the destination has no live event", () => {
      let mockEventsInstance: any

      beforeEach(() => {
        mockEventsInstance = {
          checkLiveEventsForDestinations: jest
            .fn()
            .mockImplementation(async (destinationIds: string[]) => {
              const map = new Map<string, boolean>()
              for (const id of destinationIds) {
                map.set(id, false)
              }
              return map
            }),
        }
        eventsGet.mockReturnValue(mockEventsInstance)
      })

      it("should return destinations with live=false", async () => {
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
        const url = new URL("https://localhost/?with_live_events=true")
        const response = await getDestinationsList({
          request,
          url,
        })

        expect(response.body.data[0].live).toBe(false)
      })
    })
  })

  describe("when called without with_live_events parameter", () => {
    it("should not include live property in response", async () => {
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
      const response = await getDestinationsList({
        request,
        url,
      })

      expect(response.body.data[0]).not.toHaveProperty("live")
      expect(eventsGet).not.toHaveBeenCalled()
    })
  })
})
