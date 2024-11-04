import schema from "decentraland-gatsby/dist/entities/Schema/schema"

import { PlaceListOrderBy } from "./types"

export const getPlaceParamsSchema = schema.params({
  place_id: {
    type: "string",
    format: "uuid",
    description: "Place ID",
  },
})

export const getPlaceListQuerySchema = schema({
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
      enum: [PlaceListOrderBy.LIKE_SCORE_BEST, PlaceListOrderBy.MOST_ACTIVE],
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

export const realmSchema = schema({
  type: "object",
  required: [],
  properties: {
    serverName: {
      type: "string",
      description: "The name of the Realm server",
    },
    url: {
      type: "string",
      description: "The url of the Realm",
    },
    usersCount: {
      type: "number",
      description: "The total amount of users of the Realm",
    },
    userParcels: {
      type: "array",
      description: "Array of parcels for users of the Realm",
      items: {
        type: "array",
        description: "X and Y of the parcel",
        minItems: 2,
        maxItems: 2,
        items: {
          type: "number",
        },
      },
    },
  },
})

export const placeSchema = schema({
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
    owner: {
      type: "string",
      minLength: 0,
      maxLength: 42,
      description: "The owner's name",
    },
    positions: {
      type: "array",
      description: "A list of positions of the place",
      items: {
        type: "string",
        pattern: "^-?\\d{1,3},-?\\d{1,3}$",
      },
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
    contact_email: {
      type: "string",
      minLength: 0,
      maxLength: 5000,
      description: "The contact email on the place",
    },
    content_rating: {
      type: "string",
      minLength: 0,
      maxLength: 1,
      description: "The content rating on the place",
    },
    likes: {
      type: "number",
      minimum: 0,
      description: "The number of likes on the place",
    },
    dislikes: {
      type: "number",
      minimum: 0,
      description: "The number of dislikes on the place",
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
      description: "The number of favorites on the place",
    },
    disabled: {
      type: "boolean",
      description: "True if the place is disabled",
    },
    disabled_at: {
      description: "The date when the place was disabled",
      type: "string",
      format: "date-time",
    },
    created_at: {
      description: "the time the place was created",
      type: "string",
      format: "date-time",
    },
    updated_at: {
      description: "The time the place was last updated",
      type: "string",
      format: "date-time",
    },
    deployed_at: {
      description: "The time the place was last deployed",
      type: "string",
      format: "date-time",
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
      description: "A list of realms with users in each Realm (experimental)",
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
})

export const placeResponseSchema = schema.api(placeSchema)
export const placeListResponseSchema = schema.api(schema.array(placeSchema))

export const updateRatingBodySchema = schema({
  type: "object",
  description: "content rating body needed",
  additionalProperties: false,
  required: ["content_rating"],
  properties: {
    content_rating: {
      type: "string",
      description: "Rating for the place",
      enum: ["PR", "E", "T", "A", "R"],
    },
    comment: {
      type: "string",
      description: "A comment for the rating",
    },
  },
})
