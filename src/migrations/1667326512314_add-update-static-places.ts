import { createPlaceMigration } from "../entities/Place/migration"
import defaulPlace from "../seed/02_places.json"

export const { up, down } = createPlaceMigration(defaulPlace)
