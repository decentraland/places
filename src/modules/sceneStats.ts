import Time from "decentraland-gatsby/dist/utils/date/Time"
import { memo } from "radash/dist/curry"

import DataTeam from "../api/DataTeam"

export const getSceneStats = memo(
  async () => {
    try {
      return await DataTeam.get().getSceneStats()
    } catch (error) {
      return {}
    }
  },
  { ttl: Time.Hour }
)
