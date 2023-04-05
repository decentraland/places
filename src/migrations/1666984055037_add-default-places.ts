import { createPlaceMigration } from "../entities/Place/migration"
import { PlaceAttributes } from "../entities/Place/types"
import defaultPlace from "../seed/01_places.json"

const attributes: Array<keyof PlaceAttributes> = [
  "title",
  "description",
  "image",
  "owner",
  "tags",
  "positions",
  "base_position",
  "contact_name",
  "contact_email",
  "content_rating",
  "featured",
  "disabled",
  "disabled_at",
]

export const { up, down } = createPlaceMigration(defaultPlace, attributes)
