import fetch from "node-fetch"

type EnvName = "zone" | "prod"

const ENVS: Record<EnvName, string> = {
  zone: "https://places.decentraland.zone",
  prod: "https://places.decentraland.org",
}

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
}

type Check = {
  name: string
  path: string
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  headers?: Record<string, string>
  expectedStatus: number | number[]
  expectJson?: boolean
  expectKeys?: string[]
  expectArrayMin?: number
  category: "public" | "auth-required" | "admin" | "data-team" | "social"
  optional?: boolean
}

const PLACE_ID_GENESIS = "55327350-7891-4ca2-9d8b-e9d9d05e9682"
const FAKE_UUID = "00000000-0000-0000-0000-000000000000"
const FAKE_WORLD = "00doesnotexist00.dcl.eth"

// Resolved at runtime by `discoverFixtures()`. Each env keeps its own pair
// because zone and prod hold different datasets — there's no guarantee any
// given place_id exists in both — so we let each env answer for its own
// fixture instead of forcing an intersection.
const FIXTURES: Record<EnvName, { place_id: string; world_id: string }> = {
  zone: { place_id: PLACE_ID_GENESIS, world_id: FAKE_WORLD },
  prod: { place_id: PLACE_ID_GENESIS, world_id: FAKE_WORLD },
}

const CHECKS: Check[] = [
  {
    name: "GET /api/status",
    path: "/api/status",
    expectedStatus: 200,
    expectJson: true,
    category: "public",
  },
  {
    name: "GET /metrics",
    path: "/metrics",
    expectedStatus: [200, 401, 403, 502, 522],
    expectJson: false,
    category: "public",
    optional: true,
  },
  {
    name: "GET /api/categories",
    path: "/api/categories",
    expectedStatus: 200,
    expectJson: true,
    expectKeys: ["data"],
    expectArrayMin: 1,
    category: "public",
  },
  {
    name: "GET /api/categories?target=places",
    path: "/api/categories?target=places",
    expectedStatus: 200,
    expectJson: true,
    expectKeys: ["data"],
    category: "public",
  },
  {
    name: "GET /api/categories?target=worlds",
    path: "/api/categories?target=worlds",
    expectedStatus: 200,
    expectJson: true,
    expectKeys: ["data"],
    category: "public",
  },
  {
    name: "GET /api/places",
    path: "/api/places?limit=5",
    expectedStatus: 200,
    expectJson: true,
    expectKeys: ["data", "total"],
    expectArrayMin: 1,
    category: "public",
  },
  {
    name: "GET /api/places (paginated)",
    path: "/api/places?limit=10&offset=10&order_by=created_at&order=desc",
    expectedStatus: 200,
    expectJson: true,
    expectKeys: ["data", "total"],
    category: "public",
  },
  {
    name: "GET /api/places (search)",
    path: "/api/places?search=plaza&limit=5",
    expectedStatus: 200,
    expectJson: true,
    expectKeys: ["data", "total"],
    category: "public",
  },
  {
    name: "GET /api/places (most_active)",
    path: "/api/places?order_by=most_active&limit=5",
    expectedStatus: 200,
    expectJson: true,
    expectKeys: ["data", "total"],
    category: "public",
  },
  {
    name: "GET /api/places/:id (sample)",
    path: `/api/places/{{place_id}}`,
    expectedStatus: 200,
    expectJson: true,
    expectKeys: ["data", "ok"],
    category: "public",
  },
  {
    name: "GET /api/places/:id (404)",
    path: `/api/places/${FAKE_UUID}`,
    expectedStatus: 404,
    expectJson: true,
    category: "public",
  },
  {
    name: "GET /api/places/:id/categories",
    path: `/api/places/{{place_id}}/categories`,
    expectedStatus: 200,
    expectJson: true,
    expectKeys: ["data", "ok"],
    category: "public",
  },
  {
    name: "POST /api/places (by ids)",
    path: "/api/places",
    method: "POST",
    body: ["{{place_id}}"],
    expectedStatus: [200, 201],
    expectJson: true,
    expectKeys: ["data", "ok", "total"],
    category: "public",
  },
  {
    name: "POST /api/places (validation: not array)",
    path: "/api/places",
    method: "POST",
    body: { foo: "bar" },
    expectedStatus: 400,
    expectJson: true,
    category: "public",
  },
  {
    name: "POST /api/places/status",
    path: "/api/places/status",
    method: "POST",
    body: ["{{place_id}}"],
    expectedStatus: [200, 201],
    expectJson: true,
    expectKeys: ["data", "ok", "total"],
    category: "public",
  },
  {
    name: "GET /api/worlds",
    path: "/api/worlds?limit=5",
    expectedStatus: 200,
    expectJson: true,
    expectKeys: ["data", "total"],
    category: "public",
  },
  {
    name: "GET /api/worlds (most_active)",
    path: "/api/worlds?order_by=most_active&limit=5",
    expectedStatus: 200,
    expectJson: true,
    expectKeys: ["data", "total"],
    category: "public",
  },
  {
    name: "GET /api/worlds/:id (sample)",
    path: `/api/worlds/{{world_id}}`,
    expectedStatus: 200,
    expectJson: true,
    expectKeys: ["data", "ok"],
    category: "public",
  },
  {
    name: "GET /api/worlds/:id (404)",
    path: `/api/worlds/${encodeURIComponent(FAKE_WORLD)}`,
    expectedStatus: 404,
    expectJson: true,
    category: "public",
  },
  {
    name: "GET /api/world_names",
    path: "/api/world_names",
    expectedStatus: 200,
    expectJson: true,
    expectKeys: ["data", "total"],
    category: "public",
  },
  {
    name: "GET /api/map",
    path: "/api/map?limit=10",
    expectedStatus: 200,
    expectJson: true,
    expectKeys: ["data", "total"],
    category: "public",
  },
  {
    name: "GET /api/map/places",
    path: "/api/map/places?limit=10",
    expectedStatus: 200,
    expectJson: true,
    expectKeys: ["data", "total"],
    category: "public",
  },
  {
    name: "GET /api/destinations",
    path: "/api/destinations?limit=5",
    expectedStatus: 200,
    expectJson: true,
    expectKeys: ["data", "total"],
    category: "public",
  },
  {
    name: "GET /api/destinations (only_worlds)",
    path: "/api/destinations?only_worlds=true&limit=5",
    expectedStatus: 200,
    expectJson: true,
    expectKeys: ["data", "total"],
    category: "public",
  },
  {
    name: "POST /api/destinations (by ids)",
    path: "/api/destinations",
    method: "POST",
    body: ["{{place_id}}", "{{world_id}}"],
    expectedStatus: [200, 201],
    expectJson: true,
    expectKeys: ["data", "ok", "total"],
    category: "public",
  },
  {
    name: "GET /places/place/?id (social HTML)",
    path: `/places/place/?id={{place_id}}`,
    expectedStatus: 200,
    expectJson: false,
    category: "social",
  },
  {
    name: "GET /places/place/?position (social HTML)",
    path: "/places/place/?position=-23,-96",
    expectedStatus: 200,
    expectJson: false,
    category: "social",
  },
  {
    name: "GET /places/world/?name (social HTML)",
    path: `/places/world/?name={{world_id}}`,
    expectedStatus: 200,
    expectJson: false,
    category: "social",
  },
  {
    name: "PATCH /places/:id/favorites (no auth)",
    path: `/api/places/{{place_id}}/favorites`,
    method: "PATCH",
    body: { favorites: true },
    expectedStatus: [400, 401],
    expectJson: true,
    category: "auth-required",
  },
  {
    name: "PATCH /places/:id/likes (no auth)",
    path: `/api/places/{{place_id}}/likes`,
    method: "PATCH",
    body: { like: true },
    expectedStatus: [400, 401],
    expectJson: true,
    category: "auth-required",
  },
  {
    name: "PATCH /worlds/:id/favorites (no auth)",
    path: `/api/worlds/{{world_id}}/favorites`,
    method: "PATCH",
    body: { favorites: true },
    expectedStatus: [400, 401],
    expectJson: true,
    category: "auth-required",
  },
  {
    name: "PATCH /worlds/:id/likes (no auth)",
    path: `/api/worlds/{{world_id}}/likes`,
    method: "PATCH",
    body: { like: true },
    expectedStatus: [400, 401],
    expectJson: true,
    category: "auth-required",
  },
  {
    name: "PUT /places/:id/rating (no auth)",
    path: `/api/places/{{place_id}}/rating`,
    method: "PUT",
    body: { content_rating: "E" },
    expectedStatus: [400, 401],
    expectJson: true,
    category: "admin",
  },
  {
    name: "PUT /places/:id/highlight (no auth)",
    path: `/api/places/{{place_id}}/highlight`,
    method: "PUT",
    body: { highlighted: true },
    expectedStatus: [400, 401],
    expectJson: true,
    category: "admin",
  },
  {
    name: "PUT /places/:id/featured (no token)",
    path: `/api/places/{{place_id}}/featured`,
    method: "PUT",
    expectedStatus: [400, 401],
    expectJson: true,
    category: "admin",
  },
  {
    name: "DELETE /places/:id/featured (no token)",
    path: `/api/places/{{place_id}}/featured`,
    method: "DELETE",
    expectedStatus: [400, 401],
    expectJson: true,
    category: "admin",
  },
  {
    name: "PUT /places/:id/ranking (no token)",
    path: `/api/places/{{place_id}}/ranking`,
    method: "PUT",
    body: { ranking: 1 },
    expectedStatus: [400, 401],
    expectJson: true,
    category: "data-team",
  },
  {
    name: "PUT /worlds/:id/featured (no token)",
    path: `/api/worlds/{{world_id}}/featured`,
    method: "PUT",
    expectedStatus: [400, 401],
    expectJson: true,
    category: "admin",
  },
  {
    name: "POST /api/report (no auth)",
    path: "/api/report",
    method: "POST",
    expectedStatus: [400, 401],
    expectJson: true,
    category: "auth-required",
  },
]

type Result = {
  status: number
  ok: boolean
  contentType: string
  ms: number
  body: unknown
  raw: string
  topKeys: string[]
  arrayLen?: number
  error?: string
}

type FixtureResponse = {
  data?: Array<{ id?: string }>
}

function fillPlaceholders(value: string, env: EnvName): string {
  return value
    .replace(/{{place_id}}/g, FIXTURES[env].place_id)
    .replace(/{{world_id}}/g, encodeURIComponent(FIXTURES[env].world_id))
}

function fillBody(body: unknown, env: EnvName): unknown {
  if (typeof body === "string") return fillPlaceholders(body, env)
  if (Array.isArray(body)) return body.map((v) => fillBody(v, env))
  if (body && typeof body === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      out[k] = fillBody(v, env)
    }
    return out
  }
  return body
}

// Cloudflare WAF / rate-limit responses come with this exact key. We use it
// to (a) retry once with the suggested backoff, (b) downgrade to "warn" so a
// transient edge block doesn't break the whole run.
function isCloudflareBlock(
  body: unknown
): body is { cloudflare_error?: unknown; retry_after?: number } {
  return (
    !!body &&
    typeof body === "object" &&
    "cloudflare_error" in (body as Record<string, unknown>)
  )
}

async function runOneOnce(env: EnvName, check: Check): Promise<Result> {
  const baseUrl = ENVS[env]
  const url = `${baseUrl}${fillPlaceholders(check.path, env)}`
  const started = Date.now()
  try {
    const res = await fetch(url, {
      method: check.method ?? "GET",
      headers: {
        accept: check.expectJson === false ? "text/html" : "application/json",
        ...(check.body ? { "content-type": "application/json" } : {}),
        ...check.headers,
      },
      body: check.body ? JSON.stringify(fillBody(check.body, env)) : undefined,
      timeout: 30_000,
    } as never)
    const ms = Date.now() - started
    const raw = await res.text()
    const contentType = res.headers.get("content-type") ?? ""
    let body: unknown = raw
    let topKeys: string[] = []
    let arrayLen: number | undefined
    if (contentType.includes("application/json")) {
      try {
        body = JSON.parse(raw)
        if (Array.isArray((body as { data?: unknown }).data)) {
          arrayLen = (body as { data: unknown[] }).data.length
        } else if (Array.isArray(body)) {
          arrayLen = (body as unknown[]).length
        }
        topKeys =
          body && typeof body === "object" && !Array.isArray(body)
            ? Object.keys(body as Record<string, unknown>).sort()
            : []
      } catch {
        // not JSON despite header
      }
    }
    return {
      status: res.status,
      ok: res.ok,
      contentType,
      ms,
      body,
      raw,
      topKeys,
      arrayLen,
    }
  } catch (error) {
    return {
      status: 0,
      ok: false,
      contentType: "",
      ms: Date.now() - started,
      body: null,
      raw: "",
      topKeys: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function runOne(env: EnvName, check: Check): Promise<Result> {
  let result = await runOneOnce(env, check)
  if (result.status === 429 && isCloudflareBlock(result.body)) {
    const wait = Math.min(
      ((result.body as { retry_after?: number }).retry_after ?? 1) * 1000,
      5000
    )
    await new Promise((r) => setTimeout(r, wait))
    result = await runOneOnce(env, check)
  }
  return result
}

function statusOk(actual: number, expected: number | number[]): boolean {
  return Array.isArray(expected)
    ? expected.includes(actual)
    : actual === expected
}

function color(text: string, c: keyof typeof COLORS): string {
  return `${COLORS[c]}${text}${COLORS.reset}`
}

function pad(text: string, width: number): string {
  if (text.length >= width) return text
  return text + " ".repeat(width - text.length)
}

function hasNonJsonContentType(contentType: string): boolean {
  return ["text/html", "application/xml", "text/xml", "text/plain"].some(
    (type) => contentType.includes(type)
  )
}

type Diff = {
  check: Check
  zone: Result
  prod: Result
  issues: string[]
  severity: "ok" | "warn" | "fail"
}

function compare(check: Check, zone: Result, prod: Result): Diff {
  const issues: string[] = []
  let severity: Diff["severity"] = "ok"
  // If the edge (Cloudflare WAF) blocked the request, the API itself never
  // got a chance to answer — that's environmental, not a real contract drift,
  // so we downgrade fails to warns instead of failing the run.
  const cloudflareBlocked =
    isCloudflareBlock(zone.body) || isCloudflareBlock(prod.body)
  const failSeverity: Diff["severity"] =
    check.optional || cloudflareBlocked ? "warn" : "fail"

  for (const [envName, res] of [
    ["zone", zone],
    ["prod", prod],
  ] as const) {
    if (res.error) {
      issues.push(`${envName}: network error: ${res.error}`)
      severity = failSeverity
      continue
    }
    if (!statusOk(res.status, check.expectedStatus)) {
      issues.push(
        `${envName}: status ${res.status} not in expected ${JSON.stringify(
          check.expectedStatus
        )}`
      )
      severity = failSeverity
    }
    if (check.expectJson && !res.contentType.includes("application/json")) {
      issues.push(
        `${envName}: expected JSON but got content-type "${res.contentType}"`
      )
      severity = severity === "fail" ? "fail" : "warn"
    }
    if (check.expectJson === false && !hasNonJsonContentType(res.contentType)) {
      issues.push(
        `${envName}: expected non-JSON content but got content-type "${res.contentType}"`
      )
      severity = severity === "fail" ? "fail" : "warn"
    }
    if (check.expectKeys && res.topKeys.length > 0) {
      for (const key of check.expectKeys) {
        if (!res.topKeys.includes(key)) {
          issues.push(
            `${envName}: missing top-level key "${key}" (got ${JSON.stringify(
              res.topKeys
            )})`
          )
          severity = failSeverity
        }
      }
    }
    if (
      check.expectArrayMin !== undefined &&
      res.arrayLen !== undefined &&
      res.arrayLen < check.expectArrayMin
    ) {
      issues.push(
        `${envName}: array length ${res.arrayLen} below minimum ${check.expectArrayMin}`
      )
      severity = severity === "fail" ? "fail" : "warn"
    }
  }

  if (zone.status !== prod.status && severity !== "fail") {
    issues.push(`status mismatch zone=${zone.status} vs prod=${prod.status}`)
    severity = "warn"
  }

  if (
    zone.topKeys.length > 0 &&
    prod.topKeys.length > 0 &&
    JSON.stringify(zone.topKeys) !== JSON.stringify(prod.topKeys)
  ) {
    issues.push(
      `top-level shape mismatch: zone=${JSON.stringify(
        zone.topKeys
      )} prod=${JSON.stringify(prod.topKeys)}`
    )
    severity = failSeverity
  }
  if (cloudflareBlocked) {
    issues.push(
      `cloudflare WAF blocked one env (status=${
        isCloudflareBlock(zone.body)
          ? `zone=${zone.status}`
          : `prod=${prod.status}`
      }) — re-run to recover`
    )
  }

  return { check, zone, prod, issues, severity }
}

function fmtRow(d: Diff): string {
  const sevIcon =
    d.severity === "ok"
      ? color("✓", "green")
      : d.severity === "warn"
      ? color("!", "yellow")
      : color("✗", "red")
  const zoneStatus = d.zone.error
    ? color("ERR", "red")
    : color(String(d.zone.status), d.zone.ok ? "green" : "yellow")
  const prodStatus = d.prod.error
    ? color("ERR", "red")
    : color(String(d.prod.status), d.prod.ok ? "green" : "yellow")
  const zoneLen = d.zone.arrayLen !== undefined ? `[${d.zone.arrayLen}]` : ""
  const prodLen = d.prod.arrayLen !== undefined ? `[${d.prod.arrayLen}]` : ""
  return `${sevIcon} ${pad(d.check.name, 50)}  zone:${zoneStatus}${zoneLen} ${
    d.zone.ms
  }ms  prod:${prodStatus}${prodLen} ${d.prod.ms}ms`
}

async function discoverFixturesFor(env: EnvName) {
  const [places, worlds] = await Promise.all([
    fetch(`${ENVS[env]}/api/places?limit=10&order_by=like_score_best`)
      .then((r) => r.json() as Promise<FixtureResponse>)
      .catch(() => ({ data: [] })),
    fetch(`${ENVS[env]}/api/worlds?limit=10&order_by=like_score_best`)
      .then((r) => r.json() as Promise<FixtureResponse>)
      .catch(() => ({ data: [] })),
  ])
  const firstPlace = (places.data ?? [])[0]
  const firstWorld = (worlds.data ?? [])[0]
  if (firstPlace?.id) FIXTURES[env].place_id = firstPlace.id
  if (firstWorld?.id) FIXTURES[env].world_id = firstWorld.id
}

async function discoverFixtures() {
  await Promise.all([discoverFixturesFor("zone"), discoverFixturesFor("prod")])
  console.log(
    color(
      `Resolved fixtures:\n  zone: place_id=${FIXTURES.zone.place_id} world_id=${FIXTURES.zone.world_id}\n  prod: place_id=${FIXTURES.prod.place_id} world_id=${FIXTURES.prod.world_id}`,
      "gray"
    )
  )
}

function usesFixture(
  check: Check,
  placeholder: "{{place_id}}" | "{{world_id}}"
) {
  return (
    check.path.includes(placeholder) ||
    JSON.stringify(check.body ?? "").includes(placeholder)
  )
}

function filterResolvedFixtureChecks(checks: Check[]): Check[] {
  const placeResolved =
    FIXTURES.zone.place_id !== PLACE_ID_GENESIS ||
    FIXTURES.prod.place_id !== PLACE_ID_GENESIS
  const worldResolved =
    FIXTURES.zone.world_id !== FAKE_WORLD &&
    FIXTURES.prod.world_id !== FAKE_WORLD

  return checks.filter((check) => {
    if (!placeResolved && usesFixture(check, "{{place_id}}")) return false
    if (!worldResolved && usesFixture(check, "{{world_id}}")) return false
    return true
  })
}

async function main() {
  const filter =
    process.argv[2] && !process.argv[2].startsWith("--")
      ? process.argv[2]
      : undefined
  const verbose = process.argv.includes("--verbose")

  const matchingChecks = filter
    ? CHECKS.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))
    : CHECKS

  await discoverFixtures()
  const checks = filterResolvedFixtureChecks(matchingChecks)

  console.log(
    color(
      `\nRunning ${checks.length} smoke checks against ${ENVS.zone} and ${ENVS.prod}`,
      "bold"
    )
  )
  console.log("")

  const results: Diff[] = []
  for (const check of checks) {
    const [zone, prod] = await Promise.all([
      runOne("zone", check),
      runOne("prod", check),
    ])
    const diff = compare(check, zone, prod)
    results.push(diff)
    console.log(fmtRow(diff))
    if (verbose || diff.severity !== "ok") {
      for (const issue of diff.issues) {
        console.log(
          `    ${color(issue, diff.severity === "fail" ? "red" : "yellow")}`
        )
      }
    }
  }

  const okCount = results.filter((r) => r.severity === "ok").length
  const warnCount = results.filter((r) => r.severity === "warn").length
  const failCount = results.filter((r) => r.severity === "fail").length

  console.log(
    `\n${color("Summary:", "bold")} ${color(`${okCount} ok`, "green")}, ${color(
      `${warnCount} warn`,
      "yellow"
    )}, ${color(`${failCount} fail`, "red")}`
  )

  if (failCount > 0) {
    console.log(color("\nFailing checks:", "red"))
    for (const r of results.filter((x) => x.severity === "fail")) {
      console.log(`  ${color("✗", "red")} ${r.check.name}`)
      for (const issue of r.issues) {
        console.log(`      ${color(issue, "red")}`)
      }
    }
  }

  process.exit(failCount > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(color(`Fatal: ${error}`, "red"))
  process.exit(2)
})
