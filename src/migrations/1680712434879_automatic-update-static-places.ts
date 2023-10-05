import { createPlaceMigration } from "../entities/Place/migration"
import { PlaceAttributes } from "../entities/Place/types"
import defaultPlace from "../seed/30_places.json"

const attributes: Array<keyof PlaceAttributes> = [
  "title",
  "description",
  "image",
  "highlighted_image",

  "owner",

  "positions",
  "base_position",
  "contact_name",
  "contact_email",
  "content_rating",
  "highlighted",

  "disabled",
  "disabled_at",
]

export const { up, down } = createPlaceMigration(defaultPlace, attributes)
