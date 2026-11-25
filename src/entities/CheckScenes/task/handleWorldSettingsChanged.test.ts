import { Events } from "@dcl/schemas"
import { WorldSettingsChangedEvent } from "@dcl/schemas/dist/platform/events/world"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import {
  ContentServerConfigurationError,
  InvalidWorldSqsMessageError,
} from "./errors"
import { handleWorldSettingsChanged } from "./handleWorldSettingsChanged"
import PlaceModel from "../../Place/model"
import { notifyDowngradeRating, notifyUpgradingRating } from "../../Slack/utils"
import WorldModel from "../../World/model"
import { WorldAttributes } from "../../World/types"

jest.mock("../../Slack/utils", () => ({
  notifyDowngradeRating: jest.fn(),
  notifyUpgradingRating: jest.fn(),
  notifyError: jest.fn(),
}))

const WORLDS_URL = "https://worlds-content-server.decentraland.org"
const ALLOWED_HOSTS = "worlds-content-server.dcl.dev"

describe("when handling a world settings changed event", () => {
  let event: WorldSettingsChangedEvent
  let fetchMock: jest.SpyInstance
  let findByWorldName: jest.SpyInstance
  let upsertWorld: jest.SpyInstance
  let upsertWorldSettings: jest.SpyInstance
  let isNewestWorldSceneFrom: jest.SpyInstance
  let storedWorld: WorldAttributes

  beforeEach(() => {
    event = {
      type: Events.Type.WORLD,
      subType: Events.SubType.Worlds.WORLD_SETTINGS_CHANGED,
      key: "example.dcl.eth-1786492800000",
      timestamp: Date.parse("2026-08-12T00:00:00.000Z"),
      metadata: {
        worldName: "example.dcl.eth",
      },
    }
    storedWorld = {
      id: "example.dcl.eth",
      world_name: "example.dcl.eth",
      content_rating: SceneContentRating.TEEN,
    } as Partial<WorldAttributes> as WorldAttributes
    fetchMock = jest.spyOn(global, "fetch")
    findByWorldName = jest
      .spyOn(WorldModel, "findByWorldName")
      .mockResolvedValue(null)
    upsertWorld = jest
      .spyOn(WorldModel, "upsertWorld")
      .mockResolvedValue(storedWorld)
    upsertWorldSettings = jest
      .spyOn(WorldModel, "upsertWorldSettings")
      .mockResolvedValue(storedWorld)
    isNewestWorldSceneFrom = jest
      .spyOn(PlaceModel, "isNewestWorldSceneFrom")
      .mockResolvedValue(true)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.mocked(notifyDowngradeRating).mockReset()
    jest.mocked(notifyUpgradingRating).mockReset()
  })

  describe("when the event has no world name", () => {
    beforeEach(() => {
      event = {
        ...event,
        metadata: {} as WorldSettingsChangedEvent["metadata"],
      }
    })

    it("should return without fetching the settings", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe("when the world is unknown to the worlds content server", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    })

    it("should not upsert any settings", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).not.toHaveBeenCalled()
      expect(upsertWorld).not.toHaveBeenCalled()
    })
  })

  describe("when the settings fetch fails with a server error", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, { status: 503, statusText: "Service Unavailable" })
      )
    })

    it("should rethrow so the consumer retries the message", async () => {
      await expect(
        handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)
      ).rejects.toThrow("503")
    })
  })

  describe("when the fetched settings carry a settings version", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            title: "A New Title",
            description: "A new description",
            content_rating: SceneContentRating.TEEN,
            categories: ["art"],
            single_player: true,
            show_in_places: true,
            skybox_time: 12,
            thumbnail_hash: "bafkreithumb",
            settings_version: 7,
          }),
          { status: 200 }
        )
      )
    })

    it("should apply the fetched settings guarded by the fetched version", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).toHaveBeenCalledWith(
        {
          world_name: "example.dcl.eth",
          title: "A New Title",
          description: "A new description",
          content_rating: SceneContentRating.TEEN,
          categories: ["art"],
          image: `${WORLDS_URL}/contents/bafkreithumb`,
          show_in_places: true,
          single_player: true,
          skybox_time: 12,
          is_private: undefined,
          settings_version: 7,
          settings_source: WORLDS_URL,
        },
        WORLDS_URL
      )
    })

    it("should not use the unguarded upsert", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorld).not.toHaveBeenCalled()
    })

    describe("and the stored settings are newer than the fetched ones", () => {
      beforeEach(() => {
        upsertWorldSettings.mockReset()
        upsertWorldSettings.mockResolvedValueOnce(null)
      })

      it("should resolve without throwing so the message is acknowledged", async () => {
        await expect(
          handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)
        ).resolves.toBeUndefined()
      })
    })
  })

  describe("when the fetched settings carry an unusable settings version", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ title: "A New Title", settings_version: -1.5 }),
          { status: 200 }
        )
      )
    })

    it("should reject the update instead of silently dropping the ordering guarantee", async () => {
      await expect(
        handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)
      ).rejects.toThrow("invalid settings_version")
    })

    it("should not write at all", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS).catch(
        () => undefined
      )

      expect(upsertWorldSettings).not.toHaveBeenCalled()
    })
  })

  describe("when an unversioned response arrives for a world already under the versioned contract", () => {
    beforeEach(() => {
      findByWorldName.mockReset()
      findByWorldName.mockResolvedValueOnce({
        ...storedWorld,
        settings_version: 7,
      })
      // Mixed fleet mid-rollout: this reply came from an instance without the versioned contract
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ title: "Older Instance Title" }), {
          status: 200,
        })
      )
    })

    it("should not overwrite the row through the unguarded upsert", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorld).not.toHaveBeenCalled()
    })

    it("should write through the version-guarded statement, which rejects it in the database", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      // No version means the statement guards on settings_version IS NULL
      expect(upsertWorldSettings.mock.calls[0][0]).not.toHaveProperty(
        "settings_version"
      )
    })

    it("should resolve without throwing when the database rejects the write", async () => {
      upsertWorldSettings.mockReset()
      upsertWorldSettings.mockResolvedValueOnce(null)

      await expect(
        handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)
      ).resolves.toBeUndefined()
    })
  })

  describe("when the response carries a version but no settings and the world is unknown here", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ settings_version: 7 }), { status: 200 })
      )
    })

    it("should not create a world row out of column defaults", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).not.toHaveBeenCalled()
    })
  })

  describe("when a versioned response carries no settings but the event payload has an access type", () => {
    beforeEach(() => {
      event = {
        ...event,
        metadata: {
          worldName: "example.dcl.eth",
          accessType: "restricted",
        },
      }
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ settings_version: 7 }), { status: 200 })
      )
    })

    it("should not create a world row, since this path ignores the payload access type", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).not.toHaveBeenCalled()
    })

    it("should not fall through to the unguarded upsert", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorld).not.toHaveBeenCalled()
    })
  })

  describe("when the response carries a version and settings for a world unknown here", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ title: "A New Title", settings_version: 7 }),
          { status: 200 }
        )
      )
    })

    it("should create the world from the fetched settings", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).toHaveBeenCalledWith(
        expect.objectContaining({ title: "A New Title" }),
        WORLDS_URL
      )
    })
  })

  describe("when the source predates the versioned contract and the event carries an access type", () => {
    beforeEach(() => {
      event = {
        ...event,
        metadata: {
          worldName: "example.dcl.eth",
          accessType: "shared-secret",
        },
      }
      // Legacy response shape: neither settings_version nor access_type
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ title: "A New Title" }), { status: 200 })
      )
    })

    it("should still mirror the visibility from the event payload", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).toHaveBeenCalledWith(
        expect.objectContaining({ is_private: true }),
        WORLDS_URL
      )
    })
  })

  describe("when the source predates the versioned contract and the event has no access type", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ title: "A New Title" }), { status: 200 })
      )
    })

    it("should leave the stored visibility untouched", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).toHaveBeenCalledWith(
        expect.objectContaining({ is_private: undefined }),
        WORLDS_URL
      )
    })
  })

  describe("when the source is versioned but the event payload disagrees about access", () => {
    beforeEach(() => {
      event = {
        ...event,
        metadata: {
          worldName: "example.dcl.eth",
          accessType: "shared-secret",
        },
      }
      // An existing row, so the write runs instead of being short-circuited by the creation guard
      findByWorldName.mockReset()
      findByWorldName.mockResolvedValueOnce(storedWorld)
      // Versioned response without access_type: the payload must not be used as a substitute
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ settings_version: 7 }), { status: 200 })
      )
    })

    it("should ignore the payload rather than apply visibility under an unrelated version", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).toHaveBeenCalledWith(
        expect.objectContaining({ is_private: undefined }),
        WORLDS_URL
      )
    })
  })

  describe("when the fetched settings have no settings version", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ title: "A New Title" }), { status: 200 })
      )
    })

    it("should apply last-write-wins while the row has never stored a version", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          world_name: "example.dcl.eth",
          title: "A New Title",
        }),
        WORLDS_URL
      )
    })
  })

  describe("when the fetched settings explicitly clear optional fields", () => {
    beforeEach(() => {
      findByWorldName.mockReset()
      findByWorldName.mockResolvedValueOnce(storedWorld)
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            skybox_time: null,
            categories: null,
            settings_version: 7,
          }),
          { status: 200 }
        )
      )
    })

    it("should clear the fixed skybox rather than preserve a value the source dropped", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).toHaveBeenCalledWith(
        expect.objectContaining({ skybox_time: null }),
        WORLDS_URL
      )
    })

    it("should clear the categories as an empty array, since the column cannot store null", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).toHaveBeenCalledWith(
        expect.objectContaining({ categories: [] }),
        WORLDS_URL
      )
    })
  })

  describe("when the fetched settings omit optional fields", () => {
    beforeEach(() => {
      // The "omitted means do not update" contract only matters against an existing row
      findByWorldName.mockReset()
      findByWorldName.mockResolvedValueOnce(storedWorld)
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ settings_version: 7 }), { status: 200 })
      )
    })

    it("should leave every omitted field undefined so nothing is cleared", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).toHaveBeenCalledWith(
        {
          world_name: "example.dcl.eth",
          title: undefined,
          description: undefined,
          content_rating: undefined,
          categories: undefined,
          image: undefined,
          show_in_places: undefined,
          single_player: undefined,
          skybox_time: undefined,
          is_private: undefined,
          settings_version: 7,
          settings_source: WORLDS_URL,
        },
        WORLDS_URL
      )
    })
  })

  describe("when the fetched title exceeds the column limit", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            title: "x".repeat(80),
            settings_version: 7,
          }),
          { status: 200 }
        )
      )
    })

    it("should truncate the title to 50 characters", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).toHaveBeenCalledWith(
        expect.objectContaining({ title: "x".repeat(50) }),
        WORLDS_URL
      )
    })
  })

  describe("when the fetched access type is restricted", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_type: "shared-secret", settings_version: 7 }),
          { status: 200 }
        )
      )
    })

    it("should mark the world as private", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).toHaveBeenCalledWith(
        expect.objectContaining({ is_private: true }),
        WORLDS_URL
      )
    })
  })

  describe("when the fetched access type is unrestricted", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_type: "unrestricted", settings_version: 7 }),
          { status: 200 }
        )
      )
    })

    it("should mark the world as public", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).toHaveBeenCalledWith(
        expect.objectContaining({ is_private: false }),
        WORLDS_URL
      )
    })
  })

  describe("when the event payload carries an access type that disagrees with the fetched one", () => {
    beforeEach(() => {
      event = {
        ...event,
        metadata: {
          worldName: "example.dcl.eth",
          accessType: "shared-secret",
        },
      }
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_type: "unrestricted", settings_version: 7 }),
          { status: 200 }
        )
      )
    })

    it("should trust the fetched access type instead of the payload", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).toHaveBeenCalledWith(
        expect.objectContaining({ is_private: false }),
        WORLDS_URL
      )
    })
  })

  describe("when the fetched settings omit the access type", () => {
    beforeEach(() => {
      findByWorldName.mockReset()
      findByWorldName.mockResolvedValueOnce(storedWorld)
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ settings_version: 7 }), { status: 200 })
      )
    })

    it("should leave the stored visibility untouched", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).toHaveBeenCalledWith(
        expect.objectContaining({ is_private: undefined }),
        WORLDS_URL
      )
    })
  })

  describe("when the guarded write is skipped because the stored version is newer", () => {
    beforeEach(() => {
      findByWorldName.mockReset()
      findByWorldName.mockResolvedValueOnce({
        ...storedWorld,
        content_rating: SceneContentRating.ADULT,
      })
      upsertWorldSettings.mockReset()
      upsertWorldSettings.mockResolvedValueOnce(null)
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content_rating: SceneContentRating.TEEN,
            settings_version: 7,
          }),
          { status: 200 }
        )
      )
    })

    it("should not notify moderators about a downgrade that was never applied", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(notifyDowngradeRating).not.toHaveBeenCalled()
    })
  })

  describe("when the settings source answers with a redirect", () => {
    beforeEach(() => {
      fetchMock.mockRejectedValueOnce(new TypeError("unexpected redirect"))
    })

    it("should rethrow so the message is retried instead of following it", async () => {
      await expect(
        handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)
      ).rejects.toThrow("unexpected redirect")
    })
  })

  describe("when the settings request is issued", () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ settings_version: 7 }), { status: 200 })
      )
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)
    })

    it("should refuse to follow redirects off the allowlisted host", () => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${WORLDS_URL}/world/example.dcl.eth/settings`,
        expect.objectContaining({ redirect: "error" })
      )
    })
  })

  describe("when the fetched rating downgrades the stored one", () => {
    beforeEach(() => {
      storedWorld = {
        ...storedWorld,
        content_rating: SceneContentRating.ADULT,
      }
      findByWorldName.mockReset()
      findByWorldName.mockResolvedValueOnce(storedWorld)
      // The statement preserves the stored rating, so the row it returns still carries it
      upsertWorldSettings.mockReset()
      upsertWorldSettings.mockResolvedValueOnce(storedWorld)
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content_rating: SceneContentRating.TEEN,
            settings_version: 7,
          }),
          { status: 200 }
        )
      )
    })

    it("should hand the fetched rating to the statement that enforces the rule", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).toHaveBeenCalledWith(
        expect.objectContaining({ content_rating: SceneContentRating.TEEN }),
        WORLDS_URL
      )
    })

    it("should notify moderators about the blocked downgrade", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(notifyDowngradeRating).toHaveBeenCalledWith(
        storedWorld,
        SceneContentRating.TEEN
      )
    })
  })

  describe("when the fetched rating upgrades the stored one", () => {
    beforeEach(() => {
      findByWorldName.mockReset()
      findByWorldName.mockResolvedValueOnce(storedWorld)
      // The statement applies the higher rating, so the row it returns carries it
      upsertWorldSettings.mockReset()
      upsertWorldSettings.mockResolvedValueOnce({
        ...storedWorld,
        content_rating: SceneContentRating.ADULT,
      })
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content_rating: SceneContentRating.ADULT,
            settings_version: 7,
          }),
          { status: 200 }
        )
      )
    })

    it("should apply the upgraded rating", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).toHaveBeenCalledWith(
        expect.objectContaining({ content_rating: SceneContentRating.ADULT }),
        WORLDS_URL
      )
    })

    it("should notify about the rating upgrade with the row as stored", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(notifyUpgradingRating).toHaveBeenCalledWith(
        expect.objectContaining({ content_rating: SceneContentRating.ADULT }),
        "Content Creator",
        SceneContentRating.ADULT
      )
    })
  })

  describe("when the fetched rating uses a legacy code", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content_rating: "M",
            settings_version: 7,
          }),
          { status: 200 }
        )
      )
    })

    it("should normalize the legacy code to the places scale", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).toHaveBeenCalledWith(
        expect.objectContaining({ content_rating: SceneContentRating.ADULT }),
        WORLDS_URL
      )
    })
  })

  describe("when the fetched rating is an unknown code", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content_rating: "garbage",
            settings_version: 7,
          }),
          { status: 200 }
        )
      )
    })

    it("should leave the rating out of the update instead of persisting it", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(upsertWorldSettings).toHaveBeenCalledWith(
        expect.objectContaining({ content_rating: undefined }),
        WORLDS_URL
      )
    })

    it("should not notify moderators about a downgrade", async () => {
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)

      expect(notifyDowngradeRating).not.toHaveBeenCalled()
    })
  })

  describe("when the configured worlds content server is not a bare origin", () => {
    it("should throw a configuration error so the message is retried", async () => {
      await expect(
        handleWorldSettingsChanged(event, `${WORLDS_URL}/worlds`, ALLOWED_HOSTS)
      ).rejects.toThrow(ContentServerConfigurationError)
    })
  })

  describe("when the event names its source worlds server", () => {
    let sourceUrl: string
    let allowedHosts: string

    beforeEach(() => {
      sourceUrl = "https://worlds.example.org/"
      allowedHosts = `${ALLOWED_HOSTS},worlds.example.org`
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            title: "From the source",
            thumbnail_hash: "bafkreithumb",
            settings_version: 2,
          }),
          { status: 200 }
        )
      )
    })

    describe("and its host is allowlisted", () => {
      beforeEach(async () => {
        await handleWorldSettingsChanged(
          event,
          WORLDS_URL,
          allowedHosts,
          sourceUrl
        )
      })

      it("should read the settings from that server", () => {
        expect(fetchMock).toHaveBeenCalledWith(
          "https://worlds.example.org/world/example.dcl.eth/settings",
          expect.anything()
        )
      })

      it("should point the thumbnail at that server", () => {
        expect(upsertWorldSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            image: "https://worlds.example.org/contents/bafkreithumb",
          }),
          WORLDS_URL
        )
      })

      it("should store the settings as coming from that server", () => {
        expect(upsertWorldSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            settings_version: 2,
            settings_source: "https://worlds.example.org",
          }),
          WORLDS_URL
        )
      })
    })

    describe("and its host is not allowlisted", () => {
      let result: Promise<void>

      beforeEach(() => {
        result = handleWorldSettingsChanged(
          event,
          WORLDS_URL,
          ALLOWED_HOSTS,
          sourceUrl
        )
      })

      it("should reject the event as invalid so it is discarded", async () => {
        await expect(result).rejects.toThrow(InvalidWorldSqsMessageError)
      })

      it("should not fall back to the configured server", async () => {
        await result.catch(() => undefined)
        expect(fetchMock).not.toHaveBeenCalled()
      })
    })

    describe("and the world has no enabled scene", () => {
      beforeEach(() => {
        isNewestWorldSceneFrom.mockResolvedValueOnce(null)
      })

      describe("and its stored settings come from that server", () => {
        beforeEach(async () => {
          findByWorldName.mockResolvedValue({
            ...storedWorld,
            settings_source: "https://worlds.example.org",
          })
          await handleWorldSettingsChanged(
            event,
            WORLDS_URL,
            allowedHosts,
            sourceUrl
          )
        })

        it("should apply the settings", () => {
          expect(upsertWorldSettings).toHaveBeenCalled()
        })
      })

      describe("and its stored settings predate recording their server", () => {
        beforeEach(async () => {
          findByWorldName.mockResolvedValue({
            ...storedWorld,
            settings_source: null,
          })
          await handleWorldSettingsChanged(
            event,
            WORLDS_URL,
            allowedHosts,
            sourceUrl
          )
        })

        it("should leave them to the configured server", () => {
          expect(upsertWorldSettings).not.toHaveBeenCalled()
        })
      })

      describe("and its stored settings come from another server", () => {
        beforeEach(async () => {
          findByWorldName.mockResolvedValue({
            ...storedWorld,
            settings_source: "https://worlds-content-server.dcl.dev",
          })
          await handleWorldSettingsChanged(
            event,
            WORLDS_URL,
            allowedHosts,
            sourceUrl
          )
        })

        it("should leave the stored settings alone", () => {
          expect(upsertWorldSettings).not.toHaveBeenCalled()
        })
      })
    })

    describe("and the world's newest scene is on another server", () => {
      beforeEach(async () => {
        isNewestWorldSceneFrom.mockResolvedValueOnce(false)
        await handleWorldSettingsChanged(
          event,
          WORLDS_URL,
          allowedHosts,
          sourceUrl
        )
      })

      it("should leave the stored settings alone", () => {
        expect(upsertWorldSettings).not.toHaveBeenCalled()
      })
    })
  })
})
