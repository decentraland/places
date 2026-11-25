import env from "decentraland-gatsby/dist/utils/env"

import {
  ContentServerConfigurationError,
  InvalidWorldSqsMessageError,
} from "./errors"

type ContentServerSource = {
  contentServerUrls?: string[]
}

/**
 * Canonical form of a worlds server: a bare `https` origin, host lowercased, no port, path, query,
 * hash or userinfo, so the same server always compares equal.
 *
 * @throws InvalidWorldSqsMessageError when the URL is not a bare https origin
 */
export function normalizeContentServerUrl(url: URL): string {
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new InvalidWorldSqsMessageError(
      `'${url.toString()}' is not a bare https origin`
    )
  }
  return url.origin
}

export function getTrustedContentServerUrl(
  job: ContentServerSource,
  allowedContentServerHosts = env("ALLOWED_CONTENT_SERVER_HOSTS", "")
): string {
  const contentServerUrls = job.contentServerUrls
  if (!contentServerUrls?.length)
    throw new InvalidWorldSqsMessageError("contentServerUrls is required")

  const allowedHosts = new Set(
    allowedContentServerHosts
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  )
  if (allowedHosts.size === 0) {
    throw new ContentServerConfigurationError(
      "ALLOWED_CONTENT_SERVER_HOSTS is not configured"
    )
  }

  for (const rawUrl of contentServerUrls) {
    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      continue
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !allowedHosts.has(url.hostname.toLowerCase())
    ) {
      continue
    }
    // Catalyst content servers live under a path, so it is kept
    url.hash = ""
    url.search = ""
    return url.toString().replace(/\/+$/, "")
  }

  throw new InvalidWorldSqsMessageError(
    "contentServerUrls does not contain a trusted host"
  )
}

/**
 * Validate the configured Worlds Content Server URL. It comes from the environment rather than from
 * a message, so a malformed value is a deployment misconfiguration: surface it as one so callers
 * retry their input instead of discarding it as deterministically invalid.
 */
export function getTrustedWorldsContentServerUrl(
  worldsContentServerUrl: string
): string {
  try {
    return normalizeContentServerUrl(new URL(worldsContentServerUrl))
  } catch {
    throw new ContentServerConfigurationError(
      `WORLDS_CONTENT_SERVER_URL '${worldsContentServerUrl}' is not a bare https origin`
    )
  }
}
