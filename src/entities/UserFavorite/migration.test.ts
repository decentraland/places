import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"

import {
  MigrationFavorite,
  executeMigrationFavorite,
  migrationRequestHash,
} from "./migration"
import UserFavoriteModel from "./model"

describe("when executing a captured favorite command", () => {
  let command: MigrationFavorite
  let query: jest.SpyInstance

  beforeEach(() => {
    command = {
      operationId: "10000000-0000-4000-8000-000000000001",
      user: "0x1111111111111111111111111111111111111111",
      entityId: "20000000-0000-4000-8000-000000000001",
      favorite: true,
      userActivity: 1,
    }
    query = jest.spyOn(UserFavoriteModel, "namedQuery")
  })

  afterEach(() => jest.restoreAllMocks())

  describe("and production returns a durable receipt", () => {
    beforeEach(() => {
      query.mockResolvedValueOnce([
        { result: { favorites: 3, user_favorite: true } },
      ])
    })

    it("should return the stored source result", async () => {
      await expect(executeMigrationFavorite(command)).resolves.toEqual({
        favorites: 3,
        user_favorite: true,
      })
    })
  })

  describe("and an operation identity is malformed", () => {
    beforeEach(() => {
      command.operationId = "invalid"
    })

    it("should reject before performing any database mutation", async () => {
      await expect(executeMigrationFavorite(command)).rejects.toBeInstanceOf(
        ErrorResponse
      )
      expect(query).not.toHaveBeenCalled()
    })
  })

  describe("and a database failure includes sensitive details", () => {
    beforeEach(() => {
      query.mockRejectedValueOnce(new Error("secret-connection-canary"))
    })

    it("should expose only the safe retry instruction", async () => {
      await expect(executeMigrationFavorite(command)).rejects.toThrow(
        "Migration command is unavailable; retry with the same operation ID"
      )
    })
  })

  describe("and the receipt shape is invalid", () => {
    beforeEach(() => {
      query.mockResolvedValueOnce([
        { result: { favorites: -1, user_favorite: true } },
      ])
    })

    it("should reject a malformed source response", async () => {
      await expect(executeMigrationFavorite(command)).rejects.toThrow(
        "Migration receipt is unavailable"
      )
    })
  })

  describe("and the command identity conflicts", () => {
    beforeEach(() => {
      query.mockRejectedValueOnce({
        code: "P0001",
        message: "private-row-canary",
      })
    })

    it("should expose a safe conflict message", async () => {
      await expect(executeMigrationFavorite(command)).rejects.toThrow(
        "Migration operation conflicts with its scope or stored receipt"
      )
    })
  })

  describe("and a retry observes a different activity score", () => {
    it("should keep the same semantic fingerprint", () => {
      expect(migrationRequestHash({ ...command, userActivity: 50 })).toBe(
        migrationRequestHash(command)
      )
    })
  })

  describe("and another actor reuses the operation", () => {
    it("should bind its fingerprint to the authenticated actor", () => {
      expect(
        migrationRequestHash({
          ...command,
          user: "0x2222222222222222222222222222222222222222",
        })
      ).not.toBe(migrationRequestHash(command))
    })
  })
})
