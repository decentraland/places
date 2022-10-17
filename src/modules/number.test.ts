import { toPercent } from "./number"

test("src/modules/number", () => {
  expect(toPercent(1)).toBe(100)
  expect(toPercent(123456789)).toBe(100)
  expect(toPercent(0)).toBe(0)
  expect(toPercent(-123456789)).toBe(0)
  expect(toPercent(0.5)).toBe(50)
  expect(toPercent(0.75)).toBe(75)
  expect(toPercent(0.2555555)).toBe(26)
  expect(toPercent(0.254)).toBe(25)
  expect(toPercent(0.01)).toBe(1)
  expect(toPercent(0.00000000000000001)).toBe(1)
  expect(toPercent(0.99)).toBe(99)
  expect(toPercent(Math.log(-1))).toBe(0)
  expect(toPercent(Math.pow(10, 1000))).toBe(100)
  expect(toPercent(-Math.pow(10, 1000))).toBe(0)
})
