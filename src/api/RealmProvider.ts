import API from "decentraland-gatsby/dist/utils/api/API"
import Options from "decentraland-gatsby/dist/utils/api/Options"
import Time from "decentraland-gatsby/dist/utils/date/Time"
import env from "decentraland-gatsby/dist/utils/env"

import { HotScene } from "../entities/Place/types"

export default class RealmProvider extends API {
  static Url = env(
    `REALM_PROVIDER_URL`,
    "https://realm-provider-ea.decentraland.org/"
  )

  static Cache = new Map<string, RealmProvider>()

  static from(url: string) {
    if (!this.Cache.has(url)) {
      this.Cache.set(url, new RealmProvider(url))
    }

    return this.Cache.get(url)!
  }

  static get() {
    return this.from(env("REALM_PROVIDER_URL", this.Url))
  }

  async getHotScenes() {
    // TODO(@lauti7): review later
    const { signal, abort } = new AbortController()

    const fetchOptions = new Options({ signal })

    const timeoutId = setTimeout(() => {
      abort()
    }, Time.Second * 10)

    const response = this.fetch<HotScene[]>("/hot-scenes", fetchOptions)

    clearTimeout(timeoutId)

    return response
  }
}
