import ContentServer from "decentraland-gatsby/dist/utils/api/ContentServer"

import { InvalidWorldSqsMessageError } from "./errors"
import { processEntityId } from "./processEntityId"
import { contentEntitySceneGenesisPlaza } from "../../../__data__/contentEntitySceneGenesisPlaza"
import { sqsMessage, sqsMessageRoad } from "../../../__data__/sqs"

describe("when processing an entity id", () => {
  let allowedContentServerHosts: string
  let getContentEntity: jest.SpyInstance

  beforeEach(() => {
    allowedContentServerHosts = [
      "peer.decentraland.org",
      "worlds-content-server.decentraland.org",
    ].join(",")
    getContentEntity = jest.spyOn(
      ContentServer.getInstanceFrom(sqsMessage.contentServerUrls![0]),
      "getContentEntity"
    )
  })

  afterEach(() => {
    getContentEntity.mockRestore()
  })

  describe("and the content server is trusted", () => {
    beforeEach(() => {
      getContentEntity.mockResolvedValueOnce(contentEntitySceneGenesisPlaza)
    })

    it("should return the scene deployment", async () => {
      await expect(
        processEntityId(sqsMessage, allowedContentServerHosts)
      ).resolves.toEqual(contentEntitySceneGenesisPlaza)
    })

    it("should fetch the requested entity once", async () => {
      await processEntityId(sqsMessage, allowedContentServerHosts)

      expect(getContentEntity).toHaveBeenCalledTimes(1)
    })
  })

  describe("and a trusted content server follows an untrusted one", () => {
    let job: typeof sqsMessage

    beforeEach(() => {
      job = {
        ...sqsMessage,
        contentServerUrls: [
          "https://untrusted.example/contents",
          "https://peer.decentraland.org/content",
        ],
      }
      getContentEntity.mockResolvedValueOnce(contentEntitySceneGenesisPlaza)
    })

    it("should fetch the entity from the first allowlisted content server", async () => {
      await expect(
        processEntityId(job, allowedContentServerHosts)
      ).resolves.toEqual(contentEntitySceneGenesisPlaza)
    })
  })

  describe("and no content server URL is provided", () => {
    it("should reject the message", async () => {
      await expect(
        processEntityId(
          { ...sqsMessageRoad, contentServerUrls: undefined },
          allowedContentServerHosts
        )
      ).rejects.toThrow("contentServerUrls is required")
    })
  })

  describe("and the content server host is not allowlisted", () => {
    it("should reject the message before fetching content", async () => {
      await expect(
        processEntityId(
          {
            ...sqsMessage,
            contentServerUrls: ["https://untrusted.example/contents"],
          },
          allowedContentServerHosts
        )
      ).rejects.toThrow("contentServerUrls does not contain a trusted host")
    })

    it("should classify the failure as non-retryable", async () => {
      await expect(
        processEntityId(
          {
            ...sqsMessage,
            contentServerUrls: ["https://untrusted.example/contents"],
          },
          allowedContentServerHosts
        )
      ).rejects.toBeInstanceOf(InvalidWorldSqsMessageError)
    })
  })

  describe("and the trusted content-server hosts are not configured", () => {
    it("should reject the message before fetching content", async () => {
      await expect(processEntityId(sqsMessage, "")).rejects.toThrow(
        "ALLOWED_CONTENT_SERVER_HOSTS is not configured"
      )
    })
  })
})
