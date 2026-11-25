import { gatsbyRegister } from "decentraland-gatsby/dist/entities/Prometheus/metrics"

import {
  ContentServerConfigurationError,
  InvalidWorldSqsMessageError,
} from "./errors"
import {
  resolveWorldDeploymentSource,
  resolveWorldEventSource,
} from "./worldEventSource"
import { WorldContentSource } from "../../World/types"

async function rejectedCount(reason: string): Promise<number> {
  const metric = gatsbyRegister.getSingleMetric(
    "places_world_event_source_rejected_total"
  )
  const values = (await metric?.get())?.values ?? []
  return values.find((value) => value.labels.reason === reason)?.value ?? 0
}

describe("when resolving the worlds server a world event came from", () => {
  let worldsContentServerUrl: string
  let allowedWorldsHosts: string
  let source: WorldContentSource

  beforeEach(() => {
    worldsContentServerUrl = "https://worlds-content-server.decentraland.org/"
    allowedWorldsHosts = "worlds-content-server.dcl.dev,worlds.example.org"
  })

  describe("and the event carries no source attribute", () => {
    beforeEach(() => {
      source = resolveWorldEventSource(
        undefined,
        worldsContentServerUrl,
        allowedWorldsHosts
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
        "HTTPS://Worlds-Content-Server.DCL.dev/",
        worldsContentServerUrl,
        allowedWorldsHosts
      )
    })

    it("should resolve to that server as a bare lowercased origin", () => {
      expect(source).toEqual({
        url: "https://worlds-content-server.dcl.dev",
        isDefault: false,
      })
    })
  })

  describe("and the source attribute carries a path", () => {
    let resolve: () => WorldContentSource

    beforeEach(() => {
      resolve = () =>
        resolveWorldEventSource(
          "https://worlds-content-server.dcl.dev/worlds-content-server",
          worldsContentServerUrl,
          allowedWorldsHosts
        )
    })

    it("should reject the event as invalid", () => {
      expect(resolve).toThrow(InvalidWorldSqsMessageError)
    })
  })

  describe("and the source attribute carries a port", () => {
    let resolve: () => WorldContentSource

    beforeEach(() => {
      resolve = () =>
        resolveWorldEventSource(
          "https://worlds.example.org:8443",
          worldsContentServerUrl,
          allowedWorldsHosts
        )
    })

    it("should reject the event as invalid", () => {
      expect(resolve).toThrow(InvalidWorldSqsMessageError)
    })
  })

  describe("and the source attribute is not https", () => {
    let resolve: () => WorldContentSource

    beforeEach(() => {
      resolve = () =>
        resolveWorldEventSource(
          "http://worlds.example.org",
          worldsContentServerUrl,
          allowedWorldsHosts
        )
    })

    it("should reject the event as invalid", () => {
      expect(resolve).toThrow(InvalidWorldSqsMessageError)
    })
  })

  describe("and the source attribute names the configured server", () => {
    beforeEach(() => {
      source = resolveWorldEventSource(
        "https://worlds-content-server.decentraland.org",
        worldsContentServerUrl,
        ""
      )
    })

    it("should recognise it as the configured server without consulting the allowlist", () => {
      expect(source).toEqual({
        url: "https://worlds-content-server.decentraland.org",
        isDefault: true,
      })
    })
  })

  describe("and the source attribute names a server that is not allowlisted", () => {
    let resolve: () => WorldContentSource

    beforeEach(() => {
      resolve = () =>
        resolveWorldEventSource(
          "https://worlds.attacker.example",
          worldsContentServerUrl,
          allowedWorldsHosts
        )
    })

    it("should reject the event as invalid instead of falling back to the configured server", () => {
      expect(resolve).toThrow(InvalidWorldSqsMessageError)
    })

    describe("and the rejection is counted", () => {
      let before: number

      beforeEach(async () => {
        before = await rejectedCount("source_not_allowed")
        try {
          resolve()
        } catch {
          // Rejected as expected
        }
      })

      it("should increment the rejection metric for that reason", async () => {
        expect(await rejectedCount("source_not_allowed")).toBe(before + 1)
      })
    })
  })

  describe("and the source attribute names a subdomain of an allowlisted host", () => {
    let resolve: () => WorldContentSource

    beforeEach(() => {
      resolve = () =>
        resolveWorldEventSource(
          "https://evil.worlds.example.org",
          worldsContentServerUrl,
          allowedWorldsHosts
        )
    })

    it("should reject the event as invalid, since hosts match exactly", () => {
      expect(resolve).toThrow(InvalidWorldSqsMessageError)
    })
  })

  describe("and the worlds allowlist is empty", () => {
    let resolve: () => WorldContentSource

    beforeEach(() => {
      resolve = () =>
        resolveWorldEventSource(
          "https://worlds.example.org",
          worldsContentServerUrl,
          ""
        )
    })

    it("should reject every server other than the configured one", () => {
      expect(resolve).toThrow(InvalidWorldSqsMessageError)
    })
  })

  describe("and the source attribute is empty", () => {
    let resolve: () => WorldContentSource

    beforeEach(() => {
      resolve = () =>
        resolveWorldEventSource("", worldsContentServerUrl, allowedWorldsHosts)
    })

    it("should reject the event as invalid", () => {
      expect(resolve).toThrow(InvalidWorldSqsMessageError)
    })
  })

  describe("and the configured worlds content server is not a bare origin", () => {
    let resolve: () => WorldContentSource

    beforeEach(() => {
      resolve = () =>
        resolveWorldEventSource(
          undefined,
          "https://worlds-content-server.decentraland.org/worlds",
          allowedWorldsHosts
        )
    })

    it("should report a configuration error so the message is retried", () => {
      expect(resolve).toThrow(ContentServerConfigurationError)
    })
  })
})

describe("when resolving the worlds server a deployment came from", () => {
  let worldsContentServerUrl: string
  let allowedWorldsHosts: string

  beforeEach(() => {
    worldsContentServerUrl = "https://worlds-content-server.decentraland.org"
    allowedWorldsHosts = "worlds.example.org"
  })

  describe("and the body's content server shares the attribute's origin", () => {
    let source: WorldContentSource

    beforeEach(() => {
      source = resolveWorldDeploymentSource(
        ["https://worlds.example.org/"],
        "https://worlds.example.org",
        worldsContentServerUrl,
        allowedWorldsHosts
      )
    })

    it("should resolve to the attribute's server", () => {
      expect(source).toEqual({
        url: "https://worlds.example.org",
        isDefault: false,
      })
    })
  })

  describe("and the body's content server is on another origin", () => {
    let resolve: () => WorldContentSource

    beforeEach(() => {
      resolve = () =>
        resolveWorldDeploymentSource(
          ["https://worlds-content-server.decentraland.org"],
          "https://worlds.example.org",
          worldsContentServerUrl,
          allowedWorldsHosts
        )
    })

    it("should reject the deployment as invalid", () => {
      expect(resolve).toThrow(InvalidWorldSqsMessageError)
    })
  })

  describe("and the body carries no content server", () => {
    let resolve: () => WorldContentSource

    beforeEach(() => {
      resolve = () =>
        resolveWorldDeploymentSource(
          [],
          "https://worlds.example.org",
          worldsContentServerUrl,
          allowedWorldsHosts
        )
    })

    it("should reject the deployment as invalid", () => {
      expect(resolve).toThrow(InvalidWorldSqsMessageError)
    })
  })
})
