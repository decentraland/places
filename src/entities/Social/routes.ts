import { resolve } from "path"

import { replaceHelmetMetadata } from "decentraland-gatsby/dist/entities/Gatsby/utils"
import { handleRaw } from "decentraland-gatsby/dist/entities/Route/handle"
import routes from "decentraland-gatsby/dist/entities/Route/routes"
import { readOnce } from "decentraland-gatsby/dist/entities/Route/routes/file"
import { Request } from "express"
import { escape } from "html-escaper"
import isUUID from "validator/lib/isUUID"

import copies from "../../intl/en.json"
import PlaceModel from "../Place/model"
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
  const id = String(req.query.id || "")
  const page = await readFile(req)
  if (isUUID(id)) {
    const place = await PlaceModel.findByIdWithAggregates(id, {
      user: undefined,
    })

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
