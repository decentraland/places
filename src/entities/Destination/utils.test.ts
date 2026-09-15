import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { AggregateDestinationAttributes } from "./types"
import { ConnectedUsersMap, destinationsWithAggregates } from "./utils"
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

    describe("and both world names are missing", () => {
      it("should not treat malformed live data as a match", () => {
        const worldsLiveData = {
          perWorld: [{ worldName: undefined, users: 3 }],
          totalUsers: 3,
        } as unknown as WorldLiveDataProps
        const destinationWithoutWorldName = {
          ...worldDestination("SpaceRunner.dcl.eth"),
          world_name: null,
        }

        const [destination] = destinationsWithAggregates(
          [destinationWithoutWorldName],
          [],
          {},
          worldsLiveData
        )

        expect(destination.user_count).toBe(0)
      })
    })
  })

  describe("when connected users were requested", () => {
    const worldsLiveData: WorldLiveDataProps = {
      perWorld: [{ worldName: "spacerunner.dcl.eth", users: 3 }],
      totalUsers: 3,
    }

    const aggregatesWithPresence = (connectedUsersMap: ConnectedUsersMap) =>
      destinationsWithAggregates(
        [worldDestination("SpaceRunner.dcl.eth")],
        [],
        {},
        worldsLiveData,
        {
          withRealmsDetail: false,
          withConnectedUsers: true,
          connectedUsersMap,
          withLiveEvents: false,
        }
      )

    describe("and comms-gatekeeper listed the people in the room", () => {
      it("should return their addresses", () => {
        const [destination] = aggregatesWithPresence(
          new Map([["SpaceRunner.dcl.eth", ["0xabc", "0xdef"]]])
        )

        expect(destination.connected_addresses).toEqual(["0xabc", "0xdef"])
      })
    })

    describe("and comms-gatekeeper answered that the room is empty", () => {
      it("should return an empty list, not null", () => {
        const [destination] = aggregatesWithPresence(
          new Map([["SpaceRunner.dcl.eth", []]])
        )

        expect(destination.connected_addresses).toEqual([])
      })
    })

    describe("and comms-gatekeeper could not be reached for the destination", () => {
      it("should return null so the room is not read as empty", () => {
        const [destination] = aggregatesWithPresence(
          new Map([["SpaceRunner.dcl.eth", null]])
        )

        expect(destination.connected_addresses).toBeNull()
      })

      it("should still count the users reported by live data", () => {
        const [destination] = aggregatesWithPresence(
          new Map([["SpaceRunner.dcl.eth", null]])
        )

        expect(destination.user_count).toBe(3)
      })
    })

    describe("and the destination is missing from the map altogether", () => {
      it("should return null rather than an empty list", () => {
        const [destination] = aggregatesWithPresence(new Map())

        expect(destination.connected_addresses).toBeNull()
      })
    })
  })

  describe("when connected users were not requested", () => {
    it("should leave connected_addresses out of the result", () => {
      const [destination] = destinationsWithAggregates(
        [worldDestination("SpaceRunner.dcl.eth")],
        [],
        {},
        { perWorld: [], totalUsers: 0 }
      )

      expect(destination).not.toHaveProperty("connected_addresses")
    })
  })
})
