import { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { GenesisCityDeploymentDecision } from "./deploymentDecision"
import * as processContentEntitySceneModule from "./processContentEntityScene"
import { resolveGenesisCityDeployment } from "./resolveGenesisCityDeployment"
import { contentEntitySceneGenesisPlaza } from "../../../__data__/contentEntitySceneGenesisPlaza"
import { placeGenesisPlaza } from "../../../__data__/placeGenesisPlaza"
import PlaceModel from "../../Place/model"
import { PlaceAttributes } from "../../Place/types"

describe("when resolving a Genesis City deployment", () => {
  let contentEntityScene: ContentEntityScene
  let decision: GenesisCityDeploymentDecision
  let input: Parameters<typeof resolveGenesisCityDeployment>[0]
  let newPlace: PlaceAttributes
  let replacedPlace: PlaceAttributes
  let findEnabledByPositions: jest.SpyInstance
  let processContentEntityScene: jest.SpyInstance

  beforeEach(() => {
    contentEntityScene = {
      ...contentEntitySceneGenesisPlaza,
      pointers: ["0,0", "1,0"],
      metadata: {
        ...contentEntitySceneGenesisPlaza.metadata,
        scene: { base: "0,0", parcels: ["0,0", "1,0"] },
      },
    }
    newPlace = {
      ...placeGenesisPlaza,
      id: "new-place",
      positions: ["0,0", "1,0"],
    }
    replacedPlace = {
      ...placeGenesisPlaza,
      id: "replaced-place",
      base_position: "1,0",
      positions: ["1,0"],
    }
    input = {
      contentEntityScene,
      contentServerUrl: "https://peer.decentraland.org",
      creator: "0xcreator",
      deploymentId: "deployment-current",
      sdk: "7",
    }
    findEnabledByPositions = jest
      .spyOn(PlaceModel, "findEnabledByPositions")
      .mockResolvedValue([])
    processContentEntityScene = jest.spyOn(
      processContentEntitySceneModule,
      "processContentEntityScene"
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("and the deployment creates a new place", () => {
    beforeEach(async () => {
      processContentEntityScene.mockReturnValueOnce({
        new: newPlace,
        rating: null,
        disabled: [],
      })

      decision = await resolveGenesisCityDeployment(input)
    })

    it("should return the processing result without replacement candidates", () => {
      expect(decision).toEqual({
        kind: "genesis-city",
        placesToProcess: {
          new: newPlace,
          rating: null,
          disabled: [],
        },
        replacement: { candidates: [] },
      })
    })

    it("should resolve overlaps using every authorized position", () => {
      expect(findEnabledByPositions).toHaveBeenCalledWith(["0,0", "1,0"])
    })

    it("should pass deployment metadata to scene processing", () => {
      expect(processContentEntityScene).toHaveBeenCalledWith(
        contentEntityScene,
        [],
        {
          url: "https://peer.decentraland.org",
          creator: "0xcreator",
          sdk: "7",
          deploymentId: "deployment-current",
        }
      )
    })
  })

  describe("and the deployment replaces an existing place", () => {
    beforeEach(async () => {
      findEnabledByPositions.mockResolvedValueOnce([replacedPlace])
      processContentEntityScene.mockReturnValueOnce({
        new: newPlace,
        rating: null,
        disabled: [replacedPlace],
      })

      decision = await resolveGenesisCityDeployment(input)
    })

    it("should return the disabled places as replacement intent", () => {
      expect(decision.replacement).toEqual({ candidates: [replacedPlace] })
    })
  })

  describe("and the deployment is already stale", () => {
    beforeEach(async () => {
      findEnabledByPositions.mockResolvedValueOnce([replacedPlace])
      processContentEntityScene.mockReturnValueOnce(null)

      decision = await resolveGenesisCityDeployment(input)
    })

    it("should avoid processing the deployment", () => {
      expect(decision.placesToProcess).toBeNull()
    })

    it("should not return replacement candidates", () => {
      expect(decision.replacement).toEqual({ candidates: [] })
    })
  })
})
