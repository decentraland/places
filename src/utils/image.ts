import env from "decentraland-gatsby/dist/utils/env"

export function getImageUrl(imageUrl?: string | null) {
  if (env("NEW_ROLLOUT") && imageUrl && imageUrl.startsWith("/")) {
    return `/places${imageUrl}`
  }
  return imageUrl
}
