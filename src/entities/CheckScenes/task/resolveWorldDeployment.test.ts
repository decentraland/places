import {
  ContentEntityScene,
  SceneContentRating,
} from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { WorldDeploymentDecision } from "./deploymentDecision"
import { resolveWorldDeployment } from "./resolveWorldDeployment"
import { contentEntitySceneGenesisPlaza } from "../../../__data__/contentEntitySceneGenesisPlaza"
import { placeGenesisPlaza } from "../../../__data__/placeGenesisPlaza"
import PlaceModel from "../../Place/model"
import { DisabledReason, PlaceAttributes } from "../../Place/types"
import WorldModel from "../../World/model"
import { WorldAttributes } from "../../World/types"
import WorldDeploymentPositionWatermarkModel from "../../WorldDeploymentPositionWatermark/model"
import WorldSceneUndeploymentModel from "../../WorldSceneUndeployment/model"
import WorldUndeploymentModel from "../../WorldUndeployment/model"

function createWorldScene(options: {
  optOut?: boolean
  parcels?: string[]
  timestamp?: number
  title?: string
  worldName?: string
}): ContentEntityScene {
  const worldName = options.worldName ?? "example.dcl.eth"
  const parcels = options.parcels ?? ["0,0"]

  return {
    ...contentEntitySceneGenesisPlaza,
    pointers: parcels,
    timestamp: options.timestamp ?? Date.parse("2026-08-03T12:00:00.000Z"),
    metadata: {
      ...contentEntitySceneGenesisPlaza.metadata,
      display: {
        ...contentEntitySceneGenesisPlaza.metadata.display,
        title: options.title ?? "World Scene",
      },
      scene: {
        base: parcels[0],
        parcels,
      },
      worldConfiguration: {
        name: worldName,
        ...(options.optOut ? { placesConfig: { optOut: true } } : {}),
      },
    },
  }
}

function createWorldPlace(options: {
  id: string
  position: string
  title: string
}): PlaceAttributes {
  return {
    ...placeGenesisPlaza,
    id: options.id,
    title: options.title,
    base_position: options.position,
    positions: [options.position],
    world: true,
    world_id: "example.dcl.eth",
    world_name: "example.dcl.eth",
    deployment_id: `deployment-${options.id}`,
  }
}

describe("when resolving a world deployment", () => {
  let contentEntityScene: ContentEntityScene
  let decision: WorldDeploymentDecision
  let existingPlace: PlaceAttributes
  let secondExistingPlace: PlaceAttributes
  let world: WorldAttributes
  let input: Parameters<typeof resolveWorldDeployment>[0]
  let findActiveByWorldIdAndPositions: jest.SpyInstance
  let hasNewerActiveWorldDeployment: jest.SpyInstance
  let hasSupersedingPositionWatermark: jest.SpyInstance
  let insertWorldIfNotExists: jest.SpyInstance
  let lockWorldForDeployment: jest.SpyInstance
  let findSupersedingSceneUndeployment: jest.SpyInstance
  let findSupersedingWorldUndeployment: jest.SpyInstance
  let upsertWorld: jest.SpyInstance

  beforeEach(() => {
    contentEntityScene = createWorldScene({})
    existingPlace = createWorldPlace({
      id: "place-a",
      position: "0,0",
      title: "Existing Scene",
    })
    secondExistingPlace = createWorldPlace({
      id: "place-b",
      position: "1,0",
      title: "Second Existing Scene",
    })
    world = {
      id: "example.dcl.eth",
      world_name: "Example.DCL.ETH",
      title: "World Scene",
      description: null,
      image: null,
      content_rating: SceneContentRating.RATING_PENDING,
      categories: [],
      owner: "0xowner",
      show_in_places: true,
      single_player: false,
      skybox_time: null,
      is_private: false,
      highlighted: false,
      highlighted_image: null,
      ranking: 0,
      likes: 0,
      dislikes: 0,
      favorites: 0,
      like_rate: 0.5,
      like_score: 0,
      created_at: new Date("2026-08-03T12:00:00.000Z"),
      updated_at: new Date("2026-08-03T12:00:00.000Z"),
    }
    input = {
      contentEntityScene,
      contentServerUrl: "https://worlds-content-server.decentraland.org",
      creator: "0xcreator",
      deploymentId: "deployment-current",
      nameOwner: "0xowner",
      sdk: "7",
      worldName: "Example.DCL.ETH",
    }

    lockWorldForDeployment = jest
      .spyOn(WorldModel, "lockWorldForDeployment")
      .mockResolvedValue()
    findActiveByWorldIdAndPositions = jest
      .spyOn(PlaceModel, "findActiveByWorldIdAndPositions")
      .mockResolvedValue([])
    hasNewerActiveWorldDeployment = jest
      .spyOn(PlaceModel, "hasNewerActiveWorldDeployment")
      .mockResolvedValue(false)
    findSupersedingWorldUndeployment = jest
      .spyOn(WorldUndeploymentModel, "findSupersedingUndeployment")
      .mockResolvedValue(null)
    findSupersedingSceneUndeployment = jest
      .spyOn(WorldSceneUndeploymentModel, "findSupersedingUndeployment")
      .mockResolvedValue(null)
    hasSupersedingPositionWatermark = jest
      .spyOn(WorldDeploymentPositionWatermarkModel, "hasSupersedingDeployment")
      .mockResolvedValue(false)
    insertWorldIfNotExists = jest
      .spyOn(WorldModel, "insertWorldIfNotExists")
      .mockResolvedValue("example.dcl.eth")
    upsertWorld = jest.spyOn(WorldModel, "upsertWorld").mockResolvedValue(world)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("and a newer position watermark supersedes it", () => {
    beforeEach(async () => {
      findActiveByWorldIdAndPositions.mockResolvedValueOnce([existingPlace])
      hasSupersedingPositionWatermark.mockResolvedValueOnce(true)

      decision = await resolveWorldDeployment(input)
    })

    it("should avoid creating or updating a place", () => {
      expect(decision.placesToProcess).toBeNull()
    })

    it("should return the overlapping place as a strict replacement candidate", () => {
      expect(decision.replacement).toEqual({
        candidates: [existingPlace],
        includesTimestampTies: false,
        updatedPlace: null,
      })
    })

    it("should return the complete deployment footprint as watermark intent", () => {
      expect(decision.positionWatermark).toEqual({
        worldId: "example.dcl.eth",
        positions: ["0,0"],
        deployedAt: new Date(contentEntityScene.timestamp),
      })
    })

    it("should not create a world row for the superseded deployment", () => {
      expect(insertWorldIfNotExists).not.toHaveBeenCalled()
    })
  })

  describe("and it does not overlap an existing place", () => {
    beforeEach(async () => {
      decision = await resolveWorldDeployment(input)
    })

    it("should return a new place mutation", () => {
      expect(decision.placesToProcess).toMatchObject({
        new: {
          title: "World Scene",
          world_id: "example.dcl.eth",
          deployment_id: "deployment-current",
        },
      })
    })

    it("should return an inclusive replacement intent with no candidates", () => {
      expect(decision.replacement).toEqual({
        candidates: [],
        includesTimestampTies: true,
        updatedPlace: null,
      })
    })

    it("should create the world after the deployment is accepted", () => {
      expect(insertWorldIfNotExists).toHaveBeenCalledWith(
        expect.objectContaining({
          world_name: "Example.DCL.ETH",
          show_in_places: true,
        })
      )
    })

    it("should synchronize the resolved world owner", () => {
      expect(upsertWorld).toHaveBeenCalledWith({
        world_name: "Example.DCL.ETH",
        owner: "0xowner",
      })
    })
  })

  describe("and it overlaps exactly one existing place", () => {
    beforeEach(async () => {
      findActiveByWorldIdAndPositions.mockResolvedValueOnce([existingPlace])

      decision = await resolveWorldDeployment(input)
    })

    it("should return an update that preserves the existing place identity", () => {
      expect(decision.placesToProcess).toMatchObject({
        update: {
          id: "place-a",
          deployment_id: "deployment-current",
        },
      })
    })

    it("should return the previous place for a tombstone after a successful update", () => {
      expect(decision.replacement.updatedPlace).toBe(existingPlace)
    })

    it("should not return bulk replacement candidates", () => {
      expect(decision.replacement).toEqual({
        candidates: [],
        includesTimestampTies: false,
        updatedPlace: existingPlace,
      })
    })
  })

  describe("and it overlaps multiple existing places", () => {
    beforeEach(async () => {
      contentEntityScene = createWorldScene({ parcels: ["0,0", "1,0"] })
      input = { ...input, contentEntityScene }
      findActiveByWorldIdAndPositions.mockResolvedValueOnce([
        existingPlace,
        secondExistingPlace,
      ])

      decision = await resolveWorldDeployment(input)
    })

    it("should return a new place mutation spanning the deployment footprint", () => {
      expect(decision.placesToProcess).toMatchObject({
        new: { positions: ["0,0", "1,0"] },
      })
    })

    it("should return every overlap as an inclusive replacement candidate", () => {
      expect(decision.replacement).toEqual({
        candidates: [existingPlace, secondExistingPlace],
        includesTimestampTies: true,
        updatedPlace: null,
      })
    })
  })

  describe("and the world opted out of Places", () => {
    beforeEach(async () => {
      contentEntityScene = createWorldScene({ optOut: true })
      input = { ...input, contentEntityScene }

      decision = await resolveWorldDeployment(input)
    })

    it("should return the new place disabled with the opt-out reason", () => {
      expect(decision.placesToProcess).toMatchObject({
        new: {
          disabled: true,
          disabled_reason: DisabledReason.OPT_OUT,
        },
      })
    })

    it("should keep the world hidden from Places", () => {
      expect(insertWorldIfNotExists).toHaveBeenCalledWith(
        expect.objectContaining({ show_in_places: false })
      )
    })
  })

  describe("and the world has no resolved owner", () => {
    beforeEach(async () => {
      input = { ...input, nameOwner: null }

      decision = await resolveWorldDeployment(input)
    })

    it("should not issue an owner update", () => {
      expect(upsertWorld).not.toHaveBeenCalled()
    })
  })

  describe("and acquiring the world lock", () => {
    beforeEach(async () => {
      decision = await resolveWorldDeployment(input)
    })

    it("should serialize decisions using the normalized world identity", () => {
      expect(lockWorldForDeployment).toHaveBeenCalledWith("Example.DCL.ETH")
    })
  })

  describe("and checking stale state", () => {
    beforeEach(async () => {
      decision = await resolveWorldDeployment(input)
    })

    it("should check active places using the whole footprint", () => {
      expect(hasNewerActiveWorldDeployment).toHaveBeenCalledWith(
        "example.dcl.eth",
        ["0,0"],
        new Date(contentEntityScene.timestamp)
      )
    })

    it("should check the world undeployment watermark", () => {
      expect(findSupersedingWorldUndeployment).toHaveBeenCalledWith(
        "example.dcl.eth",
        new Date(contentEntityScene.timestamp)
      )
    })

    it("should check the scene undeployment watermark using deployment identity", () => {
      expect(findSupersedingSceneUndeployment).toHaveBeenCalledWith(
        "example.dcl.eth",
        "deployment-current",
        "0,0",
        new Date(contentEntityScene.timestamp)
      )
    })
  })
})
