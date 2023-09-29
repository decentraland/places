export type CategoryAttributes = {
  name: string // primary key
  active: boolean
  created_at: Date
  updated_at: Date
}

export type CategoryWithPlaceCount = {
  name: string
  count: string
}

export const ALL_PLACE_CATEGORY = "all"
