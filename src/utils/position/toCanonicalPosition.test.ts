import toCanonicalPosition from "./toCanonicalPosition"

describe("Validate position", () => {
  test(`With -9,-9 should return position`, () => {
    expect(toCanonicalPosition("-9,-9")).toStrictEqual("-9.-9")
  })
  test(`With -9|-9 should return position`, () => {
    expect(toCanonicalPosition("-9|-9")).toStrictEqual("-9.-9")
  })
  test(`With -9.-9 should return position`, () => {
    expect(toCanonicalPosition("-9.-9")).toStrictEqual("-9.-9")
  })
  test(`With -9;-9 should return position`, () => {
    expect(toCanonicalPosition("-9;-9")).toStrictEqual("-9.-9")
  })
  test(`With -9;-9 should return | as separator`, () => {
    expect(toCanonicalPosition("-9;-9", "|")).toStrictEqual("-9|-9")
  })
  test(`With 20,-20 should return position`, () => {
    expect(toCanonicalPosition("20,-20")).toStrictEqual("20.-20")
  })
  test(`With -9/-9 should return false`, () => {
    expect(toCanonicalPosition("-9/-9")).toBeFalsy()
  })
  test(`With null should return false`, () => {
    expect(toCanonicalPosition(null)).toBeFalsy()
  })
  test(`With 0.1,2;3 should return false`, () => {
    expect(toCanonicalPosition("0.1,2;3")).toBeFalsy()
  })
  test(`With abc,de should return false`, () => {
    expect(toCanonicalPosition("abc,de")).toBeFalsy()
  })
  test(`With 10000,1 should return false`, () => {
    expect(toCanonicalPosition("10000,1")).toBeFalsy()
  })
})
