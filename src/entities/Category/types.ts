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

// TODO: review this type with the other ones: naming and maybe we can merge some (@lauti7)
export type Category = { name: string; active: boolean; count?: number }

export enum CategoryCountTargetOptions {
  ALL = "all",
  PLACES = "places",
  WORLDS = "worlds",
}
