import API from "decentraland-gatsby/dist/utils/api/API"
import Options from "decentraland-gatsby/dist/utils/api/Options"
import Time from "decentraland-gatsby/dist/utils/date/Time"
import env from "decentraland-gatsby/dist/utils/env"

export type RoomParticipantsResponse = {
  ok: boolean
  data: {
    addresses: string[]
  }
}

export default class CommsGatekeeper extends API {
  static Url = env(
    `COMMS_GATEKEEPER_URL`,
    "https://comms-gatekeeper.decentraland.org"
  )

  static Cache = new Map<string, CommsGatekeeper>()

  static from(url: string) {
    if (!this.Cache.has(url)) {
      this.Cache.set(url, new CommsGatekeeper(url))
    }
    return this.Cache.get(url)!
  }

  static get() {
    return this.from(env("COMMS_GATEKEEPER_URL", this.Url))
  }

  /**
   * Get the list of participant wallet addresses in a scene room.
   * @param pointer - Scene pointer/parcel (e.g., "10,20")
   * @param realmName - Realm name (default: "main")
   * @returns List of wallet addresses connected to the room
   */
  async getSceneRoomParticipants(
    pointer: string,
    realmName: string = "main"
  ): Promise<string[]> {
    const { signal, abort } = new AbortController()
    const fetchOptions = new Options({ signal })

    const timeoutId = setTimeout(() => {
      abort()
    }, Time.Second * 10)

    try {
      const params = new URLSearchParams({
        pointer,
        realm_name: realmName,
      })
      const response = await this.fetch<RoomParticipantsResponse>(
        `/room-participants?${params}`,
        fetchOptions
      )
      return response.data.addresses
    } catch (error) {
      console.error(
        `Error fetching scene room participants for pointer ${pointer}:`,
        error
      )
      return []
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Get the list of participant wallet addresses in a world room.
   * @param worldName - World name (e.g., "mycoolworld.dcl.eth")
   * @returns List of wallet addresses connected to the room
   */
  async getWorldRoomParticipants(worldName: string): Promise<string[]> {
    const { signal, abort } = new AbortController()
    const fetchOptions = new Options({ signal })

    const timeoutId = setTimeout(() => {
      abort()
    }, Time.Second * 10)

    try {
      const params = new URLSearchParams({ world_name: worldName })
      const response = await this.fetch<RoomParticipantsResponse>(
        `/room-participants?${params}`,
        fetchOptions
      )
      return response.data.addresses
    } catch (error) {
      console.error(
        `Error fetching world room participants for ${worldName}:`,
        error
      )
      return []
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

