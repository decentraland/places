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
 * Guards the ranking of a highlighted entity against the automated pipeline.
 *
 * `ranking` has two writers: the data team job (DATA_TEAM_AUTH_TOKEN) computing a
 * score, and the editorial admin (PLACES_ADMIN_AUTH_TOKEN) setting the order the
 * highlighted shelf is shown in. They share one column, so the scheduled job kept
 * overwriting hand-curated positions hours after they were set. While an entity is
 * highlighted its ranking is editorial, so only the admin token may move it.
 */
export function requireAdminTokenForHighlighted(
  token: string,
  highlighted: boolean
): void {
  if (!highlighted) {
    return
  }

  const adminToken = env("PLACES_ADMIN_AUTH_TOKEN", "")

  if (!adminToken || token !== adminToken) {
    throw new ErrorResponse(
      Response.Forbidden,
      "The ranking of a highlighted entity is editorial and can only be changed with the admin token"
    )
  }
}
