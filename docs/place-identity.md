# Reproducible place identities

New runtime place identities use UUIDv5 with namespace URL
`6ba7b811-9dad-11d1-80b4-00c04fd430c8` and UTF-8 compact JSON:

```text
["decentraland-place","v1","genesis","<immutable entity ID>"]
```

For a world scene the scope is `world:<lowercase world name>`. The entity ID is
case-sensitive and comes from the hash-verified deployment event, passed through
`deploymentId`; it is not a local database sequence or a hash of reserialized
metadata. Empty or padded inputs are rejected. The shared vectors are in
[`placeIdentity.vectors.json`](../src/entities/CheckScenes/task/placeIdentity.vectors.json).

An existing Genesis place keeps its UUID when the base matches, or otherwise when
its parcel set matches. Candidate ties use the smallest UUID. A world scene keeps
its existing UUID when it overlaps exactly one active scene identity; otherwise it
creates a new identity. Imported active UUIDs are never rewritten. Rating-history
IDs and the deprecated historical migration helpers are unaffected.

The deployment applier can restore a previously retired deterministic UUID after
the existing lifecycle checks accept the deployment. It retains creation time,
interaction counters and curation. A conflicting active binding, another scope,
or moderation-disabled identity is rejected. A retired random legacy UUID cannot
be recovered from erased history in both systems and is not guessed.

This change makes the same creation decision reproducible in Places and dcl-one;
it does not synchronize deployment ordering, catalogue state or interactions.
Both systems still need equivalent starting state and the same accepted lifecycle
history. Coordinate rollout with the dcl-one implementation before enabling new
hybrid scopes: generation changes for new places when this version is deployed,
without a migration feature flag. Existing database rows require no rewrite.
