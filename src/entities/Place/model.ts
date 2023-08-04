import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import {
  SQL,
  columns,
  conditional,
  createSearchableMatches,
  join,
  limit,
  objectValues,
  offset,
  setColumns,
  table,
  tsquery,
  values,
} from "decentraland-gatsby/dist/entities/Database/utils"
import { numeric, oneOf } from "decentraland-gatsby/dist/entities/Schema/utils"
import { HotScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import { diff, unique } from "radash/dist/array"
import isEthereumAddress from "validator/lib/isEthereumAddress"

import PlacePositionModel from "../PlacePosition/model"
import UserFavoriteModel from "../UserFavorite/model"
import UserLikesModel from "../UserLikes/model"
import {
  FindWorldWithAggregatesOptions,
  WorldListOrderBy,
} from "../World/types"
import {
  AggregatePlaceAttributes,
  FindWithAggregatesOptions,
  PlaceAttributes,
  PlaceListOrderBy,
} from "./types"

export const MIN_USER_ACTIVITY = 100
export const SUMMARY_ACTIVITY_RANGE = "7 days"
export const SIGNIFICANT_DECIMALS = 4

export default class PlaceModel extends Model<PlaceAttributes> {
  static tableName = "places"

  static textsearch(place: PlaceAttributes) {
    return SQL`(${join(
      [
        SQL`setweight(to_tsvector(coalesce(${place.title}, '')), 'A')`,
        SQL`setweight(to_tsvector(coalesce(${place.world_name}, '')), 'A')`,
        SQL`setweight(to_tsvector(coalesce(${place.description}, '')), 'B')`,
        SQL`setweight(to_tsvector(${createSearchableMatches(
          place.description || ""
        )}), 'B')`,
        SQL`setweight(to_tsvector(coalesce(${place.owner}, '')), 'C')`,
        SQL`setweight(to_tsvector(concat(coalesce(${place.tags}, '{}'))), 'D')`,
      ],
      SQL` || `
    )})`
  }

  static async findEnabledByPositions(
    positions: string[]
  ): Promise<PlaceAttributes[]> {
    if (positions.length === 0) {
      return []
    }

    const sql = SQL`
      SELECT * FROM ${table(this)}
      WHERE "disabled" is false
        AND "world" is false
        AND "base_position" IN (
          SELECT DISTINCT("base_position")
          FROM ${table(PlacePositionModel)} "pp"
          WHERE "pp"."position" IN ${values(positions)}
        )
    `

    return this.namedQuery("find_enabled_by_positions", sql)
  }

  static async findEnabledWorldName(
    world_name: string
  ): Promise<PlaceAttributes[]> {
    const sql = SQL`
      SELECT * FROM ${table(this)}
      WHERE
        "disabled" is false
        AND "world" is true
        AND "world_name" = ${world_name}
    `

    return this.namedQuery("find_enabled_by_world_name", sql)
  }

  static async findByIdWithAggregates(
    placeId: string,
    options: {
      user: string | undefined
    }
  ): Promise<AggregatePlaceAttributes> {
    const sql = SQL`
      SELECT p.*
      ${conditional(
        !!options.user,
        SQL`, uf."user" is not null as user_favorite`
      )}
      ${conditional(!options.user, SQL`, false as user_favorite`)}
      ${conditional(
        !!options.user,
        SQL`, coalesce(ul."like",false) as "user_like"`
      )}
      ${conditional(!options.user, SQL`, false as "user_like"`)}
      ${conditional(
        !!options.user,
        SQL`, not coalesce(ul."like",true) as "user_dislike"`
      )}
      ${conditional(!options.user, SQL`, false as "user_dislike"`)}
      FROM ${table(this)} p
      ${conditional(
        !!options.user,
        SQL`LEFT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.place_id AND uf."user" = ${options.user}`
      )}
      ${conditional(
        !!options.user,
        SQL`LEFT JOIN ${table(
          UserLikesModel
        )} ul on p.id = ul.place_id AND ul."user" = ${options.user}`
      )}
      WHERE "p"."id" = ${placeId}
    `

    const queryResult = await this.namedQuery("find_by_id_with_agregates", sql)
    return queryResult[0]
  }

  static async findWithAggregates(
    options: FindWithAggregatesOptions
  ): Promise<AggregatePlaceAttributes[]> {
    const searchIsEmpty = options.search && options.search.length < 3
    if (searchIsEmpty) {
      return []
    }

    const orderBy = PlaceListOrderBy.HIGHEST_RATED
    const orderDirection = oneOf(options.order, ["asc", "desc"]) ?? "desc"

    const order = SQL.raw(
      `p.${orderBy} ${orderDirection.toUpperCase()}, p."deployed_at" desc`
    )

    const sql = SQL`
      SELECT p.*
      ${conditional(
        !!options.user,
        SQL`, uf."user" is not null as user_favorite`
      )}
      ${conditional(!options.user, SQL`, false as user_favorite`)}
      ${conditional(
        !!options.user,
        SQL`, coalesce(ul."like",false) as "user_like"`
      )}
      ${conditional(!options.user, SQL`, false as "user_like"`)}
      ${conditional(
        !!options.user,
        SQL`, not coalesce(ul."like",true) as "user_dislike"`
      )}
      ${conditional(!options.user, SQL`, false as "user_dislike"`)}
      FROM ${table(this)} p
      
      ${conditional(
        !!options.user && !options.only_favorites,
        SQL`LEFT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.place_id AND uf."user" = ${options.user}`
      )}
      ${conditional(
        !!options.user && options.only_favorites,
        SQL`RIGHT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.place_id AND uf."user" = ${options.user}`
      )}
      ${conditional(
        !!options.user,
        SQL`LEFT JOIN ${table(
          UserLikesModel
        )} ul on p.id = ul.place_id AND ul."user" = ${options.user}`
      )}
      ${conditional(
        !!options.search,
        SQL`, ts_rank_cd(p.textsearch, to_tsquery(${tsquery(
          options.search || ""
        )})) as rank`
      )}
      WHERE
        p."disabled" is false AND "world" is false
        ${conditional(!!options.search, SQL`AND rank > 0`)}
        ${conditional(options.only_featured, SQL`AND featured = TRUE`)}
        ${conditional(options.only_highlighted, SQL`AND highlighted = TRUE`)}
        ${conditional(
          options.positions?.length > 0,
          SQL`AND p.base_position IN (
              SELECT DISTINCT(base_position)
              FROM ${table(PlacePositionModel)}
              WHERE position IN ${values(options.positions)}
            )`
        )}
        ${conditional(
          (options.not_in || []).length > 0,
          SQL`AND p.base_position IN (
              SELECT DISTINCT(base_position)
              FROM ${table(PlacePositionModel)}
              WHERE position NOT IN ${values(options.not_in || [])}
            )`
        )}
      ORDER BY 
      ${conditional(!!options.search, SQL`rank DESC, `)}
      ${order}
      ${limit(options.limit, { max: 100 })}
      ${offset(options.offset)}
    `

    const queryResult = await this.namedQuery("find_with_agregates", sql)
    return queryResult
  }

  static async countPlaces(
    options: Pick<
      FindWithAggregatesOptions,
      | "user"
      | "only_favorites"
      | "positions"
      | "only_featured"
      | "only_highlighted"
      | "search"
    >
  ) {
    const isMissingEthereumAddress =
      options.user && !isEthereumAddress(options.user)
    const searchIsEmpty = options.search && options.search.length < 3
    if (isMissingEthereumAddress || searchIsEmpty) {
      return 0
    }

    const query = SQL`
      SELECT
        count(*) as "total"
      FROM ${table(this)} p
      ${conditional(
        !!options.user && options.only_favorites,
        SQL`RIGHT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.place_id AND uf."user" = ${options.user}`
      )}
      ${conditional(
        !!options.search,
        SQL`, ts_rank_cd(p.textsearch, to_tsquery(${tsquery(
          options.search || ""
        )})) as rank`
      )}
      WHERE
        p."disabled" is false
        AND "world" is false
        ${conditional(options.only_featured, SQL`AND featured = TRUE`)}
        ${conditional(options.only_highlighted, SQL`AND highlighted = TRUE`)}
        ${conditional(
          options.positions?.length > 0,
          SQL`AND p.base_position IN (
              SELECT DISTINCT(base_position)
              FROM ${table(PlacePositionModel)}
              WHERE position IN ${values(options.positions)}
            )`
        )}
        ${conditional(!!options.search, SQL` AND rank > 0`)}
    `
    const results: { total: number }[] = await this.namedQuery(
      "count_places",
      query
    )

    return results[0].total
  }

  static async disablePlaces(placesIds: string[]) {
    const now = new Date()
    return this.updateTo(
      { disabled: true, disabled_at: now },
      { id: placesIds }
    )
  }

  static async updateFavorites(placeId: string) {
    const sql = SQL`
    WITH counted AS (
      SELECT count(*) AS count
      FROM ${table(UserFavoriteModel)}
      WHERE "place_id" = ${placeId}
    )
    UPDATE ${table(this)}
      SET "favorites" = c.count
      FROM counted c
      WHERE "id" = ${placeId}
    `
    return this.namedQuery("update_favorites", sql)
  }

  static async updateLikes(placeId: string) {
    const sql = SQL`
    WITH counted AS (
      SELECT
        count(*) filter (where "like") as count_likes,
        count(*) filter (where not "like") as count_dislikes,
        count(*) filter (where "user_activity" >= ${MIN_USER_ACTIVITY}) as count_active_total,
        count(*) filter (where "like" and "user_activity" >= ${MIN_USER_ACTIVITY}) as count_active_likes
      FROM ${table(UserLikesModel)}
      WHERE "place_id" = ${placeId}
    )
    UPDATE ${table(this)}
      SET
        "likes" = c.count_likes,
        "dislikes" = c.count_dislikes,
        "like_rate" = (CASE WHEN c.count_active_total::float = 0 THEN 0
                            ELSE c.count_active_likes / c.count_active_total::float
                       END)
      FROM counted c
      WHERE "id" = ${placeId}
    `
    return this.namedQuery("update_likes", sql)
  }

  static async findWithHotScenes(
    options: FindWithAggregatesOptions,
    hotScenes: HotScene[]
  ): Promise<AggregatePlaceAttributes[]> {
    const { offset, limit, order, ...extraOptions } = options
    const places = await this.findWithAggregates({
      offset: 0,
      limit: 100,
      order,
      ...extraOptions,
    })

    const hotScenePlaces = hotScenes
      .filter(
        (scene) =>
          !!places.find(
            (place) => place.base_position == scene.baseCoords.join(",")
          )
      )
      .map((scene) => {
        const hotScenePlaces = places.find(
          (place) => place.base_position == scene.baseCoords.join(",")
        )
        return {
          ...hotScenePlaces!,
          user_count: scene.usersTotalCount,
        }
      })
    if (order === "asc") {
      hotScenePlaces.reverse()
    }

    const from = numeric(offset || 0, { min: 0 })
    const to = numeric(from + (limit || 100), { min: 0, max: 100 })

    return hotScenePlaces.slice(from, to)
  }

  static async insertPlace(
    place: Partial<PlaceAttributes>,
    attributes: Array<keyof PlaceAttributes>
  ) {
    const keys = unique([...attributes, "id"])
    const sql = SQL`INSERT INTO ${table(this)} ${columns(keys)}
              VALUES ${objectValues(keys, [place])}`
    return this.namedQuery("insert_place", sql)
  }

  static updatePlace = (
    place: Partial<PlaceAttributes>,
    attributes: Array<keyof PlaceAttributes>
  ) => {
    const keys = unique(diff(attributes, ["id", "created_at"])) as Array<
      keyof PlaceAttributes
    >
    const sql = SQL`UPDATE ${table(this)} SET ${setColumns(
      keys,
      place
    )} WHERE disabled is false
    ${conditional(
      !place.world,
      SQL`AND world is false AND "base_position" IN (
        SELECT DISTINCT("base_position")
        FROM ${table(PlacePositionModel)} "pp"
        WHERE "pp"."position" = ${place.base_position}
      )`
    )}
    ${conditional(
      !!place.world,
      SQL` AND world is true AND ${place.world_name} = "world_name"`
    )}`

    return this.namedQuery("update_place", sql)
  }

  static async findWorlds(): Promise<PlaceAttributes[]> {
    const sql = SQL`
      SELECT * FROM ${table(this)}
      WHERE "world" is true and disabled is false
      ORDER BY updated_at ASC LIMIT 500
    `

    return this.namedQuery("find_worlds", sql)
  }

  static updateIndexWorlds = (
    worlds: {
      dclName: string
      shouldBeIndexed: boolean
    }[]
  ) => {
    if (!worlds || worlds.length === 0) {
      return 0
    }

    const names = worlds.map((world) => world.dclName)
    const namesVisible = worlds
      .filter((world) => world.shouldBeIndexed)
      .map((world) => world.dclName)

    const sql = SQL`
      UPDATE ${table(this)} SET hidden = (world_name not in ${values(
      namesVisible
    )}), updated_at = now()
      WHERE world is true
        AND world_name IN ${values(names)}
    `
    return this.namedRowCount("update_index_world", sql)
  }

  static async findWorld(
    options: FindWorldWithAggregatesOptions
  ): Promise<AggregatePlaceAttributes[]> {
    const searchIsEmpty = options.search && options.search.length < 3

    if (searchIsEmpty) {
      return []
    }

    const orderBy = WorldListOrderBy.HIGHEST_RATED
    const orderDirection = oneOf(options.order, ["asc", "desc"]) ?? "desc"

    const order = SQL.raw(`p.${orderBy} ${orderDirection.toUpperCase()}`)

    const sql = SQL`
      SELECT p.*
      ${conditional(
        !!options.user,
        SQL`, uf.user is not null as user_favorite`
      )}
      ${conditional(!options.user, SQL`, false as user_favorite`)}
      ${conditional(
        !!options.user,
        SQL`, coalesce(ul.like,false) as user_like`
      )}
      ${conditional(!options.user, SQL`, false as user_like`)}
      ${conditional(
        !!options.user,
        SQL`, not coalesce(ul.like,true) as user_dislike`
      )}
      ${conditional(!options.user, SQL`, false as user_dislike`)}
      FROM ${table(this)} p
      ${conditional(
        !!options.user && !options.only_favorites,
        SQL`LEFT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.place_id AND uf.user = ${options.user}`
      )}
      ${conditional(
        !!options.user && options.only_favorites,
        SQL`RIGHT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.place_id AND uf.user = ${options.user}`
      )}
      ${conditional(
        !!options.user,
        SQL`LEFT JOIN ${table(
          UserLikesModel
        )} ul on p.id = ul.place_id AND ul.user = ${options.user}`
      )}
      ${conditional(
        !!options.search,
        SQL`, ts_rank_cd(p.textsearch, to_tsquery(${tsquery(
          options.search || ""
        )})) as rank`
      )}
      WHERE
        p.disabled is false AND world is true AND hidden is false
        ${conditional(
          options.names.length > 0,
          SQL`AND world_name IN ${values(options.names)}`
        )}
        ${conditional(!!options.search, SQL` AND rank > 0`)}
      ORDER BY 
      ${conditional(!!options.search, SQL`rank DESC, `)}
      ${order}
      ${limit(options.limit, { max: 100 })}
      ${offset(options.offset)}      
    `

    return await this.namedQuery("find_worlds", sql)
  }

  static async countWorlds(
    options: Pick<
      FindWorldWithAggregatesOptions,
      "user" | "only_favorites" | "names" | "search"
    >
  ) {
    const isMissingEthereumAddress =
      options.user && !isEthereumAddress(options.user)
    const searchIsEmpty = options.search && options.search.length < 3
    if (isMissingEthereumAddress || searchIsEmpty) {
      return 0
    }

    const query = SQL`
      SELECT
        count(*) as total
      FROM ${table(this)} p
      ${conditional(
        !!options.user && options.only_favorites,
        SQL`RIGHT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.place_id AND uf.user = ${options.user}`
      )}
      ${conditional(
        !!options.search,
        SQL`, ts_rank_cd(p.textsearch, to_tsquery(${tsquery(
          options.search || ""
        )})) as rank`
      )}
      WHERE
        p.disabled is false
        AND p.world is true
        AND p.hidden is false
        ${conditional(
          options.names.length > 0,
          SQL`AND p.world_name IN ${values(options.names)}`
        )}
        ${conditional(!!options.search, SQL` AND rank > 0`)}
    `
    const results: { total: number }[] = await this.namedQuery(
      "count_worlds",
      query
    )

    return results[0].total
  }
}
