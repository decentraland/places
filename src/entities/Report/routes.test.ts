import { REPORT_MAX_FILE_SIZE, createReportPostPolicy } from "./routes"

describe("report upload policy", () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe("when a policy is created for an authenticated wallet", () => {
    let address: string
    let filename: string
    let policy: ReturnType<typeof createReportPostPolicy>

    beforeEach(() => {
      address = "0x1234567890123456789012345678901234567890"
      filename = "550e8400-e29b-41d4-a716-446655440000.json"
      policy = createReportPostPolicy(address, filename)
    })

    it("should expire after sixty seconds", () => {
      expect(policy.Expires).toBe(60)
    })

    it("should enforce the report size limit", () => {
      expect(policy.Conditions).toContainEqual([
        "content-length-range",
        1,
        REPORT_MAX_FILE_SIZE,
      ])
    })

    it("should require private object access", () => {
      expect(policy.Fields).toMatchObject({ acl: "private" })
    })

    it("should bind the policy to the authenticated wallet", () => {
      expect(policy.Fields).toMatchObject({
        "x-amz-meta-address": address,
      })
    })
  })
})
