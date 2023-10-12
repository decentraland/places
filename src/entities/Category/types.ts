export type CategoryAttributes = {
  name: string // primary key
  active: boolean
  created_at: Date
  updated_at: Date
}

export type CategoryWithPlaceCount = {
  name: string
  count: number
}

export enum DecentralandCategories {
  POI = "poi",
  FEATURED = "featured",
}
