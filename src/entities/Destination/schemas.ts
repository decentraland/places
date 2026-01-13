import schema from "decentraland-gatsby/dist/entities/Schema/schema"

import { placeSchema, realmSchema } from "../Place/schemas"
import { PlaceListOrderBy } from "../Place/types"

export const getDestinationsListQuerySchema = schema({
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
      description: "Filter places by specific coordinates (exact match)",
      nullable: true as any,
    },
    world_names: {
      type: "array",
      maxItems: 1000,
      items: { type: "string" },
      description: "Filter worlds by exact names",
      nullable: true as any,
    },
    only_favorites: {
      type: "string",
      format: "boolean",
      description: "True if shows only favorite destinations",
      nullable: true as any,
    },
    only_highlighted: {
      type: "string",
      format: "boolean",
      description: "True if shows only highlighted destinations",
      nullable: true as any,
    },
    order_by: {
      type: "string",
      description: "Order destinations by",
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
        "Filter destinations that contain a text expression (uses LIKE/full-text search), should have at least 3 characters otherwise the resultant list will be empty",
      nullable: true as any,
    },
    categories: {
      type: "array",
      items: { type: "string" },
      description: "Filter destinations by available categories",
      nullable: true as any,
    },
    owner: {
      type: "string",
      description: "Filter destinations by owner address",
      nullable: true as any,
      pattern: "^0x[a-fA-F0-9]{40}$",
    },
    creator_address: {
      type: "string",
      description: "Filter destinations by creator address",
      nullable: true as any,
      pattern: "^0x[a-fA-F0-9]{40}$",
    },
    only_worlds: {
      type: "string",
      format: "boolean",
      description: "True if shows only worlds (excludes places)",
      nullable: true as any,
    },
    only_places: {
      type: "string",
      format: "boolean",
      description: "True if shows only places (excludes worlds)",
      nullable: true as any,
    },
  },
})

/**
 * Schema for unified destinations endpoint query parameters
 * Combines places and worlds with enhanced filtering capabilities
 */
export const getUnifiedDestinationsListQuerySchema = schema({
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
      description: "Filter places by specific coordinates (exact match)",
      nullable: true as any,
    },
    names: {
      type: "array",
      maxItems: 1000,
      items: { type: "string" },
      description:
        "Filter worlds by name using LIKE matching (partial match supported)",
      nullable: true as any,
    },
    only_favorites: {
      type: "string",
      format: "boolean",
      description: "True if shows only favorite destinations",
      nullable: true as any,
    },
    only_highlighted: {
      type: "string",
      format: "boolean",
      description: "True if shows only highlighted destinations",
      nullable: true as any,
    },
    order_by: {
      type: "string",
      description: "Order destinations by",
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
        "Filter destinations that contain a text expression (uses full-text search on title, description, owner). Should have at least 3 characters otherwise the resultant list will be empty",
      nullable: true as any,
    },
    categories: {
      type: "array",
      items: { type: "string" },
      description: "Filter destinations by available categories",
      nullable: true as any,
    },
    owner: {
      type: "string",
      description: "Filter destinations by owner address",
      nullable: true as any,
      pattern: "^0x[a-fA-F0-9]{40}$",
    },
    creator_address: {
      type: "string",
      description: "Filter destinations by creator address",
      nullable: true as any,
      pattern: "^0x[a-fA-F0-9]{40}$",
    },
    only_worlds: {
      type: "string",
      format: "boolean",
      description: "True if shows only worlds (excludes places)",
      nullable: true as any,
    },
    only_places: {
      type: "string",
      format: "boolean",
      description: "True if shows only places (excludes worlds)",
      nullable: true as any,
    },
    sdk: {
      type: "string",
      description: "Filter by SDK version (exact match)",
      nullable: true as any,
    },
  },
})

export const destinationSchema = placeSchema

export const destinationResponseSchema = schema.api(destinationSchema)
export const destinationListResponseSchema = schema.api(
  schema.array(destinationSchema)
)

