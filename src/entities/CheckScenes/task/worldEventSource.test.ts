import {
  ContentServerConfigurationError,
  InvalidWorldSqsMessageError,
} from "./errors"
import { resolveWorldEventSource } from "./worldEventSource"
import { WorldContentSource } from "../../World/types"

describe("when resolving the worlds server a world event came from", () => {
  let worldsContentServerUrl: string
  let allowedHosts: string
  let source: WorldContentSource

  beforeEach(() => {
    worldsContentServerUrl = "https://worlds-content-server.decentraland.org/"
    allowedHosts = "worlds-content-server.decentraland.org,worlds.example.org"
  })

  describe("and the event carries no source attribute", () => {
    beforeEach(() => {
      source = resolveWorldEventSource(
        undefined,
        worldsContentServerUrl,
        allowedHosts
      )
    })

    it("should resolve to the configured worlds content server", () => {
      expect(source).toEqual({
        url: "https://worlds-content-server.decentraland.org",
        isDefault: true,
      })
    })
  })

  describe("and the source attribute names an allowlisted server", () => {
    beforeEach(() => {
      source = resolveWorldEventSource(
        "https://Worlds.Example.org/",
        worldsContentServerUrl,
        allowedHosts
      )
    })

    it("should resolve to that server in its normalized form", () => {
      expect(source).toEqual({
        url: "https://worlds.example.org",
        isDefault: false,
      })
    })
  })

  describe("and the source attribute names the configured server", () => {
    beforeEach(() => {
      source = resolveWorldEventSource(
        "https://worlds-content-server.decentraland.org",
        worldsContentServerUrl,
        allowedHosts
      )
    })

    it("should recognise it as the configured server", () => {
      expect(source.isDefault).toBe(true)
    })
  })

  describe("and the source attribute names a server that is not allowlisted", () => {
    let resolve: () => WorldContentSource

    beforeEach(() => {
      resolve = () =>
        resolveWorldEventSource(
          "https://worlds.attacker.example",
          worldsContentServerUrl,
          allowedHosts
        )
    })

    it("should reject the event as invalid instead of falling back to the configured server", () => {
      expect(resolve).toThrow(InvalidWorldSqsMessageError)
    })
  })

  describe("and the source attribute is empty", () => {
    let resolve: () => WorldContentSource

    beforeEach(() => {
      resolve = () =>
        resolveWorldEventSource("", worldsContentServerUrl, allowedHosts)
    })

    it("should reject the event as invalid", () => {
      expect(resolve).toThrow(InvalidWorldSqsMessageError)
    })
  })

  describe("and the configured worlds content server is not allowlisted", () => {
    let resolve: () => WorldContentSource

    beforeEach(() => {
      resolve = () =>
        resolveWorldEventSource(
          undefined,
          worldsContentServerUrl,
          "worlds.example.org"
        )
    })

    it("should report a configuration error so the message is retried", () => {
      expect(resolve).toThrow(ContentServerConfigurationError)
    })
  })
})
