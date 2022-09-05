export type PlaceAttributes = {
  id: string
  title: string | null
  description: string | null
  image: string | null
  owner: string | null
  tags: string[]
  positions: string[]
  base_position: string
  contact_name: string | null
  contact_email: string | null
  content_rating: string | null
  likes: number,
  dislikes: number,
  favorites: number,
  deployed_at: Date
  disabled: boolean
  disabled_at: Date | null
  created_at: Date
  updated_at: Date
}
