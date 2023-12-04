import { createPlaceNewMigrationUpdate } from "../entities/Place/migration"
import { PlaceAttributes } from "../entities/Place/types"
import defaultPlace from "../seed/34_places_new.json"

const attributes: Array<keyof PlaceAttributes> = [
  "base_position",
  "highlighted_image",
  "highlighted",
  "world_name",
]

export const { up, down } = createPlaceNewMigrationUpdate(
  defaultPlace,
  attributes
)
