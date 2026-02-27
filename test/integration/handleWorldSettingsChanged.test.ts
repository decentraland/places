import supertest from "supertest"

import { handleWorldSettingsChanged } from "../../src/entities/CheckScenes/task/handleWorldSettingsChanged"
import {
  createWorldSettingsChangedEvent,
  createWorldSettingsDowngradeRatingEvent,
  createWorldSettingsEventMissingKey,
  createWorldSettingsUpgradeRatingEvent,
} from "../fixtures/worldSettingsEvent"
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

describe("handleWorldSettingsChanged integration", () => {
  beforeAll(async () => {
    await initTestDb()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  afterEach(async () => {
    await cleanTables()
  })

  describe("when a WorldSettingsChangedEvent is received for a new world", () => {
    beforeEach(async () => {
      const event = createWorldSettingsChangedEvent({
        key: "newworld.dcl.eth",
        metadata: {
          worldName: "newworld.dcl.eth",
          title: "New World",
          description: "A brand new world",
          contentRating: "T",
          categories: ["art"],
          showInPlaces: true,
          singlePlayer: false,
          skyboxTime: null,
          thumbnailUrl: "https://example.com/thumb.png",
        },
      })
      await handleWorldSettingsChanged(event)
    })

    it("should create the world queryable via API with the provided settings", async () => {
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

  describe("when a WorldSettingsChangedEvent is received for an existing world", () => {
    beforeEach(async () => {
      const initialEvent = createWorldSettingsChangedEvent({
        key: "existingworld.dcl.eth",
        metadata: {
          worldName: "existingworld.dcl.eth",
          title: "Original Title",
          description: "Original Description",
          contentRating: "T",
          categories: ["game"],
          showInPlaces: true,
        },
      })
      await handleWorldSettingsChanged(initialEvent)
    })

    describe("and the settings are updated", () => {
      beforeEach(async () => {
        const updateEvent = createWorldSettingsChangedEvent({
          key: "existingworld.dcl.eth",
          metadata: {
            worldName: "existingworld.dcl.eth",
            title: "Updated Title",
            description: "Updated Description",
            contentRating: "T",
            categories: ["game", "art"],
          },
        })
        await handleWorldSettingsChanged(updateEvent)
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

    describe("and the rating is upgraded", () => {
      beforeEach(async () => {
        const upgradeEvent = createWorldSettingsUpgradeRatingEvent(
          "existingworld.dcl.eth"
        )
        await handleWorldSettingsChanged(upgradeEvent)
      })

      it("should update the content_rating", async () => {
        const response = await supertest(app)
          .get("/api/worlds/existingworld.dcl.eth")
          .expect(200)

        expect(response.body.data.content_rating).toBe("A")
      })
    })

    describe("and the rating is downgraded", () => {
      beforeEach(async () => {
        const downgradeEvent = createWorldSettingsDowngradeRatingEvent(
          "existingworld.dcl.eth"
        )
        await handleWorldSettingsChanged(downgradeEvent)
      })

      it("should preserve the original rating", async () => {
        const response = await supertest(app)
          .get("/api/worlds/existingworld.dcl.eth")
          .expect(200)

        expect(response.body.data.content_rating).toBe("T")
      })
    })
  })

  describe("when the event is missing the world name (key)", () => {
    beforeEach(async () => {
      const event = createWorldSettingsEventMissingKey()
      await handleWorldSettingsChanged(event)
    })

    it("should not create any world record", async () => {
      const response = await supertest(app).get("/api/worlds").expect(200)

      expect(response.body.data).toHaveLength(0)
    })
  })

  describe("when accessType is not 'unrestricted' (restricted world)", () => {
    beforeEach(async () => {
      const event = createWorldSettingsChangedEvent({
        key: "privateworld.dcl.eth",
        metadata: {
          worldName: "privateworld.dcl.eth",
          title: "Private World",
          description: "A restricted world",
          accessType: "restricted",
        },
      })
      await handleWorldSettingsChanged(event)
    })

    it("should create the world with is_private set to true", async () => {
      const response = await supertest(app)
        .get("/api/worlds/privateworld.dcl.eth")
        .expect(200)

      expect(response.body.ok).toBe(true)
      expect(response.body.data.is_private).toBe(true)
    })
  })

  describe("when accessType is 'unrestricted' (public world)", () => {
    beforeEach(async () => {
      const event = createWorldSettingsChangedEvent({
        key: "publicworld.dcl.eth",
        metadata: {
          worldName: "publicworld.dcl.eth",
          title: "Public World",
          description: "An unrestricted world",
          accessType: "unrestricted",
        },
      })
      await handleWorldSettingsChanged(event)
    })

    it("should create the world with is_private set to false", async () => {
      const response = await supertest(app)
        .get("/api/worlds/publicworld.dcl.eth")
        .expect(200)

      expect(response.body.ok).toBe(true)
      expect(response.body.data.is_private).toBe(false)
    })
  })

  describe("when an existing public world changes to restricted", () => {
    beforeEach(async () => {
      const createEvent = createWorldSettingsChangedEvent({
        key: "existingworld2.dcl.eth",
        metadata: {
          worldName: "existingworld2.dcl.eth",
          title: "Existing World",
          description: "A public world",
          accessType: "unrestricted",
        },
      })
      await handleWorldSettingsChanged(createEvent)

      const restrictEvent = createWorldSettingsChangedEvent({
        key: "existingworld2.dcl.eth",
        metadata: {
          worldName: "existingworld2.dcl.eth",
          accessType: "restricted",
        },
      })
      await handleWorldSettingsChanged(restrictEvent)
    })

    it("should update is_private to true", async () => {
      const response = await supertest(app)
        .get("/api/worlds/existingworld2.dcl.eth")
        .expect(200)

      expect(response.body.data.is_private).toBe(true)
    })

    it("should preserve existing world settings", async () => {
      const response = await supertest(app)
        .get("/api/worlds/existingworld2.dcl.eth")
        .expect(200)

      expect(response.body.data.title).toBe("Existing World")
      expect(response.body.data.description).toBe("A public world")
    })
  })

  describe("when an existing restricted world changes to unrestricted", () => {
    beforeEach(async () => {
      const createEvent = createWorldSettingsChangedEvent({
        key: "toggleworld.dcl.eth",
        metadata: {
          worldName: "toggleworld.dcl.eth",
          title: "Toggle World",
          accessType: "restricted",
        },
      })
      await handleWorldSettingsChanged(createEvent)

      const makePublicEvent = createWorldSettingsChangedEvent({
        key: "toggleworld.dcl.eth",
        metadata: {
          worldName: "toggleworld.dcl.eth",
          accessType: "unrestricted",
        },
      })
      await handleWorldSettingsChanged(makePublicEvent)
    })

    it("should update is_private to false", async () => {
      const response = await supertest(app)
        .get("/api/worlds/toggleworld.dcl.eth")
        .expect(200)

      expect(response.body.data.is_private).toBe(false)
    })
  })

  describe("when accessType is not present in metadata", () => {
    beforeEach(async () => {
      const event = createWorldSettingsChangedEvent({
        key: "defaultworld.dcl.eth",
        metadata: {
          worldName: "defaultworld.dcl.eth",
          title: "Default World",
          description: "World created without access type",
        },
      })
      await handleWorldSettingsChanged(event)
    })

    it("should default is_private to false", async () => {
      const response = await supertest(app)
        .get("/api/worlds/defaultworld.dcl.eth")
        .expect(200)

      expect(response.body.ok).toBe(true)
      expect(response.body.data.is_private).toBe(false)
    })
  })
})
