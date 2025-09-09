# CLI Tools

## `testSqsMessage.ts`

Sends test messages to the local SQS queue.

### Usage

```bash
# Send message with default entity ID
npm run test:sqs-message

# Send message with custom entity ID
npm run test:sqs-message bafkreiabc123...

# View help
npm run test:sqs-message --help
```

### Quick Test

```bash
docker-compose up -d        # Start services
npm run test:sqs-message   # Send message
npm run serve              # Process messages
```

**See:** [SQS Setup Guide](../docs/sqs-setup.md) for detailed SQS configuration.
