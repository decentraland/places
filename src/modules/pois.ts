import Time from "decentraland-gatsby/dist/utils/date/Time"
import env from "decentraland-gatsby/dist/utils/env"
import { memo } from "radash"

const DCL_LIST_URL = env(
  `GATSBY_DCL_LIST_URL`,
  `https://dcl-lists.decentraland.org`
)

export class PoiFeedError extends Error {
  constructor() {
    super("POI feed is unavailable or invalid; retain existing memberships")
    this.name = "PoiFeedError"
  }
}

/** A failed feed is not an authoritative empty list. */
export async function fetchPois(): Promise<string[]> {
  try {
    const response = await fetch(`${DCL_LIST_URL}/pois`, {
      method: "POST",
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw new PoiFeedError()
    const body: unknown = await response.json()
    if (
      typeof body !== "object" ||
      body === null ||
      !("data" in body) ||
      !Array.isArray(body.data) ||
      body.data.length > 100000 ||
      !body.data.every(
        (value: unknown) =>
          typeof value === "string" &&
          value.length <= 32 &&
          /^-?\d+,-?\d+$/.test(value)
      )
    ) {
      throw new PoiFeedError()
    }
    return body.data
  } catch {
    throw new PoiFeedError()
  }
}

export const getPois = memo(fetchPois, { ttl: Time.Hour })
