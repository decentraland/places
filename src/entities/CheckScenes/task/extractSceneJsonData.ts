import { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import fetch from "node-fetch"

export type SceneJsonData = {
  creator: string | null
  runtimeVersion: string | null
}

/**
 * Extracts data from the scene.json file in the content entity
 * @param contentEntityScene - The content entity scene from Catalyst
 * @param contentServerUrl - The content server URL
 * @returns Object containing creator address and runtimeVersion (SDK version)
 */
export async function extractSceneJsonData(
  contentEntityScene: ContentEntityScene,
  contentServerUrl: string
): Promise<SceneJsonData> {
  try {
    // Find scene.json in the content files
    const sceneJsonContent = contentEntityScene.content.find(
      (content) => content.file === "scene.json"
    )

    if (!sceneJsonContent) {
      return { creator: null, runtimeVersion: null }
    }

    // Construct the URL to fetch the scene.json file
    const contentUrl = `${contentServerUrl.replace(/\/+$/, "")}/contents/${
      sceneJsonContent.hash
    }`

    // Fetch the scene.json file
    const response = await fetch(contentUrl)

    if (!response.ok) {
      return { creator: null, runtimeVersion: null }
    }

    const sceneJson: SceneJsonData = await response.json()

    return {
      creator: sceneJson.creator || null,
      runtimeVersion: sceneJson.runtimeVersion || null,
    }
  } catch (error) {
    // If there's any error fetching or parsing, return nulls
    return { creator: null, runtimeVersion: null }
  }
}

