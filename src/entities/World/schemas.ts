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
      enum: [WorldListOrderBy.LIKE_SCORE_BEST, WorldListOrderBy.MOST_ACTIVE],
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
  },
})

export const worldSchema = schema({
  type: "object",
  required: [],
  properties: {
    id: {
      type: "string",
      format: "uudi",
      description: "world id",
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
    tags: {
      type: "array",
      description: "A list of tags for the world",
      items: {
        type: "string",
      },
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
    hidden: {
      type: "boolean",
      description: "True if the world is hidden",
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
  },
})

export const worldListResponseSchema = schema.api(schema.array(worldSchema))
