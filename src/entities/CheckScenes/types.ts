export enum CheckSceneLogsTypes {
  NEW = "new",
  UPDATE = "update",
  DISABLED = "disabled",
  AVOID = "avoid",
}

export type CheckSceneLogs = {
  entity_id: string
  content_server_url: string
  base_position: string
  positions: string[]
  action: CheckSceneLogsTypes
  deploy_at: Date
}
