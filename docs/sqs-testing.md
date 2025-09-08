# SQS Testing Guide

This guide provides comprehensive documentation for testing the SQS integration in the Places service, including automated tools and manual debugging techniques.

## Quick Reference

### Send Test Message
```bash
# Send message with default entity ID
npm run test:sqs-message

# Send message with custom entity ID
npm run test:sqs-message bafkreiabc123...

# View help
npm run test:sqs-message --help
```

### Check Message Processing
```bash
# Start server to process messages
npm run serve

# Start server with debug mode
npm run debug
```

## The `testSqsMessage.ts` Script

### Overview
The `bin/testSqsMessage.ts` script is a utility for sending properly formatted test messages to the local SQS queue. It handles the complex message structure and authentication automatically.

### Usage Patterns

#### Basic Usage
```bash
# Send message with default test entity ID
npm run test:sqs-message
```

#### Custom Entity ID
```bash
# Send message with specific entity ID
npm run test:sqs-message QmYourEntityId123...
```

#### Help and Documentation
```bash
# Display usage information
npm run test:sqs-message --help
```

### Message Format

The script automatically creates messages in the correct format expected by the SQS consumer:

```typescript
{
  entity: {
    entityId: "bafkreiabc123...",  // IPFS hash
    authChain: [                   // Authentication chain
      {
        type: "SIGNER",
        payload: "0x1234567890abcdef1234567890abcdef12345678",
        signature: ""
      }
    ]
  },
  contentServerUrls: ["https://peer.decentraland.org/content"]
}
```

### Default Test Entity IDs

When no entity ID is provided, the script uses these fallback values:
- `bafkreiabcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnop`
- `bafkreixyzabcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm`

## Environment Requirements

### Required Variables
Ensure these are set in your `.env.development`:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
QUEUE_URL=http://localhost:4566/000000000000/places_test
AWS_ENDPOINT=http://localhost:4566
```

### Docker Services
Make sure the required services are running:

```bash
# Start database and LocalStack
docker-compose up -d

# Verify services are healthy
docker-compose ps
```

## Debugging SQS Integration

### 1. Message Sending Issues

**Check LocalStack Connection:**
```bash
# Verify LocalStack is running
curl http://localhost:4566/health

# Check SQS service specifically
awslocal sqs list-queues
```

**Verify Environment Variables:**
```bash
# Check if variables are loaded correctly
npm run test:sqs-message --help
```

### 2. Message Processing Issues

**Check Queue Contents:**
```bash
# List messages in queue (LocalStack-specific endpoint)
curl -H "Accept: application/json" \
  "http://localhost:4566/_aws/sqs/messages?QueueUrl=http://localhost:4566/000000000000/places_test"
```

**Server Debug Mode:**
```bash
# Start server with debugging enabled
npm run debug

# Or with auto-restart
npm run debug:nodemon
```

**Check Server Logs:**
Look for these log patterns:
- `Start scenes_consumer` - Consumer task is running
- `[]` - No messages found (expected when queue is empty)
- `Processing job` - Message is being processed
- `Processed job` - Message completed successfully

### 3. Common Issues and Solutions

#### Empty Arrays in Logs
```
Start scenes_consumer
[]
```
**Cause:** No messages in queue or authentication issues
**Solution:** 
1. Send a test message: `npm run test:sqs-message`
2. Check AWS credentials in `.env.development`

#### AWS Access Key Errors
```
The AWS Access Key Id you provided does not exist in our records
```
**Cause:** Incorrect environment variable names
**Solution:** Use `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` (not `AWS_ACCESS_KEY` and `AWS_ACCESS_SECRET`)

#### Connection Refused
```
connect ECONNREFUSED 127.0.0.1:4566
```
**Cause:** LocalStack not running
**Solution:** `docker-compose up -d`

## Advanced Testing

### Manual Queue Operations

#### Using AWS CLI (LocalStack)
```bash
# Send message manually
awslocal sqs send-message \
  --queue-url http://localhost:4566/000000000000/places_test \
  --message-body '{"Message":"{\"entity\":{\"entityId\":\"bafkreiabc123\",\"authChain\":\"authChain\"},\"contentServerUrls\":[\"https://peer.decentraland.org/content\"]}"}'

# Receive messages
awslocal sqs receive-message \
  --queue-url http://localhost:4566/000000000000/places_test

# Purge queue
awslocal sqs purge-queue \
  --queue-url http://localhost:4566/000000000000/places_test
```

#### Using curl (LocalStack-specific)
```bash
# Get queue attributes
curl "http://localhost:4566/_aws/sqs/queue-attributes?QueueUrl=http://localhost:4566/000000000000/places_test"

# Get messages without consuming
curl -H "Accept: application/json" \
  "http://localhost:4566/_aws/sqs/messages?QueueUrl=http://localhost:4566/000000000000/places_test"
```

### Database Verification

After processing messages, verify data was written:

```sql
-- Check latest places
SELECT id, title, entity_id, owner, created_at 
FROM places 
ORDER BY created_at DESC 
LIMIT 5;

-- Check place positions
SELECT * FROM place_positions 
WHERE base_position IN (
  SELECT base_position FROM places 
  ORDER BY created_at DESC 
  LIMIT 1
);
```

## Integration with VS Code

### Debug Configurations

Use the provided VS Code launch configurations:

1. **Debug Server (SQS Consumer)** - Debug the main server with SQS processing
2. **Debug Server with Nodemon** - Auto-restart debug mode
3. **Debug SQS Message Script** - Debug the test message script

### Setting Breakpoints

Key locations for debugging:
- `src/entities/CheckScenes/task/consumer.ts:consume()` - Message reception
- `src/entities/CheckScenes/task/taskRunnerSqs.ts` - Message processing logic
- `src/entities/CheckScenes/task/processContentEntityScene.ts` - Data transformation

## Troubleshooting Checklist

1. **Services Running?**
   - [ ] `docker-compose ps` shows healthy services
   - [ ] LocalStack health check passes

2. **Environment Correct?**
   - [ ] `.env.development` exists with correct values
   - [ ] AWS credential variable names are correct

3. **Queue Accessible?**
   - [ ] `awslocal sqs list-queues` shows the test queue
   - [ ] Test message sends successfully

4. **Server Processing?**
   - [ ] Server logs show `Start scenes_consumer` every 10 seconds
   - [ ] No errors in server output
   - [ ] Database connection working

5. **End-to-End Test:**
   - [ ] Send message: `npm run test:sqs-message bafkreiabc123`
   - [ ] Check processing: Server logs show message handling
   - [ ] Verify result: Database contains new place record

## Production Considerations

When adapting this setup for production:

1. **AWS Credentials**: Use proper IAM roles instead of test credentials
2. **Queue Configuration**: Set appropriate visibility timeouts and dead letter queues
3. **Monitoring**: Add CloudWatch metrics and alarms
4. **Security**: Use VPC endpoints and encryption in transit/at rest
