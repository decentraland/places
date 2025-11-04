# Places

[![Coverage Status](https://coveralls.io/repos/github/decentraland/places/badge.svg?branch=master)](https://coveralls.io/github/decentraland/places?branch=master)

The Decentraland Places service processes Catalysts' scenes and Worlds deployments; fetching content from servers and maintaining a database of places for the Decentraland ecosystem.

![decentraland](https://decentraland.org/images/fallback-hero.jpg)

## How It Works

The service receives SQS messages containing entity IDs and content server URLs, fetches scene or world metadata, and creates Place records in the database.

## Setup

### Prerequisites

- Docker and Docker Compose
- Node.js (see `.nvmrc`)

### Quick Start

1. **Environment**

   ```bash
   touch .env.development
   ```

   Add to `.env.development`:

   ```bash
   CONNECTION_STRING=postgres://postgres:postgres@localhost:5432/postgres
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=test
   AWS_SECRET_ACCESS_KEY=test
   QUEUE_URL=http://localhost:4566/000000000000/places_test
   AWS_ENDPOINT=http://localhost:4566
   ```

2. **Services**

   ```bash
   docker-compose up -d  # Starts PostgreSQL + LocalStack (SQS)
   npm install
   npm run migrate up
   ```

3. **Run**

   ```bash
   npm start
   ```

   > **Note:** Runs over `https`. First time might need `sudo`. To disable: remove `--https` flag in `develop` script.

### Test SQS Integration

```bash
npm run test:sqs-message  # Send test message
npm run serve            # Process messages
```

> **Note:** The `docker-compose` automatically creates the LocalStack SQS queue. For manual LocalStack setup, see [SQS Setup](docs/sqs-setup.md).

## Documentation

- **[Database Operations](docs/database-operations.md)** - Clear database and re-populate commands
- **[SQS Setup](docs/sqs-setup.md)** - Manual LocalStack setup and message format details
- **[Project Structure](docs/project-structure.md)** - Gatsby + Node.js architecture

## Quick Commands

```bash
npm start                # Development server
npm run migrate up       # Database migrations
npm run test:sqs-message # Test SQS integration
docker-compose up -d     # Start services
```

## AI Agent Context

For detailed AI Agent context, see [docs/ai-agent-context.md](docs/ai-agent-context.md).