# Places Server

[![Coverage Status](https://coveralls.io/repos/github/decentraland/places/badge.svg?branch=master)](https://coveralls.io/github/decentraland/places?branch=master)

## Table of Contents

- [Features](#features)
- [Dependencies \& Related Services](#dependencies--related-services)
- [API Documentation](#api-documentation)
- [Database](#database)
  - [Schema](#schema)
  - [Migrations](#migrations)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Running the Service](#running-the-service)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [AI Agent Context](#ai-agent-context)
- [Additional Documentation](#additional-documentation)

## Features

- **Scene & World Processing**: Processes Catalyst scenes and Worlds deployments via SQS messages
- **Place Discovery**: Full-text search and filtering across places by categories, positions, and popularity
- **Social Features**: User likes, dislikes, favorites, content ratings, and aggregated place statistics
- **Category Management**: Dynamic categorization with automatic POI categorization
- **Hot Scenes Tracking**: Real-time monitoring of active scenes with user counts from Catalyst realms
- **Gatsby Frontend**: Static site generation for place exploration interface

## Dependencies & Related Services

- Decentraland Catalyst - Source of scene metadata and deployments
- World Content Server - Source of world metadata and deployments
- Decentraland Realm Provider - Hot scenes data for activity tracking
- AWS SQS - Message queue for deployment notifications
- PostgreSQL - Primary data store

### API Documentation

For complete API documentation including:

- Detailed endpoint descriptions and parameters
- Request/response schemas
- Authentication requirements
- Example requests and responses
- Content rating system details
- Place ID persistence rules

See the **[OpenAPI Specification](docs/openapi.yaml)** which can be viewed with tools like [Swagger UI](https://swagger.io/tools/swagger-ui/) or [Redoc](https://redocly.com/redoc).

## Database

### Schema

The database schema includes the following main tables:

- `places` - Main table storing scene and world information (includes creator_address for creator-based queries)
- `users` - Registered users with permissions
- `categories` - Place categories for organization
- `place_categories` - Many-to-many relationship between places and categories
- `user_favorites` - User favorite places
- `user_likes` - User likes/dislikes for places

For detailed column definitions and relationships, see [Database Schemas](docs/database-schemas.md).

### Migrations

This project uses [node-pg-migrate](https://github.com/salsita/node-pg-migrate) for database migrations.

#### Creating Migrations

```bash
npm run migrate create <migration-name>
```

#### Running Migrations

```bash
# Apply all pending migrations
npm run migrate up

# Apply N migrations
npm run migrate up 5

# Rollback last migration
npm run migrate down

# Rollback N migrations
npm run migrate down 5

# Rollback to specific migration
npm run migrate down <migration-name>
```

The migration configuration is set in `package.json` and uses `.env.development` for database connection.

## Getting Started

### Prerequisites

- Node.js 18.x (see `.nvmrc`)
- npm 8.x or 9.x
- Docker and Docker Compose

### Installation

```bash
# Clone the repository
git clone https://github.com/decentraland/places.git
cd places

# Install dependencies
npm install

# Build the project
npm run build
```

### Configuration

Create a `.env.development` file in the project root with the following variables:

#### Required Environment Variables

| Variable            | Description                           | Default | Example                                          |
| ------------------- | ------------------------------------- | ------- | ------------------------------------------------ |
| `CONNECTION_STRING` | PostgreSQL connection string          | -       | `postgres://user:pass@localhost:5432/places`     |
| `AWS_REGION`        | AWS region for SQS                    | -       | `us-east-1`                                      |
| `QUEUE_URL`         | SQS queue URL for deployment messages | -       | `http://localhost:4566/000000000000/places_test` |

#### Optional Environment Variables

| Variable                           | Description                                   | Default                              | Example                                   |
| ---------------------------------- | --------------------------------------------- | ------------------------------------ | ----------------------------------------- |
| `AWS_ENDPOINT`                     | AWS endpoint override (for LocalStack)        | -                                    | `http://localhost:4566`                   |
| `AWS_ACCESS_KEY`                   | AWS access key for S3 report uploads          | -                                    | `AKIA...`                                 |
| `AWS_ACCESS_SECRET`                | AWS secret key for S3 report uploads          | -                                    | `xxx...`                                  |
| `AWS_BUCKET_NAME`                  | S3 bucket name for content moderation reports | -                                    | `content-moderation-bucket`               |
| `BOOTSTRAP_USER`                   | Initial admin user wallet address             | -                                    | `0x...`                                   |
| `BOOTSTRAP_CATALYST`               | Default Catalyst server URL                   | -                                    | `https://peer.decentraland.org`           |
| `PLACES_URL`                       | Places API base URL                           | -                                    | `https://localhost:8000/api`              |
| `PLACES_ROOT_URL`                  | Places frontend base URL                      | -                                    | `https://localhost:8000`                  |
| `PLACES_BASE_URL`                  | Public-facing places URL                      | `https://decentraland.org/places`    | -                                         |
| `DECENTRALAND_URL`                 | Decentraland play URL                         | -                                    | `https://play.decentraland.org`           |
| `PROFILE_URL`                      | Content server URL for profiles               | `https://peer.decentraland.org`      | -                                         |
| `REALM_PROVIDER_URL`               | Realm provider API for hot scenes data        | -                                    | `https://realm-provider.decentraland.org` |
| `DATA_TEAM_URL`                    | Data team CDN URL for stats                   | `https://cdn-data.decentraland.org/` | -                                         |
| `CATALYST_URL`                     | Default Catalyst API URL                      | -                                    | `https://peer.decentraland.org`           |
| `COMMS_GATEKEEPER_URL`             | Comms Gatekeeper API for connected users      | `https://comms-gatekeeper.decentraland.org` | `https://comms-gatekeeper.decentraland.zone` |
| `SLACK_WEBHOOK`                    | Slack webhook for notifications               | -                                    | `https://hooks.slack.com/...`             |
| `CONTENT_MODERATION_SLACK_WEBHOOK` | Slack webhook for moderation alerts           | -                                    | `https://hooks.slack.com/...`             |
| `ADMIN_ADDRESSES`                  | Comma-separated admin wallet addresses        | -                                    | `0x...,0x...`                             |
| `NEW_ROLLOUT`                      | Enable new features rollout                   | `false`                              | `true`                                    |

#### Gatsby-Specific Variables

These variables are used by the Gatsby frontend (prefixed with `GATSBY_`):

| Variable                           | Description                     | Example                             |
| ---------------------------------- | ------------------------------- | ----------------------------------- |
| `GATSBY_PLACES_URL`                | Places API URL for frontend     | `https://localhost:8000/api`        |
| `GATSBY_LAND_URL`                  | Land API URL                    | `https://api.decentraland.org`      |
| `GATSBY_DECENTRALAND_URL`          | Decentraland play URL           | `https://play.decentraland.org`     |
| `GATSBY_PROFILE_URL`               | Profile server URL              | `https://peer.decentraland.org`     |
| `GATSBY_DCL_DEFAULT_ENV`           | Default environment             | `dev` or `prod`                     |
| `GATSBY_ROLLBAR_TOKEN`             | Rollbar error tracking token    | `local` or token                    |
| `GATSBY_SEGMENT_KEY`               | Segment analytics key           | `local` or key                      |
| `GATSBY_ADMIN_ADDRESSES`           | Admin addresses for frontend    | `0x...`                             |
| `GATSBY_NEW_ROLLOUT`               | Enable new features in frontend | `true` or `false`                   |
| `GATSBY_DECENTRALAND_DOWNLOAD_URL` | Download page URL               | `https://decentraland.org/download` |

#### Minimal Development Configuration

For local development with LocalStack and PostgreSQL via docker-compose:

```bash
# Database
CONNECTION_STRING=postgres://postgres:postgres@localhost:5432/postgres

# AWS/SQS (LocalStack)
AWS_REGION=us-east-1
AWS_ENDPOINT=http://localhost:4566
QUEUE_URL=http://localhost:4566/000000000000/places_test

# Gatsby Frontend
GATSBY_PLACES_URL=https://localhost:8000/api
GATSBY_LAND_URL=https://api.decentraland.org
GATSBY_DCL_DEFAULT_ENV=dev
GATSBY_ROLLBAR_TOKEN=local
GATSBY_SEGMENT_KEY=local
```

The configuration uses [LocalStack](https://localstack.cloud/) to emulate AWS services (SQS) locally. The `docker-compose` setup automatically creates the LocalStack SQS queue. For manual LocalStack configuration, see [SQS Setup](docs/sqs-setup.md).

### Running the Service

#### Using Docker Compose

```bash
# Start PostgreSQL + LocalStack (SQS)
docker-compose up -d

# Run database migrations
npm run migrate up

# Start the development server
npm start
```

The `docker-compose` command starts:

- **PostgreSQL** database on port 5432
- **LocalStack** on port 4566 (emulating AWS SQS locally)

The service will then start:

- Express API server with hot reload
- Gatsby development server on HTTPS at `https://localhost:8000`
- Background tasks for processing SQS messages

> **Note:** The server runs over HTTPS by default. First time might need `sudo`. To disable HTTPS, remove the `--https` flag from the `develop` script in `package.json`.

#### SQS Message Processing

The service processes deployment notifications from Catalyst (for scenes) and World Content Servers (for worlds) via AWS SQS. For local development, [LocalStack](https://localstack.cloud/) emulates SQS functionality.

Each message contains:

- `entity_id` - Unique identifier for the deployment
- `content_server_url` - URL of the content server to fetch metadata from
- `base_position` - Primary parcel coordinate (for scenes)
- `positions` - Array of all parcel coordinates (for scenes)
- `action` - Type of deployment action
- `deploy_at` - Deployment timestamp

When a message is processed, the service applies the UUID assignment logic defined in [ADR-186](https://adr.decentraland.org/adr/ADR-186):

**For Scenes:**

- If the new deployment encompasses all previous parcels OR maintains the same base parcel, the existing Place UUID is retained
- If both the parcels and base parcel change, a new Place UUID is generated
- This ensures users can continue tracking places they follow even when scenes expand, contract, or shift positions

**For Worlds:**

- Currently, each world contains only one scene, so ADR-186 logic applies to that single scene
- Future support for multiple scenes per world is planned (no ETA)

The background task continuously polls the SQS queue and processes messages in batches of 10 with a 15-second wait time.

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test -- --watch

# Run tests with coverage
npm run test -- --coverage
```

### Test Organization

Tests are written using **Jest** and **TypeScript**, organized by entity in `src/entities/*/`. Test files follow the naming convention `*.test.ts` or `*.spec.ts` and are placed next to the code they test.

### Testing Standards

This project follows the [Decentraland Testing Standards](https://docs.decentraland.org/contributor/contributor-guides/testing-standards), which emphasize:

For project-specific testing guidelines, see [Testing Standards](.cursor/rules/dcl-testing.mdc).

## Troubleshooting

### Docker & Database Issues

**Problem: Docker containers fail to start**

```bash
# Check if containers are running
docker-compose ps

# View container logs
docker-compose logs postgres
docker-compose logs localstack

# Restart containers
docker-compose down
docker-compose up -d
```

**Problem: Database connection errors**

- Ensure PostgreSQL is running: `docker-compose ps`
- Verify connection string in `.env.development` matches docker-compose settings
- Check if port 5432 is already in use: `lsof -i :5432`
- Try resetting the database:
  ```bash
  docker-compose down -v  # Remove volumes
  docker-compose up -d
  npm run migrate up
  ```

**Problem: Migration fails**

```bash
# Check migration status
npm run migrate status

# Rollback last migration
npm run migrate down

# Reapply migrations
npm run migrate up
```

### LocalStack & SQS Issues

**Problem: SQS queue not found**

- Verify LocalStack is running: `docker-compose ps`
- Check LocalStack logs: `docker-compose logs localstack`
- Recreate the queue manually:
  ```bash
  aws --endpoint-url=http://localhost:4566 sqs create-queue \
    --queue-name places_test \
    --region us-east-1
  ```

**Problem: AWS credentials error**

- Ensure `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set in `.env.development`
- For LocalStack, any non-empty values work (e.g., "test")

### Development Server Issues

**Problem: HTTPS certificate errors or sudo required**

- First-time setup may require `sudo` for HTTPS certificate creation
- To disable HTTPS, remove `--https` flag from the `develop` script in `package.json`
- Browser may show security warning on first access - this is normal for self-signed certificates

**Problem: Port already in use**

```bash
# Check what's using port 8000
lsof -i :8000

# Kill the process or change port in gatsby-config.js
```

**Problem: Build errors after npm install**

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Gatsby cache
npm run clean
npm run build
```

### Authentication & Authorization Issues

**Problem: "Unauthorized" errors on protected endpoints**

- Ensure you're sending a valid authentication token
- Check token hasn't expired
- Verify the user address matches the expected format

**Problem: Admin-only endpoints return 403**

- Only admin users can access certain endpoints (like content rating updates)
- Verify user has admin permissions in the database

### Performance Issues

**Problem: Slow API responses**

- Check database indexes are properly created (migrations should handle this)
- Monitor PostgreSQL performance:
  ```bash
  docker-compose exec postgres psql -U postgres -c "SELECT * FROM pg_stat_activity;"
  ```
- Consider increasing database connection pool size in configuration

**Problem: High memory usage**

- Gatsby development server can be memory-intensive
- Try building for production: `npm run build && npm run serve`
- Increase Node.js memory: `NODE_OPTIONS="--max-old-space-size=4096" npm start`

### Common Development Errors

**Problem: TypeScript compilation errors**

```bash
# Check TypeScript version matches package.json
npm list typescript

# Rebuild TypeScript
npm run build
```

**Problem: Test failures after code changes**

- Ensure mocks are properly cleaned up in `afterEach` blocks
- Check for race conditions in async tests
- Run tests in isolation: `npm test -- --testNamePattern="your test name"`

### Getting Additional Help

If you're still experiencing issues:

1. Check the [GitHub Issues](https://github.com/decentraland/places/issues) for similar problems
2. Review logs in detail:
   - Application logs: Check console output
   - Database logs: `docker-compose logs postgres`
   - LocalStack logs: `docker-compose logs localstack`
3. Verify environment variables are correctly set
4. Ensure you're using the correct Node.js version (check `.nvmrc`)

## AI Agent Context

For detailed information about the service architecture, key concepts, and technology stack to help AI agents understand and work with this codebase, see [AI Agent Context](docs/ai-agent-context.md).

---

## Additional Documentation

- **[OpenAPI Specification](docs/openapi.yaml)** - Complete REST API documentation with schemas, examples, and authentication details
- **[Database Schemas](docs/database-schemas.md)** - Detailed database schema documentation with ERD diagram, constraints, and business rules
- **[Database Operations](docs/database-operations.md)** - Commands for clearing and re-populating the database
- **[SQS Setup](docs/sqs-setup.md)** - Manual LocalStack setup and SQS message format details
- **[Project Structure](docs/project-structure.md)** - Gatsby + Node.js architecture overview
