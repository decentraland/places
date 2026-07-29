import { randomUUID } from "crypto"

import AWS from "aws-sdk"
import { withAuth } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import routes from "decentraland-gatsby/dist/entities/Route/wkc/routes"
import env from "decentraland-gatsby/dist/utils/env"
import { retry } from "radash"

import { extension } from "./util"

const ACCESS_KEY = env("AWS_ACCESS_KEY")
const ACCESS_SECRET = env("AWS_ACCESS_SECRET")
const BUCKET_HOSTNAME = env("BUCKET_HOSTNAME")
const BUCKET_NAME = env("AWS_BUCKET_NAME", "")
export const REPORT_MAX_FILE_SIZE = 1024 * 1024
const SIGNED_UPLOAD_EXPIRES_SECONDS = 60

const s3 = new AWS.S3({
  accessKeyId: ACCESS_KEY,
  secretAccessKey: ACCESS_SECRET,
})

export type ReportUploadResponse = {
  /**
   * @deprecated Temporary PUT compatibility URL for clients that have not
   * migrated to the constrained multipart POST upload.
   */
  signed_url: string
  upload: {
    method: "POST"
    url: string
    fields: Record<string, string>
    max_file_size: number
  }
}

export type LegacyReportPutParams = Omit<AWS.S3.PutObjectRequest, "Expires"> & {
  Expires: number
}

export function createReportPostPolicy(
  address: string,
  filename: string
): AWS.S3.PresignedPost.Params {
  const mimetype = "application/json"
  return {
    Bucket: BUCKET_NAME,
    Expires: SIGNED_UPLOAD_EXPIRES_SECONDS,
    Fields: {
      key: filename,
      "Content-Type": mimetype,
      acl: "private",
      "Cache-Control": "no-store",
      "x-amz-meta-address": address,
    },
    Conditions: [
      ["content-length-range", 1, REPORT_MAX_FILE_SIZE],
      { key: filename },
      { "Content-Type": mimetype },
      { acl: "private" },
      { "Cache-Control": "no-store" },
      { "x-amz-meta-address": address },
    ],
  }
}

export function createLegacyReportPutParams(
  address: string,
  filename: string
): LegacyReportPutParams {
  return {
    Bucket: BUCKET_NAME,
    Key: filename,
    Expires: SIGNED_UPLOAD_EXPIRES_SECONDS,
    ContentType: "application/json",
    ACL: "private",
    CacheControl: "no-store",
    Metadata: { address },
  }
}

export default routes((router) => {
  router.post("/report", getSignedUrl)
})

export async function getSignedUrl(
  ctx: Context<{}, "request" | "params">
): Promise<ApiResponse<ReportUploadResponse>> {
  const userAuth = await withAuth(ctx)
  const ext = extension("application/json")
  const filename = `${randomUUID()}${ext}`

  const signedUploads = await retry({ times: 10, delay: 100 }, async () => {
    const legacyPutUrl = new URL(
      s3.getSignedUrl(
        "putObject",
        createLegacyReportPutParams(userAuth.address, filename)
      )
    )
    const presignedPost = s3.createPresignedPost(
      createReportPostPolicy(userAuth.address, filename)
    )
    const postUrl = new URL(presignedPost.url)
    if (legacyPutUrl.searchParams.size === 0 || !presignedPost.fields.Policy) {
      throw new Error("Invalid AWS response")
    }

    if (BUCKET_HOSTNAME) {
      legacyPutUrl.hostname = BUCKET_HOSTNAME
      postUrl.hostname = BUCKET_HOSTNAME
    }

    return {
      legacyPutUrl: legacyPutUrl.toString(),
      postUrl: postUrl.toString(),
      postFields: presignedPost.fields,
    }
  })

  return new ApiResponse({
    signed_url: signedUploads.legacyPutUrl,
    upload: {
      method: "POST",
      url: signedUploads.postUrl,
      fields: signedUploads.postFields,
      max_file_size: REPORT_MAX_FILE_SIZE,
    },
  })
}
