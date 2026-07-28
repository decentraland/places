import { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import Land from "decentraland-gatsby/dist/utils/api/Land"
import env from "decentraland-gatsby/dist/utils/env"

import {
  AggregatePlaceAttributes,
  HotScene,
  PlaceAttributes,
  unwantedThumbnailHash,
} from "./types"
import { SceneStats, SceneStatsMap } from "../../api/DataTeam"
import toCanonicalPosition from "../../utils/position/toCanonicalPosition"
import { AnyEntityAttributes } from "../shared/entityTypes"

const DECENTRALAND_URL =
  process.env.GATSBY_DECENTRALAND_URL ||
  process.env.DECENTRALAND_URL ||
  "https://play.decentraland.org"

const CONTENT_SERVER_URL = env("PROFILE_URL", "https://peer.decentraland.org")

export function placeUrl(place: PlaceAttributes) {
  const target = new URL(
    env("PLACES_BASE_URL", "https://decentraland.org/places")
  )
  target.searchParams.set("position", toCanonicalPosition(place.base_position)!)
  target.pathname = "/places/place/"
  return target
}

export function worldUrl(entity: AnyEntityAttributes) {
  const target = new URL(
    env("PLACES_BASE_URL", "https://decentraland.org/places")
  )
  target.searchParams.set("name", entity.world_name!)
  target.pathname = `/places/world/`
  return target
}

function whatsOnUrl(param: "position" | "world", value: string) {
  const target = new URL(
    env("PLACES_BASE_URL", "https://decentraland.org/places")
  )
  target.pathname = "/whats-on"
  target.searchParams.set(param, value)
  return target
}

export function whatsOnPlaceUrl(place: PlaceAttributes) {
  return whatsOnUrl("position", toCanonicalPosition(place.base_position)!)
}

export function whatsOnWorldUrl(entity: AnyEntityAttributes) {
  return whatsOnUrl("world", entity.world_name!)
}

export function siteUrl(pathname = "") {
  const target = new URL(
    env("PLACES_BASE_URL", "https://decentraland.org/places")
  )
  target.pathname = pathname ? `/places/${pathname}/` : "/places/"
  return target
}

/** @deprecated */
export function explorerUrl(
  place?: Pick<PlaceAttributes, "base_position" | "world_name">,
  realm?: string
) {
  return place?.world_name
    ? explorerWorldUrl(place)
    : explorerPlaceUrl(place, realm)
}

/** @private */
function explorerPlaceUrl(
  place?: Pick<PlaceAttributes, "base_position">,
  realm?: string
): string {
  const target = new URL("/", DECENTRALAND_URL)
  if (place?.base_position) {
    target.searchParams.set("position", place.base_position)
  }
  if (realm) {
    target.searchParams.set("realm", realm)
  }

  return target.toString()
}

/** @private */
function explorerWorldUrl(place: Pick<PlaceAttributes, "world_name">): string {
  const target = new URL("/", DECENTRALAND_URL)

  if (place) {
    target.searchParams.set("realm", place.world_name!)
  }

  return target.toString()
}

/**
 * Validates that a user-supplied image/thumbnail value is a safe absolute http(s)
 * URL and returns it normalized, or `null` when it is not parseable as such.
 *
 * Scene `navmapThumbnail` and world `thumbnailUrl` values are attacker-controlled and
 * were previously stored verbatim into `Place.image` / `World.image`. A value such as
 * `https://a"><meta http-equiv="refresh" ...>` would then be injected unescaped into
 * the social/OpenGraph HTML (and returned raw in API responses), enabling stored XSS /
 * open redirect. Parsing through `URL` rejects non-URL payloads and percent-encodes any
 * HTML-breakout characters, so the stored value can never carry a raw `"`, `<` or `>`.
 */
export function sanitizeImageUrl(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

/** @deprecated */
export function getThumbnailFromDeployment(deployment: ContentEntityScene) {
  const positions = (deployment?.pointers || []).sort()
  let thumbnail = deployment?.metadata?.display?.navmapThumbnail || null
  if (thumbnail && !thumbnail.startsWith("https://")) {
    const content = deployment.content.find(
      (content) => content.file === thumbnail
    )
    if (!content || unwantedThumbnailHash.includes(content.hash)) {
      thumbnail = null
    } else {
      thumbnail = `${CONTENT_SERVER_URL}/content/contents/${content.hash}`
    }
  } else if (thumbnail) {
    // A verbatim `https://` navmapThumbnail is attacker-controlled and stored as-is.
    // Keep it only if it is a safe http(s) URL so it cannot inject markup downstream.
    thumbnail = sanitizeImageUrl(thumbnail)
  }

  if (!thumbnail) {
    thumbnail = Land.getInstance().getMapImage({
      selected: positions,
    })
  }
  return thumbnail
}

export function getThumbnailFromContentDeployment(
  deployment: ContentEntityScene,
  options: { url?: string } = {}
) {
  const positions = (deployment?.pointers || []).sort()
  let thumbnail = deployment?.metadata?.display?.navmapThumbnail || null
  if (thumbnail && !thumbnail.startsWith("https://")) {
    const content = deployment.content.find(
      (content) => content.file === thumbnail
    )
    const contentServerUrl = (
      options.url || `${CONTENT_SERVER_URL}/content`
    ).replace(/\/+$/, "")

    if (!content || unwantedThumbnailHash.includes(content.hash)) {
      thumbnail = null
    } else {
      thumbnail = `${contentServerUrl}/contents/${content.hash}`
    }
  } else if (thumbnail) {
    // A verbatim `https://` navmapThumbnail is attacker-controlled and stored as-is.
    // Keep it only if it is a safe http(s) URL so it cannot inject markup downstream.
    thumbnail = sanitizeImageUrl(thumbnail)
  }

  if (!thumbnail && deployment?.metadata?.worldConfiguration) {
    thumbnail =
      "https://peer.decentraland.org/content/contents/bafkreidj26s7aenyxfthfdibnqonzqm5ptc4iamml744gmcyuokewkr76y"
  } else if (!thumbnail) {
    thumbnail = Land.getInstance().getMapImage({
      selected: positions,
    })
  }
  return thumbnail
}

export function placesWithUserVisits(
  places: AggregatePlaceAttributes[],
  sceneStats: SceneStatsMap = {}
) {
  return places.map((place) => {
    let stats: SceneStats | undefined = sceneStats[place.base_position]
    if (!stats) {
      const statsPosition = (place.positions || []).find(
        (position) => sceneStats[position]
      )
      if (statsPosition) {
        stats = sceneStats[statsPosition]
      }
    }

    return {
      ...place,
      user_visits: stats?.last_30d?.users || 0,
    }
  })
}

export function placesWithUserCount(
  places: AggregatePlaceAttributes[],
  hotScenes: HotScene[] = [],
  options?: {
    withRealmsDetail: boolean
  }
) {
  return places.map((place) => {
    const hotScenePlaces = hotScenes.find((scene) =>
      scene.parcels
        .map((parsel) => parsel.join(","))
        .includes(place.base_position)
    )

    const placeWithAggregates = {
      ...place,
      user_count: hotScenePlaces ? hotScenePlaces.usersTotalCount : 0,
    }

    if (options?.withRealmsDetail) {
      placeWithAggregates.realms_detail = hotScenePlaces?.realms || []
    }

    return placeWithAggregates
  })
}

/** @deprecated */
export function placesWithLastUpdate(
  places: AggregatePlaceAttributes[],
  entityScene: (ContentEntityScene | null)[]
) {
  return places.map((place) => {
    const entityScenePlaces = entityScene.find(
      (scene) =>
        scene && scene.metadata.scene!.base.includes(place.base_position)
    )

    return {
      ...place,
      last_deployed_at: entityScenePlaces
        ? new Date(entityScenePlaces.timestamp)
        : undefined,
    }
  })
}

// Matches an HTML-/TMP-style markup tag: `<` followed by an optional
// closing slash and a tag name that begins with a letter, up to the next
// `>` (`<link="…">`, `</link>`, `<b>`, `<color=#fff>`). A bare `<` in
// prose ("5 < 10") is left untouched because it isn't immediately
// followed by a letter or slash.
// The body is `[^>]*` (not `[^<>]*`) so a malformed opener that embeds a
// nested tag — `<link="javascript:…"<b>` — is captured as one span up to
// the first `>` and rejected whole, rather than being left as an unmatched
// `<link…` fragment that a later strip could re-assemble into a live unsafe
// link (fail-closed).
const MARKUP_TAG_REGEX = /<\/?[a-zA-Z][^>]*>/g

// A TMP `<link=…>` / `<link="…">` opening tag and its matching `</link>`
// closing tag. The opening pattern matches the quoted (group 1) and unquoted
// (group 2) forms as separate alternatives, so a *mismatched* quote
// (`<link="x>` / `<link=x">`) matches neither and falls through to the strip
// branch — only a clean single-value link tag is ever preserved (fail-safe).
const LINK_OPEN_TAG_REGEX = /^<link\s*=\s*(?:"([^"<>]*)"|([^"<>]*))\s*>$/i
const LINK_CLOSE_TAG_REGEX = /^<\/link\s*>$/i

// A `<`/`</` that begins a `link` tag with NO closing `>` before the next `<` or end of
// string — an unclosed opener the tag strip leaves untouched (a real TMP link needs its `>`).
// Its `<` is dropped so it can never be read as a link; a kept safe link / closer keeps its
// `>` and fails the negative lookahead, so it is left intact.
const UNCLOSED_LINK_LT_REGEX = /<(?=\/?link\b)(?![^<>]*>)/gi

// Hosts a link must never point at: loopback, private, link-local (incl.
// the `169.254.169.254` cloud-metadata endpoint), carrier-grade NAT, and
// internal/`localhost` names. `hostname` is already lowercased and
// WHATWG-normalized by `new URL`, so obfuscated IPv4 forms (decimal, hex,
// octal, short) arrive here as canonical dotted quads and can't slip past.
// Reserved / internal-use DNS suffixes that never belong to a public host.
const INTERNAL_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".intranet",
  ".lan",
  ".home",
  ".corp",
  ".home.arpa",
]

function isInternalLinkHost(hostname: string): boolean {
  const unbracketed =
    hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname
  // A trailing dot is the fully-qualified form of the same host (`localhost.`,
  // `router.local.`) and resolves identically, so normalize it away before the
  // single-label / suffix checks — otherwise `localhost.` reads as a dotted,
  // non-reserved name and slips through.
  const host = unbracketed.replace(/\.+$/, "")

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (ipv4) {
    const a = Number(ipv4[1])
    const b = Number(ipv4[2])
    return (
      a === 0 || // "this host"
      a === 127 || // loopback
      a === 10 || // private
      (a === 169 && b === 254) || // link-local incl. cloud metadata
      (a === 172 && b >= 16 && b <= 31) || // private
      (a === 192 && b === 168) || // private
      (a === 100 && b >= 64 && b <= 127) // carrier-grade NAT
    )
  }

  if (host.includes(":")) {
    return (
      host === "::1" || // loopback
      host === "::" || // unspecified
      /^fe[89ab]/.test(host) || // link-local fe80::/10
      /^f[cd]/.test(host) || // unique-local fc00::/7
      host.startsWith("::ffff:") // IPv4-mapped
    )
  }

  // DNS name. A public host is a dotted FQDN under a real TLD, so a
  // single-label name (`router`, `nas`, `localhost`) or a reserved
  // internal-use suffix is treated as internal. DNS is not resolved here —
  // this is a best-effort fail-closed for local-looking names, not proof the
  // host is public.
  if (!host.includes(".")) {
    return true
  }
  return INTERNAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

// Only http(s) links to a public host are safe to hand to the client, which
// renders descriptions as TextMeshPro rich text and passes a clicked
// `<link>` target straight to an unrestricted `Application.OpenURL`. A
// non-web scheme (`file://`, `smb://`, `decentraland://`, `javascript:`,
// `data:`, …) fires a local handler on the viewer's machine, and an http(s)
// URL aimed at an internal/loopback/metadata host points the viewer's
// browser at their own network — so both are stripped.
function isSafeLinkTarget(target: string): boolean {
  const trimmed = target.trim()
  // A real URL never carries raw whitespace, so an inner space means the
  // tag had extra junk after the target (e.g. `<link=https://a onclick=x>`);
  // treat it as ambiguous and strip it.
  if (/\s/.test(trimmed)) {
    return false
  }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return false
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return false
  }

  return !isInternalLinkHost(url.hostname.toLowerCase())
}

// Upper bound on sanitization passes (see sanitizePlaceDescription). Real content stabilizes
// in one pass; a reassembly attack needs two. Beyond this we fail closed instead of looping.
const MAX_SANITIZE_PASSES = 5

// One left-to-right strip pass over `text`. A stack records whether the `<link>` currently
// being closed was kept, to decide its `</link>`.
function stripMarkupOnce(text: string): string {
  const openLinkKept: boolean[] = []
  return text.replace(MARKUP_TAG_REGEX, (tag) => {
    if (LINK_CLOSE_TAG_REGEX.test(tag)) {
      // Drop orphan closers; otherwise mirror the matching opener.
      return openLinkKept.length > 0 && openLinkKept.pop() ? tag : ""
    }

    const openMatch = tag.match(LINK_OPEN_TAG_REGEX)
    if (openMatch) {
      const keep = isSafeLinkTarget(openMatch[1] ?? openMatch[2])
      openLinkKept.push(keep)
      return keep ? tag : ""
    }

    return ""
  })
}

// One sanitization pass: strip complete markup tags, then drop the `<` of any unclosed `<link`
// left behind so removed markup can never leave a dangling link opener.
function stripPass(text: string): string {
  return stripMarkupOnce(text).replace(UNCLOSED_LINK_LT_REGEX, "")
}

/**
 * Neutralize unsafe markup in a creator-authored description while
 * preserving safe hyperlinks.
 *
 * The Unity client renders place descriptions with TextMeshPro rich text
 * (no HTML, no Markdown) and turns `<link="target">text</link>` into a
 * clickable link that reaches an unrestricted `Application.OpenURL(target)`
 * — so a `decentraland://` / `smb://` / `file://` target fires a local
 * handler on the viewer's machine. `<link>` tags pointing at http(s) URLs
 * — the legitimate use case — are kept; links to any other scheme and
 * every other markup tag are stripped (dropping both sides of a stripped
 * link so no orphan `</link>` is left behind). Unlike html-escaping this
 * leaves clean text, since TMP does not decode entities like `&lt;`.
 * Returns null for empty input to match the column's `string | null` shape.
 *
 * Stripping a tag can fuse residual text into a NEW tag the single pass never
 * revisits (e.g. `<<b>link="javascript:…">` → strip `<b>` → live `<link…>`),
 * so we re-run `stripPass` to a fixed point. Each changing pass strictly
 * shortens the string, so it converges — at the stable point the only complete
 * tags left are safe links that were kept, and any unclosed `<link` has had its
 * `<` dropped by `stripPass`. If a pathological input has not stabilized within
 * MAX_SANITIZE_PASSES we fail closed by removing every angle bracket, so no
 * markup can survive.
 */
export function sanitizePlaceDescription(
  description: string | null | undefined
): string | null {
  if (!description) {
    return null
  }

  let current = description
  for (let pass = 0; pass < MAX_SANITIZE_PASSES; pass++) {
    const next = stripPass(current)
    if (next === current) {
      return current
    }
    current = next
  }
  return current.replace(/[<>]/g, "")
}
