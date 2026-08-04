import ContentServer from "decentraland-gatsby/dist/utils/api/ContentServer"

import { InvalidWorldSqsMessageError } from "./errors"
import { processEntityId } from "./processEntityId"
import { contentEntitySceneGenesisPlaza } from "../../../__data__/contentEntitySceneGenesisPlaza"
import { sqsMessage, sqsMessageRoad } from "../../../__data__/sqs"

describe("when processing an entity id", () => {
  let getContentEntity: jest.SpyInstance

  beforeEach(() => {
    getContentEntity = jest.spyOn(
      ContentServer.getInstanceFrom(sqsMessage.contentServerUrls![0]),
      "getContentEntity"
    )
  })

  afterEach(() => {
    getContentEntity.mockRestore()
    delete process.env.ALLOWED_CONTENT_SERVER_HOSTS
  })

  describe("and the content server is trusted", () => {
    beforeEach(() => {
      getContentEntity.mockResolvedValueOnce(contentEntitySceneGenesisPlaza)
    })

    it("should return the scene deployment", async () => {
      await expect(processEntityId(sqsMessage)).resolves.toEqual(
        contentEntitySceneGenesisPlaza
      )
    })

    it("should fetch the requested entity once", async () => {
      await processEntityId(sqsMessage)

      expect(getContentEntity).toHaveBeenCalledTimes(1)
    })
  })

  describe("and no content server URL is provided", () => {
    it("should reject the message", async () => {
      await expect(
        processEntityId({ ...sqsMessageRoad, contentServerUrls: undefined })
      ).rejects.toThrow("contentServerUrls is required")
    })
  })

  describe("and the content server host is not allowlisted", () => {
    it("should reject the message before fetching content", async () => {
      await expect(
        processEntityId({
          ...sqsMessage,
          contentServerUrls: ["https://untrusted.example/contents"],
        })
      ).rejects.toThrow("contentServerUrls contains an untrusted host")
    })

    it("should classify the failure as non-retryable", async () => {
      await expect(
        processEntityId({
          ...sqsMessage,
          contentServerUrls: ["https://untrusted.example/contents"],
        })
      ).rejects.toBeInstanceOf(InvalidWorldSqsMessageError)
    })
  })
})
