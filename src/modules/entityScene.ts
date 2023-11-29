import DataLoader from "dataloader"
import Catalyst, {
  ContentEntityScene,
} from "decentraland-gatsby/dist/utils/api/Catalyst"
import Time from "decentraland-gatsby/dist/utils/date/Time"
import { memo } from "radash"

const loader = new DataLoader(
  async function (
    positions: readonly string[]
  ): Promise<(ContentEntityScene | null)[]> {
    const entityScenes = await Catalyst.getInstance().getEntityScenes(
      positions as string[]
    )

    const entityScenesMap = new Map()

    for (const entityScene of entityScenes) {
      entityScenesMap.set(entityScene.metadata.scene!.base, entityScene)
      entityScene.metadata.scene!.parcels.forEach((parcel) => {
        entityScenesMap.set(parcel, entityScene)
      })
    }
    return positions.map((position) => entityScenesMap.get(position) || null)
  },
  { cache: false }
)

export const getEntityScene = memo(
  async (position: string) => {
    return loader.load(position)
  },
  { ttl: Time.Hour, key: (position: string) => position }
)

export const getEntityScenes = async (positions: string[]) => {
  return Promise.all(positions.map((position) => getEntityScene(position)))
}
