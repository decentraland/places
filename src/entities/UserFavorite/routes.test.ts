import * as auth from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"
import * as environment from "decentraland-gatsby/dist/utils/env"

import * as migration from "./migration"
import { updateFavorites } from "./routes"
import * as entities from "../shared/entityInteractions"
import * as snapshot from "../Snapshot/utils"

describe("when the favorite request uses the migration protocol", () => {
  let context: Parameters<typeof updateFavorites>[0]
  let configured: jest.SpyInstance
  let authenticate: jest.SpyInstance
  let execute: jest.SpyInstance
  let find: jest.SpyInstance

  beforeEach(() => {
    configured = jest.spyOn(environment, "default").mockReturnValue("true")
    context = {
      request: new Request(
        "https://places.example/api/places/20000000-0000-4000-8000-000000000001/favorites",
        {
          method: "PATCH",
          headers: {
            "x-dcl-operation-id": "10000000-0000-4000-8000-000000000001",
          },
        }
      ),
      url: new URL(
        "https://places.example/api/places/20000000-0000-4000-8000-000000000001/favorites"
      ),
      params: { entity_id: "20000000-0000-4000-8000-000000000001" },
      body: { favorites: true },
    }
    authenticate = jest.spyOn(auth, "withAuth").mockResolvedValue({
      address: "0x1111111111111111111111111111111111111111",
      metadata: {},
    })
    execute = jest
      .spyOn(migration, "executeMigrationFavorite")
      .mockResolvedValue({ favorites: 1, user_favorite: true })
    find = jest
      .spyOn(entities, "findEntityByIdWithAggregates")
      .mockResolvedValue(null)
    jest.spyOn(snapshot, "fetchScore").mockResolvedValue(0)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("and authentication fails", () => {
    beforeEach(() => {
      authenticate.mockRejectedValueOnce(new Error("Unauthorized"))
    })

    it("should reject without executing a captured command", async () => {
      await expect(updateFavorites(context)).rejects.toThrow("Unauthorized")
      expect(execute).not.toHaveBeenCalled()
    })
  })

  describe("and capture is disabled", () => {
    beforeEach(() => {
      configured.mockReturnValueOnce("false")
    })

    it("should fail without falling back to an unreceipted mutation", async () => {
      await expect(updateFavorites(context)).rejects.toThrow(
        "Migration command capture is disabled"
      )
      expect(execute).not.toHaveBeenCalled()
    })
  })

  describe("and the place disappeared after the original operation", () => {
    it("should allow the source function to return the retained receipt", async () => {
      await expect(updateFavorites(context)).resolves.toMatchObject({
        body: { data: { favorites: 1, user_favorite: true } },
      })
      expect(find).not.toHaveBeenCalled()
    })
  })

  describe("and the request has no migration header", () => {
    beforeEach(() => {
      context.request.headers.delete("x-dcl-operation-id")
    })

    it("should preserve the ordinary entity lookup and not invoke capture explicitly", async () => {
      await expect(updateFavorites(context)).rejects.toThrow("Not found entity")
      expect(execute).not.toHaveBeenCalled()
    })
  })
})
