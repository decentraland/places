import { WorldSettingsChangedEvent } from "@dcl/schemas/dist/platform/events/world"
import logger from "decentraland-gatsby/dist/entities/Development/logger"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import env from "decentraland-gatsby/dist/utils/env"

import {
  ContentServerConfigurationError,
  InvalidWorldSqsMessageError,
} from "./errors"
import { getTrustedContentServerUrl } from "./processEntityId"
import { drainResponse } from "../../../utils/fetch"
import {
  isDowngradingRating,
  isUpgradingRating,
} from "../../../utils/rating/contentRating"
import { sanitizeImageUrl, sanitizePlaceDescription } from "../../Place/utils"
import {
  notifyDowngradeRating,
  notifyError,
  notifyUpgradingRating,
} from "../../Slack/utils"
import WorldModel from "../../World/model"

const SETTINGS_FETCH_TIMEOUT_MS = 15_000
// worlds.title is VARCHAR(50); worlds-content-server does not bound titles
const WORLD_TITLE_MAX_LENGTH = 50

/** Snake-case body of GET /world/:world_name/settings on worlds-content-server. */
type WorldSettingsResponse = {
  title?: string
  description?: string
  content_rating?: string
  spawn_coordinates?: string
  skybox_time?: number | null
  categories?: string[] | null
  single_player?: boolean
  show_in_places?: boolean
  thumbnail_hash?: string
  access_type?: string
  settings_version?: number
}

/**
 * The settings source URL comes from WORLDS_CONTENT_SERVER_URL, not from the message, so an
 * untrusted or malformed URL is a deployment misconfiguration: surface it as such so the consumer
 * retries the message instead of discarding it as deterministically invalid.
 */
function getTrustedSettingsSourceUrl(
  worldsContentServerUrl: string,
  allowedContentServerHosts: string
): string {
  try {
    return getTrustedContentServerUrl(
      { contentServerUrls: [worldsContentServerUrl] },
      allowedContentServerHosts
    )
  } catch (error) {
    if (error instanceof InvalidWorldSqsMessageError) {
      throw new ContentServerConfigurationError(
        `WORLDS_CONTENT_SERVER_URL '${worldsContentServerUrl}' is not an allowed content server host`
      )
    }
    throw error
  }
}

/** Fetch the authoritative world settings; null when the world is unknown to the source. */
async function fetchWorldSettings(
  contentServerUrl: string,
  worldName: string
): Promise<WorldSettingsResponse | null> {
  const response = await fetch(
    `${contentServerUrl}/world/${encodeURIComponent(worldName)}/settings`,
    {
      signal: AbortSignal.timeout(SETTINGS_FETCH_TIMEOUT_MS),
      // The host was allowlisted before the request; a redirect would move the response off it
      redirect: "error",
    }
  )
  if (response.status === 404) {
    await drainResponse(response)
    return null
  }
  if (!response.ok) {
    await drainResponse(response)
    throw new Error(
      `Unable to fetch world settings for ${worldName}: ${response.status} ${response.statusText}`
    )
  }
  return (await response.json()) as WorldSettingsResponse
}

/** Map worlds-content-server ratings to the places scale; undefined when absent or unknown. */
function normalizeContentRating(
  rating: string | undefined
): SceneContentRating | undefined {
  if (!rating) {
    return undefined
  }
  if (rating === "E") {
    return SceneContentRating.TEEN
  }
  if (rating === "M") {
    return SceneContentRating.ADULT
  }
  const knownRatings = Object.values(SceneContentRating) as string[]
  if (knownRatings.includes(rating)) {
    return rating as SceneContentRating
  }
  return undefined
}

/**
 * Narrows the mirrored settings version. Only a non-negative safe integer can order writes, so
 * anything else is rejected rather than accepted as a version.
 */
function isValidSettingsVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

/** Maps an access type to world visibility; undefined when no access type was provided. */
function toIsPrivate(accessType: string | undefined): boolean | undefined {
  return accessType === undefined ? undefined : accessType !== "unrestricted"
}

/**
 * True when the fetched response carries at least one setting worth mirroring, version aside.
 *
 * Deliberately ignores the event payload: whether the payload's accessType counts depends on which
 * write path runs, so each branch decides that for itself.
 */
function carriesFetchedValues(settings: WorldSettingsResponse): boolean {
  return (
    settings.title !== undefined ||
    settings.description !== undefined ||
    settings.content_rating !== undefined ||
    settings.categories !== undefined ||
    settings.thumbnail_hash !== undefined ||
    settings.show_in_places !== undefined ||
    settings.single_player !== undefined ||
    settings.skybox_time !== undefined ||
    settings.access_type !== undefined
  )
}

/**
 * Handles WorldSettingsChangedEvent from the worlds content server.
 *
 * The event is only a trigger: the authoritative settings — including the access type that drives
 * world visibility — are read back from GET /world/:world_name/settings. Reading current state makes
 * reordered, duplicated or redelivered events converge instead of applying stale snapshots, and the
 * returned settings_version guards the write so a slow handler cannot overwrite data a concurrent
 * one already applied.
 *
 * The payload's accessType is used only against a source that predates the versioned contract, where
 * it is the sole visibility signal available; a versioned response always wins over it.
 *
 * Note: Content creators cannot downgrade ratings - only moderators can.
 * If a downgrade is attempted, the original rating is preserved and
 * moderators are notified.
 */
export async function handleWorldSettingsChanged(
  event: WorldSettingsChangedEvent,
  worldsContentServerUrl = env(
    "WORLDS_CONTENT_SERVER_URL",
    "https://worlds-content-server.decentraland.org"
  ),
  allowedContentServerHosts = env("ALLOWED_CONTENT_SERVER_HOSTS", "")
): Promise<void> {
  const { worldName } = event.metadata

  if (!worldName) {
    logger.error("WorldSettingsChangedEvent missing world name (key)")
    return
  }

  const loggerExtended = logger.extend({
    worldName,
    eventType: "WorldSettingsChangedEvent",
  })

  try {
    loggerExtended.log(`Processing settings change for world: ${worldName}`)

    const contentServerUrl = getTrustedSettingsSourceUrl(
      worldsContentServerUrl,
      allowedContentServerHosts
    )
    const settings = await fetchWorldSettings(contentServerUrl, worldName)
    if (!settings) {
      loggerExtended.log(
        `World not found on worlds content server, skipping settings update: ${worldName}`
      )
      return
    }

    const fetchedRating = normalizeContentRating(settings.content_rating)

    // Check if this is a rating change attempt on an existing world
    const existingWorld = await WorldModel.findByWorldName(worldName)
    let contentRatingToUse: SceneContentRating | undefined = fetchedRating
    let blockedDowngrade = false
    let appliedUpgrade = false

    if (fetchedRating && existingWorld && existingWorld.content_rating) {
      if (isDowngradingRating(fetchedRating, existingWorld.content_rating)) {
        // Content creators cannot downgrade ratings - moderators are notified below
        loggerExtended.log(
          `Blocked rating downgrade attempt for world ${worldName}: ` +
            `${existingWorld.content_rating} -> ${fetchedRating}`
        )
        blockedDowngrade = true
        // Keep the original rating
        contentRatingToUse = undefined
      } else if (
        isUpgradingRating(fetchedRating, existingWorld.content_rating)
      ) {
        appliedUpgrade = true
      }
    }

    // Preserve upsertWorld's "omitted means do not update" contract on every field: an absent
    // field means the worlds row has no value for it, not an instruction to clear ours.
    const worldUpdate = {
      world_name: worldName,
      title:
        settings.title === undefined
          ? undefined
          : settings.title.slice(0, WORLD_TITLE_MAX_LENGTH),
      description:
        settings.description === undefined
          ? undefined
          : sanitizePlaceDescription(settings.description),
      content_rating: contentRatingToUse,
      categories: settings.categories ?? undefined,
      image:
        settings.thumbnail_hash === undefined
          ? undefined
          : sanitizeImageUrl(
              `${contentServerUrl}/contents/${settings.thumbnail_hash}`
            ),
      show_in_places: settings.show_in_places,
      single_player: settings.single_player,
      skybox_time: settings.skybox_time ?? undefined,
    }

    // Inserting a row materializes this table's NOT NULL defaults for every settings column, so a
    // response that carries no values would create a world whose settings are indistinguishable
    // from real ones. Nothing lists a world without an enabled place, so waiting for a response
    // that actually says something loses nothing.
    const logSkippedEmptyCreation = () =>
      loggerExtended.log(
        `Skipped creating a world from a settings response with no values: ${worldName}`
      )
    const wouldCreateFromEmptyResponse =
      !existingWorld && !carriesFetchedValues(settings)

    if (isValidSettingsVersion(settings.settings_version)) {
      // Only the fetched values can seed a row here: this branch ignores the payload's accessType,
      // so counting it would let an empty response create a row it cannot populate.
      if (wouldCreateFromEmptyResponse) {
        logSkippedEmptyCreation()
        return
      }

      const applied = await WorldModel.upsertWorldSettings({
        ...worldUpdate,
        // Under the versioned contract visibility comes from the fetch, never from the payload: the
        // payload has no ordering relationship with settings_version, so a redelivered older access
        // event would otherwise pass the guard and re-apply stale visibility.
        is_private: toIsPrivate(settings.access_type),
        settings_version: settings.settings_version,
      })
      if (!applied) {
        loggerExtended.log(
          `Skipped settings older than the ones already applied for: ${worldName}`
        )
        return
      }
    } else if (settings.settings_version === undefined) {
      // A row that already applied a versioned response cannot be ordered against an unversioned
      // one, which is what a mixed fleet serves mid-rollout. Overwriting it would bypass the guard,
      // so leave it for a response that can be ordered; the next event refreshes it in full.
      if (
        existingWorld?.settings_version !== null &&
        existingWorld?.settings_version !== undefined
      ) {
        loggerExtended.log(
          `Skipped an unversioned settings response for a world already under the versioned contract: ${worldName}`
        )
        return
      }

      // Against a legacy source the payload's accessType is the only visibility signal there is, so
      // unlike the versioned branch it counts as something worth creating a row for.
      if (
        wouldCreateFromEmptyResponse &&
        event.metadata.accessType === undefined
      ) {
        logSkippedEmptyCreation()
        return
      }

      // Source predates the versioned contract: apply last-write-wins as before. A response with no
      // access_type carries no authoritative visibility either, so the event payload is the only
      // signal available during a rollout where this service ships first.
      await WorldModel.upsertWorld({
        ...worldUpdate,
        is_private: toIsPrivate(
          settings.access_type ?? event.metadata.accessType
        ),
      })
    } else {
      // Present but unusable as a version. Falling back to the unguarded upsert here would silently
      // drop the ordering guarantee, so surface it and let the consumer retry instead.
      throw new Error(
        `World settings for ${worldName} carry an invalid settings_version: ${JSON.stringify(
          settings.settings_version
        )}`
      )
    }

    // Notified only once the write actually landed, so a skipped stale update cannot ping moderators
    if (existingWorld && blockedDowngrade && fetchedRating) {
      notifyDowngradeRating(existingWorld, fetchedRating)
    }
    if (existingWorld && appliedUpgrade && fetchedRating) {
      notifyUpgradingRating(existingWorld, "Content Creator", fetchedRating)
    }

    loggerExtended.log(`Upserted world settings for: ${worldName}`)
  } catch (error: any) {
    loggerExtended.error(
      `Error handling WorldSettingsChangedEvent for ${worldName}: ${error.message}`
    )
    notifyError([
      `Error handling WorldSettingsChangedEvent`,
      `World: ${worldName}`,
      error.message,
    ])
    throw error
  }
}
