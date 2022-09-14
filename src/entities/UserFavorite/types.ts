export type UserFavoriteAttributes = {
  user: string
  user_activity: number
  place_id: string
  created_at: Date
}

export type UpdateUserFavoriteParams = {
  place_id: string
}

export type UpdateUserFavoriteBody = {
  favorites: boolean
}

export type UpdateUserFavoriteResponse = {
  favorites: number
}
