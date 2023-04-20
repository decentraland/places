import { EntityType } from "@dcl/schemas/dist/platform/entity"
import ContentServer from "decentraland-gatsby/dist/utils/api/ContentServer"

import { DeploymentToSqs } from "./consumer"

export async function processEntityId(job: DeploymentToSqs) {
  if (!job.contentServerUrls || job.contentServerUrls.length === 0) {
    throw new Error("contentServerUrls is required")
  }

  const contentDeployment = await ContentServer.getInstanceFrom(
    job.contentServerUrls[0]
  ).getContentEntity(job.entity.entityId)

  if (!contentDeployment) {
    throw new Error(
      `No content deployment found with entity id ${job.entity.entityId}`
    )
  }

  if (contentDeployment.type !== EntityType.SCENE) {
    throw new Error(`Entity type is not an scene. Type: ${EntityType.SCENE}`)
  }

  return contentDeployment
}
