import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"

import Destinations from "../api/Destinations"
import { AggregateDestinationAttributes } from "../entities/Destination/types"

export function useDestinationsHighlighted(options?: {
  limit: number
  offset: number
}) {
  return useAsyncMemo(
    async () => {
      const result = await Destinations.get().getDestinationsHighlighted(
        options
      )
      return result.data
    },
    [options?.limit, options?.offset],
    { initialValue: [] as AggregateDestinationAttributes[] }
  )
}
