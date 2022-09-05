import { Task } from 'decentraland-gatsby/dist/entities/Task'
import DeploymentTrackModel from '../../DeploymentTrack/model'
import { DeploymentTrackAttributes } from '../../DeploymentTrack/types'
import Catalyst from 'decentraland-gatsby/dist/utils/api/Catalyst'
import PlaceModel from '../../Place/model'
import { PlaceActivityAttributes } from '../types'
import PlaceActivityModel from '../model'

export const checkActivity = new Task({
  name: 'check_activity',
  repeat: Task.Repeat.EachMinute,
  task: async (ctx) => {
    const catalysts = await DeploymentTrackModel.find<DeploymentTrackAttributes>({ disabled: false })
    for (const catalyst of catalysts) {
      const logger = ctx.logger.extend({ catalyst_id: catalyst.id, catalyst_url: catalyst.base_url })

      const now = new Date()
      const parcelStats = new Map<string, number>()
      try {
        const result = await Catalyst.from(catalyst.base_url).getStatsParcels()
        logger.log(`${result.parcels.length} new stats in ${catalyst.base_url}`)
        for (const stat of result.parcels) {
          parcelStats.set(`${stat.parcel.x},${stat.parcel.x}`, stat.peersCount)
        }

      } catch (err) {
        logger.error(`Error getting stats`, err as Record<string, any>)
        continue;
      }

      const places = await PlaceModel.findEnabledByPositions(Array.from(parcelStats.keys()))
      const placeByPositions = new Map(places.flatMap(place => place.positions.map(position => [position, place])))
      const placeActivities = new Map<string, PlaceActivityAttributes>()

      for (const [position, users] of parcelStats.entries()) {
        const place = placeByPositions.get(position)
        if (place) {
          const actity: PlaceActivityAttributes = placeActivities.get(place.id) || {
            place_id: place.id,
            catalyst_id: catalyst.id,
            created_at: now,
            users: 0
          }

          actity.users += users
          placeActivities.set(place.id, actity)
        }
      }

      const activities = Array.from(placeActivities.values())

      logger.log(`${activities.length} new activites generated`)
      await PlaceActivityModel.createMany(activities)
    }
  }
})