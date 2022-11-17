import { resolve } from "path"

import { replaceHelmetMetadata } from "decentraland-gatsby/dist/entities/Gatsby/utils"
import { handleRaw } from "decentraland-gatsby/dist/entities/Route/handle"
import routes from "decentraland-gatsby/dist/entities/Route/routes"
import { readOnce } from "decentraland-gatsby/dist/entities/Route/routes/file"
import { Request } from "express"
import { escape } from "html-escaper"

import copies from "../../intl/en.json"
import validPosition from "../../utils/position/validPosition"
import PlaceModel from "../Place/model"
import { PlaceListOrderBy } from "../Place/types"
import { placeTargetUrl, siteUrl } from "../Place/utils"

export default routes((router) => {
  router.get("/place/", handleRaw(injectPlaceMetadata, "html"))
})

async function readFile(req: Request) {
  const path = resolve(
    process.cwd(),
    "./public",
    "." + req.path,
    "./index.html"
  )
  return readOnce(path)
}

export async function injectPlaceMetadata(req: Request) {
  const position = String(req.query.position || "")
  const page = await readFile(req)
  const parsedPosition = validPosition(position)
  console.log(parsedPosition)
  if (parsedPosition) {
    const place = (
      await PlaceModel.findWithAggregates({
        positions: [parsedPosition.join(",")],
        offset: 0,
        limit: 1,
        only_favorites: false,
        only_featured: false,
        only_highlighted: false,
        order_by: PlaceListOrderBy.UPDATED_AT,
        order: "asc",
      })
    )[0]

    if (place) {
      return replaceHelmetMetadata(page.toString(), {
        ...(copies.social.place as any),
        title: escape(place.title || "") + " | Decentraland Place",
        description: escape((place.description || "").trim()),
        image: place.image || "",
        url: placeTargetUrl(place),
        "twitter:card": "summary_large_image",
      })
    }
  }

  const url = siteUrl().toString() + req.originalUrl.slice(1)
  return replaceHelmetMetadata(page.toString(), {
    ...(copies.social.place as any),
    url,
  })
}
