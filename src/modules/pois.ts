import Catalyst from "decentraland-gatsby/dist/utils/api/Catalyst"
import { memo } from "radash"

export const getPois = memo(async () => {
  try {
    return (await Catalyst.get().getPOIs()).map((poi) => poi.join(","))
  } catch (error) {
    return []
  }
})
