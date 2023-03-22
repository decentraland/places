import areShrinkPositions from "./areShrinkPositions"

const a = ["0,0", "0,1", "1,0", "1,1"]
const b = ["0,0", "0,1", "1,0"]
const c = ["0,1", "0,0", "1,0"]
const d = ["0,1", "0,0", "0,2"]
const e = ["0,0", "0,1", "1,0", "1,1", "1,2"]

describe("Check 2 arrays of positions", () => {
  test(`With shrink positions`, () => {
    expect(areShrinkPositions(a, a)).toBe(false)
    expect(areShrinkPositions(a, b)).toBe(true)
    expect(areShrinkPositions(a, c)).toBe(true)
    expect(areShrinkPositions(a, d)).toBe(false)
    expect(areShrinkPositions(a, e)).toBe(false)
  })
})
