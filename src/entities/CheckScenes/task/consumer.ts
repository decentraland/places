import { AuthChain } from "@dcl/schemas/dist/misc/auth-chain"
import { SQS } from "aws-sdk"
import logger from "decentraland-gatsby/dist/entities/Development/logger"
import delay from "decentraland-gatsby/dist/utils/promise/delay"

import { notifyError } from "../../Slack/utils"

export declare type DeploymentToSqs = {
  entity: {
    entityId: string
    authChain: AuthChain
  }
  contentServerUrls?: string[]
}

export interface TaskQueueMessage {
  id: string
}

export class SQSConsumer {
  sumatory = 0
  constructor(public sqs: SQS, public params: AWS.SQS.ReceiveMessageRequest) {}

  async publish(job: DeploymentToSqs) {
    const published = await this.sqs
      .sendMessage({
        QueueUrl: this.params.QueueUrl,
        MessageBody: JSON.stringify({
          Message: JSON.stringify(job),
        }),
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
      MessageBody: JSON.stringify({
        Message: JSON.stringify(job),
      }),
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

  async consume(taskRunner: (job: DeploymentToSqs) => Promise<any>) {
    try {
      const response = await Promise.race([
        this.sqs.receiveMessage(this.params).promise(),
        delay(30 * 60 * 1000, "Timed out sqs.receiveMessage"),
      ])
      const finalReturn = []
      if (
        typeof response !== "string" &&
        response?.Messages &&
        response.Messages.length > 0
      ) {
        for (const it of response.Messages) {
          const message: TaskQueueMessage = { id: it.MessageId! }
          const body = JSON.parse(JSON.parse(it.Body!).Message)
          const loggerExtended = logger.extend({
            id: message.id,
            message: body,
            QueueUrl: this.params.QueueUrl,
            ReceiptHandle: it.ReceiptHandle!,
          })

          try {
            loggerExtended.log(`Processing job`)

            const result = await taskRunner(body)

            loggerExtended.log(`Processed job`)
            finalReturn.push({ result, message })
          } catch (err: any) {
            if (!err.message.includes("The scene is a road")) {
              notifyError([
                err.toString(),
                `\`\`\`${JSON.stringify(body)}\`\`\``,
              ])
              loggerExtended.error(err.toString())
            }

            finalReturn.push({ result: undefined, message })
          } finally {
            loggerExtended.log(`Deleting message`)
            await this.sqs
              .deleteMessage({
                QueueUrl: this.params.QueueUrl,
                ReceiptHandle: it.ReceiptHandle!,
              })
              .promise()
          }
        }
      }
      return finalReturn
    } catch (err: any) {
      logger.error(err)
    }
  }
}
