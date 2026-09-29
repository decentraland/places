import { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { applyDeploymentDecision } from "./applyDeploymentDecision"
import { DeploymentToSqs } from "./consumer"
import { WorldDeploymentDecision } from "./deploymentDecision"
import { InvalidWorldSqsMessageError } from "./errors"
import { extractSceneJsonData } from "./extractSceneJsonData"
import { fetchWorldActiveScenesAtPositions } from "./fetchWorldActiveScenes"
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

  const deploymentId = job.entity.entityId

  const processedPlaces =
    worldConfiguration && worldName
      ? await applyWorldDeployment({
          contentEntityScene,
          contentServerUrl,
          creator,
          deploymentId,
          nameOwner,
          sdk,
          worldName,
        })
      : await withDatabaseTransaction(async () =>
          applyDeploymentDecision({
            contentEntityScene,
            contentServerUrl,
            decision: await resolveGenesisCityDeployment({
              contentEntityScene,
              contentServerUrl,
              creator,
              deploymentId,
              sdk,
            }),
            deploymentId,
          })
        )

  const { placesToProcess, placesToDisable } = processedPlaces

  if (placesToProcess?.new) notifyNewPlace(placesToProcess.new, job)
  if (placesToProcess?.update) notifyUpdatePlace(placesToProcess.update, job)
  if (placesToDisable.length) notifyDisablePlaces(placesToDisable)

  void Promise.resolve(updateGenesisCityManifest()).catch(() => undefined)
}

type ApplyWorldDeploymentOptions = {
  contentEntityScene: ContentEntityScene
  contentServerUrl: string
  creator: string | null
  deploymentId: string
  nameOwner: string | null | undefined
  sdk: string | null
  worldName: string
}

async function applyWorldDeployment(options: ApplyWorldDeploymentOptions) {
  const apply = (decision: WorldDeploymentDecision) =>
    applyDeploymentDecision({
      contentEntityScene: options.contentEntityScene,
      contentServerUrl: options.contentServerUrl,
      decision,
      deploymentId: options.deploymentId,
    })

  const firstPass = await withDatabaseTransaction(async () => {
    const decision = await resolveWorldDeployment(options)
    return decision.kind === "verify-upstream"
      ? { status: "verify" as const, base: decision.base }
      : { status: "done" as const, processed: await apply(decision) }
  })
  if (firstPass.status === "done") {
    return firstPass.processed
  }

  const served = await fetchWorldActiveScenesAtPositions(options.worldName, [
    firstPass.base,
  ])
  return withDatabaseTransaction(async () =>
    apply(
      await resolveWorldDeployment({
        ...options,
        servedUpstreamIds: served.deploymentIds,
      })
    )
  )
}
