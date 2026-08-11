import { hashV0, hashV1 } from "@dcl/hashing"

import {
  ContentServerConfigurationError,
  InvalidWorldSqsMessageError,
} from "./errors"
import { processEntityId } from "./processEntityId"
import { contentEntitySceneGenesisPlaza } from "../../../__data__/contentEntitySceneGenesisPlaza"
import { sqsMessage, sqsMessageRoad } from "../../../__data__/sqs"

import type { DeploymentToSqs } from "./consumer"

jest.mock("@dcl/hashing")

describe("when processing an entity id", () => {
  let allowedContentServerHosts: string
  let entityJson: string
  let fetchMock: jest.SpiedFunction<typeof fetch>
  let job: DeploymentToSqs

  beforeEach(() => {
    allowedContentServerHosts = [
      "peer.decentraland.org",
      "worlds-content-server.decentraland.org",
    ].join(",")
    entityJson = JSON.stringify(contentEntitySceneGenesisPlaza)
    job = sqsMessage
    jest.mocked(hashV1).mockResolvedValue(job.entity.entityId)
    fetchMock = jest.spyOn(global, "fetch")
  })

  afterEach(() => {
    fetchMock.mockRestore()
  })

  describe("and the content server returns the requested IPFSv2 entity", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(new Response(entityJson))
    })

    it("should return the verified scene deployment", async () => {
      await expect(
        processEntityId(job, allowedContentServerHosts)
      ).resolves.toEqual(JSON.parse(entityJson))
    })

    it("should fetch the requested entity from the trusted server", async () => {
      await processEntityId(job, allowedContentServerHosts)

      expect(fetchMock).toHaveBeenCalledWith(
        `https://peer.decentraland.org/content/contents/${job.entity.entityId}`,
        { signal: expect.any(AbortSignal) }
      )
    })

    it("should hash the exact response bytes before parsing", async () => {
      await processEntityId(job, allowedContentServerHosts)

      expect(hashV1).toHaveBeenCalledWith(
        new Uint8Array(Buffer.from(entityJson))
      )
    })
  })

  describe("and the content server returns the requested IPFSv1 entity", () => {
    beforeEach(() => {
      job = sqsMessageRoad
      jest.mocked(hashV0).mockResolvedValue(job.entity.entityId)
      fetchMock.mockResolvedValueOnce(new Response(entityJson))
    })

    it("should return the verified scene deployment", async () => {
      await expect(
        processEntityId(job, allowedContentServerHosts)
      ).resolves.toEqual(JSON.parse(entityJson))
    })
  })

  describe("and a trusted content server follows an untrusted one", () => {
    beforeEach(() => {
      job = {
        ...job,
        contentServerUrls: [
          "https://untrusted.example/contents",
          "https://peer.decentraland.org/content",
        ],
      }
      fetchMock.mockResolvedValueOnce(new Response(entityJson))
    })

    it("should fetch the entity from the first allowlisted content server", async () => {
      await processEntityId(job, allowedContentServerHosts)

      expect(fetchMock).toHaveBeenCalledWith(
        `https://peer.decentraland.org/content/contents/${job.entity.entityId}`,
        { signal: expect.any(AbortSignal) }
      )
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
    beforeEach(() => {
      job = {
        ...job,
        contentServerUrls: ["https://untrusted.example/contents"],
      }
    })

    it("should reject the message before fetching content", async () => {
      await expect(
        processEntityId(job, allowedContentServerHosts)
      ).rejects.toThrow("contentServerUrls does not contain a trusted host")

      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("should classify the failure as non-retryable", async () => {
      await expect(
        processEntityId(job, allowedContentServerHosts)
      ).rejects.toBeInstanceOf(InvalidWorldSqsMessageError)
    })
  })

  describe("and the trusted content-server hosts are not configured", () => {
    it("should classify the configuration failure as retryable", async () => {
      await expect(processEntityId(job, "")).rejects.toBeInstanceOf(
        ContentServerConfigurationError
      )

      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe("and the content server returns bytes for a different entity", () => {
    beforeEach(() => {
      job = sqsMessage
      jest.mocked(hashV1).mockResolvedValueOnce("bafkreimismatched")
      fetchMock.mockResolvedValueOnce(new Response(entityJson))
    })

    it("should reject the mismatched content as a non-retryable message", async () => {
      await expect(
        processEntityId(job, allowedContentServerHosts)
      ).rejects.toBeInstanceOf(InvalidWorldSqsMessageError)
    })

    it("should identify the requested entity in the error", async () => {
      await expect(
        processEntityId(job, allowedContentServerHosts)
      ).rejects.toThrow(
        `Content deployment hash does not match requested entity id ${job.entity.entityId}`
      )
    })
  })

  describe("and fetching the entity fails", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, { status: 503, statusText: "Unavailable" })
      )
    })

    it("should surface a retryable error", async () => {
      await expect(
        processEntityId(job, allowedContentServerHosts)
      ).rejects.not.toBeInstanceOf(InvalidWorldSqsMessageError)
    })
  })

  describe("and the verified entity is not a JSON object", () => {
    beforeEach(() => {
      entityJson = "null"
      fetchMock.mockResolvedValueOnce(new Response(entityJson))
    })

    it("should reject the invalid entity without retrying forever", async () => {
      await expect(
        processEntityId(job, allowedContentServerHosts)
      ).rejects.toBeInstanceOf(InvalidWorldSqsMessageError)
    })
  })
})
