import schema from "decentraland-gatsby/dist/entities/Schema/schema"

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
      nullable: true,
    },
    offset: {
      type: "string",
      format: "uint",
      nullable: true,
    },
    positions: {
      type: "array",
      items: { type: "string", pattern: "^-?\\d{1,3},-?\\d{1,3}$" },
      description: "Filter places in specific positions",
      nullable: true,
    },
    onlyFavorites: {
      type: "string",
      format: "boolean",
      description: "True if shows only favorite places",
      nullable: true,
    },
    orderBy: {
      type: "string",
      description: "Order places by",
      enum: ["popularity", "updated_at"],
      nullable: true,
    },
    order: {
      type: "string",
      description: "List order",
      default: "desc",
      enum: ["asc", "desc"],
      nullable: true,
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
    tags: {
      type: "array",
      description: "A list of tags for the place",
      items: {
        type: "string",
      },
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
      maxLength: 5000,
      description: "The content rating on the place",
    },
    likes: {
      type: "number",
      minimum: 0,
      description: "The number of of likes on the place",
    },
    dislikes: {
      type: "number",
      minimum: 0,
      description: "The number of of dislikes on the place",
    },
    favorites: {
      type: "number",
      minimum: 0,
      description: "The number of of favorites on the place",
    },
    deployed_at: {
      description: "The date when the place was deployed",
      type: "string",
      format: "date-time",
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
  },
})

export const placeResponseSchema = schema.api(placeSchema)
export const placeListResponseSchema = schema.api(schema.array(placeSchema))
