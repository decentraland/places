import withBearerToken from "decentraland-gatsby/dist/entities/Auth/routes/withBearerToken"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import env from "decentraland-gatsby/dist/utils/env"

/**
 * Authorizes ranking write endpoints. Accepts the data team service token
 * or the places admin token. Env vars are read per-request so an empty
 * value never becomes a valid credential.
 */
export async function requireRankingToken(
  ctx: Pick<Context, "request">
): Promise<string> {
  const tokens = [
    env("DATA_TEAM_AUTH_TOKEN", ""),
    env("PLACES_ADMIN_AUTH_TOKEN", ""),
  ].filter(Boolean)

  return withBearerToken({ tokens, optional: false })(ctx)
}

/**
 * Whether this token is the editorial admin's rather than the automated pipeline's.
 *
 * Exposed so a route can pick the write path that matches the caller: the admin writes a ranking
 * unconditionally, the pipeline writes one only while the row is still not curated. An unset admin
 * token never matches, so an empty environment variable cannot authorise anything.
 */
export function isAdminToken(token: string): boolean {
  const adminToken = env("PLACES_ADMIN_AUTH_TOKEN", "")

  return !!adminToken && token === adminToken
}

/**
 * Guards a curated ranking against the automated pipeline.
 *
 * `ranking` has two writers: the data team job (DATA_TEAM_AUTH_TOKEN) computing a
 * score, and the editorial admin (PLACES_ADMIN_AUTH_TOKEN) deciding the order. They
 * share one column, so the scheduled job kept overwriting hand-set positions hours
 * after they were set.
 *
 * Two states make a ranking editorial. While an entity is highlighted its position on
 * the featured shelf is a curatorial choice. And `exclude_from_ranking` marks a
 * destination that must stay browsable while the score leaves it alone, which no other
 * flag expresses: featuring moves where it shows and hiding takes it out of browse.
 *
 * Either state means only the admin token may move the ranking. The admin is still
 * allowed to set one by hand, because the flag says the automated score must not rank
 * this entity, not that nobody may.
 */
export function requireAdminTokenForCuratedRanking(
  token: string,
  curation: { highlighted: boolean; exclude_from_ranking: boolean }
): void {
  if (!curation.highlighted && !curation.exclude_from_ranking) {
    return
  }

  if (!isAdminToken(token)) {
    throw new ErrorResponse(
      Response.Forbidden,
      curation.highlighted
        ? "The ranking of a highlighted entity is editorial and can only be changed with the admin token"
        : "This entity is excluded from the automated ranking and its ranking can only be changed with the admin token"
    )
  }
}
