import schema from "decentraland-gatsby/dist/entities/Schema/schema"

import { realmSchema } from "../Place/schemas"

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
          format: "uudi",
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
