import { API_CORS_ORIGINS } from "./cors"

function isAllowed(origin: string): boolean {
  return API_CORS_ORIGINS.some((candidate) => candidate.test(origin))
}

describe("API CORS origins", () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe.each([
    "https://decentraland.org.attacker.example",
    "https://foo.decentraland.org.attacker.example",
    "https://trusted.pages.dev.attacker.example",
    "https://trusted.pages.dev",
  ])("when the origin is %s", (origin) => {
    it("should reject the origin", () => {
      expect(isAllowed(origin)).toBe(false)
    })
  })

  describe.each([
    "https://decentraland.org",
    "https://events.decentraland.org",
    "https://dcl-preview.vercel.app",
    "https://places-decentraland1.vercel.app",
  ])("when the origin is %s", (origin) => {
    it("should allow the origin", () => {
      expect(isAllowed(origin)).toBe(true)
    })
  })
})
