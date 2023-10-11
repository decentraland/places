import { resolve } from "path"

import { replaceHelmetMetadata } from "decentraland-gatsby/dist/entities/Gatsby/utils"
import { handleRaw } from "decentraland-gatsby/dist/entities/Route/handle"
import routes from "decentraland-gatsby/dist/entities/Route/routes"
import { readOnce } from "decentraland-gatsby/dist/entities/Route/routes/file"
import { Request, Response } from "express"
import { escape } from "html-escaper"
import isUUID from "validator/lib/isUUID"

import copies from "../../intl/en.json"
import toCanonicalPosition from "../../utils/position/toCanonicalPosition"
import PlaceModel from "../Place/model"
import { AggregatePlaceAttributes, PlaceListOrderBy } from "../Place/types"
import { placeUrl, siteUrl } from "../Place/utils"

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

export async function injectPlaceMetadata(req: Request, res: Response) {
  const position = String(req.query.position || "")
  const id = String(req.query.id || "")
  const page = await readFile(req)
  const canonicalPosition = toCanonicalPosition(position, ",")

  let place: AggregatePlaceAttributes | null = null
  if (id && isUUID(id)) {
    place = await PlaceModel.findByIdWithAggregates(id, {
      user: undefined,
    })
  } else if (canonicalPosition) {
    place = (
      await PlaceModel.findWithAggregates({
        positions: [canonicalPosition],
        offset: 0,
        limit: 1,
        only_favorites: false,
        only_highlighted: false,
        order_by: PlaceListOrderBy.LIKE_SCORE_BEST,
        order: "asc",
        search: "",
        categories: [],
      })
    )[0]
  }

  if (place) {
    const url = placeUrl(place)
    res.set("link", `<${url.toString()}>; rel=canonical`)

    return replaceHelmetMetadata(page.toString(), {
      ...(copies.social.place as any),
      title: escape(place.title || "") + " | Decentraland Place",
      description: escape((place.description || "").trim()),
      image: place.image || "",
      url: placeUrl(place),
      "twitter:card": "summary_large_image",
    })
  }

  const url = siteUrl().toString() + req.originalUrl.slice(1)
  return replaceHelmetMetadata(page.toString(), {
    ...(copies.social.place as any),
    url,
  })
}
