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
const SIGNED_POST_EXPIRES_SECONDS = 60

const s3 = new AWS.S3({
  accessKeyId: ACCESS_KEY,
  secretAccessKey: ACCESS_SECRET,
})

export function createReportPostPolicy(
  address: string,
  filename: string
): AWS.S3.PresignedPost.Params {
  const mimetype = "application/json"
  return {
    Bucket: BUCKET_NAME,
    Expires: SIGNED_POST_EXPIRES_SECONDS,
    Fields: {
      key: filename,
      "Content-Type": mimetype,
      acl: "private",
      "Cache-Control": "no-store",
      "x-amz-meta-address": address,
    },
    Conditions: [
      ["content-length-range", 1, REPORT_MAX_FILE_SIZE],
      { "Content-Type": mimetype },
      { acl: "private" },
      { "Cache-Control": "no-store" },
      { "x-amz-meta-address": address },
    ],
  }
}

export default routes((router) => {
  router.post("/report", getSignedUrl)
})

export async function getSignedUrl(
  ctx: Context<{}, "request" | "params">
): Promise<
  ApiResponse<{
    signed_url: string
    fields: Record<string, string>
    max_file_size: number
  }>
> {
  const userAuth = await withAuth(ctx)
  const ext = extension("application/json")
  const filename = `${randomUUID()}${ext}`

  const signedUrl = await retry({ times: 10, delay: 100 }, async () => {
    const presignedPost = s3.createPresignedPost(
      createReportPostPolicy(userAuth.address, filename)
    )

    const url = new URL(presignedPost.url)
    if (!presignedPost.fields.Policy) {
      throw new Error("Invalid AWS response")
    }

    if (BUCKET_HOSTNAME) {
      url.hostname = BUCKET_HOSTNAME
    }

    return {
      url: url.toString(),
      fields: presignedPost.fields,
    }
  })

  return new ApiResponse({
    signed_url: signedUrl.url,
    fields: signedUrl.fields,
    max_file_size: REPORT_MAX_FILE_SIZE,
  })
}
