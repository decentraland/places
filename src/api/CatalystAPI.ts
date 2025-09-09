import API from "decentraland-gatsby/dist/utils/api/API"
import Options from "decentraland-gatsby/dist/utils/api/Options"
import Time from "decentraland-gatsby/dist/utils/date/Time"
import env from "decentraland-gatsby/dist/utils/env"

import { Paginated, Permission } from "../entities/Place/types"

export default class CatalystAPI extends API {
  static Url = env(`CATALYST_URL`, "https://peer.decentraland.org/")

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

  async getAllOperatedLands(address: string): Promise<Permission[]> {
    const allElements: Permission[] = []
    let pageNum = 0
    const pageSize = 100 // Default page size, adjust if needed
    let hasMorePages = true

    while (hasMorePages) {
      const { signal, abort } = new AbortController()
      const fetchOptions = new Options({ signal })

      const timeoutId = setTimeout(() => {
        abort()
      }, Time.Second * 10)

      try {
        const response = await this.fetch<Paginated<Permission>>(
          `/lambdas/users/${address}/lands-permissions?pageNum=${pageNum}&pageSize=${pageSize}`,
          fetchOptions
        )

        if (response.elements && response.elements.length > 0) {
          allElements.push(...response.elements)
        }

        hasMorePages =
          response.elements && response.elements.length === pageSize
        pageNum++
      } catch (error) {
        console.error(`Error fetching operated lands page ${pageNum}:`, error)
        break // return already fetched elements
      } finally {
        clearTimeout(timeoutId)
      }
    }

    return allElements
  }
}
