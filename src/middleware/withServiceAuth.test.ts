import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"

const VALID_TOKEN = "test-service-token-12345"
const CUSTOM_TOKEN = "custom-service-token-67890"

let mockEnvTokens: Record<string, string> = {}

// Mock the env module
jest.mock("decentraland-gatsby/dist/utils/env", () => {
  return jest.fn((key: string, defaultValue?: string) => {
    return mockEnvTokens[key] ?? defaultValue
  })
})

import { validateServiceAuth, withServiceAuth } from "./withServiceAuth"

beforeEach(() => {
  mockEnvTokens = {
    DATA_TEAM_AUTH_TOKEN: VALID_TOKEN,
    CUSTOM_AUTH_TOKEN: CUSTOM_TOKEN,
  }
})

afterEach(() => {
  mockEnvTokens = {}
})

describe("validateServiceAuth", () => {
  test("should throw 500 when token env var is not configured", () => {
    mockEnvTokens = {}

    const request = new Request("/")
    request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)

    expect(() => validateServiceAuth({ request } as any)).toThrow(
      "Service authentication not configured"
    )
  })

  test("should throw 401 when authorization header is missing", () => {
    const request = new Request("/")

    expect(() => validateServiceAuth({ request } as any)).toThrow(
      "Authorization required"
    )
  })

  test("should throw 403 when token is invalid", () => {
    const request = new Request("/")
    request.headers.set("Authorization", "Bearer invalid-token")

    expect(() => validateServiceAuth({ request } as any)).toThrow(
      "Invalid authorization token"
    )
  })

  test("should not throw when token is valid with Bearer prefix", () => {
    const request = new Request("/")
    request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)

    expect(() => validateServiceAuth({ request } as any)).not.toThrow()
  })

  test("should not throw when token is valid without Bearer prefix", () => {
    const request = new Request("/")
    request.headers.set("Authorization", VALID_TOKEN)

    expect(() => validateServiceAuth({ request } as any)).not.toThrow()
  })

  test("should use custom env token key when provided", () => {
    const request = new Request("/")
    request.headers.set("Authorization", `Bearer ${CUSTOM_TOKEN}`)

    expect(() =>
      validateServiceAuth({ request } as any, {
        envTokenKey: "CUSTOM_AUTH_TOKEN",
      })
    ).not.toThrow()
  })

  test("should reject default token when using custom env key", () => {
    const request = new Request("/")
    request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)

    expect(() =>
      validateServiceAuth({ request } as any, {
        envTokenKey: "CUSTOM_AUTH_TOKEN",
      })
    ).toThrow("Invalid authorization token")
  })
})

describe("withServiceAuth", () => {
  test("should return a function that validates auth", () => {
    const middleware = withServiceAuth()
    expect(typeof middleware).toBe("function")
  })

  test("should validate auth when called", () => {
    const request = new Request("/")
    request.headers.set("Authorization", `Bearer ${VALID_TOKEN}`)

    const middleware = withServiceAuth()

    expect(() => middleware({ request } as any)).not.toThrow()
  })

  test("should throw when auth is invalid", () => {
    const request = new Request("/")
    request.headers.set("Authorization", "Bearer invalid")

    const middleware = withServiceAuth()

    expect(() => middleware({ request } as any)).toThrow(
      "Invalid authorization token"
    )
  })

  test("should accept custom options", () => {
    const request = new Request("/")
    request.headers.set("Authorization", `Bearer ${CUSTOM_TOKEN}`)

    const middleware = withServiceAuth({ envTokenKey: "CUSTOM_AUTH_TOKEN" })

    expect(() => middleware({ request } as any)).not.toThrow()
  })
})
