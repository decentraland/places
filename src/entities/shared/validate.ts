import RequestError from "decentraland-gatsby/dist/entities/Route/error"
import { createValidator } from "decentraland-gatsby/dist/entities/Route/validate"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import { AjvObjectSchema } from "decentraland-gatsby/dist/entities/Schema/types"

/**
 * Creates a validator compatible with the wkc route handler.
 *
 * The framework's `createValidator` throws `RequestError` (which uses `statusCode`),
 * but the wkc route handler reads `status` from `ErrorResponse`. This mismatch causes
 * validation errors to be returned as 500 instead of 400.
 *
 * This wrapper catches `RequestError` and re-throws it as an `ErrorResponse`
 * with the correct status code.
 */
export function createWkcValidator<R extends {}>(
  schema: AjvObjectSchema
): (body?: Record<string, any>) => R {
  const validator = createValidator<R>(schema)

  return function (body?: Record<string, any>): R {
    try {
      return validator(body)
    } catch (error) {
      if (error instanceof RequestError && error.statusCode) {
        throw new ErrorResponse(
          error.statusCode as typeof Response.BadRequest,
          error.message,
          error.data || {}
        )
      }
      throw error
    }
  }
}
