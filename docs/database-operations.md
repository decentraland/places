# Database Operations

## Clear Database

To restart the project with a clean database:

```sql
TRUNCATE places;
TRUNCATE place_activities;
TRUNCATE place_activity_daily;
TRUNCATE entities_places;
TRUNCATE tasks;
UPDATE deployment_tracks SET "from" = 0;
```

## Re-Populate Place Positions

```sql
TRUNCATE "place_positions";
INSERT INTO "place_positions" ("base_position", "position")
  SELECT p.base_position, unnest(p.positions) FROM places p
    WHERE p.disabled IS FALSE
      AND p.world IS FALSE;
```
