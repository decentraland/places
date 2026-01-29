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
  data: {
    events: Event[]
    total: number
  }
}

type CachedLiveStatus = {
  isLive: boolean
  expiresAt: number
}

/**
 * API client for the Events service.
 * Provides methods to check for live events associated with places/worlds.
 */
export default class Events extends API {
  static Url = env("EVENTS_API_URL", "https://events.decentraland.zone/api")

  static Cache = new Map<string, Events>()

  // Per-ID cache for live event status with 5-minute TTL
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
   * Batch check for live events for multiple destinations.
   * Uses POST with body { placeIds: [...] } as required by the events API.
   * Works for both places and worlds since they share the same table.
   * Results are cached per-ID for 5 minutes.
   *
   * @param destinationIds - Array of destination UUIDs (places or worlds) to check
   * @returns Map where keys are destination IDs and values indicate live event status
   */
  async checkLiveEventsForDestinations(
    destinationIds: string[]
  ): Promise<Map<string, boolean>> {
    const liveEventsMap = new Map<string, boolean>()

    if (destinationIds.length === 0) {
      return liveEventsMap
    }

    // Check cache for each ID, collect uncached IDs
    const uncachedIds: string[] = []
    const now = Date.now()

    for (const id of destinationIds) {
      const cached = Events.liveEventCache.get(id)
      if (cached && cached.expiresAt > now) {
        liveEventsMap.set(id, cached.isLive)
      } else {
        uncachedIds.push(id)
      }
    }

    // If all IDs were cached, return early
    if (uncachedIds.length === 0) {
      return liveEventsMap
    }

    const controller = new AbortController()
    const { signal } = controller
    const fetchOptions = new Options({
      signal,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        placeIds: uncachedIds,
      }),
    })

    const timeoutId = setTimeout(() => {
      controller.abort()
    }, Time.Second * 10)

    try {
      const response = await this.fetch<EventsResponse>(
        `/events/search?list=live`,
        fetchOptions
      )

      // Initialize uncached IDs as false (no live event)
      for (const id of uncachedIds) {
        liveEventsMap.set(id, false)
      }

      // Mark destinations that have live events
      if (response.ok && response.data?.events) {
        for (const event of response.data.events) {
          if (event.place_id && uncachedIds.includes(event.place_id)) {
            liveEventsMap.set(event.place_id, true)
          }
        }
      }

      // Cache each result individually
      const expiresAt = now + Events.CACHE_TTL_MS
      for (const id of uncachedIds) {
        Events.liveEventCache.set(id, {
          isLive: liveEventsMap.get(id) ?? false,
          expiresAt,
        })
      }

      return liveEventsMap
    } catch (error) {
      console.error(`Error checking live events for destinations:`, error)
      // Return false for uncached IDs on error
      for (const id of uncachedIds) {
        liveEventsMap.set(id, false)
      }
      return liveEventsMap
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
