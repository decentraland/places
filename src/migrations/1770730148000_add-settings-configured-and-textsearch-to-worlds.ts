import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

// This migration was already applied. The file was accidentally deleted in a
// revert commit. Re-added as a no-op so node-pg-migrate ordering is satisfied.
export async function up(_pgm: MigrationBuilder): Promise<void> {}
export async function down(_pgm: MigrationBuilder): Promise<void> {}
