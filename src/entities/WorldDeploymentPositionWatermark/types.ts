export type WorldDeploymentPositionWatermarkAttributes = {
  world_id: string
  position: string
  /** Newest entity timestamp of a deployment covering the position. */
  superseded_at: Date | null
  /** Legacy tie-break flag; removals now record `removed_at` instead. */
  inclusive: boolean
  /** Newest emission time of a removal that cleared the position. */
  removed_at: Date | null
}
