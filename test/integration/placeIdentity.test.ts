import { Client } from "pg"

import { createPlaceIdentity } from "../../src/entities/CheckScenes/task/placeIdentity"
import { PlaceIdentityConflictError } from "../../src/entities/Place/errors"
import PlaceModel from "../../src/entities/Place/model"
import { DisabledReason, PlaceAttributes } from "../../src/entities/Place/types"

// Each test uses a connection-local temporary table: no application database is reset.
describe("when persisting a deterministic deployment identity", () => {
  let createdAt: string
  let client: Client
  let place: Partial<PlaceAttributes>
  let attributes: Array<keyof PlaceAttributes>

  beforeEach(async () => {
    if (!process.env.CONNECTION_STRING) {
      throw new Error(
        "CONNECTION_STRING must point to a disposable PostgreSQL instance"
      )
    }
    client = new Client({ connectionString: process.env.CONNECTION_STRING })
    await client.connect()
    await client.query(`CREATE TEMP TABLE places (
      id text PRIMARY KEY, deployment_id text, world boolean, world_id text, world_name text,
      positions text[], base_position text, disabled boolean, disabled_reason text,
      created_at timestamp, updated_at timestamp, likes integer, highlighted boolean
    )`)
    jest
      .spyOn(PlaceModel, "namedQuery")
      .mockImplementation(async (_name, statement) => {
        return (await client.query(statement.text, statement.values)).rows
      })
    place = {
      id: createPlaceIdentity("bafybeigdyrzt", "example.dcl.eth"),
      deployment_id: "bafybeigdyrzt",
      world: true,
      world_id: "example.dcl.eth",
      world_name: "example.dcl.eth",
      positions: ["0,0"],
      base_position: "0,0",
      disabled: false,
      disabled_reason: null,
      created_at: new Date("2026-11-01T00:00:00Z"),
      updated_at: new Date("2026-11-01T00:00:00Z"),
      likes: 0,
      highlighted: false,
    }
    attributes = [
      "deployment_id",
      "world",
      "world_id",
      "world_name",
      "positions",
      "base_position",
      "disabled",
      "disabled_reason",
      "created_at",
      "updated_at",
      "likes",
      "highlighted",
    ]
    await PlaceModel.insertPlace(place, attributes, true)
    createdAt = (await client.query("SELECT created_at::text FROM places"))
      .rows[0].created_at
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await client.end()
  })

  describe("and the same accepted creation is retried", () => {
    it("should keep one identity", async () => {
      await PlaceModel.insertPlace(place, attributes, true)
      expect((await client.query("SELECT count(*) FROM places")).rows).toEqual([
        { count: "1" },
      ])
    })
  })

  describe("and a moved deterministic identity was retired", () => {
    beforeEach(async () => {
      await client.query(
        "UPDATE places SET deployment_id='later-entity', positions=ARRAY['1,0'], base_position='1,0', disabled=true, disabled_reason=$1, likes=7, highlighted=true",
        [DisabledReason.UNDEPLOYMENT]
      )
      place.created_at = new Date("2026-11-02T00:00:00Z")
      await PlaceModel.insertPlace(place, attributes, true)
    })
    it("should reactivate the creating identity while retaining its interactions and curation", async () => {
      expect(
        (
          await client.query(
            "SELECT deployment_id, disabled, positions, likes, highlighted, created_at::text FROM places"
          )
        ).rows
      ).toEqual([
        {
          deployment_id: "bafybeigdyrzt",
          disabled: false,
          positions: ["0,0"],
          likes: 7,
          highlighted: true,
          created_at: createdAt,
        },
      ])
    })
  })

  describe("and another deployment still owns the active identity", () => {
    beforeEach(async () => {
      await client.query("UPDATE places SET deployment_id='later-entity'")
    })
    it("should reject stealing the binding", async () => {
      await expect(
        PlaceModel.insertPlace(place, attributes, true)
      ).rejects.toThrow(PlaceIdentityConflictError)
    })
  })

  describe("and the stored identity belongs to another world", () => {
    beforeEach(async () => {
      await client.query(
        "UPDATE places SET world_name='other.dcl.eth', disabled=true, disabled_reason='undeployment'"
      )
    })
    it("should reject the mismatched scope", async () => {
      await expect(
        PlaceModel.insertPlace(place, attributes, true)
      ).rejects.toThrow(PlaceIdentityConflictError)
    })
  })

  describe("and the identity was disabled by moderation", () => {
    beforeEach(async () => {
      await client.query(
        "UPDATE places SET disabled=true, disabled_reason='moderation'"
      )
    })
    it("should preserve the moderation decision", async () => {
      await expect(
        PlaceModel.insertPlace(place, attributes, true)
      ).rejects.toThrow(PlaceIdentityConflictError)
    })
  })

  describe("and the supplied UUID does not match the creating entity", () => {
    beforeEach(() => {
      place.id = "00000000-0000-5000-8000-000000000000"
    })
    it("should reject the identity before writing it", async () => {
      await expect(
        PlaceModel.insertPlace(place, attributes, true)
      ).rejects.toThrow(PlaceIdentityConflictError)
    })
  })
})
