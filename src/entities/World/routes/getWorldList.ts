import { withAuthOptional } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"
import {
  bool,
  numeric,
  oneOf,
} from "decentraland-gatsby/dist/entities/Schema/utils"

import { getWorldsLiveData } from "../../../modules/worldsLiveData"
import PlaceModel from "../../Place/model"
import { getWorldListQuerySchema } from "../schemas"
import {
  FindWorldWithAggregatesOptions,
  GetWorldListQuery,
  WorldListOrderBy,
} from "../types"
import { worldsWithUserCount } from "../utils"

export const validateGetWorldListQuery = Router.validator<GetWorldListQuery>(
  getWorldListQuerySchema
)

export const getWorldList = Router.memo(
  async (ctx: Context<{}, "url" | "request">) => {
    const query = await validateGetWorldListQuery({
      names: ctx.url.searchParams.getAll("names"),
      offset: ctx.url.searchParams.get("offset"),
      limit: ctx.url.searchParams.get("limit"),
      only_favorites: ctx.url.searchParams.get("only_favorites"),
      order_by:
        oneOf(ctx.url.searchParams.get("order_by"), [
          WorldListOrderBy.MOST_ACTIVE,
          WorldListOrderBy.LIKE_SCORE_BEST,
          WorldListOrderBy.CREATED_AT,
        ]) || WorldListOrderBy.MOST_ACTIVE,
      search: ctx.url.searchParams.get("search"),
      order:
        oneOf(ctx.url.searchParams.get("order"), ["asc", "desc"]) || "desc",
      categories: ctx.url.searchParams.getAll("categories"),
    })

    const userAuth = await withAuthOptional(ctx)

    if (bool(query.only_favorites) && !userAuth?.address) {
      return new ApiResponse([], { total: 0 })
    }

    const options: FindWorldWithAggregatesOptions = {
      user: userAuth?.address,
      offset: numeric(query.offset, { min: 0 }) ?? 0,
      limit: numeric(query.limit, { min: 0, max: 100 }) ?? 100,
      only_favorites: !!bool(query.only_favorites),
      names: query.names,
      order_by: query.order_by,
      order: query.order,
      search: query.search,
      categories: query.categories,
    }

    const [data, total, liveData] = await Promise.all([
      PlaceModel.findWorld(options),
      PlaceModel.countWorlds(options),
      getWorldsLiveData(),
    ])

    return new ApiResponse(worldsWithUserCount(data, liveData.perWorld), {
      total,
    })
  }
)
