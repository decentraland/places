import API from "decentraland-gatsby/dist/utils/api/API"

import CommsGatekeeper from "./CommsGatekeeper"

const CACHE_WINDOW_MS = 30 * 1000

describe("CommsGatekeeper", () => {
  let fetchMock: jest.SpyInstance
  let client: CommsGatekeeper

  beforeEach(() => {
    jest.useFakeTimers()
    fetchMock = jest
      .spyOn(
        API.prototype as unknown as { fetch: () => Promise<unknown> },
        "fetch"
      )
      .mockResolvedValue({ ok: true, data: { addresses: ["0xabc"] } })
    client = CommsGatekeeper.from("https://comms-gatekeeper.example.com")
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.resetAllMocks()
  })

  describe("when asking twice for the participants of the same scene", () => {
    describe("and the second call happens inside the cache window", () => {
      beforeEach(async () => {
        await client.getSceneParticipants("1,1")
        jest.setSystemTime(Date.now() + CACHE_WINDOW_MS - 1)
        await client.getSceneParticipants("1,1")
      })

      it("should reach the service only once", () => {
        expect(fetchMock).toHaveBeenCalledTimes(1)
      })
    })

    describe("and the cache window has already passed", () => {
      beforeEach(async () => {
        await client.getSceneParticipants("2,2")
        jest.setSystemTime(Date.now() + CACHE_WINDOW_MS + 1)
        await client.getSceneParticipants("2,2")
      })

      it("should reach the service again so somebody who walked out stops being listed", () => {
        expect(fetchMock).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe("when asking twice for the participants of the same world", () => {
    describe("and the cache window has already passed", () => {
      beforeEach(async () => {
        await client.getWorldParticipants("a-world.dcl.eth")
        jest.setSystemTime(Date.now() + CACHE_WINDOW_MS + 1)
        await client.getWorldParticipants("a-world.dcl.eth")
      })

      it("should reach the service again so somebody who walked in starts being listed", () => {
        expect(fetchMock).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe("when a scene and a world share the same identifier", () => {
    beforeEach(async () => {
      await client.getSceneParticipants("shared")
      await client.getWorldParticipants("shared")
    })

    it("should keep them apart instead of serving one from the other's entry", () => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })
})
