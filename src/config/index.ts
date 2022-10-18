import { setupEnv } from "decentraland-gatsby/dist/utils/env"

import dev from "./dev.json"
import prod from "./prod.json"
import stg from "./stg.json"

setupEnv({ dev, stg, prod })
