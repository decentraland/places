import { withAuthOptional } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"
import {
  bool,
  numeric,
  oneOf,
} from "decentraland-gatsby/dist/entities/Schema/utils"
import { flat, sort } from "radash"

import { getHotScenes } from "../../RealmProvider/utils"
import { getSceneStats } from "../../SceneStats/utils"
import PlaceModel from "../model"
import { FindWithAggregatesOptions, PlaceListOrderBy } from "../types"
import { placesWithUserCount, placesWithUserVisits } from "../utils"
import { validateGetPlaceListQuery } from "./getPlaceList"

export const getPlaceMostActiveList = Router.memo(
  async (ctx: Context<{}, "url" | "request">) => {
    const query = await validateGetPlaceListQuery({
      positions: ctx.url.searchParams.getAll("positions"),
      offset: ctx.url.searchParams.get("offset"),
      limit: ctx.url.searchParams.get("limit"),
      only_favorites: ctx.url.searchParams.get("only_favorites"),
      only_featured: ctx.url.searchParams.get("only_featured"),
      only_highlighted: ctx.url.searchParams.get("only_highlighted"),
      order_by: PlaceListOrderBy.MOST_ACTIVE,
      order:
        oneOf(ctx.url.searchParams.get("order"), ["asc", "desc"]) || "desc",
      with_realms_detail: ctx.url.searchParams.get("with_realms_detail"),
      search: ctx.url.searchParams.get("search"),
      categories: ctx.url.searchParams.getAll("categories"),
    })

    const sceneStats = await getSceneStats()

    const hotScenes = getHotScenes()

    const hotScenesParcels = hotScenes.map((scene) => scene.parcels)

    const hotScenesPositions = flat(hotScenesParcels).map((scene) =>
      scene.join(",")
    )

    const userAuth = await withAuthOptional(ctx)

    if (
      (bool(query.only_favorites) && !userAuth?.address) ||
      (numeric(query.offset) ?? 0) > hotScenes.length
    ) {
      return new ApiResponse([], { total: 0 })
    }

    const options: FindWithAggregatesOptions = {
      user: userAuth?.address,
      offset: numeric(query.offset, { min: 0 }) ?? 0,
      limit: numeric(query.limit, { min: 0, max: 100 }) ?? 100,
      only_favorites: !!bool(query.only_favorites),
      only_highlighted: !!bool(query.only_highlighted),
      positions: query.positions,
      hotScenesPositions: hotScenesPositions,
      order_by: PlaceListOrderBy.UPDATED_AT,
      order: query.order,
      search: query.search,
      categories: query.categories,
    }

    const { offset, limit, order, ...extraOptions } = options
    const places = await PlaceModel.findWithAggregates({
      offset: 0,
      limit: 100,
      order,
      ...extraOptions,
    })

    const hotScenePlaces = sort(
      placesWithUserVisits(
        placesWithUserCount(places, hotScenes, {
          withRealmsDetail: !!query.with_realms_detail,
        }),
        sceneStats
      ),

      (place) => place.user_count || 0,
      !order || order === "desc"
    )

    const total = hotScenePlaces.length

    const from = numeric(offset || 0, { min: 0 }) ?? 0
    const to = numeric(from + (limit || 100), { min: 0, max: 100 }) ?? 100

    return new ApiResponse(hotScenePlaces.slice(from, to), { total })
  }
)
