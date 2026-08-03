import { SQS } from "aws-sdk"

import { SQSConsumer, WorldSqsMessage } from "./consumer"
import { sqsMessage } from "../../../__data__/sqs"

jest.mock("../../Slack/utils", () => ({ notifyError: jest.fn() }))

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
})
