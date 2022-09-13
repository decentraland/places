import schema from "decentraland-gatsby/dist/entities/Schema/schema"

export const updateUserLikeParamsSchema = schema.params({
  place_id: {
    type: "string",
    format: "uuid",
    description: "Place ID",
  },
})

export const updateUserLikeBodySchema = schema({
  type: "object",
  description: "user like body needed",
  additionalProperties: false,
  required: ["like"] as const,
  properties: {
    like: {
      type: "boolean",
      description: "True if the place is selected as like",
    },
  },
})

export const userLikeSchema = schema({
  type: "object",
  required: [],
  properties: {
    total: {
      type: "number",
      minimum: 0,
      description: "The number of likes on the place",
    },
  },
})

export const userLikeResponseSchema = schema.api(userLikeSchema)
