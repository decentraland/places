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

  const result = await withDatabaseTransaction(async () => {
    const [placeClasses, worldClasses] = await Promise.all([
      PlaceModel.classifyForRankingReplace(places.map((entry) => entry.id)),
      WorldModel.classifyForRankingReplace(worlds.map((entry) => entry.id)),
    ])

    const placeWritable = new Set(placeClasses.writable)
    const worldWritable = new Set(worldClasses.writable)

    const placeCounts = await PlaceModel.applyRankingReplace(
      places.filter((entry) => placeWritable.has(entry.id))
    )
    const worldCounts = await WorldModel.applyRankingReplace(
      worlds.filter((entry) => worldWritable.has(entry.id))
    )

    return {
      places: {
        ...placeCounts,
        skipped_curated: placeClasses.curated,
        skipped_world_backed: placeClasses.world_backed,
        skipped_missing: placeClasses.missing,
      },
      worlds: {
        ...worldCounts,
        skipped_curated: worldClasses.curated,
        skipped_missing: worldClasses.missing,
      },
    }
  })

  return new ApiResponse(result)
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
