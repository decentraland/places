export type WorldSceneUndeploymentAttributes = {
  world_id: string
  deployment_id: string
  base_position: string
  undeployed_at: Date
}

export type UndeployedScene = {
  entityId: string
  baseParcel: string
}
