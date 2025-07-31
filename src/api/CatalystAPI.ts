import API from "decentraland-gatsby/dist/utils/api/API"
import Options from "decentraland-gatsby/dist/utils/api/Options"
import Time from "decentraland-gatsby/dist/utils/date/Time"
import env from "decentraland-gatsby/dist/utils/env"

import { Paginated, Permission } from "../entities/Place/types"

export default class CatalystAPI extends API {
  static Url =
    env(`CATALYST_URL`, "https://peer-ap1.decentraland.zone/") + "/lambdas"

  static Cache = new Map<string, CatalystAPI>()

  static from(url: string) {
    if (!this.Cache.has(url)) {
      this.Cache.set(url, new CatalystAPI(url))
    }

    return this.Cache.get(url)!
  }

  static get() {
    return this.from(env("CATALYST_URL", this.Url))
  }

  async getOperatedLands(address: string) {
    const { signal, abort } = new AbortController()

    const fetchOptions = new Options({ signal })

    const timeoutId = setTimeout(() => {
      abort()
    }, Time.Second * 10)

    try {
      const response = await this.fetch<Paginated<Permission>>(
        `/users/${address}/permissions`,
        fetchOptions
      )
      return response
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
