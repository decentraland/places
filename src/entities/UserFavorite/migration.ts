import { createHash } from "crypto"

import { SQL } from "decentraland-gatsby/dist/entities/Database/utils"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"

import UserFavoriteModel from "./model"

export const MIGRATION_OPERATION_HEADER = "x-dcl-operation-id"

export type MigrationFavorite = {
  operationId: string
  user: string
  entityId: string
  favorite: boolean
  userActivity: number
}

export type MigrationFavoriteResult = {
  favorites: number
  user_favorite: boolean
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Bind a retry identity to the authenticated actor and semantic command. */
export function migrationRequestHash(command: MigrationFavorite): string {
  return createHash("sha256")
    .update(JSON.stringify([command.user, command.entityId, command.favorite]))
    .digest("hex")
}

/**
 * Execute the opt-in pilot command and durable receipt in one source transaction.
 * Authentication remains the HTTP handler's responsibility.
 * The installed source function enforces scope and rejects conflicting identity reuse.
 */
export async function executeMigrationFavorite(
  command: MigrationFavorite
): Promise<MigrationFavoriteResult> {
  try {
    if (
      !UUID.test(command.operationId) ||
      command.operationId === "00000000-0000-0000-0000-000000000000" ||
      !UUID.test(command.entityId) ||
      !/^0x[0-9a-f]{40}$/.test(command.user) ||
      typeof command.favorite !== "boolean" ||
      !Number.isInteger(command.userActivity) ||
      command.userActivity < -2147483648 ||
      command.userActivity > 2147483647
    ) {
      throw new ErrorResponse(400, "Invalid migration favorite command")
    }
    const digest = migrationRequestHash(command)
    const rows = await UserFavoriteModel.namedQuery<{ result: unknown }>(
      "executeMigrationFavorite",
      SQL`SELECT migration_capture.execute_favorite(
        ${command.operationId}::uuid, ${digest}::text, ${command.user}::text,
        ${command.entityId}::uuid, ${command.favorite}::boolean,
        ${command.userActivity}::double precision) AS result`
    )
    const result = rows[0]?.result
    if (
      !record(result) ||
      typeof result.favorites !== "number" ||
      !Number.isSafeInteger(result.favorites) ||
      result.favorites < 0 ||
      typeof result.user_favorite !== "boolean"
    ) {
      throw new ErrorResponse(503, "Migration receipt is unavailable")
    }
    return {
      favorites: result.favorites,
      user_favorite: result.user_favorite,
    }
  } catch (error) {
    if (error instanceof ErrorResponse) throw error
    if (record(error) && error.code === "P0001") {
      throw new ErrorResponse(
        409,
        "Migration operation conflicts with its scope or stored receipt"
      )
    }
    throw new ErrorResponse(
      503,
      "Migration command is unavailable; retry with the same operation ID"
    )
  }
}
