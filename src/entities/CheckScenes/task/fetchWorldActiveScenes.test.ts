import { ContentServerConfigurationError } from "./errors"
import {
  fetchWorldActiveScenes,
  fetchWorldActiveScenesAtPositions,
} from "./fetchWorldActiveScenes"

const CONTENT_SERVER_URL = "https://worlds-content-server.decentraland.org"
const ALLOWED_HOSTS = "worlds-content-server.decentraland.org"

describe("when reading the scenes a world currently serves", () => {
  let fetchMock: jest.SpyInstance

  beforeEach(() => {
    fetchMock = jest.spyOn(global, "fetch")
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("and the world serves scenes", () => {
    let active: Awaited<ReturnType<typeof fetchWorldActiveScenes>>

    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scenes: [
            { entityId: "deployment-a", parcels: ["0,0", "0,1"] },
            { entityId: "deployment-b", parcels: ["5,5"] },
          ],
          total: 2,
        }),
      } as Response)

      active = await fetchWorldActiveScenes(
        "example.dcl.eth",
        CONTENT_SERVER_URL,
        ALLOWED_HOSTS
      )
    })

    it("should return every served deployment and the parcels they cover", () => {
      expect(active).toEqual({
        deploymentIds: ["deployment-a", "deployment-b"],
        positions: ["0,0", "0,1", "5,5"],
        oldestDeployedAt: null,
      })
    })

    it("should read the world's scene list from the content server", () => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${CONTENT_SERVER_URL}/world/example.dcl.eth/scenes?limit=100&offset=0`,
        expect.objectContaining({ signal: expect.anything() })
      )
    })
  })

  describe("and the served scenes report their deployment timestamps", () => {
    let active: Awaited<ReturnType<typeof fetchWorldActiveScenes>>

    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scenes: [
            {
              entityId: "deployment-newer",
              parcels: ["0,0"],
              entity: { timestamp: 2_000 },
            },
            {
              entityId: "deployment-older",
              parcels: ["5,5"],
              entity: { timestamp: 1_000 },
            },
          ],
          total: 2,
        }),
      } as Response)

      active = await fetchWorldActiveScenes(
        "example.dcl.eth",
        CONTENT_SERVER_URL,
        ALLOWED_HOSTS
      )
    })

    it("should report the earliest of them", () => {
      expect(active.oldestDeployedAt).toBe(1_000)
    })
  })

  describe("and one served scene reports no deployment timestamp", () => {
    let active: Awaited<ReturnType<typeof fetchWorldActiveScenes>>

    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scenes: [
            {
              entityId: "deployment-a",
              parcels: ["0,0"],
              entity: { timestamp: 1_000 },
            },
            { entityId: "deployment-b", parcels: ["5,5"] },
          ],
          total: 2,
        }),
      } as Response)

      active = await fetchWorldActiveScenes(
        "example.dcl.eth",
        CONTENT_SERVER_URL,
        ALLOWED_HOSTS
      )
    })

    it("should report no bound rather than one that ignores that scene", () => {
      expect(active.oldestDeployedAt).toBeNull()
    })

    it("should still return every served deployment", () => {
      expect(active.deploymentIds).toEqual(["deployment-a", "deployment-b"])
    })
  })

  describe("and the world serves nothing", () => {
    let active: Awaited<ReturnType<typeof fetchWorldActiveScenes>>

    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ scenes: [], total: 0 }),
      } as Response)

      active = await fetchWorldActiveScenes(
        "example.dcl.eth",
        CONTENT_SERVER_URL,
        ALLOWED_HOSTS
      )
    })

    it("should return an empty scene set", () => {
      expect(active).toEqual({
        deploymentIds: [],
        positions: [],
        oldestDeployedAt: null,
      })
    })
  })

  describe("and the world name needs escaping", () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ scenes: [], total: 0 }),
      } as Response)

      await fetchWorldActiveScenes(
        "name with spaces.dcl.eth",
        CONTENT_SERVER_URL,
        ALLOWED_HOSTS
      )
    })

    it("should encode the world name into the path", () => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${CONTENT_SERVER_URL}/world/name%20with%20spaces.dcl.eth/scenes?limit=100&offset=0`,
        expect.anything()
      )
    })
  })

  describe("and the content server rejects the request", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        bodyUsed: false,
        body: { cancel: async () => undefined },
      } as unknown as Response)
    })

    it("should throw so the caller retries instead of treating the world as empty", async () => {
      await expect(
        fetchWorldActiveScenes(
          "example.dcl.eth",
          CONTENT_SERVER_URL,
          ALLOWED_HOSTS
        )
      ).rejects.toThrow(
        "Unable to fetch the active scenes of example.dcl.eth: 503 Service Unavailable"
      )
    })
  })

  describe("and the response carries no scene list", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total: 0 }),
      } as Response)
    })

    it("should throw rather than assume the world serves nothing", async () => {
      await expect(
        fetchWorldActiveScenes(
          "example.dcl.eth",
          CONTENT_SERVER_URL,
          ALLOWED_HOSTS
        )
      ).rejects.toThrow(
        "Active scenes response for example.dcl.eth does not contain a scene list"
      )
    })
  })

  describe("and the world serves more scenes than one page holds", () => {
    let active: Awaited<ReturnType<typeof fetchWorldActiveScenes>>

    beforeEach(async () => {
      const firstPage = Array.from({ length: 100 }, (_, index) => ({
        entityId: `deployment-${index}`,
        parcels: [`${index},0`],
      }))
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ scenes: firstPage, total: 101 }),
      } as Response)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scenes: [{ entityId: "deployment-last", parcels: ["500,500"] }],
          total: 101,
        }),
      } as Response)

      active = await fetchWorldActiveScenes(
        "example.dcl.eth",
        CONTENT_SERVER_URL,
        ALLOWED_HOSTS
      )
    })

    it("should read every page", () => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        `${CONTENT_SERVER_URL}/world/example.dcl.eth/scenes?limit=100&offset=100`,
        expect.anything()
      )
    })

    it("should return the scenes from every page", () => {
      expect(active.deploymentIds).toHaveLength(101)
    })

    it("should include the last page's deployment", () => {
      expect(active.deploymentIds).toContain("deployment-last")
    })
  })

  describe("and the listing shrinks between pages", () => {
    beforeEach(() => {
      const firstPage = Array.from({ length: 100 }, (_, index) => ({
        entityId: `deployment-${index}`,
        parcels: [`${index},0`],
      }))
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ scenes: firstPage, total: 150 }),
      } as Response)
      // 20 scenes were undeployed mid-read, so the offset window slid past 20 live ones
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scenes: Array.from({ length: 30 }, (_, index) => ({
            entityId: `deployment-${120 + index}`,
            parcels: [`${120 + index},0`],
          })),
          total: 130,
        }),
      } as Response)
    })

    it("should throw rather than return a set the shifted window skipped", async () => {
      await expect(
        fetchWorldActiveScenes(
          "example.dcl.eth",
          CONTENT_SERVER_URL,
          ALLOWED_HOSTS
        )
      ).rejects.toThrow(
        "Active scenes for example.dcl.eth changed while being read: 150 scenes, then 130"
      )
    })
  })

  describe("and a page repeats a scene it already served", () => {
    beforeEach(() => {
      const firstPage = Array.from({ length: 100 }, (_, index) => ({
        entityId: `deployment-${index}`,
        parcels: [`${index},0`],
      }))
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ scenes: firstPage, total: 101 }),
      } as Response)
      // An untied ORDER BY can repeat a row in place of one it skipped
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scenes: [{ entityId: "deployment-99", parcels: ["99,0"] }],
          total: 101,
        }),
      } as Response)
    })

    it("should throw rather than return a set missing the skipped scene", async () => {
      await expect(
        fetchWorldActiveScenes(
          "example.dcl.eth",
          CONTENT_SERVER_URL,
          ALLOWED_HOSTS
        )
      ).rejects.toThrow(
        "Active scenes response for example.dcl.eth repeated 1 of 101 scenes"
      )
    })
  })

  describe("and the response does not report a total", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scenes: [{ entityId: "deployment-a", parcels: ["0,0"] }],
        }),
      } as Response)
    })

    it("should throw rather than trust an unprovable read", async () => {
      await expect(
        fetchWorldActiveScenes(
          "example.dcl.eth",
          CONTENT_SERVER_URL,
          ALLOWED_HOSTS
        )
      ).rejects.toThrow(
        "Active scenes response for example.dcl.eth does not report how many scenes it has"
      )
    })
  })

  describe("and an empty response does not report a total", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ scenes: [] }),
      } as Response)
    })

    it("should throw rather than read it as a world that serves nothing", async () => {
      await expect(
        fetchWorldActiveScenes(
          "example.dcl.eth",
          CONTENT_SERVER_URL,
          ALLOWED_HOSTS
        )
      ).rejects.toThrow(
        "Active scenes response for example.dcl.eth does not report how many scenes it has"
      )
    })
  })

  describe("and the content server serves fewer scenes than it reports", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scenes: [{ entityId: "deployment-a", parcels: ["0,0"] }],
          total: 4,
        }),
      } as Response)
    })

    it("should throw rather than spare only the scenes it saw", async () => {
      await expect(
        fetchWorldActiveScenes(
          "example.dcl.eth",
          CONTENT_SERVER_URL,
          ALLOWED_HOSTS
        )
      ).rejects.toThrow(
        "Active scenes response for example.dcl.eth served 1 of 4 scenes"
      )
    })
  })

  describe("and a served scene carries no deployment id", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ scenes: [{ parcels: ["0,0"] }], total: 1 }),
      } as Response)
    })

    it("should throw because that scene could not be excluded by identity", async () => {
      await expect(
        fetchWorldActiveScenes(
          "example.dcl.eth",
          CONTENT_SERVER_URL,
          ALLOWED_HOSTS
        )
      ).rejects.toThrow(
        "Active scenes response for example.dcl.eth contains a scene without a deployment id"
      )
    })
  })

  describe("and a served scene carries an unusable footprint", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scenes: [{ entityId: "deployment-a", parcels: ["not-a-parcel"] }],
          total: 1,
        }),
      } as Response)
    })

    it("should throw because legacy rows could not be excluded by footprint", async () => {
      await expect(
        fetchWorldActiveScenes(
          "example.dcl.eth",
          CONTENT_SERVER_URL,
          ALLOWED_HOSTS
        )
      ).rejects.toThrow(
        "Active scenes response for example.dcl.eth contains scene 'deployment-a' without a usable footprint"
      )
    })
  })

  describe("and the configured content server is not an allowed host", () => {
    it("should report it as a deployment misconfiguration", async () => {
      await expect(
        fetchWorldActiveScenes(
          "example.dcl.eth",
          "https://untrusted.example",
          ALLOWED_HOSTS
        )
      ).rejects.toBeInstanceOf(ContentServerConfigurationError)
    })
  })
})

describe("when reading the scenes a world serves at given parcels", () => {
  let fetchMock: jest.SpyInstance

  beforeEach(() => {
    fetchMock = jest.spyOn(global, "fetch")
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("and the parcels are served", () => {
    let active: Awaited<ReturnType<typeof fetchWorldActiveScenesAtPositions>>

    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scenes: [{ entityId: "deployment-a", parcels: ["0,0"] }],
          total: 1,
        }),
      } as Response)

      active = await fetchWorldActiveScenesAtPositions(
        "example.dcl.eth",
        ["0,0", "0,1"],
        CONTENT_SERVER_URL,
        ALLOWED_HOSTS
      )
    })

    it("should ask only about those parcels", () => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${CONTENT_SERVER_URL}/world/example.dcl.eth/scenes?limit=100&offset=0`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ coordinates: ["0,0", "0,1"] }),
        })
      )
    })

    it("should declare a JSON body, which the schema validator requires", () => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { "Content-Type": "application/json" },
        })
      )
    })

    it("should apply a request timeout", () => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: expect.anything() })
      )
    })

    it("should return the deployments serving them", () => {
      expect(active).toEqual({
        deploymentIds: ["deployment-a"],
        positions: ["0,0"],
        oldestDeployedAt: null,
      })
    })
  })

  describe("and no parcels were cleared", () => {
    let active: Awaited<ReturnType<typeof fetchWorldActiveScenesAtPositions>>

    beforeEach(async () => {
      active = await fetchWorldActiveScenesAtPositions(
        "example.dcl.eth",
        [],
        CONTENT_SERVER_URL,
        ALLOWED_HOSTS
      )
    })

    it("should return an empty scene set", () => {
      expect(active).toEqual({
        deploymentIds: [],
        positions: [],
        oldestDeployedAt: null,
      })
    })

    it("should not call the content server", () => {
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe("and one chunk has a scene without a timestamp while another does not", () => {
    let active: Awaited<ReturnType<typeof fetchWorldActiveScenesAtPositions>>
    let positions: string[]

    beforeEach(async () => {
      positions = Array.from({ length: 501 }, (_, index) => `${index},0`)
      // first chunk: a served scene reports no timestamp
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scenes: [{ entityId: "deployment-a", parcels: ["0,0"] }],
          total: 1,
        }),
      } as Response)
      // second chunk: a served scene does report one
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scenes: [
            {
              entityId: "deployment-b",
              parcels: ["500,0"],
              entity: { timestamp: 1_000 },
            },
          ],
          total: 1,
        }),
      } as Response)

      active = await fetchWorldActiveScenesAtPositions(
        "example.dcl.eth",
        positions,
        CONTENT_SERVER_URL,
        ALLOWED_HOSTS
      )
    })

    it("should report no bound, since one served scene is unaccounted for", () => {
      expect(active.oldestDeployedAt).toBeNull()
    })

    it("should still return every served deployment", () => {
      expect(active.deploymentIds).toEqual(["deployment-a", "deployment-b"])
    })
  })

  describe("and more parcels were cleared than one request accepts", () => {
    let positions: string[]

    beforeEach(async () => {
      positions = Array.from({ length: 501 }, (_, index) => `${index},0`)
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ scenes: [], total: 0 }),
      } as Response)

      await fetchWorldActiveScenesAtPositions(
        "example.dcl.eth",
        positions,
        CONTENT_SERVER_URL,
        ALLOWED_HOSTS
      )
    })

    it("should split them into requests the content server accepts", () => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("should send the remaining parcels in the last request", () => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ coordinates: ["500,0"] }),
        })
      )
    })
  })
})
