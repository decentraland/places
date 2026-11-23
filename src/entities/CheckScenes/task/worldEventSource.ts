import env from "decentraland-gatsby/dist/utils/env"

import {
  getTrustedContentServerUrl,
  getTrustedWorldsContentServerUrl,
} from "./contentServerUrl"
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
