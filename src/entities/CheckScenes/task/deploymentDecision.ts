import { ProcessEntitySceneResult } from "./processContentEntityScene"
import { PlaceAttributes } from "../../Place/types"

export type WorldReplacementIntent = {
  candidates: PlaceAttributes[]
  includesTimestampTies: boolean
  updatedPlace: PlaceAttributes | null
}

export type WorldPositionWatermarkIntent = {
  worldId: string
  positions: string[]
  deployedAt: Date
}

export type WorldDeploymentDecision = {
  kind: "world"
  placesToProcess: ProcessEntitySceneResult | null
  replacement: WorldReplacementIntent
  positionWatermark: WorldPositionWatermarkIntent
}

export type GenesisCityDeploymentDecision = {
  kind: "genesis-city"
  placesToProcess: ProcessEntitySceneResult | null
  replacement: {
    candidates: PlaceAttributes[]
  }
}

export type DeploymentDecision =
  | WorldDeploymentDecision
  | GenesisCityDeploymentDecision
