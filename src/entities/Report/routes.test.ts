import AWS from "aws-sdk"
import * as decentralandAuth from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"

import {
  REPORT_MAX_FILE_SIZE,
  createLegacyReportPutParams,
  createReportPostPolicy,
  getSignedUrl,
} from "./routes"

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

    it("should bind the policy to the generated object key", () => {
      expect(policy.Conditions).toContainEqual({ key: filename })
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

describe("legacy report upload compatibility", () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe("when PUT parameters are created for an authenticated wallet", () => {
    let address: string
    let filename: string
    let params: ReturnType<typeof createLegacyReportPutParams>

    beforeEach(() => {
      address = "0x1234567890123456789012345678901234567890"
      filename = "550e8400-e29b-41d4-a716-446655440000.json"
      params = createLegacyReportPutParams(address, filename)
    })

    it("should bind the signed PUT to the generated object key", () => {
      expect(params.Key).toBe(filename)
    })

    it("should expire after sixty seconds", () => {
      expect(params.Expires).toBe(60)
    })

    it("should prevent report caching", () => {
      expect(params.CacheControl).toBe("no-store")
    })
  })
})

describe("report upload response", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("when an authenticated client requests upload credentials", () => {
    let address: string
    let request: Request
    let response: Awaited<ReturnType<typeof getSignedUrl>>
    let legacyPutUrl: string
    let postUrl: string
    let postFields: AWS.S3.PresignedPost.Fields
    let putKey: string
    let postKey: string
    let getSignedUrlMock: jest.SpiedFunction<AWS.S3["getSignedUrl"]>
    let createPresignedPostMock: jest.SpiedFunction<
      AWS.S3["createPresignedPost"]
    >

    beforeEach(async () => {
      address = "0x1234567890123456789012345678901234567890"
      request = new Request("http://0.0.0.0/api/report", { method: "POST" })
      legacyPutUrl =
        "https://reports.s3.amazonaws.com/report.json?X-Amz-Signature=legacy"
      postUrl = "https://reports.s3.amazonaws.com"
      postFields = {
        key: "report.json",
        Policy: "signed-policy",
        "X-Amz-Signature": "post-signature",
      }

      jest.spyOn(decentralandAuth, "withAuth").mockResolvedValue({
        address,
        metadata: {},
      })
      getSignedUrlMock = jest
        .spyOn(AWS.S3.prototype, "getSignedUrl")
        .mockReturnValue(legacyPutUrl)
      createPresignedPostMock = jest
        .spyOn(AWS.S3.prototype, "createPresignedPost")
        .mockReturnValue({
          url: postUrl,
          fields: postFields,
        })

      response = await getSignedUrl({ request, params: {} })
      putKey = getSignedUrlMock.mock.calls[0][1].Key
      postKey = createPresignedPostMock.mock.calls[0][0].Fields?.key || ""
    })

    it("should keep signed_url compatible with legacy PUT clients", () => {
      expect(response.body.data.signed_url).toBe(legacyPutUrl)
    })

    it("should return a self-describing constrained POST upload", () => {
      expect(response.body.data.upload).toEqual({
        method: "POST",
        url: `${postUrl}/`,
        fields: postFields,
        max_file_size: REPORT_MAX_FILE_SIZE,
      })
    })

    it("should bind PUT and POST credentials to the same object key", () => {
      expect(putKey).toBe(postKey)
    })
  })
})
