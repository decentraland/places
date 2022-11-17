import Catalyst from "decentraland-gatsby/dist/utils/api/Catalyst"
import Time from "decentraland-gatsby/dist/utils/date/Time"
import { memo } from "radash/dist/curry"

export const getEntityScenes = memo(
  async (positions: string[]) => {
    try {
      return await Catalyst.get().getEntityScenes(positions)
    } catch (error) {
      return []
    }
  },
  { ttl: Time.Hour, key: (positions: string[]) => positions.join(",") }
)
