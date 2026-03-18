import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

/**
 * Worlds should never be disabled — only places can be disabled (when replaced
 * by newer deployments). The populate-worlds-from-places migration incorrectly
 * copied the disabled flag from places, causing some worlds to be hidden.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    UPDATE worlds
    SET disabled = false, disabled_at = null, updated_at = now()
    WHERE disabled = true
  `)
}

export async function down(): Promise<void> {
  // No-op: we cannot determine which worlds were originally disabled
}
