import { InvalidWorldSqsMessageError } from "./errors"
import { createPlaceIdentity } from "./placeIdentity"
import vectors from "./placeIdentity.vectors.json"

describe("when generating a new place identity", () => {
  describe.each(vectors)("and the shared vector is $id", (vector) => {
    let entity: string
    let world: string | null

    beforeEach(() => {
      entity = vector.entity
      world = vector.world
    })

    it("should match the shared UUIDv5 vector", () => {
      expect(createPlaceIdentity(entity, world)).toBe(vector.id)
    })
  })

  describe.each([undefined, null, "", " entity", "entity "])(
    "and the immutable entity ID is invalid (%s)",
    (invalidEntity) => {
      let entity: string | null | undefined

      beforeEach(() => {
        entity = invalidEntity
      })

      it("should reject it without generating a random identity", () => {
        expect(() => createPlaceIdentity(entity, null)).toThrow(
          InvalidWorldSqsMessageError
        )
      })
    }
  )
})

describe.each(["", " example.dcl.eth", "example.dcl.eth "])(
  "when the world name is not canonical (%s)",
  (invalidWorld) => {
    let world: string
    beforeEach(() => {
      world = invalidWorld
    })
    it("should reject the scope instead of assigning a Genesis identity", () => {
      expect(() => createPlaceIdentity("bafybeigdyrzt", world)).toThrow(
        InvalidWorldSqsMessageError
      )
    })
  }
)
