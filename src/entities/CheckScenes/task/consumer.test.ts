import { SQS } from "aws-sdk"

import {
  SQSConsumer,
  WorldSqsMessage,
  isScenesUndeploymentEvent,
} from "./consumer"
import { InvalidWorldSqsMessageError } from "./errors"
import { sqsMessage } from "../../../__data__/sqs"

jest.mock("../../Slack/utils", () => ({ notifyError: jest.fn() }))

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
})
