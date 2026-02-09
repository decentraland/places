export type UserLikeAttributes = {
  user: string
  user_activity: number
  entity_id: string
  like: boolean
  created_at: Date
  updated_at: Date
}

export type UpdateUserLikeParams = {
  entity_id: string
}

export type UpdateUserLikeBody = {
  like: boolean
}

export type UpdateUserLikeResponse = {
  likes: number
  dislikes: number
}
