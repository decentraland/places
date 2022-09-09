import {
  AjvObjectSchema,
  apiResultSchema,
} from "decentraland-gatsby/dist/entities/Schema/types"

const placeCategoryScheme: AjvObjectSchema = {
  type: "object",
  description: "Place's categories",
  properties: {
    name: {
      type: "string",
      minLength: 0,
      maxLength: 50,
      description: "The category of a place",
    },
    active: {
      type: "boolean",
      description:
        "Whether the category can be displayed in the listing or not",
    },
    places_counter: {
      type: "number",
      description: "Sum of places with this category",
    },
    created_at: {
      description: "the time the category was created",
      type: "string",
      format: "date-time",
    },
    updated_at: {
      description: "The time the category was last updated",
      type: "string",
      format: "date-time",
    },
  },
}

export const placeCategoryListScheme = apiResultSchema({
  type: "array",
  items: placeCategoryScheme,
})
