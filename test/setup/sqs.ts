import SQS from "aws-sdk/clients/sqs"
import env from "decentraland-gatsby/dist/utils/env"

import {
  SQSConsumer,
  WorldSqsMessage,
} from "../../src/entities/CheckScenes/task/consumer"
import { taskRunnerDispatcher } from "../../src/entities/CheckScenes/task/taskRunnerDispatcher"

const AWS_REGION = env("AWS_REGION", "us-east-1")
const AWS_ENDPOINT = env("AWS_ENDPOINT", "http://localhost:4566")
const QUEUE_URL = env(
  "QUEUE_URL",
  "http://localhost:4566/000000000000/places_test"
)

/**
 * Creates a pre-configured SQS client pointing at LocalStack.
 */
export function createSqsClient(): SQS {
  return new SQS({
    apiVersion: "latest",
    region: AWS_REGION,
    endpoint: AWS_ENDPOINT,
  })
}

/**
 * Sends a single message to the test SQS queue.
 */
export async function sendSqsMessage(body: WorldSqsMessage): Promise<string> {
  const sqs = createSqsClient()
  const result = await sqs
    .sendMessage({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(body),
    })
    .promise()
  return result.MessageId!
}

/**
 * Purges all messages from the test SQS queue.
 */
export async function purgeQueue(): Promise<void> {
  const sqs = createSqsClient()
  await sqs
    .purgeQueue({
      QueueUrl: QUEUE_URL,
    })
    .promise()
}

/**
 * Creates an SQSConsumer instance configured for the test queue.
 * Uses the production taskRunnerDispatcher to process messages
 * through the same code path as the real application.
 */
export function createTestConsumer(): SQSConsumer {
  const sqs = createSqsClient()
  return new SQSConsumer(sqs, {
    AttributeNames: ["SentTimestamp"],
    MaxNumberOfMessages: 10,
    MessageAttributeNames: ["All"],
    QueueUrl: QUEUE_URL,
    WaitTimeSeconds: 0,
    VisibilityTimeout: 600,
  })
}

/**
 * Sends a message to SQS and immediately consumes it through the dispatcher.
 * This simulates the full production flow: publish -> consume -> dispatch -> handler.
 */
export async function sendAndConsume(body: WorldSqsMessage): Promise<void> {
  await sendSqsMessage(body)
  const consumer = createTestConsumer()
  await consumer.consume(taskRunnerDispatcher)
}
