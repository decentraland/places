import Catalyst from "decentraland-gatsby/dist/utils/api/Catalyst"
import { memo } from "radash/dist/curry"

export const getPois = memo(async () => {
  try {
    const position = await Catalyst.get().getPOIs()
    return position.map((poi) => poi.join(","))
  } catch (error) {
    return []
  }
})
