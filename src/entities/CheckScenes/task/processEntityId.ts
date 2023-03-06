import { DeploymentToSqs } from "@dcl/schemas/dist/misc/deployments-to-sqs"
import { EntityType } from "@dcl/schemas/dist/platform/entity"
import Catalyst from "decentraland-gatsby/dist/utils/api/Catalyst"

import { isRoad } from "../utils"
import { processContentDeployment } from "./processContentDeployment"

export async function processEntityId(job: DeploymentToSqs) {
  if (!job.contentServerUrls) {
    throw new Error("contentServerUrls is required")
  }
  const contentDeployment = await Catalyst.getInstanceFrom(
    job.contentServerUrls[0]
  ).getContentEntity(job.entity.entityId)

  if (!contentDeployment) {
    throw new Error(
      `No content deployment found with entity id ${job.entity.entityId}`
    )
  }

  if (contentDeployment.entityType !== EntityType.SCENE) {
    throw new Error(`Entity type is not an scene. Type: ${EntityType.SCENE}`)
  }

  if (isRoad(contentDeployment)) {
    throw new Error(
      "The scene is a road. The following places can proccede: " +
        contentDeployment.metadata.scene.base
    )
  }

  return processContentDeployment(contentDeployment)
}
