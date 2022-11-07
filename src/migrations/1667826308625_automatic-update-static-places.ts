import { createPlaceMigration } from "../entities/Place/migration"
import defaulPlace from "../seed/04_places.json"

export const { up, down } = createPlaceMigration(defaulPlace)
