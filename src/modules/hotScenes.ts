import Time from "decentraland-gatsby/dist/utils/date/Time"
import { memo } from "radash/dist/curry"

import RealmProvider from "../api/RealmProvider"
import { HotScene } from "../entities/Place/types"

export const getHotScenes = memo(
  async (): Promise<HotScene[]> => {
    try {
      return await RealmProvider.get().getHotScenes()
    } catch (error) {
      return []
    }
  },
  { ttl: Time.Minute }
)
