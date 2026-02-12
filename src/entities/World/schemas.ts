import schema from "decentraland-gatsby/dist/entities/Schema/schema"

import { WorldListOrderBy } from "./types"

export const getWorldListQuerySchema = schema({
  type: "object",
  required: [],
  properties: {
    limit: {
      type: "string",
      format: "uint",
      nullable: true as any,
    },
    offset: {
      type: "string",
      format: "uint",
      nullable: true as any,
    },
    names: {
      type: "array",
      maxItems: 1000,
      items: { type: "string" },
      description: "Filter worlds by names",
      nullable: true as any,
    },
    only_favorites: {
      type: "string",
      format: "boolean",
      description: "True if shows only favorite worlds",
      nullable: true as any,
    },
    order_by: {
      type: "string",
      description: "Order worlds by",
      enum: [
        WorldListOrderBy.LIKE_SCORE_BEST,
        WorldListOrderBy.MOST_ACTIVE,
        WorldListOrderBy.CREATED_AT,
      ],
      nullable: true as any,
    },
    order: {
      type: "string",
      description: "List order",
      default: "desc",
      enum: ["asc", "desc"],
      nullable: true as any,
    },
    search: {
      type: "string",
      description:
        "Filter worlds that contains a text expression, should have at least 3 characters otherwise the resultant list will be empty",
      nullable: true as any,
    },
    categories: {
      type: "array",
      items: { type: "string" },
      description: "Filter worlds by categories",
      nullable: true as any,
    },
    disabled: {
      type: "string",
      format: "boolean",
      description: "True if shows also disabled worlds",
      nullable: true as any,
    },
    owner: {
      type: "string",
      description: "Filter worlds by owner address",
      pattern: "^0x[a-fA-F0-9]{40}$",
      nullable: true as any,
    },
  },
})

export const worldSchema = schema({
  type: "object",
  required: [],
  properties: {
    id: {
      type: "string",
      description: "world id (lowercased world name)",
    },
    title: {
      type: "string",
      minLength: 0,
      maxLength: 50,
      description: "The world name",
    },
    description: {
      type: "string",
      minLength: 0,
      maxLength: 5000,
      description: "The world description",
    },
    image: {
      description: "Url to the world cover or image",
      type: "string",
      format: "uri",
    },
    owner: {
      type: "string",
      minLength: 0,
      maxLength: 42,
      description: "The owner's name",
    },
    positions: {
      type: "array",
      description: "A list of positions of the world",
      items: {
        type: "string",
        pattern: "^-?\\d{1,3},-?\\d{1,3}$",
      },
    },
    base_position: {
      type: "string",
      description: "The base position of the world",
      pattern: "^-?\\d{1,3},-?\\d{1,3}$",
    },
    contact_name: {
      type: "string",
      minLength: 0,
      maxLength: 5000,
      description: "The contact name of the world",
    },
    contact_email: {
      type: "string",
      minLength: 0,
      maxLength: 5000,
      description: "The contact email on the world",
    },
    content_rating: {
      type: "string",
      minLength: 0,
      maxLength: 5000,
      description: "The content rating on the world",
    },
    likes: {
      type: "number",
      minimum: 0,
      description: "The number of likes on the world",
    },
    dislikes: {
      type: "number",
      minimum: 0,
      description: "The number of dislikes on the world",
    },
    like_score: {
      type: "number",
      minimum: 0,
      maximum: 1,
      default: null,
      description:
        "A calculated number to qualify a place based on its likes and dislikes only taking into account the users with enough VP",
    },
    like_rate: {
      type: "number",
      minimum: 0,
      maximum: 1,
      default: null,
      description:
        "The percentage of likes on the place expressed on decimal fraction",
    },
    favorites: {
      type: "number",
      minimum: 0,
      description: "The number of favorites on the world",
    },
    is_private: {
      type: "boolean",
      description: "True if the world has restricted access (private)",
    },
    disabled: {
      type: "boolean",
      description: "True if the world is disabled",
    },
    disabled_at: {
      description: "The date when the world was disabled",
      type: "string",
      format: "date-time",
    },
    created_at: {
      description: "the time the world was created",
      type: "string",
      format: "date-time",
    },
    updated_at: {
      description: "The time the world was last updated",
      type: "string",
      format: "date-time",
    },
    deployed_at: {
      description: "The time the world was last deployed",
      type: "string",
      format: "date-time",
    },
    user_like: {
      type: "boolean",
      description: "True if user likes the world",
    },
    user_dislike: {
      type: "boolean",
      description: "True if user dislikes the world",
    },
    user_favorite: {
      type: "boolean",
      description: "True if user seletect as favorite the world",
    },
    user_count: {
      type: "number",
      minimum: 0,
      description: "The number of users in the world",
    },
    user_visits: {
      type: "number",
      minimum: 0,
      description:
        "The number of users that had visited the world in the last 30 days",
    },
    creator_address: {
      type: "string",
      minLength: 0,
      maxLength: 42,
      description: "The creator's wallet address",
      pattern: "^0x[a-fA-F0-9]{40}$",
      nullable: true as any,
    },
  },
})

export const worldListResponseSchema = schema.api(schema.array(worldSchema))

export const getWorldParamsSchema = schema.params({
  world_id: {
    type: "string",
    description: "World ID (lowercased world name)",
  },
})

export const updateWorldFavoriteParamsSchema = schema.params({
  world_id: {
    type: "string",
    description: "World ID (lowercased world name)",
  },
})

export const updateWorldFavoriteBodySchema = schema({
  type: "object",
  description: "User favorite update body",
  additionalProperties: false,
  required: ["favorites"] as const,
  properties: {
    favorites: {
      type: "boolean",
      description: "Favorites boolean is require",
    },
  },
})

export const updateWorldLikeParamsSchema = schema.params({
  world_id: {
    type: "string",
    description: "World ID (lowercased world name)",
  },
})

export const updateWorldLikeBodySchema = schema({
  type: "object",
  description: "User like update body",
  additionalProperties: false,
  required: ["like"] as const,
  properties: {
    like: {
      type: "boolean",
      description: "Like is required",
      nullable: true as any,
    },
  },
})

export const updateWorldRatingParamsSchema = schema.params({
  world_id: {
    type: "string",
    description: "World ID (lowercased world name)",
  },
})

export const updateWorldRatingBodySchema = schema({
  type: "object",
  description: "content rating body needed",
  additionalProperties: false,
  required: ["content_rating"] as const,
  properties: {
    content_rating: {
      type: "string",
      description: "Rating for the world",
      enum: ["PR", "E", "T", "A", "R"],
    },
    comment: {
      type: "string",
      description: "A comment for the rating",
    },
  },
})
