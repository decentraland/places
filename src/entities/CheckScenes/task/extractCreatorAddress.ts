import { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import fetch from "node-fetch"

type SceneJson = {
  display?: {
    title?: string
    description?: string
    navmapThumbnail?: string
    favicon?: string
  }
  contact?: {
    name?: string
    email?: string
  }
  owner?: string
  scene?: {
    parcels?: string[]
    base?: string
  }
  communications?: {
    type?: string
    signalling?: string
  }
  policy?: {
    contentRating?: string
    fly?: boolean
    voiceEnabled?: boolean
    blacklist?: string[]
  }
  main?: string
  tags?: string[]
  spawnPoints?: Array<{
    name?: string
    default?: boolean
    position?: { x: number[]; y: number[]; z: number[] }
    cameraTarget?: { x: number; y: number; z: number }
  }>
  requiredPermissions?: string[]
  featureToggles?: Record<string, boolean>
  worldConfiguration?: Record<string, any>
  source?: {
    version?: number
    origin?: string
    projectId?: string
    point?: { x: number; y: number }
    rotation?: string
    layout?: { rows: number; cols: number }
  }
  _baseUrl?: string
  _mappings?: Record<string, string>
  _entityId?: string
  _sceneId?: string
  _timestamp?: number
  _pointers?: string[]
  _deploymentSource?: string
  creator?: string
}

/**
 * Extracts the creator address from the scene.json file in the content entity
 * @param contentEntityScene - The content entity scene from Catalyst
 * @param contentServerUrl - The content server URL
 * @returns The creator address or null if not found
 */
export async function extractCreatorAddress(
  contentEntityScene: ContentEntityScene,
  contentServerUrl: string
): Promise<string | null> {
  try {
    // Find scene.json in the content files
    const sceneJsonContent = contentEntityScene.content.find(
      (content) => content.file === "scene.json"
    )

    if (!sceneJsonContent) {
      return null
    }

    // Construct the URL to fetch the scene.json file
    const contentUrl = `${contentServerUrl.replace(/\/+$/, "")}/contents/${
      sceneJsonContent.hash
    }`

    // Fetch the scene.json file
    const response = await fetch(contentUrl)

    if (!response.ok) {
      return null
    }

    const sceneJson: SceneJson = await response.json()

    // Return the creator address if it exists
    return sceneJson.creator || null
  } catch (error) {
    // If there's any error fetching or parsing, return null
    return null
  }
}
