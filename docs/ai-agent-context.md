# AI Agent Context - Decentraland Places Service

## Service Purpose

The Decentraland Places service is a comprehensive API solution for discovering, managing, and interacting with places in the Decentraland metaverse. It processes deployment notifications from Catalyst servers and World Content Servers, maintaining a searchable database of scenes (Genesis City) and worlds (private virtual spaces). The service provides place discovery, user interactions (likes/favorites), category management, and real-time activity tracking.

## Key Capabilities

- **Scene & World Processing**: Processes Catalyst scenes and Worlds deployments via SQS messages, fetching metadata and creating/updating place records
- **Place Discovery**: Full-text search and filtering across places by categories, positions, and popularity with pagination
- **Social Features**: User likes, dislikes, favorites, content ratings, and aggregated place statistics
- **Category Management**: Dynamic categorization with automatic POI (Point of Interest) categorization
- **Hot Scenes Tracking**: Real-time monitoring of active scenes with user counts from Catalyst realms
- **Map Integration**: Specialized endpoints for coordinate-based queries optimized for map visualization
- **Content Moderation**: Content rating system (PR/E/T/A/R) and report generation with S3 signed URLs
- **Gatsby Frontend**: Static site generation for place exploration interface with HTTPS support

## Communication Pattern

**Hybrid Architecture:**

- **Asynchronous Processing**: AWS SQS-based message queue for deployment notifications from Catalyst and World Content Servers
- **Synchronous REST API**: Express.js REST API for client queries, user interactions, and place discovery
- **Static Frontend**: Gatsby development server with hot reload on HTTPS (port 8000)
- **Background Tasks**: Continuous polling of SQS queue (batches of 10, 15s wait time), hot scenes updates, POI categorization

## Technology Stack

- **Runtime**: Node.js 18.x (see `.nvmrc`)
- **Framework**: Express.js (API) + Gatsby 4.x (Frontend)
- **Language**: TypeScript 4.7.x
- **Database**: PostgreSQL with `node-pg-migrate` for migrations
- **Message Queue**: AWS SQS (LocalStack for local development)
- **Testing**: Jest with TypeScript, following [Decentraland Testing Standards](https://docs.decentraland.org/contributor/contributor-guides/testing-standards)
- **Authentication**: Ethereum wallet-based authentication via decentraland-gatsby
- **Task Management**: decentraland-gatsby task system for background jobs
- **Monitoring**: Prometheus metrics via decentraland-gatsby

## External Dependencies

- **PostgreSQL Database**: Stores places, users, categories, place-category relationships, user favorites, and user likes
- **AWS SQS**: Receives deployment notifications with `entity_id`, `content_server_url`, positions, and deployment metadata
- **Decentraland Catalyst**: Source of scene metadata and deployment information (`https://peer.decentraland.org` by default)
- **World Content Server**: Source of world metadata and deployment information for Decentraland Worlds
- **Decentraland Realm Provider**: Real-time hot scenes data and user count information from active realms
- **AWS S3**: Content moderation report storage with pre-signed upload URLs (60s expiry)
- **Decentraland Data Team CDN**: Scene statistics and visit data (`https://cdn-data.decentraland.org/`)

## Key Concepts

- **Places vs Worlds**: Places are scenes in Genesis City at specific coordinates; Worlds are private virtual spaces accessed via unique URLs outside Genesis City
- **Place UUID Assignment (ADR-186)**: UUID persistence across deployments ensures favorites/likes/social data persist when scenes update:
  - UUID **preserved** if new deployment encompasses all previous parcels OR maintains same base parcel
  - UUID **changes** when both parcels AND base parcel change (fundamental location change)
  - Examples: Expanding scenes keep UUID, reshaping with same base keeps UUID, moving to different parcels gets new UUID
- **Base Position**: Primary parcel coordinate where users spawn (critical for UUID persistence)
- **Positions Array**: All parcel coordinates occupied by a scene (format: `"x,y"`, range: -150 to 150)
- **Categories**: Places belong to multiple categories (art-gallery, social, game, etc.) via many-to-many `place_categories` table
- **Like Score**: VP-weighted quality metric (0-1) based on Decentraland voting power from Snapshot
- **Content Rating**: Age-appropriate classification - PR (10+), E (all ages), T (13+), A (18+), R (18+ explicit)
- **Hot Scenes**: Places with active users, tracked via Catalyst realm provider with real-time user counts
- **User Visits**: Unique users who visited a place in the last 30 days
- **Highlighted Places**: Featured places with special promotion status

## API Specification

The service exposes a REST API under `/api` with comprehensive documentation in [OpenAPI 3.0 format](openapi.yaml). Key endpoint categories:

- **Places**: `/api/places`, `/api/places/:id`, `/api/places/status`, `/api/places/:id/categories`, `/api/places/:id/rating`
- **Worlds**: `/api/worlds`, `/api/world_names`
- **Map**: `/api/map`, `/api/map/places` (coordinate-based queries with higher limits)
- **Categories**: `/api/categories` (with optional `target` filter for places/worlds/all)
- **Interactions**: `/api/places/:id/likes`, `/api/places/:id/favorites` (authentication required)
- **Reports**: `/api/report` (authentication required, returns S3 signed URL)
- **Social**: `/places/place/`, `/places/world/` (metadata injection for social sharing)

**Authentication**: Bearer token authentication using Decentraland wallet signatures. Admin endpoints require additional permissions.

**Response Format**: All responses follow `{ "ok": true/false, "data": [...], "total": number }` structure.

## Database Notes

- **Primary Keys**: UUIDs for places, Ethereum addresses (text, 42 chars) for users
- **Indexing**: Optimized indexes on `disabled + positions` for place queries, `active` for categories
- **Full-Text Search**: PostgreSQL `textsearch` column with tsvector on title, description, owner for place discovery
- **Soft Deletes**: Places use `disabled` boolean and `disabled_at` timestamp (not physically deleted)
- **Timestamps**: All tables include `created_at` and `updated_at` with timezone support
- **User Interactions**: Composite keys on `(place_id, user)` for likes and favorites tables
- **Category Relationships**: Many-to-many via `place_categories` pivot table with automatic POI categorization
- **Migrations**: Managed via `node-pg-migrate` with configuration in `package.json`, using `.env.development` for connection

**Key Tables**:

- `places`: Main table with UUID, title, description, positions[], base_position, owner, content_rating, disabled, user_count, user_visits, like metrics
- `users`: Registered users with Ethereum addresses and permissions
- `categories`: Place categories with name, active status, i18n translations
- `place_categories`: Many-to-many relationships between places and categories
- `user_favorites`: User's favorited places with timestamps
- `user_likes`: User likes/dislikes with VP-weighted scoring

## Project Structure

```
src/
├── server.ts                    # Express server setup, CORS, route mounting
├── entities/                    # Domain-driven entity organization
│   ├── Place/                  # Place entity (scenes)
│   │   ├── routes/            # Place API endpoints
│   │   └── utils.ts           # Place utility functions
│   ├── World/                  # World entity
│   ├── Category/               # Category management
│   ├── UserFavorite/          # Favorite management
│   ├── UserLikes/             # Like/dislike system
│   ├── Map/                    # Map-specific endpoints
│   ├── Social/                 # Social metadata injection
│   ├── Report/                 # Content reporting
│   ├── CheckScenes/           # SQS message processing
│   ├── PlaceCategories/       # Category automation
│   ├── RealmProvider/         # Hot scenes tracking
│   └── SceneStats/            # Visit statistics
├── migrations/                  # Database migrations
├── components/                  # Gatsby React components
├── pages/                      # Gatsby pages
└── api/                        # External API clients
    ├── CatalystAPI.ts
    ├── Places.ts
    └── RealmProvider.ts
```

## Configuration

**Required Environment Variables**:

- `CONNECTION_STRING`: PostgreSQL connection string
- `AWS_REGION`: AWS region for SQS
- `QUEUE_URL`: SQS queue URL for deployment messages

**Optional**: See [Configuration section](../README.md#configuration) in README for complete list including Gatsby variables, AWS credentials, Slack webhooks, admin addresses, and service URLs.

**Local Development**: Uses LocalStack for SQS emulation and docker-compose for PostgreSQL. Configuration in `.env.development`.

## Testing

Tests written in Jest with TypeScript following [Decentraland Testing Standards](https://docs.decentraland.org/contributor/contributor-guides/testing-standards):

- **Structure**: `describe` for contexts ("when"/"and"), `it` for behaviors ("should")
- **Isolation**: Independent tests with proper mock cleanup in `afterEach`
- **Organization**: Tests in `src/entities/*/` alongside code (`*.test.ts`, `*.spec.ts`)
- **Coverage**: `npm test -- --coverage`

See [Testing Standards](.cursor/rules/dcl-testing.mdc) for project-specific guidelines.

## Additional Documentation

- **[README.md](../README.md)**: Getting started, installation, configuration, troubleshooting
- **[OpenAPI Specification](openapi.yaml)**: Complete API documentation with schemas, examples, authentication
- **[Database Schemas](database-schemas.md)**: Detailed column definitions and relationships
- **[Database Operations](database-operations.md)**: Commands for clearing and re-populating database
- **[SQS Setup](sqs-setup.md)**: Manual LocalStack configuration and SQS message format details
- **[Project Structure](project-structure.md)**: Gatsby + Node.js architecture overview
