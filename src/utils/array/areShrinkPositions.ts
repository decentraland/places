function areShrinkPositions(oldPositions: string[], newPositions: string[]) {
  if (!Array.isArray(oldPositions) || !Array.isArray(newPositions)) {
    throw new Error("not array")
  }
  if (oldPositions.length <= newPositions.length) {
    return false
  }
  return newPositions.every((position) => oldPositions.includes(position))
}

export default areShrinkPositions
