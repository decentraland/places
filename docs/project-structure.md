# Project Structure

This project is a Node.js + Express backend that exposes the Places API and runs background jobs for scene/world processing.

## Architecture

- **HTTP server**: Express, bootstrapped from `src/server.ts`. Mounts entity routes under `/api` and social/og-metadata routes under `/places`.
- **Background tasks**: SQS consumer (Catalyst/world deployments), POI category updates, hot scenes refresh, worlds live data refresh — registered in `src/server.ts` via the `decentraland-gatsby` task manager.
- **Database**: PostgreSQL, accessed via `pg`. Schema is managed by `node-pg-migrate` migrations under `src/migrations/`.
- **Queue**: AWS SQS (LocalStack in dev) for incoming deployment notifications.

## Routes

Backend routes are defined with Express and live in `src/entities/{Entity}/routes.ts` (or `routes/` for entities with multiple handlers). They are composed in `src/server.ts`:

- `/api/categories`, `/api/places`, `/api/worlds`, `/api/destinations`, `/api/places/:id/likes`, `/api/places/:id/favorites`, `/api/reports`, `/api/map`, etc.
- `/places/...` — social/og metadata for sharing links (handled by `src/entities/Social/routes.ts`).

## Layout

| Path               | Purpose                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `src/server.ts`    | Express bootstrap + task registration                                                           |
| `src/entities/`    | One folder per domain entity (model, schema, types, routes, tasks, utils, tests)                |
| `src/migrations/`  | Database migrations                                                                             |
| `src/seed/`        | JSON seed data consumed by migrations and `bin/placeMigrations.ts`                              |
| `src/api/`         | HTTP clients used by routes/tasks (Catalyst, Comms Gatekeeper, DataTeam, Events, RealmProvider) |
| `src/modules/`     | Shared backend modules (hot scenes cache, scene stats, worlds live data, POIs)                  |
| `src/utils/`       | Shared utilities (position canonicalization, content rating, position comparison)               |
| `src/intl/en.json` | Server-side copy used by `Category` and `Social` routes for response strings                    |
| `src/config/`      | Per-env config (`dev.json`, `local.json`, `prod.json`, `stg.json`)                              |
| `src/__data__/`    | Test fixtures used by integration tests and `CheckScenes/utils.ts`                              |
| `bin/`             | CLI scripts (rebuild worlds, update roads, SQS helpers, etc.)                                   |
| `test/`            | Integration tests (Postgres + LocalStack required)                                              |
| `docs/`            | OpenAPI spec and operational docs                                                               |
