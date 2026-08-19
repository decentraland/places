/**
 * Command line parsing shared by the destructive world maintenance scripts.
 *
 * Both of them insert, update or disable places, so the parser fails on anything it does not
 * recognize rather than falling through to a live run: a mistyped flag is a typo, and a typo must not
 * be the difference between a preview and a production write.
 */

export type ScriptArgs = {
  /** True unless --apply was given. Writing requires saying so. */
  dryRun: boolean
  limit: number | null
  worldName: string | null
  connectionString: string | null
}

const KNOWN = [
  "--apply",
  "--dry-run",
  "--limit",
  "--world-name",
  "--connection-string",
]

export function parseScriptArgs(args: string[]): ScriptArgs {
  const unknown = args.filter(
    (arg) => arg.startsWith("--") && !KNOWN.includes(arg)
  )
  if (unknown.length > 0) {
    throw new Error(`Unrecognized option(s): ${unknown.join(", ")}`)
  }

  const apply = args.includes("--apply")
  if (apply && args.includes("--dry-run")) {
    throw new Error("--apply and --dry-run contradict each other")
  }

  const value = (flag: string): string | null => {
    const index = args.indexOf(flag)
    if (index === -1) return null
    const next = args[index + 1]
    // Without this, `--world-name --apply` silently filters for a world called "--apply" and
    // `--limit` with nothing after it becomes NaN, which reads as no limit at all.
    if (!next || next.startsWith("--")) {
      throw new Error(`${flag} requires a value`)
    }
    return next
  }

  // parseInt stops at the first character it cannot read, so "10abc" and "1e9" would both quietly
  // become a limit that is not what was typed. Only digits are a limit.
  const rawLimit = value("--limit")
  if (rawLimit !== null && !/^[0-9]+$/.test(rawLimit)) {
    throw new Error("--limit requires a positive whole number")
  }
  const limit = rawLimit === null ? null : Number.parseInt(rawLimit, 10)
  if (limit !== null && limit <= 0) {
    throw new Error("--limit requires a positive whole number")
  }

  return {
    dryRun: !apply,
    limit,
    worldName: value("--world-name"),
    connectionString: value("--connection-string"),
  }
}
