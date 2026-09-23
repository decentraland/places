import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import { AjvObjectSchema } from "decentraland-gatsby/dist/entities/Schema/types"

import { withDatabaseTransaction } from "../../Database/model"
import PlaceModel from "../../Place/model"
import { requireRankingToken } from "../../shared/auth"
import { createWkcValidator } from "../../shared/validate"
import WorldModel from "../../World/model"
import { replaceRankingBodySchema } from "../schemas"
import { ReplaceRankingBody, ReplaceRankingResult } from "../types"

const validateBody = createWkcValidator<ReplaceRankingBody>(
  replaceRankingBodySchema as AjvObjectSchema
)

/**
 * Replace the whole automated ranking set in one transaction.
 *
 * The daily score rebuilds its eligible set from scratch every run, but a per-row write can only
 * say what does rank; it has no way to say what stopped ranking. A destination that qualified
 * yesterday and not today keeps its number forever, which is how the retired legacy feed left
 * values above the current maximum sitting at the top of browse order.
 *
 * So the payload is the complete set for a run: every ranking it names is written, and every
 * automated ranking it does not name is cleared. Both halves share one transaction, because a
 * clear followed by a separate write would leave a window where the entire non-curated population
 * reads as unranked, and browse requests landing in that window would see no order at all.
 *
 * Curated destinations are never touched, not by the write and not by the clear. That is enforced
 * in the SQL rather than trusted to the caller: clearing what is missing is far more dangerous
 * than a single write if it ever reaches the featured shelf.
 */
export async function replaceRanking(
  ctx: Context<{}, "request" | "body">
): Promise<ApiResponse<ReplaceRankingResult, {}>> {
  await requireRankingToken(ctx)

  const body = await validateBody(ctx.body)

  const places = body.entries.filter((entry) => entry.entity_type === "place")
  const worlds = body.entries.filter((entry) => entry.entity_type === "world")

  const duplicated = findDuplicatedIds(body.entries)
  if (duplicated.length > 0) {
    throw new ErrorResponse(
      Response.BadRequest,
      `The same destination appears more than once: ${duplicated.join(", ")}`
    )
  }

  // Absent `replaces`, the scope is whatever the payload carries. That is narrower than the old
  // behaviour, which cleared both tables regardless, and narrower is the point: a run that only
  // built its places half must not empty the worlds.
  const scope = new Set(
    body.replaces ?? body.entries.map((entry) => entry.entity_type)
  )

  const outOfScope = body.entries.filter(
    (entry) => !scope.has(entry.entity_type)
  )
  if (outOfScope.length > 0) {
    throw new ErrorResponse(
      Response.BadRequest,
      `Entries name types this run does not declare in "replaces": ${[
        ...new Set(outOfScope.map((entry) => entry.entity_type)),
      ].join(", ")}`
    )
  }

  const replacesPlaces = scope.has("place")
  const replacesWorlds = scope.has("world")

  const result = await withDatabaseTransaction(async () => {
    const [placeClasses, worldClasses] = await Promise.all([
      PlaceModel.classifyForRankingReplace(places.map((entry) => entry.id)),
      WorldModel.classifyForRankingReplace(worlds.map((entry) => entry.id)),
    ])

    // A run whose every named id is unknown to us is not a run that ranked nothing, it is a run
    // built against the wrong catalogue. Letting it through would clear every ranking of that type
    // and report success, with the evidence buried in `skipped_missing`.
    rejectWhenNothingResolved("place", places, placeClasses.missing)
    rejectWhenNothingResolved("world", worlds, worldClasses.missing)

    const placeWritable = new Set(placeClasses.writable)
    const worldWritable = new Set(worldClasses.writable)

    const placeCounts = replacesPlaces
      ? await PlaceModel.applyRankingReplace(
          places.filter((entry) => placeWritable.has(entry.id))
        )
      : { applied: 0, cleared: 0 }
    const worldCounts = replacesWorlds
      ? await WorldModel.applyRankingReplace(
          worlds.filter((entry) => worldWritable.has(entry.id))
        )
      : { applied: 0, cleared: 0 }

    return {
      places: {
        ...placeCounts,
        replaced: replacesPlaces,
        skipped_curated: placeClasses.curated,
        skipped_world_backed: placeClasses.world_backed,
        skipped_missing: placeClasses.missing,
      },
      worlds: {
        ...worldCounts,
        replaced: replacesWorlds,
        skipped_curated: worldClasses.curated,
        skipped_missing: worldClasses.missing,
      },
    }
  })

  return new ApiResponse(result)
}

/**
 * Refuse a type whose every named destination is unknown to the catalogue.
 *
 * Some misses are ordinary: a destination disabled between the caller's export and its run. All of
 * them missing is different in kind, and it is the shape a run built against a stale or wrong
 * catalogue takes. Since the write half would then be empty and the clear half would still run, the
 * request would empty the ranking of that type and answer 201.
 *
 * A type the caller sent nothing for is untouched here: that is the legitimate "nothing qualified
 * today" it declares through `replaces`.
 */
function rejectWhenNothingResolved(
  entityType: string,
  sent: ReplaceRankingBody["entries"],
  missing: string[]
): void {
  if (sent.length > 0 && missing.length === sent.length) {
    throw new ErrorResponse(
      Response.BadRequest,
      `None of the ${sent.length} ${entityType} destinations in this request exist, so it would clear every ${entityType} ranking rather than replace it`
    )
  }
}

/**
 * An id sent twice means the caller computed two rankings for one destination, and whichever landed
 * last would win silently. The export has a uniqueness test for this, so a duplicate here is a
 * broken run rather than a row to skip, and it should fail loudly before anything is written.
 */
function findDuplicatedIds(entries: ReplaceRankingBody["entries"]): string[] {
  const seen = new Set<string>()
  const duplicated = new Set<string>()

  for (const entry of entries) {
    // Reported with the entity type, not the bare id: the two id spaces are a UUID and a world
    // name so a cross-type collision is far fetched, but the message exists to be diagnosed from
    // a log and the type is half of what identifies the row.
    const key = `${entry.entity_type}:${entry.id}`
    if (seen.has(key)) {
      duplicated.add(key)
    }
    seen.add(key)
  }

  return [...duplicated]
}
