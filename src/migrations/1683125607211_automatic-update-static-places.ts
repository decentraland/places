import { createPlaceNewMigrationUpdate } from "../entities/Place/migration"
import { PlaceAttributes } from "../entities/Place/types"
import defaultPlace from "../seed/31_places_new.json"

const attributes: Array<keyof PlaceAttributes> = [
  "base_position",
  "highlighted_image",
  "highlighted",
  "featured",
  "featured_image",
  "world_name",
]

export const { up, down } = createPlaceNewMigrationUpdate(
  defaultPlace,
  attributes
)
