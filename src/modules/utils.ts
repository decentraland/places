import { PlaceAttributes } from "../entities/Place/types"

export function placeClientOptions(
  place: Pick<PlaceAttributes, "base_position" | "world" | "world_name">
): {
  position: string
  realm?: string
} {
  const options: {
    position: string
    realm?: string
  } = {
    position: place.base_position,
  }

  if (place.world) {
    options.realm = place.world_name!
  }

  return options
}
