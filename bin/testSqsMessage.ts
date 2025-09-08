import { AuthLinkType } from "@dcl/schemas/dist/misc/auth-chain"
import SQS from "aws-sdk/clients/sqs"
import logger from "decentraland-gatsby/dist/entities/Development/logger"
import { requiredEnv } from "decentraland-gatsby/dist/utils/env"

import {
  DeploymentToSqs,
  SQSConsumer,
} from "../src/entities/CheckScenes/task/consumer"

// Default test entity IDs (fallback when no entity ID is provided)
const DEFAULT_ENTITY_IDS = [
  "bafkreiabcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnop",
  "bafkreixyzabcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm",
]

// Default auth chain for testing
const DEFAULT_AUTH_CHAIN = [
  {
    type: AuthLinkType.SIGNER,
    payload: "0x1234567890abcdef1234567890abcdef12345678",
    signature: "",
  },
]

async function sendTestMessage(entityId?: string) {
  try {
    // Use provided entity ID or fall back to default
    const finalEntityId = entityId || DEFAULT_ENTITY_IDS[0]

    // Create the message with the entity ID
    const messageToSend: DeploymentToSqs = {
      entity: {
        entityId: finalEntityId,
        authChain: DEFAULT_AUTH_CHAIN,
      },
      contentServerUrls: ["https://peer.decentraland.org/content"],
    }

    // Initialize SQS consumer
    const consumer = new SQSConsumer(
      new SQS({
        apiVersion: "latest",
        region: requiredEnv("AWS_REGION"),
        endpoint: requiredEnv("AWS_ENDPOINT"),
        s3ForcePathStyle: true, // Required for localstack
      }),
      {
        QueueUrl: requiredEnv("QUEUE_URL"),
      }
    )

    logger.log("Sending test message to SQS queue...")
    logger.log("Entity ID:", { entityId: finalEntityId })
    logger.log("Message content:", messageToSend as any)

    // Send the message
    const messageId = await consumer.publish(messageToSend)

    logger.log(`✅ Message sent successfully! MessageId: ${messageId}`)
    logger.log(`Queue URL: ${requiredEnv("QUEUE_URL")}`)

    return messageId
  } catch (error) {
    logger.error("❌ Failed to send message:", error as any)
    throw error
  }
}

// CLI interface
Promise.resolve().then(async () => {
  const args = process.argv.slice(2)
  const entityId = args[0] // Optional entity ID parameter

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
📦 SQS Test Message Sender

Usage:
  npm run test:sqs-message [entity-id]

Parameters:
  entity-id    Optional. The entity ID to send in the message.
               If not provided, uses default test entity ID.

Examples:
  npm run test:sqs-message
  npm run test:sqs-message bafkreiabc123...
  npm run test:sqs-message bafkreixyz456def...

Environment Variables Required:
  AWS_REGION        (e.g., us-east-1)
  QUEUE_URL         (e.g., http://localhost:4566/000000000000/places_test)
  AWS_ACCESS_KEY    (for localstack: test)
  AWS_ACCESS_SECRET (for localstack: test)

Default fallback entity IDs:
  ${DEFAULT_ENTITY_IDS.join("\n  ")}
    `)
    return
  }

  // Send the message with optional entity ID
  await sendTestMessage(entityId)
})
