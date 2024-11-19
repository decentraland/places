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

import PlaceModel from "../../Place/model"
import { PlaceListOrderBy } from "../../Place/types"
import { getHotScenes } from "../../RealmProvider/utils"
import { getSceneStats } from "../../SceneStats/utils"
import { getWorldsLiveData } from "../../World/utils"
import { DEFAULT_MAX_LIMIT, FindAllPlacesWithAggregatesOptions } from "../types"
import { allPlacesWithAggregates } from "../utils"
import { validateGetPlaceListQuery } from "./getAllPlacesList"

export const getAllPlacesMostActiveList = Router.memo(
  async (ctx: Context<{}, "url" | "request">) => {
    const query = await validateGetPlaceListQuery({
      offset: ctx.url.searchParams.get("offset"),
      limit: ctx.url.searchParams.get("limit"),
      only_favorites: ctx.url.searchParams.get("only_favorites"),
      only_featured: ctx.url.searchParams.get("only_featured"),
      only_highlighted: ctx.url.searchParams.get("only_highlighted"),
      positions: ctx.url.searchParams.getAll("positions"),
      names: ctx.url.searchParams.getAll("names"),
      order_by: PlaceListOrderBy.MOST_ACTIVE,
      order:
        oneOf(ctx.url.searchParams.get("order"), ["asc", "desc"]) || "desc",
      with_realms_detail: ctx.url.searchParams.get("with_realms_detail"),
      search: ctx.url.searchParams.get("search"),
      categories: ctx.url.searchParams.getAll("categories"),
    })

    const hotScenes = getHotScenes()

    const userAuth = await withAuthOptional(ctx)

    if (
      (bool(query.only_favorites) && !userAuth?.address) ||
      (numeric(query.offset) ?? 0) > hotScenes.length
    ) {
      return new ApiResponse([], { total: 0 })
    }

    const sceneStats = await getSceneStats()

    // TODO: Get Worlds stats
    // const worldsStats = await getWorldsStats()

    const worldsLiveData = getWorldsLiveData()

    const hotScenesParcels = hotScenes.map((scene) => scene.parcels)

    const hotScenesPositions = flat(hotScenesParcels).map((scene) =>
      scene.join(",")
    )

    const positions = new Set(query.positions)

    const hotWorldsNames = worldsLiveData?.perWorld
      ? worldsLiveData.perWorld.map((world) => world.worldName)
      : []

    const names = new Set(query.names)

    const options: FindAllPlacesWithAggregatesOptions = {
      user: userAuth?.address,
      offset: numeric(query.offset, { min: 0 }) ?? 0,
      limit:
        numeric(query.limit, { min: 0, max: DEFAULT_MAX_LIMIT }) ??
        DEFAULT_MAX_LIMIT,
      only_favorites: !!bool(query.only_favorites),
      only_highlighted: !!bool(query.only_highlighted),
      positions: query.positions.length
        ? hotScenesPositions.filter((position) => positions.has(position))
        : hotScenesPositions,
      names: query.names.length
        ? query.names.filter((name) => names.has(name))
        : hotWorldsNames,
      order_by: PlaceListOrderBy.MOST_ACTIVE,
      order: query.order,
      search: query.search,
      categories: query.categories,
    }

    const places = await PlaceModel.findAllPlacesWithAggregates(options)

    const hotScenePlaces = sort(
      allPlacesWithAggregates(places, hotScenes, sceneStats, worldsLiveData, {
        withRealmsDetail: !!bool(query.with_realms_detail),
      }),
      (place) => place.user_count || 0,
      !options.order || options.order === "desc"
    )

    const total = hotScenePlaces.length

    const from = numeric(options.offset || 0, { min: 0 }) ?? 0
    const to =
      numeric(from + (options.limit || DEFAULT_MAX_LIMIT), {
        min: 0,
        max: DEFAULT_MAX_LIMIT,
      }) ?? DEFAULT_MAX_LIMIT

    return new ApiResponse(hotScenePlaces.slice(from, to), {
      total,
    })
  }
)
