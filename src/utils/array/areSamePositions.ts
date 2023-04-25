function areSamePositions(a: string[], b: string[]) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    throw new Error("not array")
  }
  if (a.length !== b.length) {
    return false
  }
  a.sort()
  b.sort()
  return a.every((val, index) => val === b[index])
}

export default areSamePositions
