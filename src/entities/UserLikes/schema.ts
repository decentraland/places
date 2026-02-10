import schema from "decentraland-gatsby/dist/entities/Schema/schema"

export const updateUserLikeParamsSchema = schema.params({
  entity_id: {
    type: "string",
    format: "uuid",
    description: "Entity ID (place or world)",
  },
})

export const updateUserLikeBodySchema = schema({
  type: "object",
  description: "user like body needed",
  additionalProperties: false,
  required: [],
  properties: {
    like: {
      type: "boolean",
      description: "True if the place is selected as like",
      nullable: true as any,
    },
  },
})

export const userLikeSchema = schema({
  type: "object",
  required: [],
  properties: {
    like: {
      type: "number",
      minimum: 0,
      description: "The number of likes on the place",
    },
    dislike: {
      type: "number",
      minimum: 0,
      description: "The number of dislikes on the place",
    },
    user_like: {
      type: "boolean",
      description: "True if user likes the place",
    },
    user_dislike: {
      type: "boolean",
      description: "True if user dislikes the place",
    },
  },
})

export const userLikeResponseSchema = schema.api(userLikeSchema)
