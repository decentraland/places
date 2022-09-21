import { AggregatePlaceAttributes } from "../entities/Place/types"

export const updatePlaceInPlaceList = (
  placeList: AggregatePlaceAttributes[],
  placeId: string,
  placeNewData: Partial<AggregatePlaceAttributes>
) => {
  return placeList.map((itemToUpdate) =>
    itemToUpdate.id === placeId
      ? { ...itemToUpdate, ...placeNewData }
      : itemToUpdate
  )
}
