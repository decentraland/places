import env from "decentraland-gatsby/dist/utils/env"

import {
  getTrustedContentServerUrl,
  getTrustedWorldsContentServerUrl,
} from "./contentServerUrl"
import { WorldContentSource } from "../../World/types"

/**
 * Resolve the worlds server a world event came from.
 *
 * Several worlds servers publish the same events and only deployment bodies name their server, so
 * the publisher sets it in the `sourceContentServerUrl` message attribute. Without the attribute
 * the event is from the configured worlds content server. A present attribute must name an
 * allowlisted host; otherwise the event is rejected as invalid rather than attributed to the
 * configured server, whose scenes it does not describe.
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
