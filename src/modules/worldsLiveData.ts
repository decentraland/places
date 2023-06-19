import Time from "decentraland-gatsby/dist/utils/date/Time"
import fetch from "node-fetch"
import { memo } from "radash/dist/curry"

export type WorldLivePerWorldProps = {
  users: number
  worldName: string
}

export type WorldLiveDataProps = {
  perWorld: WorldLivePerWorldProps[]
  totalUsers: number
}

export const getWorldsLiveData = memo(
  async (): Promise<WorldLiveDataProps> => {
    try {
      const liveFetch = await fetch(
        "https://worlds-content-server.decentraland.org/live-data"
      )
      const liveData = await liveFetch.json()

      return liveData.data
    } catch (error) {
      return {} as WorldLiveDataProps
    }
  },
  { ttl: Time.Minute }
)
