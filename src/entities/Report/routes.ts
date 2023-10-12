import AWS from "aws-sdk"
import { withAuth } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import routes from "decentraland-gatsby/dist/entities/Route/wkc/routes"
import env from "decentraland-gatsby/dist/utils/env"
import { retry } from "radash/dist/async"

import { extension } from "./util"

const ACCESS_KEY = env("AWS_ACCESS_KEY")
const ACCESS_SECRET = env("AWS_ACCESS_SECRET")
const BUCKET_HOSTNAME = env("BUCKET_HOSTNAME")
const BUCKET_NAME = env("AWS_BUCKET_NAME", "")

const s3 = new AWS.S3({
  accessKeyId: ACCESS_KEY,
  secretAccessKey: ACCESS_SECRET,
})

export default routes((router) => {
  router.post("/report", getSignedUrl)
})

export async function getSignedUrl(
  ctx: Context<{}, "request" | "params">
): Promise<ApiResponse<{ signed_url: string }>> {
  const initial = Date.now()
  const userAuth = await withAuth(ctx)
  const mimetype = "application/json"
  const ext = extension(mimetype)

  const timeHash = Math.floor(initial / 1000)
    .toString(16)
    .toLowerCase()
  const userHash = userAuth.address.slice(-8).toLowerCase()
  const filename = userHash + timeHash + ext

  const signedUrlExpireSeconds = 60 * 1000

  const signedUrl = await retry({ times: 10, delay: 100 }, async () => {
    const responseUrl = s3.getSignedUrl("putObject", {
      Bucket: BUCKET_NAME,
      Key: `${filename}`,
      Expires: signedUrlExpireSeconds,
      ContentType: mimetype,
      ACL: "private",
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: {
        ...userAuth.metadata,
        address: userAuth.address,
      },
    })

    const url = new URL(responseUrl)
    if (url.searchParams.size === 0) {
      throw new Error("Invalid AWS response")
    }

    if (BUCKET_HOSTNAME) {
      url.hostname = BUCKET_HOSTNAME
    }

    return url.toString()
  })

  return new ApiResponse({
    signed_url: signedUrl,
  })
}
