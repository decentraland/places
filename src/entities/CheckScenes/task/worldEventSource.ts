import env from "decentraland-gatsby/dist/utils/env"

import {
  getTrustedContentServerUrl,
  getTrustedWorldsContentServerUrl,
  normalizeContentServerUrl,
} from "./contentServerUrl"
import { PlaceAttributes } from "../../Place/types"
import { WorldContentSource } from "../../World/types"

/**
 * The worlds server named by the `sourceContentServerUrl` attribute, else the configured one. A
 * non-allowlisted attribute is invalid rather than attributed to the configured server.
 */
export function resolveWorldEventSource(
  sourceContentServerUrl: string | undefined,
  worldsContentServerUrl = env(
    "WORLDS_CONTENT_SERVER_URL",
    "https://worlds-content-server.decentraland.org"
  ),
  allowedContentServerHosts = env("ALLOWED_CONTENT_SERVER_HOSTS", "")
): WorldContentSource {
  const defaultUrl = getTrustedWorldsContentServerUrl(
    worldsContentServerUrl,
    allowedContentServerHosts
  )
  if (sourceContentServerUrl === undefined) {
    return { url: defaultUrl, isDefault: true }
  }

  const url = getTrustedContentServerUrl(
    { contentServerUrls: [sourceContentServerUrl] },
    allowedContentServerHosts
  )
  return { url, isDefault: url === defaultUrl }
}

/** The configured worlds content server, for offline tools that only ever read from it. */
export function configuredWorldSource(
  worldsContentServerUrl = env(
    "WORLDS_CONTENT_SERVER_URL",
    "https://worlds-content-server.decentraland.org"
  )
): WorldContentSource {
  return {
    url: normalizeContentServerUrl(new URL(worldsContentServerUrl)),
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
