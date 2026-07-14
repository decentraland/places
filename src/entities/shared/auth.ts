import withBearerToken from "decentraland-gatsby/dist/entities/Auth/routes/withBearerToken"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
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
