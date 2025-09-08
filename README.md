# Places

[![Coverage Status](https://coveralls.io/repos/github/decentraland/places/badge.svg?branch=master)](https://coveralls.io/github/decentraland/places?branch=master)

The Decentraland Places service manages and processes scene deployments, providing a gateway between content servers and the Places database. It handles SQS-based scene processing, user favorites, and provides APIs for the Decentraland ecosystem.

![decentraland](https://decentraland.org/images/fallback-hero.jpg)

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- [Node.js](https://nodejs.org/) (version specified in `.nvmrc`)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Environment Setup

1. **Create environment file:**
```bash
cp .env.example .env.development
```

2. **Configure environment variables** in `.env.development`:
```bash
# Database Configuration
CONNECTION_STRING=postgres://postgres:postgres@localhost:5432/postgres

# AWS/SQS Configuration for Local Development (LocalStack)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
QUEUE_URL=http://localhost:4566/000000000000/places_test
AWS_ENDPOINT=http://localhost:4566

# Application Configuration
NODE_ENV=development
PORT=4000
```

   > 📖 **More about environment variables:** See [Gatsby's documentation](https://www.gatsbyjs.com/docs/how-to/local-development/environment-variables/#defining-environment-variables)

### Database & Services Setup

1. **Start services** (PostgreSQL database + LocalStack for SQS):
```bash
docker-compose up -d
```

2. **Verify services are running:**
```bash
docker-compose ps
```

3. **Run database migrations:**
```bash
npm run migrate up
```

4. **Install dependencies:**
   ```bash
   npm install
   ```

### Running the Application

Start the development server:
```bash
  npm start
```

> **Note 1:** This project runs over `https`. If it's your first time, you might need to run with `sudo`  
> **Note 2:** You can disable `https` by removing the `--https` flag in the `develop` script in `package.json`

### Verification

Test the SQS integration:
```bash
# Send a test message to the queue
npm run test:sqs-message

# Start the server to process messages
npm run serve
```

You should see logs indicating successful message processing in the server output.

## Development

### Project Structure

This project follows the [`decentraland-gatsby` structure](https://github.com/decentraland/decentraland-gatsby#project-structure):

- **Front-end & Back-end**: Gatsby front-end with Node.js back-end connected via proxy
  - **Local**: Proxy defined in [`gatsby-config.js`](https://www.gatsbyjs.com/docs/api-proxy/#gatsby-skip-here) (`proxy` prop)
  - **Production**: Proxy defined in `Pulumi.ts` (`servicePaths` prop)

- **Routing**:
  - **Front-end**: [Gatsby routes](https://www.gatsbyjs.com/docs/reference/routing/creating-routes/#define-routes-in-srcpages) + [gatsby-plugin-intl](https://www.gatsbyjs.com/plugins/gatsby-plugin-intl/) in `src/pages/`
  - **Back-end**: Express routes in `src/entities/{Entity}/routes.ts`, imported in `src/server.ts`

### SQS Testing & Development

The service includes automated tools for testing SQS message processing:

#### Quick Commands
```bash
# Send test message with default entity ID
npm run test:sqs-message

# Send test message with custom entity ID  
npm run test:sqs-message bafkreiabc123...

# Start server with auto-restart
npm run serve

# Debug mode with breakpoints
npm run debug
```

> 📖 **Detailed SQS Testing Guide:** See [docs/sqs-testing.md](docs/sqs-testing.md) for comprehensive testing documentation

### Database Operations

#### Clear Database
To restart the project with a clean database:

```sql
TRUNCATE places;
TRUNCATE place_activities;
TRUNCATE place_activity_daily;
TRUNCATE entities_places;
TRUNCATE tasks;
UPDATE deployment_tracks SET "from" = 0;
```

#### Re-Populate Place Positions
```sql
TRUNCATE "place_positions";
INSERT INTO "place_positions" ("base_position", "position")
  SELECT p.base_position, unnest(p.positions) FROM places p
    WHERE p.disabled IS FALSE
      AND p.world IS FALSE;
```

## SQS Integration

### Overview

The Places service processes scene deployments through an SQS-based queue system. When scenes are deployed to Decentraland, notifications are sent via SQS containing entity IDs and content server URLs. The service fetches scene metadata and creates corresponding Place records in the database.

### Message Format

SQS messages must follow this structure:

```json
{
    "entity": {
        "entityId": "bafkreietumuqvq6kyy5k3dnn4z57j45isf5e2rjn46w2hrcpfghwmausvy",
    "authChain": [
      {
        "type": "SIGNER", 
        "payload": "0x1234567890abcdef1234567890abcdef12345678",
        "signature": ""
      }
    ]
    },
    "contentServerUrls": ["https://peer.decentraland.org/content"]
}
```

### Local Testing

The development environment uses [LocalStack](https://docs.localstack.cloud/) to simulate AWS SQS locally:

1. **Automated Setup**: The `docker-compose.yml` automatically creates the required SQS queue
2. **Test Messages**: Use `npm run test:sqs-message` to send test messages
3. **Processing**: The server polls the queue every 10 seconds and processes messages automatically

### Processing Flow

1. **Message Reception**: SQS consumer receives deployment notification
2. **Content Fetching**: Service fetches scene metadata from content server
3. **Data Processing**: Scene data is transformed into Place attributes
4. **Database Storage**: Place record is created/updated in PostgreSQL
5. **Message Cleanup**: SQS message is deleted after successful processing

> 📖 **Advanced SQS Operations:** See [docs/sqs-testing.md](docs/sqs-testing.md) for manual queue operations and debugging

## Advanced Operations

### Production Deployment

When deploying to production environments:

1. **Environment Variables**: Configure proper AWS credentials and SQS queue URLs
2. **Database**: Ensure PostgreSQL is properly configured with connection pooling
3. **Monitoring**: Set up logging and monitoring for SQS processing
4. **Scaling**: Configure appropriate SQS visibility timeouts and dead letter queues

### Monitoring

Key metrics to monitor:
- SQS message processing rate and latency
- Database connection pool utilization  
- Scene content server response times
- Failed message processing (dead letter queues)

### Troubleshooting

#### Common Issues

1. **SQS Messages Not Processing**:
   - Check AWS credentials in environment variables
   - Verify LocalStack/SQS connectivity
   - Review server logs for consumer task execution

2. **Database Connection Issues**:
   - Verify `CONNECTION_STRING` in environment
   - Check PostgreSQL service status
   - Review migration status

3. **Content Server Timeouts**:
   - Monitor content server response times
   - Check network connectivity to Decentraland infrastructure
   - Review retry logic in processing code

> 📖 **Detailed Troubleshooting:** See [docs/sqs-testing.md](docs/sqs-testing.md) for comprehensive debugging guides