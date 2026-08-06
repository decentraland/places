import { AuthChain } from "@dcl/schemas/dist/misc/auth-chain"
import { Events } from "@dcl/schemas/dist/platform/events/base"
import {
  WorldScenesUndeploymentEvent,
  WorldSettingsChangedEvent,
  WorldUndeploymentEvent,
} from "@dcl/schemas/dist/platform/events/world"
import { generateLazyValidator } from "@dcl/schemas/dist/validation"
import { SQS } from "aws-sdk"
import logger from "decentraland-gatsby/dist/entities/Development/logger"

import { InvalidWorldSqsMessageError } from "./errors"
import { notifyError } from "../../Slack/utils"

export declare type DeploymentToSqs = {
  entity: {
    entityId: string
    authChain: AuthChain
  }
  contentServerUrls?: string[]
}

/** Union type for all possible SQS message types */
export type WorldSqsMessage =
  | DeploymentToSqs
  | WorldSettingsChangedEvent
  | WorldScenesUndeploymentEvent
  | WorldUndeploymentEvent

const validateWorldSettingsChanged = generateLazyValidator(
  WorldSettingsChangedEvent.schema
)
const ENTITY_ID_PATTERN = /^(?:Qm[a-zA-Z0-9]{44}|ba[a-zA-Z0-9]{57})$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Type guard to check if message is a deployment event */
export function isDeploymentEvent(
  message: unknown
): message is DeploymentToSqs {
  if (!isRecord(message) || !isRecord(message.entity)) return false
  const contentServerUrls = message.contentServerUrls
  return (
    typeof message.entity.entityId === "string" &&
    ENTITY_ID_PATTERN.test(message.entity.entityId) &&
    AuthChain.validate(message.entity.authChain) &&
    Array.isArray(contentServerUrls) &&
    contentServerUrls.length > 0 &&
    contentServerUrls.length <= 10 &&
    new Set(contentServerUrls).size === contentServerUrls.length &&
    contentServerUrls.every((url) => {
      if (typeof url !== "string" || url.length > 2048) return false
      try {
        const parsed = new URL(url)
        return parsed.protocol === "https:"
      } catch {
        return false
      }
    })
  )
}

/** Type guard to check if message is a settings changed event */
export function isSettingsChangedEvent(
  message: unknown
): message is WorldSettingsChangedEvent {
  return (
    isRecord(message) &&
    message.type === Events.Type.WORLD &&
    message.subType === Events.SubType.Worlds.WORLD_SETTINGS_CHANGED &&
    validateWorldSettingsChanged(message)
  )
}

/** Type guard to check if message is a scene undeployment event */
export function isScenesUndeploymentEvent(
  message: unknown
): message is WorldScenesUndeploymentEvent {
  return isRecord(message) && WorldScenesUndeploymentEvent.validate(message)
}

/** Type guard to check if message is a full world undeployment event */
export function isWorldUndeploymentEvent(
  message: unknown
): message is WorldUndeploymentEvent {
  return (
    isRecord(message) &&
    message.type === Events.Type.WORLD &&
    message.subType === Events.SubType.Worlds.WORLD_UNDEPLOYMENT &&
    WorldUndeploymentEvent.validate(message)
  )
}

export function parseWorldSqsMessage(value: unknown): WorldSqsMessage | null {
  if (isDeploymentEvent(value)) return value
  if (isSettingsChangedEvent(value)) return value
  if (isScenesUndeploymentEvent(value)) return value
  if (isWorldUndeploymentEvent(value)) return value
  return null
}

export interface TaskQueueMessage {
  id: string
}

type TaskExecutionResult = {
  result: unknown
  message: TaskQueueMessage
}

type MessageProcessingOutcome =
  | { kind: "processed"; taskResult: TaskExecutionResult }
  | { kind: "discarded" }
  | { kind: "retry"; taskResult: TaskExecutionResult }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function errorContext(body: WorldSqsMessage): string {
  if (isDeploymentEvent(body)) {
    return `<${body.contentServerUrls}/contents/${body.entity.entityId}|${body.entity.entityId}>`
  }
  if (isSettingsChangedEvent(body)) {
    return `WorldSettingsChanged: ${body.key}`
  }
  if (isScenesUndeploymentEvent(body)) {
    return `WorldScenesUndeployment: ${
      body.key
    } - scenes: ${body.metadata.scenes
      .map((scene) => scene.entityId)
      .join(", ")}`
  }
  return `WorldUndeployment: ${body.metadata.worldName}`
}

export class SQSConsumer {
  sumatory = 0
  constructor(public sqs: SQS, public params: AWS.SQS.ReceiveMessageRequest) {}

  async publish(job: DeploymentToSqs) {
    const published = await this.sqs
      .sendMessage({
        QueueUrl: this.params.QueueUrl,
        MessageBody: JSON.stringify(job),
      })
      .promise()

    const loggerExtended = logger.extend({
      id: published.MessageId!,
      message: job,
      QueueUrl: this.params.QueueUrl,
    })

    loggerExtended.log(`Published`)

    return published.MessageId!
  }

  async publishBatch(jobs: DeploymentToSqs[]) {
    const entries = jobs.map((job) => ({
      Id: job.entity.entityId,
      MessageBody: JSON.stringify(job),
    }))
    const published = await this.sqs
      .sendMessageBatch({ QueueUrl: this.params.QueueUrl, Entries: entries })
      .promise()

    this.sumatory += published.Successful.length
    const loggerExtended = logger.extend({
      successfullyPublished: published.Successful.length,
      failures: published.Failed.length,
      totalEntries: entries.length,
      totalPublished: this.sumatory,
    })

    loggerExtended.log(`Published`)

    return published.Successful!.map((it) => it.Id!)
  }

  private async processMessage(
    sqsMessage: AWS.SQS.Message,
    taskRunner: (job: WorldSqsMessage) => Promise<unknown>
  ): Promise<MessageProcessingOutcome> {
    const message: TaskQueueMessage = { id: sqsMessage.MessageId || "" }
    const loggerExtended = logger.extend({
      id: message.id,
      QueueUrl: this.params.QueueUrl,
      ReceiptHandle: sqsMessage.ReceiptHandle || "",
    })

    let body: WorldSqsMessage | null
    try {
      body = parseWorldSqsMessage(JSON.parse(sqsMessage.Body || ""))
    } catch (error: unknown) {
      loggerExtended.error(
        `Discarding malformed SQS message JSON: ${errorMessage(error)}`
      )
      return { kind: "discarded" }
    }

    if (!body) {
      loggerExtended.error(`Discarding invalid SQS message`)
      return { kind: "discarded" }
    }

    try {
      loggerExtended.log(`Processing job`)
      const result = await taskRunner(body)
      loggerExtended.log(`Processed job`)
      return { kind: "processed", taskResult: { result, message } }
    } catch (error: unknown) {
      if (error instanceof InvalidWorldSqsMessageError) {
        loggerExtended.error(
          `Discarding deterministically invalid SQS message: ${error.message}`
        )
        return { kind: "discarded" }
      }

      notifyError([errorMessage(error), errorContext(body)])
      loggerExtended.error(errorMessage(error))
      return {
        kind: "retry",
        taskResult: { result: undefined, message },
      }
    }
  }

  private async acknowledgeMessage(sqsMessage: AWS.SQS.Message): Promise<void> {
    const loggerExtended = logger.extend({
      id: sqsMessage.MessageId || "",
      QueueUrl: this.params.QueueUrl,
      ReceiptHandle: sqsMessage.ReceiptHandle || "",
    })

    if (!sqsMessage.ReceiptHandle) {
      loggerExtended.error(`Cannot delete SQS message without a receipt handle`)
      return
    }

    loggerExtended.log(`Deleting message`)
    try {
      await this.sqs
        .deleteMessage({
          QueueUrl: this.params.QueueUrl,
          ReceiptHandle: sqsMessage.ReceiptHandle,
        })
        .promise()
    } catch (error: unknown) {
      loggerExtended.error(`Error deleting SQS message: ${errorMessage(error)}`)
    }
  }

  async consume(taskRunner: (job: WorldSqsMessage) => Promise<unknown>) {
    try {
      const response = await this.sqs.receiveMessage(this.params).promise()
      const finalReturn: TaskExecutionResult[] = []
      if (
        typeof response !== "string" &&
        response?.Messages &&
        response.Messages.length > 0
      ) {
        for (const sqsMessage of response.Messages) {
          const outcome = await this.processMessage(sqsMessage, taskRunner)

          if (outcome.kind !== "discarded") {
            finalReturn.push(outcome.taskResult)
          }
          if (outcome.kind !== "retry") {
            await this.acknowledgeMessage(sqsMessage)
          }
        }
      }
      return finalReturn
    } catch (error: unknown) {
      logger.error(errorMessage(error))
    }
  }
}
