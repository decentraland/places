import { createHash } from "crypto"

import { SQL } from "decentraland-gatsby/dist/entities/Database/utils"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"

import UserLikesModel from "./model"

export const MIGRATION_OPERATION_HEADER = "x-dcl-operation-id"

export type MigrationLike = {
  operationId: string
  user: string
  entityId: string
  like: boolean | null
  userActivity: number
}

export type MigrationLikeResult = {
  likes: number
  dislikes: number
  user_like: boolean
  user_dislike: boolean
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Bind a retry identity to the authenticated actor and semantic command. */
export function migrationRequestHash(command: MigrationLike): string {
  return createHash("sha256")
    .update(
      JSON.stringify(["like", command.user, command.entityId, command.like])
    )
    .digest("hex")
}

/**
 * Execute the opt-in pilot command and durable receipt in one source transaction.
 * Authentication remains the HTTP handler's responsibility.
 * The installed source function enforces scope and rejects conflicting identity reuse.
 */
export async function executeMigrationLike(
  command: MigrationLike
): Promise<MigrationLikeResult> {
  try {
    if (
      !UUID.test(command.operationId) ||
      command.operationId === "00000000-0000-0000-0000-000000000000" ||
      !UUID.test(command.entityId) ||
      !/^0x[0-9a-f]{40}$/.test(command.user) ||
      (command.like !== null && typeof command.like !== "boolean") ||
      !Number.isInteger(command.userActivity) ||
      command.userActivity < -2147483648 ||
      command.userActivity > 2147483647
    ) {
      throw new ErrorResponse(400, "Invalid migration vote command")
    }
    const digest = migrationRequestHash(command)
    const rows = await UserLikesModel.namedQuery<{ result: unknown }>(
      "executeMigrationLike",
      SQL`SELECT migration_capture.execute_like(
        ${command.operationId}::uuid, ${digest}::text, ${command.user}::text,
        ${command.entityId}::uuid, ${command.like}::boolean,
        ${command.userActivity}::double precision) AS result`
    )
    const result = rows[0]?.result
    if (
      !record(result) ||
      typeof result.likes !== "number" ||
      !Number.isSafeInteger(result.likes) ||
      result.likes < 0 ||
      typeof result.dislikes !== "number" ||
      !Number.isSafeInteger(result.dislikes) ||
      result.dislikes < 0 ||
      typeof result.user_like !== "boolean" ||
      typeof result.user_dislike !== "boolean" ||
      result.user_like !== (command.like === true) ||
      result.user_dislike !== (command.like === false)
    ) {
      throw new ErrorResponse(503, "Migration receipt is unavailable")
    }
    return {
      likes: result.likes,
      dislikes: result.dislikes,
      user_like: result.user_like,
      user_dislike: result.user_dislike,
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
