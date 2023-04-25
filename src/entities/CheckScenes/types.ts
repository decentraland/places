/** @deprecated */
export type DeploymentTrackAttributes = {
  id: string
  base_url: string
  owner: string
  from: number
  limit: number
  disabled: boolean
  disabled_at: Date
  created_at: Date
  updated_at: Date
}

export type WorldAbout = {
  healthy: boolean
  acceptingUsers: boolean
  configurations: {
    networkId: number
    globalScenesUrn: string[]
    scenesUrn: string[]
    minimap: { enabled: false }
    skybox: {}
    realmName: string
  }
  content: {
    healthy: boolean
    publicUrl: string
  }
  lambdas: {
    healthy: boolean
    publicUrl: string
  }
  comms: {
    healthy: boolean
    protocol: string
    fixedAdapter: string
  }
}

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
