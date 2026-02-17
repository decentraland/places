## Summary

The destinations endpoint (`/destinations`) previously queried only the `places` table, meaning that when a client requested worlds, it actually received "places for worlds" — place records with `world=true` — rather than actual world entities from the `worlds` table. This produced inconsistent data and prevented world-specific features (highlighting, ranking) from surfacing correctly.

This PR fixes the destinations endpoint to query from the proper tables, adds highlighting and ranking support for worlds, introduces a dedicated Destinations API client, and cleans up several related issues.

## Why

- **Incorrect data source**: The destinations endpoint returned place records when asked for worlds, missing world-specific fields and returning stale or incorrect data.
- **No highlighting/ranking for worlds**: Worlds could not be highlighted or ranked because the `worlds` table lacked those columns and had no corresponding API endpoints.
- **Scattered world API calls**: Frontend code called the Places API client for world operations, making the code confusing and fragile.
- **No unified API client for destinations**: Hooks that needed combined place+world data (like the homepage carousel) had to go through the Places API, which only hit the `/places` endpoint.

## How

### New DestinationModel (query layer)

Created `src/entities/Destination/model.ts` with three query strategies:

- **`only_places`**: queries only the `places` table, filtering out world-type records (`world=false`).
- **`only_worlds`**: queries only the `worlds` table, using lateral joins to pull in contact details and images from the most recently deployed scene.
- **Neither (default)**: performs a `UNION ALL` of both subqueries, producing a single sorted, paginated result set.

Both `findWithAggregates` and `count` follow this same three-strategy pattern. The route handlers (`getDestinationsList`, `getDestinationsListById`) now delegate to `DestinationModel` instead of `PlaceModel`.

### Unified destination types

Defined `DestinationAttributes` and `AggregateDestinationAttributes` in `src/entities/Destination/types.ts`. Every field is always present with sensible defaults for the entity type that doesn't naturally have it (e.g., `positions: []` for worlds, `is_private: false` for places). Internal-only fields (`textsearch`, `world_id`, `single_player`, `skybox_time`, `show_in_places`) are excluded from the API response. This preserves backward compatibility — no fields were removed, and no types changed from required to optional.

### Highlighting and ranking for worlds

- **Migration** (`1770730028000_add-highlighted-ranking-to-worlds.ts`): adds `highlighted`, `highlighted_image`, and `ranking` columns to the `worlds` table. Populates `highlighted` and `highlighted_image` from existing highlighted world-type place records so no data is lost.
- **Endpoints**: `PUT /worlds/:world_id/highlight` (admin-only) and `PUT /worlds/:world_id/ranking` (bearer token auth), following the same patterns as the place equivalents.
- **WorldModel**: added `updateHighlighted` and `updateRanking` methods.

### Dedicated API clients

- **`src/api/Worlds.ts`**: new client for world-specific operations. All world methods (`getWorldById`, `getWorlds`, `updateWorldFavorite`, `updateWorldLike`, `updateWorldRating`, `updateHighlight`) were moved here from `Places.ts`.
- **`src/api/Destinations.ts`**: new client for the `/destinations` endpoint. Provides `getDestinations` plus convenience methods (`getDestinationsHighlighted`, `getDestinationsRecentlyUpdated`, etc.).

### Frontend updates

- **Hooks**: updated `useWorldList`, `useWorldListSearch`, `useWorldListMyFavorites`, `useEntitiesManager`, and `useWorldFromParams` to use the `Worlds` API client instead of `Places`. Created `useDestinationsHighlighted` (replacing `usePlaceListHighlighted`) to fetch highlighted destinations from the `/destinations` endpoint via the new Destinations API client.
- **Admin UI**: `highlights.tsx` now calls `Worlds.get().updateHighlight()` for world entities and `Places.get().updateHighlight()` for places. `AdminPlaceCard` reads `highlighted` directly from the entity.
- **Homepage**: `index.tsx` uses `useDestinationsHighlighted` for the carousel, so both highlighted places and worlds appear.

### Bug fix: useWorldFromParams

The `id` parameter branch was calling `Places.get().getPlaceById()` with a UUID guard. World IDs are lowercased world names (e.g., `"foo.dcl.eth"`), never UUIDs, so this branch always returned `null`. Fixed to call `Worlds.get().getWorldById()` without the UUID check.

### Shared query logic

Extracted duplicated SQL fragment builders into reusable helpers to reduce code repetition across `PlaceModel`, `WorldModel`, and `DestinationModel`:

- **`buildUserInteractionColumns`** and **`buildUserInteractionJoins`** in `entityInteractions.ts` — shared user favorite/like SELECT and JOIN fragments used by all three models.
- **`buildWorldTextSearchRank`** in `entityInteractions.ts` — shared inline tsvector rank expression for worlds (used in WorldModel and DestinationModel).
- **`PlaceModel.buildWhereConditions`** — shared WHERE clause for place queries, used by both `PlaceModel.findWithAggregates`/`countPlaces` and `DestinationModel.buildPlacesSubQuery`.
- **`WorldModel.buildWhereConditions`** — shared WHERE clause for world queries, used by both `WorldModel.findWorldsWithAggregates`/`countWorlds` and `DestinationModel.buildWorldsSubQuery`.
- **`WorldModel.buildLatestPlaceLateralJoin`** — shared lateral join for fetching the latest enabled place data for a world.

### Cleanup

- Removed `findDestinationsWithAggregates`, `countDestinations`, `findDestinationsWithHotScenes`, and `buildDestinationFilterCondition` from `PlaceModel` — this logic now lives in `DestinationModel`.
- Deleted `usePlaceListHighlighted` (replaced by `useDestinationsHighlighted`).
- Updated the `isWorld` type guard from `!("positions" in entity)` to `entity.world === true`, since world entities now consistently have `positions: []`.

## Test plan

- [ ] Verify `GET /destinations` returns places from `places` table and worlds from `worlds` table
- [ ] Verify `GET /destinations?only_worlds=true` returns only world entities from `worlds` table
- [ ] Verify `GET /destinations?only_places=true` returns only place entities (no world-type records)
- [ ] Verify text search works across both places and worlds
- [ ] Verify pagination and total counts are correct for mixed, places-only, and worlds-only queries
- [ ] Verify `PUT /worlds/:world_id/highlight` requires admin auth and toggles the highlighted flag
- [ ] Verify `PUT /worlds/:world_id/ranking` requires bearer token auth and updates the ranking
- [ ] Verify the homepage carousel shows both highlighted places and highlighted worlds
- [ ] Verify the admin highlights page can toggle highlight status for both places and worlds
- [ ] Verify the world detail page loads correctly via both `?id=` and `?name=` parameters
- [ ] Verify favorites, likes, and ratings work for worlds using the new Worlds API client
