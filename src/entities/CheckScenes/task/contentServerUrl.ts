import env from "decentraland-gatsby/dist/utils/env"

import {
  ContentServerConfigurationError,
  InvalidWorldSqsMessageError,
} from "./errors"

type ContentServerSource = {
  contentServerUrls?: string[]
}

/** Canonical form of a content server base URL, so the same server always compares equal. */
export function normalizeContentServerUrl(url: URL): string {
  const normalized = new URL(url.toString())
  normalized.hash = ""
  normalized.search = ""
  return normalized.toString().replace(/\/+$/, "")
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
    return normalizeContentServerUrl(url)
  }

  throw new InvalidWorldSqsMessageError(
    "contentServerUrls does not contain a trusted host"
  )
}

/**
 * Validate the configured Worlds Content Server URL. It comes from the environment rather than from
 * a message, so an untrusted or malformed value is a deployment misconfiguration: surface it as one
 * so callers retry their input instead of discarding it as deterministically invalid.
 */
export function getTrustedWorldsContentServerUrl(
  worldsContentServerUrl: string,
  allowedContentServerHosts = env("ALLOWED_CONTENT_SERVER_HOSTS", "")
): string {
  try {
    return getTrustedContentServerUrl(
      { contentServerUrls: [worldsContentServerUrl] },
      allowedContentServerHosts
    )
  } catch (error) {
    if (error instanceof InvalidWorldSqsMessageError) {
      throw new ContentServerConfigurationError(
        `WORLDS_CONTENT_SERVER_URL '${worldsContentServerUrl}' is not an allowed content server host`
      )
    }
    throw error
  }
}
