import areSamePositions from "./areSamePositions"

const a = ["0,0", "0,1", "1,0", "1,1"]
const b = ["1,0", "0,0", "1,1", "0,1"]
const c = ["1,0", "0,0", "1,1", "0,1", "2,0"]
const d = ["10,0", "10,1", "11,0", "11,1"]

describe("Check 2 arrays with same positions", () => {
  test(`With 100`, () => {
    expect(areSamePositions(a, a)).toBe(true)
    expect(areSamePositions(a, b)).toBe(true)
    expect(areSamePositions(b, c)).toBe(false)
    expect(areSamePositions(a, d)).toBe(false)
  })
})
