export function getImageUrl(imageUrl?: string | null) {
  if (imageUrl && imageUrl.startsWith("/")) {
    return `/places${imageUrl}`
  }
  return imageUrl
}
