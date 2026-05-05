# Places — Project Memory

Backend service for Decentraland's place/world discovery and social metadata. Express + PostgreSQL + AWS SQS. No frontend.

> **Note:** Despite the name, `decentraland-gatsby` is **kept** as a dependency. It's the backend framework (Database/Route/Server/Task helpers) for this service, not a frontend dep. Do not remove it. See [decentraland-gatsby usage](#decentraland-gatsby-usage) below.

## Architecture

```
src/
├── server.ts              # Express bootstrap; mounts /api routes + /places (social/og); registers tasks
├── entities/              # One folder per domain entity
│   ├── Category/          # routes.ts, model.ts, types.ts
│   ├── CheckScenes/       # task/ (SQS consumer for Catalyst/world deployments)
│   ├── Destination/       # routes/, model.ts, utils.ts
│   ├── Map/
│   ├── Place/             # routes/, model.ts, schemas.ts, utils.ts, migration.ts
│   ├── PlaceCategories/   # tasks/poi.ts (POI category sync)
│   ├── PlaceContentRating/
│   ├── PlacePosition/
│   ├── RealmProvider/     # tasks/hotScenesUpdate.ts
│   ├── Report/
│   ├── SceneStats/
│   ├── Slack/             # notification helpers
│   ├── Snapshot/
│   ├── Social/            # /places/place/, /places/world/ (OG metadata for link previews)
│   ├── User/
│   ├── UserFavorite/
│   ├── UserLikes/
│   ├── World/             # routes/, tasks/worldsLiveData.ts
│   └── shared/            # cross-entity helpers (entityTypes, validate)
├── api/                   # HTTP clients consumed by routes/tasks (DUAL-USE — see below)
├── modules/               # Backend modules: hotScenes, sceneStats, worldsLiveData, pois
├── utils/                 # Backend utilities: array/, position/, rating/
├── migrations/            # node-pg-migrate TS migrations
├── seed/                  # JSON seed data for migrations and bin/placeMigrations.ts
├── intl/en.json           # Server-side strings (Category and Social routes consume these)
├── config/                # JSON env defaults (currently UNIMPORTED — orphaned)
├── __data__/              # Test fixtures (also used by entities/CheckScenes/utils.ts)
└── __mocks__/             # @dcl/ui-env mock for jest

bin/                       # CLI tools (TS via ts-node)
├── rebuildWorldPlaces.ts  # Rebuild worlds tables from worlds-content-server
├── populateSdk.ts         # One-time SDK column populator
├── snapshotToFiles.ts     # Export snapshot to files
├── filesToSqs.ts          # Upload files + send SQS messages
├── testSqsMessage.ts      # Send test SQS message
├── roads.ts               # Update roads
└── placeMigrations.ts     # Run custom place migrations

test/integration/          # Backend integration tests (Postgres + LocalStack required)
docs/                      # OpenAPI spec + DB schemas + runbooks
```

## Routes

- `/api/categories`, `/api/places`, `/api/worlds`, `/api/destinations`, `/api/map`, `/api/reports`, `/api/places/:id/{likes,favorites}` — REST API (Express + decentraland-gatsby Route helpers)
- `/places/place/`, `/places/world/` — social/og metadata HTML for share-link previews

## Background tasks

Registered in `src/server.ts` via `decentraland-gatsby/dist/entities/Task`:

- `createSceneConsumerTask` (every 10s) — consumes Catalyst/world deployments from SQS, processes scenes
- `checkPoisForCategoryUpdate` (daily) — syncs POI category assignments from `dcl-lists.decentraland.org`
- `hotScenesUpdate` (minutely) — fetches hot scenes from realm-provider
- `worldsLiveDataUpdate` (minutely) — fetches worlds-content-server live user counts

## Build / dev / test

```bash
npm install                    # required after fresh checkout
npx husky install              # required ONCE after npm install — recreates .husky/_/husky.sh, otherwise commits fail
npm run build                  # tsc -p . → lib/
npm start                      # nodemon + ts-node (loads .env.development)
npm test                       # jest unit tests on src/**/*.test.ts
npm run test:integration       # jest test/integration/**.test.ts (needs DB + LocalStack)
npm run lint                   # eslint src/
npm run migrate                # node-pg-migrate up (needs CONNECTION_STRING in .env.development)
```

## Local environment

`.env.development` is gitignored. Minimum vars:

```bash
CONNECTION_STRING=postgres://postgres:postgres@localhost:5432/postgres
AWS_REGION=us-east-1
AWS_ENDPOINT=http://localhost:4566
QUEUE_URL=http://localhost:4566/000000000000/places_test
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

Bring up infra with `docker-compose up -d` (Postgres + LocalStack SQS), then `npm run migrate` and `npm start`.

## Common gotchas

### `getaddrinfo ENOTFOUND base` at boot

Means `CONNECTION_STRING` is empty/unset. `pg.Client('').host` defaults to literal `"base"` (verified: `node -e "console.log(new (require('pg')).Client('').host)"` prints `base`). The string `"base"` does NOT appear anywhere in source — it's a `pg-connection-string` library default. Fix: ensure `.env.development` has `CONNECTION_STRING` and Postgres is running.

### Pre-commit fails with `.husky/_/husky.sh: No such file or directory`

`npm install` does not create `.husky/_/husky.sh`. Run `npx husky install` once after install, then commit. Never use `--no-verify` to work around it.

### `decentraland-gatsby` usage

Despite the name, this is the **backend** framework for places. The server imports:

- `dist/entities/Database/utils` — `databaseInitializer`
- `dist/entities/Route/{error,handle,middleware,routes,wkc/...}` — Express routing primitives, Context, Router.memo, ApiResponse
- `dist/entities/Server/{handler,utils}` — `initializeServices`, `serverInitializer`
- `dist/entities/Task` — `TaskManager`, `Task`, `taskInitializer`
- `dist/entities/Prometheus/{metrics,routes/utils}` — Prometheus exporters
- `dist/entities/Gatsby/utils` — `replaceHelmetMetadata` for `/places/place/` social metadata
- `dist/utils/env` — `env()` with `GATSBY_*` / `REACT_APP_*` fallback chain
- `dist/utils/api/{API,Options}` — base class extended by `src/api/*.ts`
- `dist/utils/date/Time`

The frontend that used to live here (Gatsby + React + decentraland-ui2) was removed in PR #836; `decentraland-gatsby` itself stays as the backend foundation.

### `src/api/` is dual-use

Some files are backend-consumed, others were frontend-only. After PR #836 the directory contains only the backend-used ones:

- `CatalystAPI.ts` — Destination + Place routes
- `CommsGatekeeper.ts` — Destination utils (cached for 5 min)
- `DataTeam.ts` — Destination/Map/Place utils + modules/sceneStats
- `Events.ts` — Destination utils
- `RealmProvider.ts` — modules/hotScenes (used by 6 backend route files)

All extend `decentraland-gatsby/dist/utils/api/API`. When adding a new external service client, follow the same pattern.

### `src/intl/en.json` is partly backend data

Two backend routes import from it:

- `entities/Category/routes.ts` — `categories` keys → `/api/categories` response strings
- `entities/Social/routes.ts` — `social.place.*` → OG metadata defaults

Don't delete this file even if it looks like pure i18n.

### Social routes need an inline HTML template

`/places/place/` and `/places/world/` use `replaceHelmetMetadata(html, metadata)` which requires a `<head>` element in `html` to inject meta tags. After Gatsby removal there is no `./public/.../index.html` to read, so `src/entities/Social/routes.ts` defines `SOCIAL_HTML_TEMPLATE` inline. If you change the template, keep at least an empty `<head>` with `data-react-helmet="true"` markers.

### `src/config/` is unimported

`src/config/index.ts` calls `setupEnv()` with JSON files but nothing imports it. Runtime env comes from `.env.development` (dotenv) or the deployment env. Treat the directory as documentation/template only.

## API documentation

OpenAPI 3.1 spec lives in `docs/openapi.yaml`. Operation IDs follow `{serviceName}_{operationDescription}` camelCase. Document all error responses; reuse schemas via `$ref`. See `docs/database-schemas.md` and `docs/database-operations.md` for DB layout, and `docs/sqs-setup.md` for queue config.

## Conventions

- **Migrations:** `node-pg-migrate` with TS files under `src/migrations/`. Never edit a shipped migration; add a new one.
- **Routes:** declared with `decentraland-gatsby` `routes((router) => { ... })` factory; per-entity. Compose them in `src/server.ts`.
- **Tests:** Jest. Unit tests live next to source (`*.test.ts`). Integration tests live in `test/integration/` and require Postgres + LocalStack.
- **Models:** `decentraland-server` Model class wrapping pg client. SQL helpers in `decentraland-gatsby/dist/entities/Database/utils/sql`.
- **Tasks:** `new Task({ name, repeat, task })` with `Task.Repeat.{Each10Seconds,Minutely,Hourly,Daily}`.
