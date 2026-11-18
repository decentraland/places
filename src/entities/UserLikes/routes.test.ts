import * as auth from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"
import * as environment from "decentraland-gatsby/dist/utils/env"

import * as migration from "./migration"
import { updateLike } from "./routes"
import * as entities from "../shared/entityInteractions"
import * as snapshot from "../Snapshot/utils"

describe("when the like request uses the migration protocol", () => {
  let context: Parameters<typeof updateLike>[0]
  let configured: jest.SpyInstance
  let authenticate: jest.SpyInstance
  let execute: jest.SpyInstance
  let find: jest.SpyInstance
  let score: jest.SpyInstance

  beforeEach(() => {
    configured = jest.spyOn(environment, "default").mockReturnValue("true")
    context = {
      request: new Request(
        "https://places.example/api/places/20000000-0000-4000-8000-000000000001/likes",
        {
          method: "PATCH",
          headers: {
            "x-dcl-operation-id": "10000000-0000-4000-8000-000000000001",
          },
        }
      ),
      params: { entity_id: "20000000-0000-4000-8000-000000000001" },
      body: { like: true },
    }
    authenticate = jest.spyOn(auth, "withAuth").mockResolvedValue({
      address: "0x1111111111111111111111111111111111111111",
      metadata: {},
    })
    execute = jest.spyOn(migration, "executeMigrationLike").mockResolvedValue({
      likes: 1,
      dislikes: 0,
      user_like: true,
      user_dislike: false,
    })
    find = jest
      .spyOn(entities, "findEntityByIdWithAggregates")
      .mockResolvedValue(null)
    score = jest.spyOn(snapshot, "fetchScore").mockResolvedValue(0)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("and authentication fails", () => {
    beforeEach(() => {
      authenticate.mockRejectedValueOnce(new Error("Unauthorized"))
    })

    it("should reject without executing a captured command", async () => {
      await expect(updateLike(context)).rejects.toThrow("Unauthorized")
      expect(execute).not.toHaveBeenCalled()
    })
  })

  describe("and capture is disabled", () => {
    beforeEach(() => {
      configured.mockReturnValueOnce("false")
    })

    it("should fail without falling back to an unreceipted mutation", async () => {
      await expect(updateLike(context)).rejects.toThrow(
        "Migration command capture is disabled"
      )
      expect(execute).not.toHaveBeenCalled()
    })
  })

  describe("and the place disappeared after the original operation", () => {
    it("should allow the source function to return the retained receipt", async () => {
      await expect(updateLike(context)).resolves.toMatchObject({
        body: {
          data: { likes: 1, dislikes: 0, user_like: true, user_dislike: false },
        },
      })
      expect(find).not.toHaveBeenCalled()
    })
  })

  describe("and the request has no migration header", () => {
    beforeEach(() => {
      context.request.headers.delete("x-dcl-operation-id")
    })

    it("should preserve the ordinary entity lookup and not invoke capture explicitly", async () => {
      await expect(updateLike(context)).rejects.toThrow("Not found entity")
      expect(execute).not.toHaveBeenCalled()
    })
  })

  describe("and the vote is omitted", () => {
    beforeEach(() => {
      context.body = {}
    })
    it("should preserve the legacy default like command", async () => {
      await updateLike(context)
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({ like: true })
      )
    })
  })

  describe("and the vote is false", () => {
    beforeEach(() => {
      context.body = { like: false }
    })
    it("should dispatch a dislike rather than a withdrawal", async () => {
      await updateLike(context)
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({ like: false })
      )
    })
  })

  describe("and the vote is null", () => {
    beforeEach(() => {
      context.body = { like: null }
    })
    it("should withdraw without calling the voting-power provider", async () => {
      await updateLike(context)
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({ like: null, userActivity: 0 })
      )
      expect(score).not.toHaveBeenCalled()
    })
  })

  describe("and captured execution fails", () => {
    beforeEach(() => {
      execute.mockRejectedValueOnce(new Error("receipt unavailable"))
    })
    it("should fail without a second ordinary mutation", async () => {
      await expect(updateLike(context)).rejects.toThrow("receipt unavailable")
      expect(find).not.toHaveBeenCalled()
    })
  })
})
