export type UserFavoriteAttributes = {
  user: string
  user_activity: number
  entity_id: string
  created_at: Date
}

export type UpdateUserFavoriteParams = {
  entity_id: string
}

export type UpdateUserFavoriteBody = {
  favorites: boolean
}

export type UpdateUserFavoriteResponse = {
  favorites: number
}
