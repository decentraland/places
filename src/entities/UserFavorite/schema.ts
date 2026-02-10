import schema from "decentraland-gatsby/dist/entities/Schema/schema"

export const updateUserFavoriteParamsSchema = schema.params({
  entity_id: {
    type: "string",
    format: "uuid",
    description: "Entity ID (place or world)",
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
    favorites: {
      type: "number",
      minimum: 0,
      description: "The number of favorites on the place",
    },
    user_favorite: {
      type: "boolean",
      description: "True if the user selected as favorite",
    },
  },
})

export const userFavoriteResponseSchema = schema.api(userFavoriteSchema)
