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
  constructor(public sqs: SQS, public params: AWS.SQS.ReceiveMessageRequest) {}

  async consume(taskRunner: (job: DeploymentToSqs) => Promise<any>) {
    try {
      const response = await Promise.race([
        this.sqs.receiveMessage(this.params).promise(),
        delay(30 * 60 * 1000, "Timed out sqs.receiveMessage"),
      ])

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
            return { result, message }
          } catch (err: any) {
            notifyError([err.toString(), `\`\`\`${JSON.stringify(body)}\`\`\``])
            loggerExtended.error(err.toString())
            return { result: undefined, message }
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
    } catch (err: any) {
      logger.error(err)
    }
  }
}
