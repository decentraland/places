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
      description: "Order places by",
      enum: [WorldListOrderBy.HIGHEST_RATED, WorldListOrderBy.MOST_ACTIVE],
      nullable: true as any,
    },
    order: {
      type: "string",
      description: "List order",
      default: "desc",
      enum: ["asc", "desc"],
      nullable: true as any,
    },
  },
})
