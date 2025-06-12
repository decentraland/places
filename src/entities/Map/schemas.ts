import schema from "decentraland-gatsby/dist/entities/Schema/schema"

import { realmSchema } from "../Place/schemas"
import { PlaceListOrderBy } from "../Place/types"

export const mapPlaceSchema = schema({
  type: "object",
  required: [],
  patternProperties: {
    "^-?\\d{1,3},-?\\d{1,3}$": {
      type: "object",
      required: [],
      properties: {
        id: {
          type: "string",
          format: "uuid",
          description: "place id",
        },
        title: {
          type: "string",
          minLength: 0,
          maxLength: 50,
          description: "The place name",
        },
        description: {
          type: "string",
          minLength: 0,
          maxLength: 5000,
          description: "The place description",
        },
        image: {
          description: "Url to the place cover or image",
          type: "string",
          format: "uri",
        },
        base_position: {
          type: "string",
          description: "The base position of the place",
          pattern: "^-?\\d{1,3},-?\\d{1,3}$",
        },
        contact_name: {
          type: "string",
          minLength: 0,
          maxLength: 5000,
          description: "The contact name of the place",
        },
        user_like: {
          type: "boolean",
          description: "True if user likes the place",
        },
        user_dislike: {
          type: "boolean",
          description: "True if user dislikes the place",
        },
        user_favorite: {
          type: "boolean",
          description: "True if user seletect as favorite the place",
        },
        user_count: {
          type: "number",
          minimum: 0,
          description: "The number of users in the place",
        },
        realms_detail: {
          type: "array",
          description:
            "A list of realms with users in each Realm (experimental)",
          items: realmSchema,
        },
        user_visits: {
          type: "number",
          minimum: 0,
          description:
            "The number of users that had visited the place in the last 30 days",
        },
        categories: {
          type: "array",
          description: "A list of the Place's categories",
          items: { type: "string" },
        },
      },
    },
  },
})

export const mapPlaceResponseSchema = schema.api(mapPlaceSchema)

export const getAllPlacesListQuerySchema = schema({
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
    positions: {
      type: "array",
      maxItems: 1000,
      items: { type: "string", pattern: "^-?\\d{1,3},-?\\d{1,3}$" },
      description: "Filter places in specific positions",
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
      description: "True if shows only favorite places",
      nullable: true as any,
    },
    only_highlighted: {
      type: "string",
      format: "boolean",
      description: "True if shows only highlighted places",
      nullable: true as any,
    },
    order_by: {
      type: "string",
      description: "Order places by",
      enum: [
        PlaceListOrderBy.LIKE_SCORE_BEST,
        PlaceListOrderBy.MOST_ACTIVE,
        PlaceListOrderBy.UPDATED_AT,
        PlaceListOrderBy.CREATED_AT,
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
    with_realms_detail: {
      type: "string",
      format: "boolean",
      description: "Add the numbers of users in each Realm (experimental)",
      nullable: true as any,
    },
    search: {
      type: "string",
      description:
        "Filter places that contains a text expression, should have at least 3 characters otherwise the resultant list will be empty",
      nullable: true as any,
    },
    categories: {
      type: "array",
      items: { type: "string" },
      description: "Filter places by available categories",
      nullable: true as any,
    },
  },
})
