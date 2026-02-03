import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import env from "decentraland-gatsby/dist/utils/env"

export type ServiceAuthOptions = {
  envTokenKey: string
}

const defaultOptions: ServiceAuthOptions = {
  envTokenKey: "DATA_TEAM_AUTH_TOKEN",
}

/**
 * Validates service-to-service authentication using a pre-configured token.
 * The token must be provided in the Authorization header as `Bearer <token>` or just `<token>`.
 *
 * @param ctx - The request context containing the authorization header
 * @param options - Configuration options for the middleware
 * @throws ErrorResponse with 500 if token is not configured
 * @throws ErrorResponse with 401 if authorization header is missing
 * @throws ErrorResponse with 403 if token is invalid
 */
export function validateServiceAuth<T extends Record<string, string>>(
  ctx: Context<T, "request">,
  options: ServiceAuthOptions = defaultOptions
): void {
  const authToken = env(options.envTokenKey, "")

  if (!authToken) {
    throw new ErrorResponse(
      Response.InternalServerError,
      "Service authentication not configured"
    )
  }

  const authHeader = ctx.request.headers.get("authorization")

  if (!authHeader) {
    throw new ErrorResponse(Response.Unauthorized, "Authorization required")
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader

  if (token !== authToken) {
    throw new ErrorResponse(Response.Forbidden, "Invalid authorization token")
  }
}

/**
 * Middleware function that validates service-to-service authentication.
 * Use this to protect endpoints that should only be accessed by other services.
 *
 * @param options - Configuration options for the middleware
 * @returns A function that validates the service token from the request context
 *
 * @example
 * ```typescript
 * export async function updateRanking(ctx: Context<...>): Promise<ApiResponse<...>> {
 *   withServiceAuth()(ctx)
 *   // ... rest of the handler
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With custom env token key
 * export async function myHandler(ctx: Context<...>): Promise<ApiResponse<...>> {
 *   withServiceAuth({ envTokenKey: 'MY_SERVICE_TOKEN' })(ctx)
 *   // ... rest of the handler
 * }
 * ```
 */
export function withServiceAuth(options: ServiceAuthOptions = defaultOptions) {
  return <T extends Record<string, string>>(
    ctx: Context<T, "request">
  ): void => {
    validateServiceAuth(ctx, options)
  }
}
