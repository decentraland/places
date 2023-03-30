import PlaceModel from "../../Place/model"
import { PlaceAttributes } from "../../Place/types"
import {
  notifyDisablePlaces,
  notifyNewPlace,
  notifyUpdatePlace,
} from "../../Slack/utils"
import { getWorldAbout } from "../utils"
import { DeploymentToSqs } from "./consumer"
import {
  ProcessEntitySceneResult,
  createPlaceFromContentEntityScene,
  processContentEntityScene,
} from "./processContentEntityScene"
import { processEntityId } from "./processEntityId"

const placesAttributes: Array<keyof PlaceAttributes> = [
  "id",
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
  "visible",
  "created_at",
  "updated_at",
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

  if (placesToProcess.new) {
    const newPlace = createPlaceFromContentEntityScene(contentEntityScene)
    await PlaceModel.insertPlace(newPlace, placesAttributes)
    notifyNewPlace(newPlace)
  }

  if (placesToProcess.update) {
    const updatePlace = createPlaceFromContentEntityScene(contentEntityScene)
    await PlaceModel.updatePlace(updatePlace, placesAttributes)
    notifyUpdatePlace(updatePlace)
  }

  if (placesToProcess.disabled.length) {
    const placesIdToDisable = placesToProcess.disabled.map((place) => place.id)
    await PlaceModel.disablePlaces(placesIdToDisable)
    notifyDisablePlaces(placesToProcess.disabled)
  }
}
