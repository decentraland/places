import { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import fetch from "node-fetch"

type SceneJson = {
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
