import PlaceModel from "../../Place/model"
import { PlaceAttributes } from "../../Place/types"
import PlacePositionModel from "../../PlacePosition/model"
import {
  notifyDisablePlaces,
  notifyNewPlace,
  notifyUpdatePlace,
} from "../../Slack/utils"
import CheckScenesModel from "../model"
import { CheckSceneLogsTypes } from "../types"
import { getWorldAbout } from "../utils"
import { DeploymentToSqs } from "./consumer"
import {
  ProcessEntitySceneResult,
  createPlaceFromContentEntityScene,
  processContentEntityScene,
} from "./processContentEntityScene"
import { processEntityId } from "./processEntityId"

const placesAttributes: Array<keyof PlaceAttributes> = [
  "title",
  "description",
  "image",
  "owner",
  "tags",
  "positions",
  "base_position",
  "contact_name",
  "contact_email",
  "content_rating",
  "disabled",
  "disabled_at",
  "created_at",
  "updated_at",
  "deployed_at",
  "categories",
  "world",
  "world_name",
]

export async function taskRunnerSqs(job: DeploymentToSqs) {
  const contentEntityScene = await processEntityId(job)

  let placesToProcess: ProcessEntitySceneResult | null = null

  if (contentEntityScene.metadata.worldConfiguration) {
    const worlds = await PlaceModel.findEnabledWorldName(
      contentEntityScene.metadata.worldConfiguration.name
    )

    if (!worlds.length) {
      placesToProcess = {
        new: createPlaceFromContentEntityScene(contentEntityScene),
        disabled: [],
      }
    } else {
      const worldAbout = await getWorldAbout(
        job.contentServerUrls![0],
        contentEntityScene.metadata.worldConfiguration.name
      )

      if (
        !worldAbout.configurations.scenesUrn[0].includes(job.entity.entityId)
      ) {
        throw new Error(
          `The information obtained from the World \`${contentEntityScene.metadata.worldConfiguration.name}\` with the \`${job.entity.entityId}\` hash is not the same as the information obtained from About. scenesUrn: \`${worldAbout.configurations.scenesUrn[0]}\``
        )
      }

      placesToProcess = {
        update: createPlaceFromContentEntityScene(
          contentEntityScene,
          worlds[0]
        ),
        disabled: [],
      }
    }
  } else {
    const places = await PlaceModel.findEnabledByPositions(
      contentEntityScene.pointers
    )
    placesToProcess = await processContentEntityScene(
      contentEntityScene,
      places
    )
  }

  if (!placesToProcess) {
    CheckScenesModel.createOne({
      entity_id: job.entity.entityId,
      content_server_url: job.contentServerUrls![0],
      base_position: contentEntityScene.metadata.scene!.base,
      positions: contentEntityScene.metadata.scene!.parcels,
      action: CheckSceneLogsTypes.AVOID,
      deploy_at: new Date(contentEntityScene.timestamp),
    })
  }

  if (placesToProcess?.new) {
    const newPlace = createPlaceFromContentEntityScene(contentEntityScene)
    await PlaceModel.insertPlace(newPlace, placesAttributes)
    !contentEntityScene.metadata.worldConfiguration &&
      (await PlacePositionModel.syncBasePosition(placesToProcess.new))

    notifyNewPlace(newPlace)
    CheckScenesModel.createOne({
      entity_id: job.entity.entityId,
      content_server_url: job.contentServerUrls![0],
      base_position: contentEntityScene.metadata.scene!.base,
      positions: contentEntityScene.metadata.scene!.parcels,
      action: CheckSceneLogsTypes.NEW,
      deploy_at: new Date(contentEntityScene.timestamp),
    })
  }

  if (placesToProcess?.update) {
    await PlaceModel.updatePlace(placesToProcess.update, placesAttributes)
    !contentEntityScene.metadata.worldConfiguration &&
      (await PlacePositionModel.syncBasePosition(placesToProcess.update))

    notifyUpdatePlace(placesToProcess.update)
    CheckScenesModel.createOne({
      entity_id: job.entity.entityId,
      content_server_url: job.contentServerUrls![0],
      base_position: contentEntityScene.metadata.scene!.base,
      positions: contentEntityScene.metadata.scene!.parcels,
      action: CheckSceneLogsTypes.UPDATE,
      deploy_at: new Date(contentEntityScene.timestamp),
    })
  }

  if (placesToProcess?.disabled.length) {
    const placesIdToDisable = placesToProcess.disabled.map((place) => place.id)
    await PlaceModel.disablePlaces(placesIdToDisable)

    const positions = new Set(
      placesToProcess.disabled.flatMap((place) => place.positions)
    )
    placesToProcess?.new?.positions.forEach((position) =>
      positions.delete(position)
    )
    placesToProcess?.update?.positions.forEach((position) =>
      positions.delete(position)
    )
    !contentEntityScene.metadata.worldConfiguration &&
      (await PlacePositionModel.removePositions([...positions]))

    notifyDisablePlaces(placesToProcess.disabled)
    placesToProcess.disabled.forEach((place) => {
      // TODO: use createMany instead of createOne
      CheckScenesModel.createOne({
        entity_id: job.entity.entityId,
        content_server_url: job.contentServerUrls![0],
        base_position: place.base_position,
        positions: place.positions,
        action: CheckSceneLogsTypes.DISABLED,
      })
    })
  }
}
