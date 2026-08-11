import { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { GenesisCityDeploymentDecision } from "./deploymentDecision"
import { processContentEntityScene } from "./processContentEntityScene"
import PlaceModel from "../../Place/model"

type ResolveGenesisCityDeploymentOptions = {
  contentEntityScene: ContentEntityScene
  contentServerUrl: string
  creator: string | null
  deploymentId: string
  sdk: string | null
}

/** Resolve a Genesis City deployment without leaking overlap state into the task runner. */
export async function resolveGenesisCityDeployment({
  contentEntityScene,
  contentServerUrl,
  creator,
  deploymentId,
  sdk,
}: ResolveGenesisCityDeploymentOptions): Promise<GenesisCityDeploymentDecision> {
  const places = await PlaceModel.findEnabledByPositions(
    contentEntityScene.pointers
  )
  const placesToProcess = processContentEntityScene(
    contentEntityScene,
    places,
    {
      url: contentServerUrl,
      creator,
      sdk,
      deploymentId,
    }
  )

  return {
    kind: "genesis-city",
    placesToProcess,
    replacement: {
      candidates: placesToProcess?.disabled ?? [],
    },
  }
}
