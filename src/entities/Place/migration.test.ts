import { validatePlacesWorlds } from "./migration"

describe("validatePlacesWorlds", () => {
  test("should return undefined if non of the places to import have base_position and world_name at the same tiem", async () => {
    const validatePlacesWorldsResult = validatePlacesWorlds([
      {
        base_position: "0,0",
        featured: true,
      },
      {
        world_name: "paralax.dcl.eth",
        featured: true,
      },
    ])
    expect(validatePlacesWorldsResult).toBeUndefined()
  })

  test("should return throw an error if any of the places to import have base_position and world_name at the same tiem", async () => {
    expect(() =>
      validatePlacesWorlds([
        {
          base_position: "0,0",
          featured: true,
          world_name: "paralax.dcl.eth",
        },
      ])
    ).toThrowError()
  })
})
