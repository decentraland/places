import schema from "decentraland-gatsby/dist/entities/Schema/schema"

export const signedUrlBodySchema = schema({
  type: "object",
  description: "mimetype to sign url",
  additionalProperties: false,
  required: ["mimetype"],
  properties: {
    mimetype: {
      type: "string",
    },
  },
})
