export type UserLikeAttributes = {
  user: string
  user_activity: number
  place_id: string
  like: boolean
  created_at: Date
  updated_at: Date
}

export type UpdateUserLikeParams = {
  place_id: string
}

export type UpdateUserLikeBody = {
  like: boolean
}

export type UpdateUserLikeResponse = {
  like: number
  dislike: number
}
