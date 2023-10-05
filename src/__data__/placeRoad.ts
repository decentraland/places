import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { PlaceAttributes } from "../entities/Place/types"

export const placeRoad: PlaceAttributes = {
  id: "c6adac03-0c7a-406d-8285-9abf8b19751f",
  likes: 0,
  dislikes: 0,
  favorites: 0,
  like_rate: 0.5,
  like_score: 0,
  highlighted: false,
  highlighted_image: null,
  disabled: false,
  updated_at: new Date("2023-03-28T18:37:39.918Z"),
  world: false,
  world_name: null,
  title: "Road at -89,11 (open road OpenRoad_C)",
  description: null,
  owner: null,
  image: "https://decentraland.org/images/thumbnail/road.png",
  base_position: "-89,11",
  positions: ["-89,11"],
  contact_name: "Decentraland Foundation",
  contact_email: null,
  content_rating: SceneContentRating.RATING_PENDING,
  created_at: new Date("2023-03-28T18:37:39.918Z"),
  disabled_at: null,
  deployed_at: new Date("2022-11-14T17:22:05.307Z"),
  hidden: false,
  textsearch: undefined,
}
