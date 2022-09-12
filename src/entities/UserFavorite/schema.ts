import schema from "decentraland-gatsby/dist/entities/Schema/schema"

export const updateUserFavoriteParamsSchema = schema.params({
  place_id: {
    type: "string",
    format: "uuid",
    description: "Place ID",
  },
})

export const updateUserFavoriteBodySchema = schema({
  type: "object",
  description: "user favorite query needed",
  additionalProperties: false,
  required: ["favorites"] as const,
  properties: {
    favorites: {
      type: "boolean",
      description: "True if the place is selected as favorite",
    },
  },
})

export const userFavoriteSchema = schema({
  type: "object",
  required: [],
  properties: {
    total: {
      type: "number",
      minimum: 0,
      description: "The number of favorites on the place",
    },
  },
})

export const userFavoriteResponseSchema = schema.api(userFavoriteSchema)
