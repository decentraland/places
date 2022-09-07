import shorterNumber from "./sortenNumber"

describe("Sorten Number", () => {
  test(`With 100`, () => {
    expect(shorterNumber(100)).toBe("100")
  })
  test(`With 1.000`, () => {
    expect(shorterNumber(1000)).toBe("1k")
  })
  test(`With 1.000.000`, () => {
    expect(shorterNumber(1000000)).toBe("1M")
  })
  test(`With 1.000.000.000`, () => {
    expect(shorterNumber(1000000000)).toBe("1G")
  })
  test(`With 1.000.000.000.000`, () => {
    expect(shorterNumber(1000000000000)).toBe("1T")
  })
  test(`With 1.000.000.000.000.000`, () => {
    expect(shorterNumber(1000000000000000)).toBe("1P")
  })
  test(`With 1.000.000.000.000.000.000`, () => {
    expect(shorterNumber(1000000000000000000)).toBe("1E")
  })
})
