import { SQS } from "aws-sdk"

import {
  SQSConsumer,
  WorldSqsMessage,
  isDeploymentEvent,
  isScenesUndeploymentEvent,
} from "./consumer"
import {
  ContentServerConfigurationError,
  InvalidSceneBaseError,
  InvalidWorldSqsMessageError,
} from "./errors"
import {
  sqsMessage,
  sqsMessageRoad,
  sqsMessageWithWrongEntityId,
} from "../../../__data__/sqs"
import { notifyError } from "../../Slack/utils"

jest.mock("../../Slack/utils", () => ({ notifyError: jest.fn() }))

const notifyErrorMock = notifyError as jest.MockedFunction<typeof notifyError>

describe("when validating a deployment event", () => {
  describe("and the entity id is an IPFSv2 hash", () => {
    it("should accept the event", () => {
      expect(isDeploymentEvent(sqsMessage)).toBe(true)
    })
  })

  describe("and the entity id is an IPFSv1 hash", () => {
    it("should accept the event", () => {
      expect(isDeploymentEvent(sqsMessageRoad)).toBe(true)
    })
  })

  describe("and the entity id is not an IPFS hash", () => {
    it("should reject the event", () => {
      expect(isDeploymentEvent(sqsMessageWithWrongEntityId)).toBe(false)
    })
  })
})

describe("when validating a world scenes undeployment event", () => {
  const event = {
    type: "world",
    subType: "world_scenes_undeployment",
    key: "example.dcl.eth",
    timestamp: 1,
    metadata: {
      worldName: "example.dcl.eth",
      scenes: [
        { entityId: "deployment-a", baseParcel: "1,1" },
        { entityId: "deployment-b", baseParcel: "2,2" },
      ],
    },
  }

  describe("and every deployment identity is unique and canonical", () => {
    it("should accept the event", () => {
      expect(isScenesUndeploymentEvent(event)).toBe(true)
    })
  })

  describe("and the event includes a canonical scene footprint", () => {
    it("should accept the event", () => {
      expect(
        isScenesUndeploymentEvent({
          ...event,
          metadata: {
            ...event.metadata,
            scenes: [
              {
                entityId: "deployment-a",
                baseParcel: "1,1",
                parcels: ["1,1", "1,2"],
              },
            ],
          },
        })
      ).toBe(true)
    })
  })

  describe("and an included footprint is empty", () => {
    it("should reject the event", () => {
      expect(
        isScenesUndeploymentEvent({
          ...event,
          metadata: {
            ...event.metadata,
            scenes: [
              {
                entityId: "deployment-a",
                baseParcel: "1,1",
                parcels: [],
              },
            ],
          },
        })
      ).toBe(false)
    })
  })

  describe("and an included footprint repeats a parcel", () => {
    it("should reject the event", () => {
      expect(
        isScenesUndeploymentEvent({
          ...event,
          metadata: {
            ...event.metadata,
            scenes: [
              {
                entityId: "deployment-a",
                baseParcel: "1,1",
                parcels: ["1,1", "1,1"],
              },
            ],
          },
        })
      ).toBe(false)
    })
  })

  describe("and an included footprint contains a non-canonical parcel", () => {
    it("should reject the event", () => {
      expect(
        isScenesUndeploymentEvent({
          ...event,
          metadata: {
            ...event.metadata,
            scenes: [
              {
                entityId: "deployment-a",
                baseParcel: "1,1",
                parcels: ["01,1"],
              },
            ],
          },
        })
      ).toBe(false)
    })
  })

  describe("and an entity id is duplicated", () => {
    it("should reject the event", () => {
      expect(
        isScenesUndeploymentEvent({
          ...event,
          metadata: {
            ...event.metadata,
            scenes: [
              event.metadata.scenes[0],
              { entityId: "deployment-a", baseParcel: "2,2" },
            ],
          },
        })
      ).toBe(false)
    })
  })

  describe("and a base parcel is duplicated", () => {
    it("should reject the event", () => {
      expect(
        isScenesUndeploymentEvent({
          ...event,
          metadata: {
            ...event.metadata,
            scenes: [
              event.metadata.scenes[0],
              { entityId: "deployment-b", baseParcel: "1,1" },
            ],
          },
        })
      ).toBe(false)
    })
  })

  describe("and a base parcel is not canonical", () => {
    it("should reject the event", () => {
      expect(
        isScenesUndeploymentEvent({
          ...event,
          metadata: {
            ...event.metadata,
            scenes: [{ entityId: "deployment-a", baseParcel: "01,1" }],
          },
        })
      ).toBe(false)
    })
  })
})

describe("when consuming scene messages", () => {
  let deletePromise: jest.Mock
  let deleteMessage: jest.Mock
  let receivePromise: jest.Mock
  let receiveMessage: jest.Mock
  let sqs: SQS
  let consumer: SQSConsumer
  let taskRunner: jest.Mock<Promise<unknown>, [WorldSqsMessage]>

  beforeEach(() => {
    deletePromise = jest.fn().mockResolvedValue({})
    deleteMessage = jest.fn().mockReturnValue({ promise: deletePromise })
    receivePromise = jest.fn()
    receiveMessage = jest.fn().mockReturnValue({ promise: receivePromise })
    sqs = { deleteMessage, receiveMessage } as unknown as SQS
    consumer = new SQSConsumer(sqs, {
      QueueUrl: "https://sqs.example/queue",
    })
    taskRunner = jest.fn().mockResolvedValue(undefined)
    notifyErrorMock.mockReset()
  })

  describe("and the message body is malformed JSON", () => {
    beforeEach(() => {
      receivePromise.mockResolvedValue({
        Messages: [
          { MessageId: "invalid", ReceiptHandle: "receipt", Body: "{" },
        ],
      })
    })

    it("should delete the invalid message", async () => {
      await consumer.consume(taskRunner)

      expect(deleteMessage).toHaveBeenCalledWith({
        QueueUrl: "https://sqs.example/queue",
        ReceiptHandle: "receipt",
      })
    })

    it("should not run the task", async () => {
      await consumer.consume(taskRunner)

      expect(taskRunner).not.toHaveBeenCalled()
    })
  })

  describe("and the message body does not match a supported event schema", () => {
    beforeEach(() => {
      receivePromise.mockResolvedValue({
        Messages: [
          {
            MessageId: "invalid-schema",
            ReceiptHandle: "receipt",
            Body: JSON.stringify({ unexpected: "message" }),
          },
        ],
      })
    })

    it("should delete the invalid message", async () => {
      await consumer.consume(taskRunner)

      expect(deleteMessage).toHaveBeenCalledWith({
        QueueUrl: "https://sqs.example/queue",
        ReceiptHandle: "receipt",
      })
    })
  })

  describe("and the validated task succeeds", () => {
    beforeEach(() => {
      receivePromise.mockResolvedValue({
        Messages: [
          {
            MessageId: "valid",
            ReceiptHandle: "receipt",
            Body: JSON.stringify(sqsMessage),
          },
        ],
      })
    })

    it("should acknowledge the message", async () => {
      await consumer.consume(taskRunner)

      expect(deleteMessage).toHaveBeenCalledTimes(1)
    })

    it("should pass the validated body to the task", async () => {
      await consumer.consume(taskRunner)

      expect(taskRunner).toHaveBeenCalledWith(sqsMessage)
    })
  })

  describe("and the task fails", () => {
    beforeEach(() => {
      receivePromise.mockResolvedValue({
        Messages: [
          {
            MessageId: "retry",
            ReceiptHandle: "receipt",
            Body: JSON.stringify(sqsMessage),
          },
        ],
      })
      taskRunner.mockRejectedValue(new Error("temporary failure"))
    })

    it("should leave the message unacknowledged for retry", async () => {
      await consumer.consume(taskRunner)

      expect(deleteMessage).not.toHaveBeenCalled()
    })
  })

  describe("and the task rejects a deterministically invalid message", () => {
    beforeEach(() => {
      receivePromise.mockResolvedValue({
        Messages: [
          {
            MessageId: "invalid-host",
            ReceiptHandle: "receipt",
            Body: JSON.stringify(sqsMessage),
          },
        ],
      })
      taskRunner.mockRejectedValue(
        new InvalidWorldSqsMessageError("content server is not trusted")
      )
    })

    it("should acknowledge the message instead of retrying forever", async () => {
      await consumer.consume(taskRunner)

      expect(deleteMessage).toHaveBeenCalledWith({
        QueueUrl: "https://sqs.example/queue",
        ReceiptHandle: "receipt",
      })
    })
  })

  describe("and the task rejects a deployment whose scene identity is not authorized", () => {
    beforeEach(() => {
      receivePromise.mockResolvedValue({
        Messages: [
          {
            MessageId: "invalid-scene-base",
            ReceiptHandle: "receipt",
            Body: JSON.stringify(sqsMessage),
          },
        ],
      })
      taskRunner.mockRejectedValue(new InvalidSceneBaseError("100,100"))
    })

    it("should acknowledge the message instead of retrying forever", async () => {
      await consumer.consume(taskRunner)

      expect(deleteMessage).toHaveBeenCalledWith({
        QueueUrl: "https://sqs.example/queue",
        ReceiptHandle: "receipt",
      })
    })

    it("should not notify the deterministic failure to Slack", async () => {
      await consumer.consume(taskRunner)

      expect(notifyErrorMock).not.toHaveBeenCalled()
    })
  })

  describe("and the task fails because the content-server allowlist is missing", () => {
    beforeEach(() => {
      receivePromise.mockResolvedValue({
        Messages: [
          {
            MessageId: "missing-configuration",
            ReceiptHandle: "receipt",
            Body: JSON.stringify(sqsMessage),
          },
        ],
      })
      taskRunner.mockRejectedValue(
        new ContentServerConfigurationError(
          "ALLOWED_CONTENT_SERVER_HOSTS is not configured"
        )
      )
    })

    it("should leave the message unacknowledged for retry", async () => {
      await consumer.consume(taskRunner)

      expect(deleteMessage).not.toHaveBeenCalled()
    })
  })

  describe("and an acknowledged message has no receipt handle", () => {
    beforeEach(() => {
      receivePromise.mockResolvedValue({
        Messages: [
          {
            MessageId: "missing-receipt",
            Body: JSON.stringify(sqsMessage),
          },
        ],
      })
    })

    it("should not attempt to delete the message", async () => {
      await consumer.consume(taskRunner)

      expect(deleteMessage).not.toHaveBeenCalled()
    })
  })

  describe("and deleting an acknowledged message fails", () => {
    beforeEach(() => {
      receivePromise.mockResolvedValue({
        Messages: [
          {
            MessageId: "first",
            ReceiptHandle: "first-receipt",
            Body: JSON.stringify(sqsMessage),
          },
          {
            MessageId: "second",
            ReceiptHandle: "second-receipt",
            Body: JSON.stringify(sqsMessage),
          },
        ],
      })
      deletePromise
        .mockRejectedValueOnce(new Error("temporary delete failure"))
        .mockResolvedValueOnce({})
    })

    it("should continue processing the remaining batch messages", async () => {
      await consumer.consume(taskRunner)

      expect(taskRunner).toHaveBeenCalledTimes(2)
    })
  })

  describe("and a batch has processed, retryable, and invalid messages", () => {
    beforeEach(() => {
      receivePromise.mockResolvedValue({
        Messages: [
          {
            MessageId: "processed",
            ReceiptHandle: "processed-receipt",
            Body: JSON.stringify(sqsMessage),
          },
          {
            MessageId: "retry",
            ReceiptHandle: "retry-receipt",
            Body: JSON.stringify(sqsMessage),
          },
          {
            MessageId: "invalid",
            ReceiptHandle: "invalid-receipt",
            Body: JSON.stringify(sqsMessage),
          },
        ],
      })
      taskRunner
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("temporary failure"))
        .mockRejectedValueOnce(
          new InvalidWorldSqsMessageError("deterministically invalid")
        )
    })

    it("should acknowledge only processed and deterministically invalid messages", async () => {
      await consumer.consume(taskRunner)

      expect(
        deleteMessage.mock.calls.map(([request]) => request.ReceiptHandle)
      ).toEqual(["processed-receipt", "invalid-receipt"])
    })
  })
})
