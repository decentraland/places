# Optional hybrid favorite commands

The public endpoint is `PATCH /api/places/{uuid}/favorites` (the server mounts
its favorite router under `/api`). Preserve that complete signed pathname.

The ordinary favorite API is unchanged unless the request includes
`x-dcl-operation-id`. This protocol is disabled by default. It supports only scoped
Genesis place UUIDs, not worlds, marketplace favorites, shop or credits.

Before setting `MIGRATION_CAPTURE_ENABLED=true`, install the reviewed
[dcl-one capture adapter](https://github.com/decentraland/dcl-one/blob/feat/one-way-sync-service/services/migration-sync/source/places.sql)
on the approved source database and grant the application role its required local
permissions. The source function is installed by the separate migration operator
command, not by ordinary application startup. Follow the
[deployment runbook](https://github.com/decentraland/dcl-one/blob/feat/one-way-sync-service/services/migration-sync/README.md).
These integration branches must be published together before those links resolve.

The caller generates a lowercase, nonzero UUID for each logical favorite/unfavorite
operation and reuses it on timeout/retry. Normal source authentication still verifies
the original request. The stored fingerprint binds the operation to its actor,
place and favorite value; changing activity scores does not change retry identity.
Reusing an operation ID with different semantics returns a conflict.

The SQL function commits the favorite mutation, derived source count, original
response and capture metadata in one transaction. An identical retry returns that
original response, even if later operations changed or removed the place. New
commands still require an active place in the installed scope. PostgreSQL failures
return a safe retry error; the handler never falls back to an unreceipted write.

Requests without the header use the existing handler. Once capture is installed,
its triggers also record those writes and direct/internal SQL changes; the target
applies them as source-only changes. Only receipt-bearing commands exercise native
duplicate execution. Production remains authoritative; this application does not
contact dcl-one or wait for its availability.

Configure the gateway's explicit hybrid path allowlist to match the source scope.
Client path signatures must survive unchanged. A gateway timeout is not evidence
that production failed to commit: retain the same operation ID.

Validate with `npm test -- src/entities/UserFavorite --runInBand` and `npm run build`.
The monorepo's disposable PostgreSQL tests validate the SQL capture/receipt contract.
Deployed grants, client retry integration and production contention remain rollout
gates. Disable hybrid gateway ingress and remove this environment flag before
retiring source capture through an explicit operator migration.

Browser preflight already permits the operation header through the existing
`/api` CORS middleware (`allowedHeaders: "*"`); no CORS policy change is needed
for the current signed-fetch requests.
