export type WorldUndeploymentAttributes = {
  world_id: string
  /** Worlds server the recording event came from; removals only reject its own deployments. */
  content_server_url: string
  undeployed_at: Date
}
