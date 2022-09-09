import Catalyst from "decentraland-gatsby/dist/utils/api/Catalyst"
import { memo } from "radash"

export const getPois = memo(async () => Catalyst.get().getPOIs())
