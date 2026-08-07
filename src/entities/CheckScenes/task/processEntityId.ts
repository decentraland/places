import { hashV0, hashV1 } from "@dcl/hashing"
import { IPFSv1 } from "@dcl/schemas/dist/misc"
import { EntityType } from "@dcl/schemas/dist/platform/entity"
import { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import env from "decentraland-gatsby/dist/utils/env"

import {
  ContentServerConfigurationError,
  InvalidWorldSqsMessageError,
} from "./errors"
import { drainResponse } from "../../../utils/fetch"

import type { DeploymentToSqs } from "./consumer"

export function getTrustedContentServerUrl(
  job: DeploymentToSqs,
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
    url.hash = ""
    url.search = ""
    return url.toString().replace(/\/+$/, "")
  }

  throw new InvalidWorldSqsMessageError(
    "contentServerUrls does not contain a trusted host"
  )
}

export async function processEntityId(
  job: DeploymentToSqs,
  allowedContentServerHosts = env("ALLOWED_CONTENT_SERVER_HOSTS", "")
) {
  const contentServerUrl = getTrustedContentServerUrl(
    job,
    allowedContentServerHosts
  )

  const entityId = job.entity.entityId
  const response = await fetch(
    `${contentServerUrl}/contents/${encodeURIComponent(entityId)}`
  )
  if (!response.ok) {
    await drainResponse(response)
    throw new Error(
      `Unable to fetch content deployment ${entityId}: ${response.status} ${response.statusText}`
    )
  }

  const rawEntity = new Uint8Array(await response.arrayBuffer())
  const actualEntityId = IPFSv1.validate(entityId)
    ? await hashV0(rawEntity)
    : await hashV1(rawEntity)

  if (actualEntityId !== entityId) {
    throw new InvalidWorldSqsMessageError(
      `Content deployment hash does not match requested entity id ${entityId}`
    )
  }

  let parsedDeployment: unknown
  try {
    parsedDeployment = JSON.parse(Buffer.from(rawEntity).toString("utf8"))
  } catch {
    throw new InvalidWorldSqsMessageError(
      `Content deployment ${entityId} is not valid JSON`
    )
  }

  if (
    typeof parsedDeployment !== "object" ||
    parsedDeployment === null ||
    Array.isArray(parsedDeployment)
  ) {
    throw new InvalidWorldSqsMessageError(
      `Content deployment ${entityId} is not a JSON object`
    )
  }

  const contentDeployment = parsedDeployment as ContentEntityScene

  if (contentDeployment.type !== EntityType.SCENE) {
    return null
  }

  return contentDeployment
}
