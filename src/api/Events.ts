import API from "decentraland-gatsby/dist/utils/api/API"
import Options from "decentraland-gatsby/dist/utils/api/Options"
import Time from "decentraland-gatsby/dist/utils/date/Time"
import env from "decentraland-gatsby/dist/utils/env"

/**
 * Event type matching the events API response structure
 */
export type Event = {
  id: string
  name: string
  image?: string
  description?: string
  start_at: string
  finish_at: string
  next_start_at: string
  next_finish_at: string
  live: boolean
  place_id?: string
  world?: boolean
  server?: string
}

export type EventsResponse = {
  ok: boolean
  data: Event[]
}

type CachedLiveStatus = {
  hasLiveEvent: boolean
  expiresAt: number
}

/**
 * API client for the Events service.
 * Provides methods to check for live events associated with places/worlds.
 */
export default class Events extends API {
  static Url = env("EVENTS_API_URL", "https://events.decentraland.org/api")

  static Cache = new Map<string, Events>()

  // Cache for live event status with 5-minute TTL
  private static liveEventCache = new Map<string, CachedLiveStatus>()
  private static readonly CACHE_TTL_MS = Time.Minute * 5 // 5 minutes

  static from(url: string) {
    if (!this.Cache.has(url)) {
      this.Cache.set(url, new Events(url))
    }
    return this.Cache.get(url)!
  }

  static get() {
    return this.from(env("EVENTS_API_URL", this.Url))
  }

  /**
   * Check if a destination (place or world) has any live events.
   * Both places and worlds use the same `places_ids` filter since they share the same table.
   * Results are cached for 5 minutes.
   *
   * @param destinationId - The destination UUID (place or world) to check for live events
   * @returns true if there's at least one live event, false otherwise
   */
  async hasLiveEvent(destinationId: string): Promise<boolean> {
    const cacheKey = `destination:${destinationId}:live`
    const cached = Events.liveEventCache.get(cacheKey)

    // Return cached value if it exists and hasn't expired
    if (cached && cached.expiresAt > Date.now()) {
      return cached.hasLiveEvent
    }

    const controller = new AbortController()
    const { signal } = controller
    const fetchOptions = new Options({ signal })

    const timeoutId = setTimeout(() => {
      controller.abort()
    }, Time.Second * 10)

    try {
      const params = new URLSearchParams({
        places_ids: destinationId,
        list: "live",
      })
      const response = await this.fetch<EventsResponse>(
        `/events?${params}`,
        fetchOptions
      )
      const hasLiveEvent =
        response.ok && response.data && response.data.length > 0

      // Cache the result with expiration
      Events.liveEventCache.set(cacheKey, {
        hasLiveEvent,
        expiresAt: Date.now() + Events.CACHE_TTL_MS,
      })

      return hasLiveEvent
    } catch (error) {
      console.error(
        `Error checking live events for destination ${destinationId}:`,
        error
      )
      return false
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Batch check for live events for multiple destinations.
   * Works for both places and worlds since they share the same table.
   *
   * @param destinationIds - Array of destination UUIDs (places or worlds) to check
   * @returns Map where keys are destination IDs and values indicate live event status
   */
  async checkLiveEventsForDestinations(
    destinationIds: string[]
  ): Promise<Map<string, boolean>> {
    const liveEventsMap = new Map<string, boolean>()

    const fetchPromises: Promise<void>[] = []

    for (const id of destinationIds) {
      fetchPromises.push(
        this.hasLiveEvent(id)
          .then((hasLive) => {
            liveEventsMap.set(id, hasLive)
          })
          .catch(() => {
            liveEventsMap.set(id, false)
          })
      )
    }

    await Promise.all(fetchPromises)

    return liveEventsMap
  }
}

