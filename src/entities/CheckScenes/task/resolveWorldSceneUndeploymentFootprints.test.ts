import {
  ContentServerConfigurationError,
  InvalidWorldSqsMessageError,
} from "./errors"
import * as processEntityIdModule from "./processEntityId"
import { resolveWorldSceneUndeploymentFootprints } from "./resolveWorldSceneUndeploymentFootprints"
import { contentEntitySceneGenesisPlaza } from "../../../__data__/contentEntitySceneGenesisPlaza"

describe("when resolving world scene undeployment footprints", () => {
  let fetchContentEntity: jest.SpiedFunction<
    typeof processEntityIdModule.fetchContentEntity
  >

  beforeEach(() => {
    fetchContentEntity = jest.spyOn(processEntityIdModule, "fetchContentEntity")
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("and every scene carries its footprint in the event", () => {
    let resolved: Awaited<
      ReturnType<typeof resolveWorldSceneUndeploymentFootprints>
    >

    beforeEach(async () => {
      resolved = await resolveWorldSceneUndeploymentFootprints(
        [
          {
            entityId: "entity-a",
            baseParcel: "0,0",
            parcels: ["0,0", "1,0"],
          },
        ],
        "https://unconfigured.example",
        ""
      )
    })

    it("should use the event footprint", () => {
      expect(resolved).toEqual([
        {
          entityId: "entity-a",
          baseParcel: "0,0",
          parcels: ["0,0", "1,0"],
        },
      ])
    })

    it("should not fetch the immutable entity", () => {
      expect(fetchContentEntity).not.toHaveBeenCalled()
    })
  })

  describe("and an event footprint was omitted", () => {
    let resolved: Awaited<
      ReturnType<typeof resolveWorldSceneUndeploymentFootprints>
    >

    beforeEach(async () => {
      fetchContentEntity.mockResolvedValueOnce({
        ...contentEntitySceneGenesisPlaza,
        pointers: ["0,0", "1,0"],
      })
      resolved = await resolveWorldSceneUndeploymentFootprints(
        [{ entityId: "entity-a", baseParcel: "1,0" }],
        "https://worlds-content-server.decentraland.org",
        "worlds-content-server.decentraland.org"
      )
    })

    it("should use the fetched immutable entity footprint", () => {
      expect(resolved).toEqual([
        {
          entityId: "entity-a",
          baseParcel: "1,0",
          parcels: ["0,0", "1,0"],
        },
      ])
    })

    it("should fetch from the configured trusted Worlds Content Server", () => {
      expect(fetchContentEntity).toHaveBeenCalledWith(
        "entity-a",
        "https://worlds-content-server.decentraland.org"
      )
    })
  })

  describe("and an included footprint does not cover its base", () => {
    let resolve: () => Promise<unknown>

    beforeEach(() => {
      resolve = () =>
        resolveWorldSceneUndeploymentFootprints(
          [
            {
              entityId: "entity-a",
              baseParcel: "0,0",
              parcels: ["1,0"],
            },
          ],
          "https://unconfigured.example",
          ""
        )
    })

    it("should reject the event as deterministically invalid", async () => {
      await expect(resolve()).rejects.toBeInstanceOf(
        InvalidWorldSqsMessageError
      )
    })
  })

  describe("and the fetched entity is not a scene", () => {
    let resolve: () => Promise<unknown>

    beforeEach(() => {
      fetchContentEntity.mockResolvedValueOnce(null)
      resolve = () =>
        resolveWorldSceneUndeploymentFootprints(
          [{ entityId: "entity-a", baseParcel: "0,0" }],
          "https://worlds-content-server.decentraland.org",
          "worlds-content-server.decentraland.org"
        )
    })

    it("should reject the event as deterministically invalid", async () => {
      await expect(resolve()).rejects.toBeInstanceOf(
        InvalidWorldSqsMessageError
      )
    })
  })

  describe("and the configured Worlds Content Server host is not allowlisted", () => {
    let resolve: () => Promise<unknown>

    beforeEach(() => {
      resolve = () =>
        resolveWorldSceneUndeploymentFootprints(
          [{ entityId: "entity-a", baseParcel: "0,0" }],
          "https://worlds-content-server.decentraland.org",
          "peer.decentraland.org"
        )
    })

    it("should surface a retryable configuration error instead of discarding the event", async () => {
      await expect(resolve()).rejects.toBeInstanceOf(
        ContentServerConfigurationError
      )
    })
  })

  describe("and the content server request fails transiently", () => {
    let transientError: Error
    let resolve: () => Promise<unknown>

    beforeEach(() => {
      transientError = new Error("content server unavailable")
      fetchContentEntity.mockRejectedValueOnce(transientError)
      resolve = () =>
        resolveWorldSceneUndeploymentFootprints(
          [{ entityId: "entity-a", baseParcel: "0,0" }],
          "https://worlds-content-server.decentraland.org",
          "worlds-content-server.decentraland.org"
        )
    })

    it("should preserve the retryable failure", async () => {
      await expect(resolve()).rejects.toBe(transientError)
    })
  })
})
