import { EntityType } from "@dcl/schemas/dist/platform/entity"
import ContentServer from "decentraland-gatsby/dist/utils/api/ContentServer"
import env from "decentraland-gatsby/dist/utils/env"

import { DeploymentToSqs } from "./consumer"
import { InvalidWorldSqsMessageError } from "./errors"

export function getTrustedContentServerUrl(
  job: DeploymentToSqs,
  allowedContentServerHosts = env("ALLOWED_CONTENT_SERVER_HOSTS", "")
): string {
  const rawUrl = job.contentServerUrls?.[0]
  if (!rawUrl)
    throw new InvalidWorldSqsMessageError("contentServerUrls is required")

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new InvalidWorldSqsMessageError(
      "contentServerUrls contains an invalid URL"
    )
  }
  const allowedHosts = new Set(
    allowedContentServerHosts
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  )
  if (allowedHosts.size === 0) {
    throw new InvalidWorldSqsMessageError(
      "ALLOWED_CONTENT_SERVER_HOSTS is not configured"
    )
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !allowedHosts.has(url.hostname.toLowerCase())
  ) {
    throw new InvalidWorldSqsMessageError(
      "contentServerUrls contains an untrusted host"
    )
  }
  url.hash = ""
  url.search = ""
  return url.toString().replace(/\/+$/, "")
}

export async function processEntityId(
  job: DeploymentToSqs,
  allowedContentServerHosts = env("ALLOWED_CONTENT_SERVER_HOSTS", "")
) {
  const contentServerUrl = getTrustedContentServerUrl(
    job,
    allowedContentServerHosts
  )

  const contentDeployment = await ContentServer.getInstanceFrom(
    contentServerUrl
  ).getContentEntity(job.entity.entityId)

  if (!contentDeployment) {
    throw new Error(
      `No content deployment found with entity id ${job.entity.entityId}`
    )
  }

  if (contentDeployment.type !== EntityType.SCENE) {
    return null
  }

  return contentDeployment
}
