import Time from "decentraland-gatsby/dist/utils/date/Time"
import env from "decentraland-gatsby/dist/utils/env"
import { memo } from "radash/dist/curry"

const DCL_LIST_URL = env(
  `GATSBY_DCL_LIST_URL`,
  `https://dcl-name-stats.decentraland.org`
)

export const getPois = memo(
  async (): Promise<string[]> => {
    try {
      const poisFetch = await fetch(`${DCL_LIST_URL}/pois`, { method: "POST" })
      const poisData = await poisFetch.json()

      return poisData.data
    } catch (error) {
      return []
    }
  },
  { ttl: Time.Hour }
)
