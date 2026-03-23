import {
  fetchNameOwner,
  findNewDeployedPlace,
  findSamePlace,
  isSameWorld,
} from "./utils"
import { contentEntitySceneGenesisPlaza } from "../../__data__/contentEntitySceneGenesisPlaza"
import { placeGenesisPlaza } from "../../__data__/placeGenesisPlaza"
import { placeGenesisPlazaWithAggregatedAttributes } from "../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import { placeRoad } from "../../__data__/placeRoad"
import {
  worldContentEntitySceneParalax,
  worldPlaceParalax,
} from "../../__data__/world"

describe("fetchNameOwner", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("when the world name is a DCL name", () => {
    const worldName = "testworld.dcl.eth"

    describe("and the marketplace subgraph returns an owner", () => {
      let result: string | undefined

      beforeEach(async () => {
        jest.spyOn(global, "fetch").mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              nfts: [
                {
                  owner: { address: "0xdclowner123" },
                  ens: { subdomain: "testworld" },
                },
              ],
            },
          }),
        } as Response)

        result = await fetchNameOwner(worldName)
      })

      it("should query the marketplace subgraph with the subdomain (without .dcl.eth suffix)", () => {
        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        )
        expect(callBody.variables).toEqual({ domains: ["testworld"] })
      })

      it("should return the owner address", () => {
        expect(result).toBe("0xdclowner123")
      })
    })

    describe("and the marketplace subgraph returns no results", () => {
      let result: string | undefined

      beforeEach(async () => {
        jest.spyOn(global, "fetch").mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { nfts: [] } }),
        } as Response)

        result = await fetchNameOwner(worldName)
      })

      it("should return undefined", () => {
        expect(result).toBeUndefined()
      })
    })
  })

  describe("when the world name is an external ENS name", () => {
    const worldName = "myworld.eth"

    describe("and the ENS subgraph returns an owner", () => {
      let result: string | undefined

      beforeEach(async () => {
        jest.spyOn(global, "fetch").mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              domains: [{ wrappedOwner: { id: "0xensowner456" } }],
            },
          }),
        } as Response)

        result = await fetchNameOwner(worldName)
      })

      it("should query the ENS subgraph with the full domain name", () => {
        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        )
        expect(callBody.variables).toEqual({ domains: ["myworld.eth"] })
      })

      it("should return the wrapped owner id", () => {
        expect(result).toBe("0xensowner456")
      })
    })

    describe("and the ENS subgraph returns no results", () => {
      let result: string | undefined

      beforeEach(async () => {
        jest.spyOn(global, "fetch").mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { domains: [] } }),
        } as Response)

        result = await fetchNameOwner(worldName)
      })

      it("should return undefined", () => {
        expect(result).toBeUndefined()
      })
    })
  })

  describe("when the subgraph response is not ok", () => {
    let result: string | undefined

    beforeEach(async () => {
      jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response)

      result = await fetchNameOwner("testworld.dcl.eth")
    })

    it("should return undefined", () => {
      expect(result).toBeUndefined()
    })
  })

  describe("when the fetch throws an error", () => {
    let result: string | undefined

    beforeEach(async () => {
      jest
        .spyOn(global, "fetch")
        .mockRejectedValueOnce(new Error("network error"))

      result = await fetchNameOwner("testworld.dcl.eth")
    })

    it("should return undefined", () => {
      expect(result).toBeUndefined()
    })
  })
})

describe("isNewPlace", () => {
  test("should return the place found if not new place with same base position", async () => {
    expect(
      findSamePlace(contentEntitySceneGenesisPlaza, [
        placeGenesisPlazaWithAggregatedAttributes,
      ])
    ).toBe(placeGenesisPlazaWithAggregatedAttributes)
  })

  test("should return the place found if not new place with different base position", async () => {
    expect(
      findSamePlace(
        {
          ...contentEntitySceneGenesisPlaza,
          metadata: {
            ...contentEntitySceneGenesisPlaza.metadata,
            scene: {
              parcels: contentEntitySceneGenesisPlaza.metadata.scene!.parcels,
              base: "0,0",
            },
          },
        },
        [placeGenesisPlazaWithAggregatedAttributes]
      )
    ).toBe(placeGenesisPlazaWithAggregatedAttributes)
  })

  test("should return true, is new place", async () => {
    expect(findSamePlace(contentEntitySceneGenesisPlaza, [])).toBeNull()
  })
})

describe("findNewDeployedPlace", () => {
  test("should return null if there are no places", async () => {
    expect(findNewDeployedPlace(contentEntitySceneGenesisPlaza, [])).toBeNull()
  })
  test("should return null when the content entity scene do not find a place with deployed_at newer", async () => {
    expect(
      findNewDeployedPlace(contentEntitySceneGenesisPlaza, [
        placeRoad,
        { ...placeGenesisPlaza, deployed_at: new Date("2021-01-01") },
      ])
    ).toBeNull()
  })
  test("should return a place when the content entity scene find a place with deployed_at newer", async () => {
    const now = new Date()
    expect(
      findNewDeployedPlace(contentEntitySceneGenesisPlaza, [
        { ...placeGenesisPlaza, deployed_at: now },
      ])
    ).toEqual({ ...placeGenesisPlaza, deployed_at: now })
  })
})

describe("isSameWorld", () => {
  test("should return true, is same world", async () => {
    expect(
      isSameWorld(worldContentEntitySceneParalax, worldPlaceParalax)
    ).toBeTruthy()
  })

  test("should return false, is not same world", async () => {
    expect(findSamePlace(contentEntitySceneGenesisPlaza, [])).toBeNull()
  })
})
