import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { AggregateDestinationAttributes } from "./types"
import { destinationsWithAggregates } from "./utils"
import { WorldLiveDataProps } from "../World/types"

/**
 * A world destination as stored in the database: `world_name` keeps the original,
 * mixed-case name while `id` is its lowercased form.
 */
const worldDestination = (
  world_name: string
): AggregateDestinationAttributes => ({
  id: world_name.toLowerCase(),
  title: world_name,
  description: null,
  image: null,
  owner: null,
  world_name,
  content_rating: SceneContentRating.RATING_PENDING,
  categories: [],
  likes: 0,
  dislikes: 0,
  favorites: 0,
  like_rate: null,
  like_score: null,
  created_at: new Date("2024-01-01T00:00:00.000Z"),
  updated_at: new Date("2024-01-01T00:00:00.000Z"),
  disabled: false,
  disabled_at: null,
  base_position: "0,0",
  contact_name: null,
  deployed_at: null,
  highlighted: false,
  world: true,
  is_private: false,
  highlighted_image: null,
  positions: [],
  contact_email: null,
  creator_address: null,
  sdk: null,
  ranking: null,
  user_like: false,
  user_dislike: false,
  user_favorite: false,
  user_visits: 0,
})

describe("destinationsWithAggregates", () => {
  describe("when the destination is a world and live data reports users for it", () => {
    describe("and the live data world name differs only in casing", () => {
      it("should return the live user count for that world", () => {
        const worldsLiveData: WorldLiveDataProps = {
          perWorld: [{ worldName: "spacerunner.dcl.eth", users: 3 }],
          totalUsers: 3,
        }

        const [destination] = destinationsWithAggregates(
          [worldDestination("SpaceRunner.dcl.eth")],
          [],
          {},
          worldsLiveData
        )

        expect(destination.user_count).toBe(3)
      })
    })

    describe("and the live data is for an unrelated world", () => {
      it("should return a user count of zero", () => {
        const worldsLiveData: WorldLiveDataProps = {
          perWorld: [{ worldName: "spacerunner.dcl.eth", users: 3 }],
          totalUsers: 3,
        }

        const [destination] = destinationsWithAggregates(
          [worldDestination("otherworld.dcl.eth")],
          [],
          {},
          worldsLiveData
        )

        expect(destination.user_count).toBe(0)
      })
    })
  })
})
