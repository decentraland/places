import { AggregateBaseEntityAttributes } from "../entities/shared/types"

/**
 * Update an entity in a list by ID.
 * Works with both places and worlds.
 */
export const updateEntityInList = <T extends AggregateBaseEntityAttributes>(
  entityList: T[] | null,
  entityId: string,
  newData: Partial<T>
): T[] => {
  if (!entityList) {
    return []
  }

  return entityList.map((item) =>
    item.id === entityId ? { ...item, ...newData } : item
  )
}
