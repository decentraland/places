import { cache } from "dcl-catalyst-client/dist/contracts-snapshots/data"
import { memo } from "radash/dist/curry"

export const getPois = memo(async () => cache.pois.polygon, { ttl: Infinity })
