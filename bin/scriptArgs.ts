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
  /**
   * Every flag that was given, for the extras a caller declared. A script asks about its own flags
   * through this; flags it did not declare are refused by the parser, so accepting one and ignoring it
   * is not a state a script can reach.
   */
  flags: Set<string>
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

const TAKES_VALUE = ["--limit", "--world-name", "--connection-string"]

/**
 * @param extraFlags value-less flags this particular script understands. Kept per script rather than
 *   in KNOWN so a flag only one of them acts on cannot be silently accepted by the other.
 */
export function parseScriptArgs(
  args: string[],
  extraFlags: string[] = []
): ScriptArgs {
  const known = [...KNOWN, ...extraFlags]
  const flags = new Set<string>()
  const values = new Map<string, string>()

  // One pass, so every token is either a flag, a value consumed by the flag before it, or an error.
  // Scanning for flags independently leaves a stray token unaccounted for, and `--apply myworld.dcl.eth`
  // reads as a world-scoped run while actually running against every world.
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]

    if (!arg.startsWith("--")) {
      throw new Error(
        `Unexpected argument: ${arg}. Options take their value after the flag, as --world-name ${arg}`
      )
    }
    if (!known.includes(arg)) {
      throw new Error(`Unrecognized option: ${arg}`)
    }
    if (flags.has(arg)) {
      throw new Error(`${arg} was given more than once`)
    }
    flags.add(arg)

    if (!TAKES_VALUE.includes(arg)) continue

    const value = args[index + 1]
    // Without this, `--world-name --apply` silently filters for a world called "--apply" and
    // `--limit` with nothing after it becomes NaN, which reads as no limit at all.
    if (!value || value.startsWith("--")) {
      throw new Error(`${arg} requires a value`)
    }
    values.set(arg, value)
    index++
  }

  const apply = flags.has("--apply")
  if (apply && flags.has("--dry-run")) {
    throw new Error("--apply and --dry-run contradict each other")
  }

  // parseInt stops at the first character it cannot read, so "10abc" and "1e9" would both quietly
  // become a limit that is not what was typed. Only digits are a limit.
  const rawLimit = values.get("--limit") ?? null
  if (rawLimit !== null && !/^[0-9]+$/.test(rawLimit)) {
    throw new Error("--limit requires a positive whole number")
  }
  const limit = rawLimit === null ? null : Number.parseInt(rawLimit, 10)
  if (limit !== null && limit <= 0) {
    throw new Error("--limit requires a positive whole number")
  }

  return {
    dryRun: !apply,
    flags,
    limit,
    worldName: values.get("--world-name") ?? null,
    connectionString: values.get("--connection-string") ?? null,
  }
}

/**
 * Validate the configured content server base URL.
 *
 * `new URL()` alone is not enough: it accepts "https://http://host" happily, reading the host as
 * "http" and the rest as a path, which is what a doubled scheme in the environment produces. That got
 * as far as a DNS lookup for a host called "http", once per world, reported only as "fetch failed" --
 * so the check is here, before any world is touched, and it names what is wrong.
 */
export function parseContentServerUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "")

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error(
      `WORLDS_CONTENT_SERVER_URL '${trimmed}' is not a URL. It needs a scheme and a host, as https://worlds-content-server.decentraland.org`
    )
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(
      `WORLDS_CONTENT_SERVER_URL '${trimmed}' has scheme '${url.protocol}'; only http and https are content servers`
    )
  }

  // A hostname with no dot that is not localhost is the signature of a second scheme inside the value:
  // "https://http://host" parses with hostname "http".
  if (
    !url.hostname ||
    (url.hostname !== "localhost" && !url.hostname.includes("."))
  ) {
    throw new Error(
      `WORLDS_CONTENT_SERVER_URL '${trimmed}' resolves to host '${url.hostname}', which is not a hostname. Check for a repeated scheme, as in https://http://example.org`
    )
  }

  return trimmed
}
