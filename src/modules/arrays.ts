import { AggregatePlaceAttributes } from "../entities/Place/types"

export const updatePlaceInPlaceList = (
  placeList: AggregatePlaceAttributes[] | null,
  placeId: string,
  placeNewData: Partial<AggregatePlaceAttributes>
) => {
  if (!placeList) {
    return []
  }

  return placeList.map((itemToUpdate) =>
    itemToUpdate.id === placeId
      ? { ...itemToUpdate, ...placeNewData }
      : itemToUpdate
  )
}
