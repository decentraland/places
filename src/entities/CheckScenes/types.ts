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
