import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import {
  SQL,
  conditional,
  limit,
  offset,
  table,
  tsquery,
} from "decentraland-gatsby/dist/entities/Database/utils"
import { oneOf } from "decentraland-gatsby/dist/entities/Schema/utils"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import isEthereumAddress from "validator/lib/isEthereumAddress"

import {
  AggregateWorldAttributes,
  FindWorldWithAggregatesOptions,
  WorldAttributes,
  WorldListOrderBy,
} from "./types"
import {
  buildTextsearch,
  buildUpdateFavoritesQuery,
  buildUpdateLikesQuery,
} from "../shared/entityInteractions"
import UserFavoriteModel from "../UserFavorite/model"
import UserLikesModel from "../UserLikes/model"

export default class WorldModel extends Model<WorldAttributes> {
  static tableName = "worlds"

  static textsearch(world: WorldAttributes) {
    return buildTextsearch(world)
  }

  static async findByWorldName(
    worldName: string
  ): Promise<WorldAttributes | null> {
    const sql = SQL`
      SELECT * FROM ${table(this)}
      WHERE id = ${worldName.toLowerCase()}
    `
    const results = await this.namedQuery<WorldAttributes>(
      "find_by_world_name",
      sql
    )
    return results[0] || null
  }

  static async findEnabledByWorldName(
    worldName: string
  ): Promise<WorldAttributes | null> {
    const sql = SQL`
      SELECT * FROM ${table(this)}
      WHERE id = ${worldName.toLowerCase()}
        AND disabled IS FALSE
        AND show_in_places IS TRUE
    `
    const results = await this.namedQuery<WorldAttributes>(
      "find_enabled_by_world_name",
      sql
    )
    return results[0] || null
  }

  static async findByIdWithAggregates(
    worldId: string,
    options: { user: string | undefined }
  ): Promise<AggregateWorldAttributes | null> {
    const sql = SQL`
      SELECT w.*
      , COALESCE(w.image, lp.image) as image
      , lp.contact_name
      , '0,0' as base_position
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
      , true as world
      , 0 as user_visits
      , lp.deployed_at
      FROM ${table(this)} w
      LEFT JOIN LATERAL (
        SELECT p.image, p.contact_name, p.deployed_at
        FROM places p
        WHERE p.world_id = w.id AND p.disabled IS FALSE
        ORDER BY p.deployed_at DESC
        LIMIT 1
      ) lp ON true
      ${conditional(
        !!options.user,
        SQL`LEFT JOIN ${table(
          UserFavoriteModel
        )} uf on w.id = uf.entity_id AND uf."user" = ${options.user}`
      )}
      ${conditional(
        !!options.user,
        SQL`LEFT JOIN ${table(
          UserLikesModel
        )} ul on w.id = ul.entity_id AND ul."user" = ${options.user}`
      )}
      WHERE w.id = ${worldId}
    `

    const results = await this.namedQuery<AggregateWorldAttributes>(
      "find_by_id_with_aggregates",
      sql
    )
    return results[0] || null
  }

  static async findWorldsWithAggregates(
    options: FindWorldWithAggregatesOptions
  ): Promise<AggregateWorldAttributes[]> {
    const searchIsEmpty = options.search && options.search.length < 3
    if (searchIsEmpty) {
      return []
    }

    const orderBy =
      oneOf(options.order_by, [
        WorldListOrderBy.LIKE_SCORE_BEST,
        WorldListOrderBy.CREATED_AT,
      ]) ?? WorldListOrderBy.LIKE_SCORE_BEST
    const orderDirection = oneOf(options.order, ["asc", "desc"]) ?? "desc"

    const order = SQL.raw(
      `w.${orderBy} ${orderDirection.toUpperCase()} NULLS LAST, w.updated_at DESC`
    )

    const sql = SQL`
      SELECT w.*
      , COALESCE(w.image, lp.image) as image
      , lp.contact_name
      , '0,0' as base_position
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
      , true as world
      , 0 as user_visits
      , lp.deployed_at
      FROM ${table(this)} w
      LEFT JOIN LATERAL (
        SELECT p.image, p.contact_name, p.deployed_at
        FROM places p
        WHERE p.world_id = w.id AND p.disabled IS FALSE
        ORDER BY p.deployed_at DESC
        LIMIT 1
      ) lp ON true
      ${conditional(
        !!options.user && !options.only_favorites,
        SQL`LEFT JOIN ${table(
          UserFavoriteModel
        )} uf on w.id = uf.entity_id AND uf."user" = ${options.user}`
      )}
      ${conditional(
        !!options.user && options.only_favorites,
        SQL`RIGHT JOIN ${table(
          UserFavoriteModel
        )} uf on w.id = uf.entity_id AND uf."user" = ${options.user}`
      )}
      ${conditional(
        !!options.user,
        SQL`LEFT JOIN ${table(
          UserLikesModel
        )} ul on w.id = ul.entity_id AND ul."user" = ${options.user}`
      )}
      ${conditional(
        !!options.search,
        SQL`, ts_rank_cd(
          (setweight(to_tsvector(coalesce(w.title, '')), 'A') || 
           setweight(to_tsvector(coalesce(w.world_name, '')), 'A') || 
           setweight(to_tsvector(coalesce(w.description, '')), 'B') ||
           setweight(to_tsvector(coalesce(w.owner, '')), 'C')),
          to_tsquery(${tsquery(options.search || "")})
        ) as rank`
      )}
      ${conditional(
        !!options.categories.length,
        SQL`WHERE w.categories && ${options.categories}::varchar[]`
      )}
      ${conditional(!options.categories.length, SQL`WHERE 1=1`)}
        ${conditional(!!options.disabled, SQL`AND w.disabled IS TRUE`)}
        ${conditional(!options.disabled, SQL`AND w.disabled IS FALSE`)}
        AND w.show_in_places IS TRUE
        ${conditional(
          options.names.length > 0,
          SQL`AND w.id = ANY(${options.names.map((name) =>
            name.toLowerCase()
          )})`
        )}
        ${conditional(!!options.search, SQL`AND rank > 0`)}
        ${conditional(!!options.owner, SQL`AND w.owner = ${options.owner}`)}
      ORDER BY
      ${conditional(!!options.search, SQL`rank DESC, `)}
      ${order}
      ${limit(options.limit, { max: 100 })}
      ${offset(options.offset)}
    `

    return await this.namedQuery<AggregateWorldAttributes>(
      "find_worlds_with_aggregates",
      sql
    )
  }

  static async countWorlds(
    options: Pick<
      FindWorldWithAggregatesOptions,
      | "user"
      | "only_favorites"
      | "names"
      | "search"
      | "categories"
      | "disabled"
      | "owner"
    >
  ): Promise<number> {
    const isMissingEthereumAddress =
      options.user && !isEthereumAddress(options.user)
    const searchIsEmpty = options.search && options.search.length < 3
    if (isMissingEthereumAddress || searchIsEmpty) {
      return 0
    }

    const query = SQL`
      SELECT count(*) as total
      FROM ${table(this)} w
      ${conditional(
        !!options.user && options.only_favorites,
        SQL`RIGHT JOIN ${table(
          UserFavoriteModel
        )} uf on w.id = uf.entity_id AND uf."user" = ${options.user}`
      )}
      ${conditional(
        !!options.search,
        SQL`, ts_rank_cd(
          (setweight(to_tsvector(coalesce(w.title, '')), 'A') || 
           setweight(to_tsvector(coalesce(w.world_name, '')), 'A') || 
           setweight(to_tsvector(coalesce(w.description, '')), 'B') ||
           setweight(to_tsvector(coalesce(w.owner, '')), 'C')),
          to_tsquery(${tsquery(options.search || "")})
        ) as rank`
      )}
      ${conditional(
        !!options.categories.length,
        SQL`WHERE w.categories && ${options.categories}::varchar[]`
      )}
      ${conditional(!options.categories.length, SQL`WHERE 1=1`)}
        ${conditional(!!options.disabled, SQL`AND w.disabled IS TRUE`)}
        ${conditional(!options.disabled, SQL`AND w.disabled IS FALSE`)}
        AND w.show_in_places IS TRUE
        ${conditional(
          options.names.length > 0,
          SQL`AND w.id = ANY(${options.names.map((name) =>
            name.toLowerCase()
          )})`
        )}
        ${conditional(!!options.search, SQL`AND rank > 0`)}
        ${conditional(!!options.owner, SQL`AND w.owner = ${options.owner}`)}
    `

    const results: { total: number }[] = await this.namedQuery(
      "count_worlds",
      query
    )
    return Number(results[0].total)
  }

  static async findWorldNames(): Promise<{ world_name: string }[]> {
    const sql = SQL`
      SELECT w.world_name
      FROM ${table(this)} w
      WHERE w.disabled IS FALSE AND w.show_in_places IS TRUE
      ORDER BY w.world_name ASC
    `
    return await this.namedQuery("find_world_names", sql)
  }

  static async countWorldNames(): Promise<number> {
    const query = SQL`
      SELECT count(*) as total
      FROM ${table(this)} w
      WHERE w.disabled IS FALSE AND w.show_in_places IS TRUE
    `
    const results: { total: number }[] = await this.namedQuery(
      "count_world_names",
      query
    )
    return Number(results[0].total)
  }

  /**
   * Build a full WorldAttributes row from partial input, applying defaults.
   */
  private static buildWorldData(
    world: Partial<WorldAttributes> & { world_name: string }
  ): WorldAttributes {
    const now = new Date()
    const worldId = world.world_name.toLowerCase()

    return {
      id: worldId,
      world_name: world.world_name,
      title: world.title ?? null,
      description: world.description ?? null,
      image: world.image ?? null,
      content_rating: world.content_rating ?? SceneContentRating.RATING_PENDING,
      categories: world.categories ?? [],
      owner: world.owner ?? null,
      show_in_places: world.show_in_places ?? true,
      single_player: world.single_player ?? false,
      skybox_time: world.skybox_time ?? null,
      likes: world.likes ?? 0,
      dislikes: world.dislikes ?? 0,
      favorites: world.favorites ?? 0,
      like_rate: world.like_rate ?? 0.5,
      like_score: world.like_score ?? 0,
      disabled: world.disabled ?? false,
      disabled_at: world.disabled_at ?? null,
      created_at: now,
      updated_at: now,
    }
  }

  /**
   * Insert a world only if it doesn't already exist.
   * Uses INSERT ... ON CONFLICT (id) DO NOTHING for atomicity.
   * Returns the world ID (lowercased world_name) regardless of whether
   * the insert was performed.
   */
  static async insertWorldIfNotExists(
    world: Partial<WorldAttributes> & { world_name: string }
  ): Promise<string> {
    const worldData = this.buildWorldData(world)

    const sql = SQL`
      INSERT INTO ${table(this)} (
        "id", "world_name", "title", "description", "image",
        "content_rating", "categories", "owner", "show_in_places",
        "single_player", "skybox_time", "likes", "dislikes", "favorites",
        "like_rate", "like_score", "disabled", "disabled_at",
        "created_at", "updated_at"
      ) VALUES (
        ${worldData.id},
        ${worldData.world_name},
        ${worldData.title},
        ${worldData.description},
        ${worldData.image},
        ${worldData.content_rating},
        ${worldData.categories},
        ${worldData.owner},
        ${worldData.show_in_places},
        ${worldData.single_player},
        ${worldData.skybox_time},
        ${worldData.likes},
        ${worldData.dislikes},
        ${worldData.favorites},
        ${worldData.like_rate},
        ${worldData.like_score},
        ${worldData.disabled},
        ${worldData.disabled_at},
        ${worldData.created_at},
        ${worldData.updated_at}
      )
      ON CONFLICT (id) DO NOTHING
    `

    await this.namedQuery("insert_world_if_not_exists", sql)
    return worldData.id
  }

  static async upsertWorld(
    world: Partial<WorldAttributes> & { world_name: string }
  ): Promise<WorldAttributes> {
    const worldData = this.buildWorldData(world)

    // Fields that can be updated on conflict (excludes id, world_name, likes, etc.)
    const updatableFields: (keyof WorldAttributes)[] = [
      "title",
      "description",
      "image",
      "content_rating",
      "categories",
      "owner",
      "show_in_places",
      "single_player",
      "skybox_time",
    ]

    // Build changes object with only explicitly provided fields
    // This ensures we don't overwrite existing values with defaults on conflict
    const changes: Partial<WorldAttributes> = {
      updated_at: worldData.updated_at,
    }
    for (const field of updatableFields) {
      if (world[field] !== undefined) {
        ;(changes as Record<string, unknown>)[field] = world[field]
      }
    }

    // Upsert on id (lowercased world_name) as the conflict target
    return this.upsert(worldData, {
      target: ["id"],
      changes,
    })
  }

  static async disableWorld(worldName: string): Promise<void> {
    const now = new Date()
    const sql = SQL`
      UPDATE ${table(this)}
      SET disabled = TRUE, disabled_at = ${now}, updated_at = ${now}
      WHERE id = ${worldName.toLowerCase()}
    `
    await this.namedQuery("disable_world", sql)
  }

  static async updateFavorites(worldId: string): Promise<void> {
    const sql = buildUpdateFavoritesQuery(this, worldId)
    await this.namedQuery("update_favorites", sql)
  }

  static async updateLikes(worldId: string): Promise<void> {
    const sql = buildUpdateLikesQuery(this, worldId)
    await this.namedQuery("update_likes", sql)
  }

  /**
   * Check if a world has any enabled scene places
   */
  static async hasEnabledScenes(worldId: string): Promise<boolean> {
    const sql = SQL`
      SELECT EXISTS(
        SELECT 1 FROM places
        WHERE world_id = ${worldId}
          AND disabled IS FALSE
      ) as has_scenes
    `
    const results: { has_scenes: boolean }[] = await this.namedQuery(
      "has_enabled_scenes",
      sql
    )
    return results[0]?.has_scenes ?? false
  }
}
