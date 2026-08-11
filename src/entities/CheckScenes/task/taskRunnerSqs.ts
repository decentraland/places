import { applyDeploymentDecision } from "./applyDeploymentDecision"
import { DeploymentToSqs } from "./consumer"
import { InvalidWorldSqsMessageError } from "./errors"
import { extractSceneJsonData } from "./extractSceneJsonData"
import { assertSceneBaseIsAuthorized } from "./processContentEntityScene"
import { getTrustedContentServerUrl, processEntityId } from "./processEntityId"
import { resolveGenesisCityDeployment } from "./resolveGenesisCityDeployment"
import { resolveWorldDeployment } from "./resolveWorldDeployment"
import { withDatabaseTransaction } from "../../Database/model"
import {
  notifyDisablePlaces,
  notifyNewPlace,
  notifyUpdatePlace,
} from "../../Slack/utils"
import { fetchNameOwner, updateGenesisCityManifest } from "../utils"

export async function taskRunnerSqs(job: DeploymentToSqs) {
  const contentServerUrl = getTrustedContentServerUrl(job)
  const contentEntityScene = await processEntityId(job)

  if (!contentEntityScene) {
    return null
  }

  assertSceneBaseIsAuthorized(contentEntityScene)

  // Extract creator address and SDK version from scene.json. Fall back to
  // entity metadata when the secondary blob fetch fails or returns nulls —
  // metadata is the same scene.json already parsed by the content server, so
  // it's the authoritative source even when the standalone fetch hiccups
  // (CDN replication lag, transient network errors, etc).
  const sceneJsonData = await extractSceneJsonData(
    contentEntityScene,
    contentServerUrl
  )
  const creator =
    sceneJsonData.creator ||
    (contentEntityScene.metadata as { creator?: string } | undefined)
      ?.creator ||
    null
  const sdk =
    sceneJsonData.runtimeVersion ||
    (contentEntityScene.metadata as { runtimeVersion?: string } | undefined)
      ?.runtimeVersion ||
    null

  const worldConfiguration = contentEntityScene.metadata.worldConfiguration
  const worldName =
    worldConfiguration?.name || worldConfiguration?.dclName || null
  if (worldConfiguration && !worldName) {
    throw new InvalidWorldSqsMessageError("worldConfiguration without name")
  }
  const nameOwner = worldName ? await fetchNameOwner(worldName) : null

  if (worldConfiguration && !contentEntityScene.metadata.owner && nameOwner) {
    contentEntityScene.metadata.owner = nameOwner
  }

  const processedPlaces = await withDatabaseTransaction(async () => {
    const decision =
      worldConfiguration && worldName
        ? await resolveWorldDeployment({
            contentEntityScene,
            contentServerUrl,
            creator,
            deploymentId: job.entity.entityId,
            nameOwner,
            sdk,
            worldName,
          })
        : await resolveGenesisCityDeployment({
            contentEntityScene,
            contentServerUrl,
            creator,
            deploymentId: job.entity.entityId,
            sdk,
          })

    return applyDeploymentDecision({
      contentEntityScene,
      contentServerUrl,
      decision,
      deploymentId: job.entity.entityId,
    })
  })

  const { placesToProcess, placesToDisable } = processedPlaces

  if (placesToProcess?.new) notifyNewPlace(placesToProcess.new, job)
  if (placesToProcess?.update) notifyUpdatePlace(placesToProcess.update, job)
  if (placesToDisable.length) notifyDisablePlaces(placesToDisable)

  void Promise.resolve(updateGenesisCityManifest()).catch(() => undefined)
}
