import uniq from 'lodash/uniq'
import { Task } from 'decentraland-gatsby/dist/entities/Task'
import Catalyst from 'decentraland-gatsby/dist/utils/api/Catalyst'
import { EntityType } from '@dcl/schemas/dist/platform/entity'
import roads from '../data/roads.json'
import DeploymentTrackModel from '../model'
import { DeploymentTrackAttributes } from '../types'
import { ContentDeploymentSortingField, ContentDeploymentSortingOrder, ContentDepoymentScene } from 'decentraland-gatsby/dist/utils/api/Catalyst.types'
import PlaceModel from '../../Place/model'
import { PlaceAttributes } from '../../Place/types'
import { EntityPlaceAttributes } from '../../EntityPlace/types'
import { createPlaceFromDeployment } from '../../Place/utils'
import EntityPlaceModel from '../../EntityPlace/model'

export const checkDeployments = new Task({
  name: 'check_deployments',
  repeat: Task.Repeat.EachMinute,
  task: async (ctx) => {
    const catalysts = await DeploymentTrackModel.find<DeploymentTrackAttributes>({ disabled: false })
    for (const catalyst of catalysts) {
      const logger = ctx.logger.extend({ catalyst_id: catalyst.id, catalyst_url: catalyst.base_url })

      // Download new deployments
      let deployments: ContentDepoymentScene[]
      try {
        const contentDeploymentsResponse = await Catalyst.from(catalyst.base_url)
          .getContentDeployments({
            from: catalyst.from,
            limit: catalyst.limit,
            entityTypes: [ EntityType.SCENE ],
            onlyCurrentlyPointed: true,
            sortingField: ContentDeploymentSortingField.LocalTimestamp,
            sortingOrder: ContentDeploymentSortingOrder.ASCENDING
          })

          if (contentDeploymentsResponse.deployments.length === 0) {
            logger.log(`No pending deployments in ${catalyst.base_url}`)
            continue;
          } else {
            logger.log(`${contentDeploymentsResponse.deployments.length} pending deployments in ${catalyst.base_url}`)
            deployments = contentDeploymentsResponse.deployments as ContentDepoymentScene[]
          }

      } catch (err) {
        logger.error(`Error getting deploys`, err as Record<string, any>)
        continue;
      }

      // Filter roads and empty deployments
      const filteredDeployments = deployments
        .filter(deployments => {
          const isMetadataEmpty = (
            deployments.metadata?.display?.title === 'interactive-text' &&
            !deployments.metadata?.display?.description &&
            !deployments.metadata?.display?.navmapThumbnail
          )

          if (isMetadataEmpty) {
            return null
          }

          const isRoad = deployments.pointers.every(position => {
            const roadsMap = roads as Record<string, Record<string, true>>
            const [x, y] = position.split(',')

            return roadsMap[x] && roadsMap[x][y] || false
          })

          if (isRoad) {
            return false
          }

          return true
        })

      // Filter missing entityIds
      const entityIds = filteredDeployments.map(deploy => deploy.entityId)
      const importedPlaces = await PlaceModel.findByEntityIds(entityIds)
      const importedPlacesByEnityId = new Map(importedPlaces.map(place => [place.entity_id, place]))
      const missingDeployments = filteredDeployments.filter(deploy => !importedPlacesByEnityId.has(deploy.entityId))
      if (missingDeployments.length === 0) {
        logger.log(`No new deployments in ${catalyst.base_url}`)

      } else {
        logger.log(`${missingDeployments.length} new deployments in ${catalyst.base_url}`)
        const positions = uniq(missingDeployments.flatMap(deploy => deploy.pointers))
        const overlapedPlaces = await PlaceModel.findEnabledByPositions(positions)

        const newPlaces: PlaceAttributes[] = []
        const disabledPlaces: PlaceAttributes[] = []
        const updatedPlaces: PlaceAttributes[] = []
        const newEntityPlaces: EntityPlaceAttributes[] = []

        const overlapedPlacesByPosition = new Map(
          overlapedPlaces.flatMap(place => place.positions.map(position => [position, place]))
        )

        for (const missingDeployment of missingDeployments) {
          const missingDeploymentPositions = missingDeployment.pointers.sort()
          const currentOverlapedPlaces = uniq(
            missingDeploymentPositions
              .map(pointer => overlapedPlacesByPosition.get(pointer)!)
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
              const currentOverlapedPlacePositions = currentOverlapedPlace.positions.sort()
              const areEquals = missingDeploymentPositions.length === currentOverlapedPlacePositions.length &&
                missingDeploymentPositions.every((position, i) => position === currentOverlapedPlacePositions[i])

              if (areEquals) {
                // TODO update
                newEntityPlaces.push({
                  place_id: currentOverlapedPlace.id,
                  entity_id: missingDeployment.entityId
                })
              } else if (missingDeployment.entityTimestamp > currentOverlapedPlace.deployed_at.getTime()) {
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

        const totalDisablePlaces = await PlaceModel.disablePlaces(disabledPlaces.map(place => place.id))
        logger.log(`${totalDisablePlaces} places disabled`)

        const totalNewPlaces = await PlaceModel.createMany(newPlaces)
        logger.log(`${totalNewPlaces} new places created`)

        const totalNewEntityPlaces = await EntityPlaceModel.createMany(newEntityPlaces)
        logger.log(`${totalNewEntityPlaces} new entity places created`)
      }

      const greatherFrom = Math.max(...deployments.map(deploy => deploy.localTimestamp))
      await DeploymentTrackModel.update<DeploymentTrackAttributes>({ from: greatherFrom }, { id: catalyst.id })
    }
  }
})