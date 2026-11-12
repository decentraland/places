import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"

import {
  MigrationLike,
  executeMigrationLike,
  migrationRequestHash,
} from "./migration"
import UserLikeModel from "./model"

describe("when executing a captured vote command", () => {
  let command: MigrationLike
  let query: jest.SpyInstance

  beforeEach(() => {
    command = {
      operationId: "10000000-0000-4000-8000-000000000001",
      user: "0x1111111111111111111111111111111111111111",
      entityId: "20000000-0000-4000-8000-000000000001",
      like: true,
      userActivity: 1,
    }
    query = jest.spyOn(UserLikeModel, "namedQuery")
  })

  afterEach(() => jest.restoreAllMocks())

  describe("and production returns a durable receipt", () => {
    beforeEach(() => {
      query.mockResolvedValueOnce([
        {
          result: {
            likes: 3,
            dislikes: 0,
            user_like: true,
            user_dislike: false,
          },
        },
      ])
    })

    it("should return the stored source result", async () => {
      await expect(executeMigrationLike(command)).resolves.toEqual({
        likes: 3,
        dislikes: 0,
        user_like: true,
        user_dislike: false,
      })
    })
  })

  describe("and an operation identity is malformed", () => {
    beforeEach(() => {
      command.operationId = "invalid"
    })

    it("should reject before performing any database mutation", async () => {
      await expect(executeMigrationLike(command)).rejects.toBeInstanceOf(
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
      await expect(executeMigrationLike(command)).rejects.toThrow(
        "Migration command is unavailable; retry with the same operation ID"
      )
    })
  })

  describe("and the receipt shape is invalid", () => {
    beforeEach(() => {
      query.mockResolvedValueOnce([
        {
          result: {
            likes: -1,
            dislikes: 0,
            user_like: true,
            user_dislike: false,
          },
        },
      ])
    })

    it("should reject a malformed source response", async () => {
      await expect(executeMigrationLike(command)).rejects.toThrow(
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
      await expect(executeMigrationLike(command)).rejects.toThrow(
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

  describe("and the command withdraws a vote", () => {
    beforeEach(() => {
      command.like = null
      command.userActivity = 0
      query.mockResolvedValueOnce([
        {
          result: {
            likes: 0,
            dislikes: 0,
            user_like: false,
            user_dislike: false,
          },
        },
      ])
    })
    it("should return a receipt with neither vote selected", async () => {
      await expect(executeMigrationLike(command)).resolves.toEqual({
        likes: 0,
        dislikes: 0,
        user_like: false,
        user_dislike: false,
      })
    })
  })

  describe("and the command sets a dislike", () => {
    beforeEach(() => {
      command.like = false
      query.mockResolvedValueOnce([
        {
          result: {
            likes: 0,
            dislikes: 1,
            user_like: false,
            user_dislike: true,
          },
        },
      ])
    })
    it("should preserve the distinction between dislike and withdrawal", async () => {
      await expect(executeMigrationLike(command)).resolves.toEqual({
        likes: 0,
        dislikes: 1,
        user_like: false,
        user_dislike: true,
      })
    })
  })

  describe("and a receipt contradicts the accepted vote", () => {
    beforeEach(() => {
      query.mockResolvedValueOnce([
        {
          result: {
            likes: 0,
            dislikes: 1,
            user_like: false,
            user_dislike: true,
          },
        },
      ])
    })
    it("should reject the inconsistent response", async () => {
      await expect(executeMigrationLike(command)).rejects.toThrow(
        "Migration receipt is unavailable"
      )
    })
  })

  describe("and vote values differ", () => {
    let fingerprints: string[]
    beforeEach(() => {
      fingerprints = [true, false, null].map((like) =>
        migrationRequestHash({ ...command, like })
      )
    })
    it("should bind each tri-state command to a different fingerprint", () => {
      expect(new Set(fingerprints).size).toBe(3)
    })
  })
})
