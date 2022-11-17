import validPosition from "./validPosition"

describe("Validate position", () => {
  test(`With -9,-9 should return position`, () => {
    expect(validPosition("-9,-9")).toStrictEqual([-9, -9])
  })
  test(`With -9|-9 should return position`, () => {
    expect(validPosition("-9|-9")).toStrictEqual([-9, -9])
  })
  test(`With -9.-9 should return position`, () => {
    expect(validPosition("-9.-9")).toStrictEqual([-9, -9])
  })
  test(`With -9;-9 should return position`, () => {
    expect(validPosition("-9;-9")).toStrictEqual([-9, -9])
  })
  test(`With 20,-20 should return position`, () => {
    expect(validPosition("20,-20")).toStrictEqual([20, -20])
  })
  test(`With -9/-9 should return false`, () => {
    expect(validPosition("-9/-9")).toBeFalsy()
  })
  test(`With null should return false`, () => {
    expect(validPosition(null)).toBeFalsy()
  })
  test(`With 0.1,2;3 should return false`, () => {
    expect(validPosition("0.1,2;3")).toBeFalsy()
  })
  test(`With abc,de should return false`, () => {
    expect(validPosition("abc,de")).toBeFalsy()
  })
  test(`With 10000,1 should return false`, () => {
    expect(validPosition("10000,1")).toBeFalsy()
  })
})
