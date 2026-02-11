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

---

## `populateSdk.ts`

One-time script to backfill the `sdk` column in the database by fetching `runtimeVersion` from scene.json files via Catalyst (for Genesis City places) and Worlds Content Server (for worlds).

### Usage

```bash
# Development environment
npm run populate:sdk:dev

# Staging environment
npm run populate:sdk:stg

# Production environment
npm run populate:sdk:prd
```

### Options

| Option      | Description                                        |
| ----------- | -------------------------------------------------- |
| `--dry-run` | Preview changes without modifying the database     |
| `--limit N` | Process only N records                             |
| `--places`  | Process only Genesis City places (excludes worlds) |
| `--worlds`  | Process only worlds (excludes places)              |

### Examples

```bash
# Dry run with limit of 10 records in development
npm run populate:sdk:dev -- --dry-run --limit 10

# Process only worlds in staging
npm run populate:sdk:stg -- --worlds

# Full production run (use with caution)
npm run populate:sdk:prd
```

### Environment Variables

| Variable                    | Description                  | Default                                          |
| --------------------------- | ---------------------------- | ------------------------------------------------ |
| `CONNECTION_STRING`         | PostgreSQL connection string | (required)                                       |
| `CATALYST_URL`              | Catalyst server URL          | `https://peer.decentraland.org`                  |
| `WORLDS_CONTENT_SERVER_URL` | Worlds Content Server URL    | `https://worlds-content-server.decentraland.org` |

### How It Works

1. Queries database for records with `sdk IS NULL`
2. For Genesis City places: Fetches scene entities from Catalyst API and extracts `runtimeVersion` from scene.json
3. For Worlds: Fetches world metadata from Worlds Content Server using world name/URN
4. Updates database records with the extracted SDK version
