import API from "decentraland-gatsby/dist/utils/api/API"
import env from "decentraland-gatsby/dist/utils/env"

import { HotScene } from "../entities/Place/types"

export default class RealmProvider extends API {
  static Url = env(
    `REALM_PROVIDER_URL`,
    "https://realm-provider.decentraland.org/"
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
    return this.fetch<HotScene[]>("/hot-scenes")
  }
}
