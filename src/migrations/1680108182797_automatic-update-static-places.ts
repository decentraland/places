import { createPlaceMigration } from "../entities/Place/migration"
import { PlaceAttributes } from "../entities/Place/types"
import defaultPlace from "../seed/25_places.json"

const attributes: Array<keyof PlaceAttributes> = [
  "title",
  "description",
  "image",
  "highlighted_image",
  "featured_image",
  "owner",
  "tags",
  "positions",
  "base_position",
  "contact_name",
  "contact_email",
  "content_rating",
  "highlighted",
  "featured",
  "disabled",
  "disabled_at",
]

export const { up, down } = createPlaceMigration(defaultPlace, attributes)
