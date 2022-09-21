import { SQL } from "decentraland-gatsby/dist/entities/Database/utils/sql"
import { Task } from "decentraland-gatsby/dist/entities/Task"
import { ContentDepoymentScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import Time from "decentraland-gatsby/dist/utils/date/Time"
import uniq from "lodash/uniq"

import EntityPlaceModel from "../../EntityPlace/model"
import { EntityPlaceAttributes } from "../../EntityPlace/types"
import PlaceModel from "../../Place/model"
import { PlaceAttributes } from "../../Place/types"
import { createPlaceFromDeployment } from "../../Place/utils"
import DeploymentTrackModel from "../model"
import { DeploymentTrackAttributes } from "../types"
import { fetchDeployments, isMetadataEmpty, isRoad } from "../utils"

export const checkDeployments = new Task({
  name: "check_deployments",
  repeat: Task.Repeat.EachMinute,
  task: async (ctx) => {
    const catalysts =
      await DeploymentTrackModel.find<DeploymentTrackAttributes>({
        disabled: false,
      })
    for (const catalyst of catalysts) {
      const logger = ctx.logger.extend({
        catalyst_id: catalyst.id,
        catalyst_url: catalyst.base_url,
      })

      // Download new deployments
      let deployments: ContentDepoymentScene[]
      try {
        deployments = await fetchDeployments(catalyst)

        if (deployments.length === 0) {
          logger.log(`No pending deployments in ${catalyst.base_url}`)
        } else {
          logger.log(
            `${deployments.length} pending deployments in ${catalyst.base_url}`
          )
        }
      } catch (err) {
        logger.error(`Error getting deploys`, err as Record<string, any>)
        continue
      }

      // Filter roads and empty deployments
      const filteredDeployments = deployments.filter((deployment) => {
        return !isMetadataEmpty(deployment) && !isRoad(deployment)
      })

      logger.log(
        `${filteredDeployments.length} valid deployments in ${catalyst.base_url}`
      )

      // Filter missing entityIds
      const entityIds = filteredDeployments.map((deploy) => deploy.entityId)
      const importedPlaces = await PlaceModel.findByEntityIds(entityIds)
      const importedPlacesByEnityId = new Map(
        importedPlaces.map((place) => [place.entity_id, place])
      )
      const missingDeployments = filteredDeployments.filter(
        (deploy) => !importedPlacesByEnityId.has(deploy.entityId)
      )
      if (missingDeployments.length === 0) {
        logger.log(`No new deployments in ${catalyst.base_url}`)
      } else {
        logger.log(
          `${missingDeployments.length} new deployments in ${catalyst.base_url}`
        )
        const positions = uniq(
          missingDeployments.flatMap((deploy) => deploy.pointers)
        )
        const overlapedPlaces = await PlaceModel.findEnabledByPositions(
          positions
        )

        const newPlaces: PlaceAttributes[] = []
        const updatedPlaces: PlaceAttributes[] = []
        const disabledPlaces: PlaceAttributes[] = []
        const newEntityPlaces: EntityPlaceAttributes[] = []
        const overlapedPlacesByPosition = new Map(
          overlapedPlaces.flatMap((place) =>
            place.positions.map((position) => [position, place])
          )
        )

        for (const missingDeployment of missingDeployments) {
          const missingDeploymentPositions = missingDeployment.pointers.sort()
          const currentOverlapedPlaces = uniq(
            missingDeploymentPositions
              .map((pointer) => overlapedPlacesByPosition.get(pointer)!)
              .filter(Boolean)
          )

          if (currentOverlapedPlaces.length === 0) {
            const newPlace = createPlaceFromDeployment(missingDeployment)
            newPlaces.push(newPlace)
            newEntityPlaces.push({
              place_id: newPlace.id,
              entity_id: missingDeployment.entityId,
            })
          } else {
            for (const currentOverlapedPlace of currentOverlapedPlaces) {
              const currentOverlapedPlacePositions =
                currentOverlapedPlace.positions.sort()
              const areEquals =
                missingDeploymentPositions.length ===
                  currentOverlapedPlacePositions.length &&
                missingDeploymentPositions.every(
                  (position, i) =>
                    position === currentOverlapedPlacePositions[i]
                )

              if (areEquals) {
                const updatedPlace = {
                  ...createPlaceFromDeployment(missingDeployment),
                  id: currentOverlapedPlace.id,
                }

                updatedPlaces.push(updatedPlace)
                newEntityPlaces.push({
                  place_id: currentOverlapedPlace.id,
                  entity_id: missingDeployment.entityId,
                })
              } else if (
                missingDeployment.entityTimestamp >
                Time.utc(currentOverlapedPlace.deployed_at).getTime()
              ) {
                const newPlace = createPlaceFromDeployment(missingDeployment)
                newPlaces.push(newPlace)
                newEntityPlaces.push({
                  place_id: newPlace.id,
                  entity_id: missingDeployment.entityId,
                })

                disabledPlaces.push(currentOverlapedPlace)
              }
            }
          }
        }

        const totalDisablePlaces = await PlaceModel.disablePlaces(
          disabledPlaces.map((place) => place.id)
        )
        logger.log(`${totalDisablePlaces} places disabled`)

        const totalUpdatedPlaces = await PlaceModel.updateMany(
          updatedPlaces.map((place) => ({
            ...place,
            tags: SQL`${place.tags}::varchar[]`,
          })),
          ["id"],
          [
            "title",
            "description",
            "image",
            "owner",
            "tags",
            "base_position",
            "contact_name",
            "contact_email",
            "content_rating",
          ]
        )
        logger.log(`${totalUpdatedPlaces} updated places`)

        const totalNewPlaces = await PlaceModel.createMany(newPlaces)
        logger.log(`${totalNewPlaces} new places created`)

        const totalNewEntityPlaces = await EntityPlaceModel.createMany(
          newEntityPlaces
        )
        logger.log(`${totalNewEntityPlaces} new entity places created`)
      }

      const greatherFrom = Math.max(
        ...deployments.map((deploy) => deploy.localTimestamp)
      )
      await DeploymentTrackModel.update<DeploymentTrackAttributes>(
        { from: greatherFrom },
        { id: catalyst.id }
      )
    }
  },
})
