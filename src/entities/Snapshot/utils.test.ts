import { fetchScore } from "./utils"

test("fetchScore", async () => {
  expect(await fetchScore("")).toBe(0)
  expect(await fetchScore("0x0000000000000000000000000000000000000000")).toBe(0)
  expect(
    await fetchScore("0x4eac6325e1dbf1ac90434d39766e164dca71139e")
  ).toBeGreaterThan(100)
})
