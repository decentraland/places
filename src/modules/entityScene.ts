import Catalyst from "decentraland-gatsby/dist/utils/api/Catalyst"

export const getEntityScenes = async (positions: string[]) => {
  try {
    return await Catalyst.get().getEntityScenes(positions)
  } catch (error) {
    return []
  }
}
