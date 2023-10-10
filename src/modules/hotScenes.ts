import Time from "decentraland-gatsby/dist/utils/date/Time"
import { memo } from "radash/dist/curry"

export const getHotScenes = memo(
  async () => {
    try {
      const hotScenesFetch = await fetch(
        "https://realm-provider.decentraland.org/hot-scenes"
      )
      const hotScenesData = await hotScenesFetch.json()

      return hotScenesData
    } catch (error) {
      return []
    }
  },
  { ttl: Time.Minute }
)
