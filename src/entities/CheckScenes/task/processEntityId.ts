import { EntityType } from "@dcl/schemas/dist/platform/entity"
import ContentServer from "decentraland-gatsby/dist/utils/api/ContentServer"

import { DeploymentToSqs } from "./consumer"
import { InvalidWorldSqsMessageError } from "./errors"

const DEFAULT_ALLOWED_CONTENT_SERVER_HOSTS = [
  "peer.decentraland.org",
  "peer.decentraland.zone",
  "worlds-content-server.decentraland.org",
  "worlds-content-server.decentraland.zone",
]

export function getTrustedContentServerUrl(job: DeploymentToSqs): string {
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
    (
      process.env.ALLOWED_CONTENT_SERVER_HOSTS ||
      DEFAULT_ALLOWED_CONTENT_SERVER_HOSTS.join(",")
    )
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  )
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

export async function processEntityId(job: DeploymentToSqs) {
  const contentServerUrl = getTrustedContentServerUrl(job)

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
