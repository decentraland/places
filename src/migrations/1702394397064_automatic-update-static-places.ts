import { createPlaceNewMigrationUpdate } from "../entities/Place/migration"
import { PlaceAttributes } from "../entities/Place/types"
import defaultPlace from "../seed/35_places_new.json"

const attributes: Array<keyof PlaceAttributes> = [
  "description",
  "base_position",
  "highlighted_image",
  "highlighted",
  "world_name",
]

export const { up, down } = createPlaceNewMigrationUpdate(
  defaultPlace,
  attributes
)
