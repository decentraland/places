import supertest from "supertest"

import { handleWorldSettingsChanged } from "../../src/entities/CheckScenes/task/handleWorldSettingsChanged"
import * as SlackUtils from "../../src/entities/Slack/utils"
import { createWorldSettingsChangedEvent } from "../fixtures/worldSettingsEvent"
import { cleanTables, closeTestDb, initTestDb } from "../setup/db"
import { createTestApp } from "../setup/server"

// Mock Slack notifications to prevent HTTP calls during tests
jest.mock("../../src/entities/Slack/utils", () => ({
  notifyDowngradeRating: jest.fn(),
  notifyUpgradingRating: jest.fn(),
  notifyError: jest.fn(),
  notifyNewPlace: jest.fn(),
  notifyUpdatePlace: jest.fn(),
  notifyDisablePlaces: jest.fn(),
}))

// Mock modules with persistent timers to prevent Jest from hanging
jest.mock("../../src/modules/hotScenes", () => ({
  getHotScenes: jest.fn().mockReturnValue([]),
}))
jest.mock("../../src/modules/sceneStats", () => ({
  getSceneStats: jest.fn().mockResolvedValue({}),
}))
jest.mock("../../src/modules/worldsLiveData", () => ({
  getWorldsLiveData: jest.fn().mockResolvedValue({
    perWorld: [],
    totalUsers: 0,
  }),
}))

const app = createTestApp()

// The handler treats the event as a trigger and fetches the authoritative settings from
// worlds-content-server, so each scenario stubs the GET /world/:name/settings response.
const WORLDS_URL = "https://worlds-content-server.decentraland.org"
const ALLOWED_HOSTS = "worlds-content-server.decentraland.org"

describe("handleWorldSettingsChanged integration", () => {
  let fetchMock: jest.SpyInstance

  const mockSettingsResponse = (settings: Record<string, unknown>) => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(settings), { status: 200 })
    )
  }

  beforeAll(async () => {
    await initTestDb()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  beforeEach(() => {
    fetchMock = jest.spyOn(global, "fetch")
  })

  afterEach(async () => {
    await cleanTables()
    fetchMock.mockRestore()
    jest.clearAllMocks()
  })

  describe("when a WorldSettingsChangedEvent is received for a new world", () => {
    beforeEach(async () => {
      mockSettingsResponse({
        title: "New World",
        description: "A brand new world",
        content_rating: "T",
        categories: ["art"],
        show_in_places: true,
        single_player: false,
        settings_version: 2,
      })
      const event = createWorldSettingsChangedEvent({
        key: "newworld.dcl.eth",
        metadata: { worldName: "newworld.dcl.eth" },
      })
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)
    })

    it("should create the world queryable via API with the fetched settings", async () => {
      const response = await supertest(app)
        .get("/api/worlds/newworld.dcl.eth")
        .expect(200)

      expect(response.body.ok).toBe(true)
      expect(response.body.data.title).toBe("New World")
      expect(response.body.data.description).toBe("A brand new world")
      expect(response.body.data.content_rating).toBe("T")
      expect(response.body.data.categories).toEqual(["art"])
      expect(response.body.data.show_in_places).toBe(true)
      expect(response.body.data.single_player).toBe(false)
    })
  })

  describe("when the world is unknown to the worlds content server", () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
      const event = createWorldSettingsChangedEvent({
        key: "ghostworld.dcl.eth",
        metadata: { worldName: "ghostworld.dcl.eth" },
      })
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)
    })

    it("should not create any world record", async () => {
      await supertest(app).get("/api/worlds/ghostworld.dcl.eth").expect(404)
    })
  })

  describe("when a WorldSettingsChangedEvent is received for an existing world", () => {
    beforeEach(async () => {
      mockSettingsResponse({
        title: "Original Title",
        description: "Original Description",
        content_rating: "T",
        categories: ["game"],
        show_in_places: true,
        settings_version: 2,
      })
      const initialEvent = createWorldSettingsChangedEvent({
        key: "existingworld.dcl.eth",
        metadata: { worldName: "existingworld.dcl.eth" },
      })
      await handleWorldSettingsChanged(initialEvent, WORLDS_URL, ALLOWED_HOSTS)
    })

    describe("and the fetched settings carry a newer version", () => {
      beforeEach(async () => {
        mockSettingsResponse({
          title: "Updated Title",
          description: "Updated Description",
          content_rating: "T",
          categories: ["game", "art"],
          settings_version: 3,
        })
        const updateEvent = createWorldSettingsChangedEvent({
          key: "existingworld.dcl.eth",
          metadata: { worldName: "existingworld.dcl.eth" },
        })
        await handleWorldSettingsChanged(updateEvent, WORLDS_URL, ALLOWED_HOSTS)
      })

      it("should update the world settings", async () => {
        const response = await supertest(app)
          .get("/api/worlds/existingworld.dcl.eth")
          .expect(200)

        expect(response.body.data.title).toBe("Updated Title")
        expect(response.body.data.description).toBe("Updated Description")
        expect(response.body.data.categories).toEqual(["game", "art"])
      })
    })

    describe("and the fetched settings carry an older version than the one already applied", () => {
      beforeEach(async () => {
        mockSettingsResponse({
          title: "Stale Title",
          description: "Stale Description",
          settings_version: 1,
        })
        const staleEvent = createWorldSettingsChangedEvent({
          key: "existingworld.dcl.eth",
          metadata: { worldName: "existingworld.dcl.eth" },
        })
        await handleWorldSettingsChanged(staleEvent, WORLDS_URL, ALLOWED_HOSTS)
      })

      it("should keep the settings that were already applied", async () => {
        const response = await supertest(app)
          .get("/api/worlds/existingworld.dcl.eth")
          .expect(200)

        expect(response.body.data.title).toBe("Original Title")
        expect(response.body.data.description).toBe("Original Description")
      })
    })

    describe("and the fetched description contains client-rendered markup", () => {
      beforeEach(async () => {
        mockSettingsResponse({
          description:
            'Join <link="decentraland://?position=0,0">here</link> and <link="https://decentraland.org">site</link>',
          settings_version: 3,
        })
        const markupEvent = createWorldSettingsChangedEvent({
          key: "existingworld.dcl.eth",
          metadata: { worldName: "existingworld.dcl.eth" },
        })
        await handleWorldSettingsChanged(markupEvent, WORLDS_URL, ALLOWED_HOSTS)
      })

      it("should strip the unsafe link and keep the safe one", async () => {
        const response = await supertest(app)
          .get("/api/worlds/existingworld.dcl.eth")
          .expect(200)

        expect(response.body.data.description).toBe(
          'Join here and <link="https://decentraland.org">site</link>'
        )
      })
    })

    describe("and the fetched rating upgrades the stored one", () => {
      beforeEach(async () => {
        mockSettingsResponse({
          content_rating: "A",
          settings_version: 3,
        })
        const upgradeEvent = createWorldSettingsChangedEvent({
          key: "existingworld.dcl.eth",
          metadata: { worldName: "existingworld.dcl.eth" },
        })
        await handleWorldSettingsChanged(
          upgradeEvent,
          WORLDS_URL,
          ALLOWED_HOSTS
        )
      })

      it("should update the content_rating", async () => {
        const response = await supertest(app)
          .get("/api/worlds/existingworld.dcl.eth")
          .expect(200)

        expect(response.body.data.content_rating).toBe("A")
      })
    })

    describe("and the fetched rating downgrades the stored one", () => {
      beforeEach(async () => {
        mockSettingsResponse({
          content_rating: "RP",
          settings_version: 3,
        })
        const downgradeEvent = createWorldSettingsChangedEvent({
          key: "existingworld.dcl.eth",
          metadata: { worldName: "existingworld.dcl.eth" },
        })
        await handleWorldSettingsChanged(
          downgradeEvent,
          WORLDS_URL,
          ALLOWED_HOSTS
        )
      })

      it("should preserve the original rating", async () => {
        const response = await supertest(app)
          .get("/api/worlds/existingworld.dcl.eth")
          .expect(200)

        expect(response.body.data.content_rating).toBe("T")
      })

      it("should call notifyDowngradeRating with the world entity (world_name defined, not undefined base_position)", () => {
        expect(SlackUtils.notifyDowngradeRating).toHaveBeenCalledWith(
          expect.objectContaining({
            world_name: "existingworld.dcl.eth",
            show_in_places: expect.anything(),
          }),
          expect.any(String)
        )
      })
    })

    describe("and the fetched rating is absent", () => {
      beforeEach(async () => {
        mockSettingsResponse({
          title: "Ratingless Update",
          settings_version: 3,
        })
        const noRatingEvent = createWorldSettingsChangedEvent({
          key: "existingworld.dcl.eth",
          metadata: { worldName: "existingworld.dcl.eth" },
        })
        await handleWorldSettingsChanged(
          noRatingEvent,
          WORLDS_URL,
          ALLOWED_HOSTS
        )
      })

      it("should keep the stored rating untouched", async () => {
        const response = await supertest(app)
          .get("/api/worlds/existingworld.dcl.eth")
          .expect(200)

        expect(response.body.data.content_rating).toBe("T")
      })

      it("should not report a downgrade attempt", () => {
        expect(SlackUtils.notifyDowngradeRating).not.toHaveBeenCalled()
      })
    })
  })

  describe("when the fetched settings omit the thumbnail for an existing world that has an image", () => {
    beforeEach(async () => {
      mockSettingsResponse({
        title: "Image World",
        thumbnail_hash: "bafkreithumb",
        settings_version: 2,
      })
      const createEvent = createWorldSettingsChangedEvent({
        key: "imageworld.dcl.eth",
        metadata: { worldName: "imageworld.dcl.eth" },
      })
      await handleWorldSettingsChanged(createEvent, WORLDS_URL, ALLOWED_HOSTS)

      mockSettingsResponse({
        title: "Image World Updated",
        settings_version: 3,
      })
      const updateEvent = createWorldSettingsChangedEvent({
        key: "imageworld.dcl.eth",
        metadata: { worldName: "imageworld.dcl.eth" },
      })
      await handleWorldSettingsChanged(updateEvent, WORLDS_URL, ALLOWED_HOSTS)
    })

    it("should preserve the existing image instead of clearing it", async () => {
      const response = await supertest(app)
        .get("/api/worlds/imageworld.dcl.eth")
        .expect(200)

      expect(response.body.data.image).toBe(
        `${WORLDS_URL}/contents/bafkreithumb`
      )
    })
  })

  describe("when the fetched thumbnail hash contains HTML-breakout characters", () => {
    beforeEach(async () => {
      mockSettingsResponse({
        title: "XSS World",
        thumbnail_hash: `a"><script>alert(1)</script><meta name="x`,
        settings_version: 2,
      })
      const event = createWorldSettingsChangedEvent({
        key: "xssworld.dcl.eth",
        metadata: { worldName: "xssworld.dcl.eth" },
      })
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)
    })

    it("should never store raw markup-breakout characters in the world image", async () => {
      const response = await supertest(app)
        .get("/api/worlds/xssworld.dcl.eth")
        .expect(200)

      expect(response.body.data.image).not.toMatch(/["<>]/)
    })
  })

  describe("when the event is missing the world name", () => {
    let event: ReturnType<typeof createWorldSettingsChangedEvent>

    beforeEach(async () => {
      event = createWorldSettingsChangedEvent()
      delete (event.metadata as Partial<typeof event.metadata>).worldName
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)
    })

    it("should not fetch any settings", () => {
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe("when the event says the access type is not 'unrestricted' (restricted world)", () => {
    beforeEach(async () => {
      mockSettingsResponse({
        title: "Private World",
        description: "A restricted world",
        settings_version: 2,
      })
      const event = createWorldSettingsChangedEvent({
        key: "privateworld.dcl.eth",
        metadata: {
          worldName: "privateworld.dcl.eth",
          accessType: "restricted",
        },
      })
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)
    })

    it("should create the world with is_private set to true", async () => {
      const response = await supertest(app)
        .get("/api/worlds/privateworld.dcl.eth")
        .expect(200)

      expect(response.body.ok).toBe(true)
      expect(response.body.data.is_private).toBe(true)
    })
  })

  describe("when the event says the access type is 'unrestricted' (public world)", () => {
    beforeEach(async () => {
      mockSettingsResponse({
        title: "Public World",
        settings_version: 2,
      })
      const event = createWorldSettingsChangedEvent({
        key: "publicworld.dcl.eth",
        metadata: {
          worldName: "publicworld.dcl.eth",
          accessType: "unrestricted",
        },
      })
      await handleWorldSettingsChanged(event, WORLDS_URL, ALLOWED_HOSTS)
    })

    it("should create the world with is_private set to false", async () => {
      const response = await supertest(app)
        .get("/api/worlds/publicworld.dcl.eth")
        .expect(200)

      expect(response.body.ok).toBe(true)
      expect(response.body.data.is_private).toBe(false)
    })
  })

  describe("when an existing restricted world receives a settings event without access type", () => {
    beforeEach(async () => {
      mockSettingsResponse({
        title: "Private World",
        settings_version: 2,
      })
      const createEvent = createWorldSettingsChangedEvent({
        key: "stayprivate.dcl.eth",
        metadata: {
          worldName: "stayprivate.dcl.eth",
          accessType: "restricted",
        },
      })
      await handleWorldSettingsChanged(createEvent, WORLDS_URL, ALLOWED_HOSTS)

      mockSettingsResponse({
        title: "Private World Renamed",
        settings_version: 3,
      })
      const settingsOnlyEvent = createWorldSettingsChangedEvent({
        key: "stayprivate.dcl.eth",
        metadata: { worldName: "stayprivate.dcl.eth" },
      })
      await handleWorldSettingsChanged(
        settingsOnlyEvent,
        WORLDS_URL,
        ALLOWED_HOSTS
      )
    })

    it("should keep the world private instead of resetting is_private", async () => {
      const response = await supertest(app)
        .get("/api/worlds/stayprivate.dcl.eth")
        .expect(200)

      expect(response.body.data.is_private).toBe(true)
    })

    it("should still apply the fetched settings", async () => {
      const response = await supertest(app)
        .get("/api/worlds/stayprivate.dcl.eth")
        .expect(200)

      expect(response.body.data.title).toBe("Private World Renamed")
    })
  })

  describe("when an existing restricted world changes to unrestricted", () => {
    beforeEach(async () => {
      mockSettingsResponse({
        title: "Toggle World",
        settings_version: 2,
      })
      const createEvent = createWorldSettingsChangedEvent({
        key: "toggleworld.dcl.eth",
        metadata: {
          worldName: "toggleworld.dcl.eth",
          accessType: "restricted",
        },
      })
      await handleWorldSettingsChanged(createEvent, WORLDS_URL, ALLOWED_HOSTS)

      mockSettingsResponse({
        title: "Toggle World",
        settings_version: 3,
      })
      const makePublicEvent = createWorldSettingsChangedEvent({
        key: "toggleworld.dcl.eth",
        metadata: {
          worldName: "toggleworld.dcl.eth",
          accessType: "unrestricted",
        },
      })
      await handleWorldSettingsChanged(
        makePublicEvent,
        WORLDS_URL,
        ALLOWED_HOSTS
      )
    })

    it("should update is_private to false", async () => {
      const response = await supertest(app)
        .get("/api/worlds/toggleworld.dcl.eth")
        .expect(200)

      expect(response.body.data.is_private).toBe(false)
    })
  })
})
