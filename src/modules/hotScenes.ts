import Catalyst from "decentraland-gatsby/dist/utils/api/Catalyst"
import Time from "decentraland-gatsby/dist/utils/date/Time"
import { memo } from "radash/dist/curry"

export const getHotScenes = memo(
  async () => {
    try {
      return await Catalyst.get().getHostScenes()
    } catch (error) {
      return []
    }
  },
  { ttl: Time.Minute }
)
