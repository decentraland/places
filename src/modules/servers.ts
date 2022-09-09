import Catalyst from "decentraland-gatsby/dist/utils/api/Catalyst"
import { memo } from "radash/dist/curry"

export const getServers = memo(async () => Catalyst.get().getServers())
