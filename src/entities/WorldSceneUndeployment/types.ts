export type WorldSceneUndeploymentAttributes = {
  world_id: string
  deployment_id: string
  base_position: string
  /** Entity timestamp of the deployment that replaced this one. */
  undeployed_at: Date | null
  /** Emission time of the removal event that named this deployment. */
  removed_at: Date | null
  /**
   * Whether this row may reject a deployment by base parcel as well as by deployment id. False when
   * the base was already served by a replacement at the time of recording, so that the row still
   * tombstones the removed deployment without rejecting the scene occupying its base.
   */
  base_position_rejects: boolean
}

export type UndeployedScene = {
  entityId: string
  baseParcel: string
  parcels?: string[] | null
}
