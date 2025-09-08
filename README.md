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
   # Add: CONNECTION_STRING=postgres://postgres:postgres@localhost:5432/postgres
   ```

2. **Services**

   ```bash
   docker-compose up -d
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

## Documentation

- **[Database Operations](docs/database-operations.md)** - Clear database and re-populate commands
- **[SQS Setup](docs/sqs-setup.md)** - LocalStack installation and message testing
- **[Project Structure](docs/project-structure.md)** - Gatsby + Node.js architecture

## Quick Commands

```bash
npm start                # Development server
npm run migrate up       # Database migrations
npm run test:sqs-message # Test SQS integration
docker-compose up -d     # Start services
```
