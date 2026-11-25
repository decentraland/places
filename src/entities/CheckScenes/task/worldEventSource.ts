import env from "decentraland-gatsby/dist/utils/env"

import {
  getTrustedWorldsContentServerUrl,
  normalizeContentServerUrl,
} from "./contentServerUrl"
import { InvalidWorldSqsMessageError } from "./errors"
import { PlaceAttributes } from "../../Place/types"
import { WorldContentSource } from "../../World/types"

/**
 * The worlds server named by the `sourceContentServerUrl` attribute, else the configured one.
 *
 * The attribute must be a bare https origin. The configured server is recognised before the
 * allowlist; any other server must be listed in `ALLOWED_WORLDS_CONTENT_SERVER_HOSTS` (exact host),
 * so an empty list accepts the configured server only. Anything else is invalid rather than
 * attributed to the configured server.
 */
export function resolveWorldEventSource(
  sourceContentServerUrl: string | undefined,
  worldsContentServerUrl = env(
    "WORLDS_CONTENT_SERVER_URL",
    "https://worlds-content-server.decentraland.org"
  ),
  allowedWorldsContentServerHosts = env(
    "ALLOWED_WORLDS_CONTENT_SERVER_HOSTS",
    ""
  )
): WorldContentSource {
  const defaultUrl = getTrustedWorldsContentServerUrl(worldsContentServerUrl)
  if (sourceContentServerUrl === undefined) {
    return { url: defaultUrl, isDefault: true }
  }

  let parsed: URL
  try {
    parsed = new URL(sourceContentServerUrl)
  } catch {
    throw new InvalidWorldSqsMessageError(
      `sourceContentServerUrl '${sourceContentServerUrl}' is not a URL`
    )
  }
  const url = normalizeContentServerUrl(parsed)
  if (url === defaultUrl) {
    return { url, isDefault: true }
  }

  const allowedHosts = new Set(
    allowedWorldsContentServerHosts
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  )
  if (!allowedHosts.has(parsed.hostname)) {
    throw new InvalidWorldSqsMessageError(
      `sourceContentServerUrl '${url}' is not an allowed worlds content server`
    )
  }
  return { url, isDefault: false }
}

/**
 * The worlds server a deployment came from. With a source attribute the attribute decides, and the
 * body's first content server must share its origin.
 */
export function resolveWorldDeploymentSource(
  contentServerUrls: string[],
  sourceContentServerUrl: string,
  worldsContentServerUrl?: string,
  allowedWorldsContentServerHosts?: string
): WorldContentSource {
  const source = resolveWorldEventSource(
    sourceContentServerUrl,
    worldsContentServerUrl,
    allowedWorldsContentServerHosts
  )
  let origin: string | null = null
  try {
    origin = new URL(contentServerUrls[0]).origin
  } catch {
    origin = null
  }
  if (origin !== source.url) {
    throw new InvalidWorldSqsMessageError(
      `contentServerUrls[0] does not belong to the source ${source.url}`
    )
  }
  return source
}

/** The configured worlds content server, for offline tools that only ever read from it. */
export function configuredWorldSource(
  worldsContentServerUrl = env(
    "WORLDS_CONTENT_SERVER_URL",
    "https://worlds-content-server.decentraland.org"
  )
): WorldContentSource {
  return {
    url: getTrustedWorldsContentServerUrl(worldsContentServerUrl),
    isDefault: true,
  }
}

/** Whether a place was deployed to the given server; rows without one belong to the configured server. */
export function isPlaceFromSource(
  place: Pick<PlaceAttributes, "content_server_url">,
  source: WorldContentSource
): boolean {
  return place.content_server_url === null
    ? source.isDefault
    : place.content_server_url === source.url
}
