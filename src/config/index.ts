import { setupEnv } from "decentraland-gatsby/dist/utils/env"

import dev from "./dev.json"
import prod from "./prod.json"
import stg from "./stg.json"

const envs = { dev, stg, prod }
if (process.env.GATSBY_DCL_DEFAULT_ENV === "dev") {
  envs.prod = dev
  envs.stg = dev
}

setupEnv(envs)
