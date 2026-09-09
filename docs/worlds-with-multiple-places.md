# Worlds that contain many places: discoverability of sub-scenes

Status: open product question, raised in Slack on 2026-09-08 with Nico Earnshaw, Kim Currier and Bay
Backner, cc Vicky de Campos. Lautaro Petaccio has raised it several times before. No engineering
work has started, deliberately: all three options below need a product decision first, and two of
them change both this service and the ranking pipeline.

This document exists so whoever picks the decision up does not have to re-derive the current
behaviour. Everything under "Verified behaviour" was measured against production on 2026-09-08,
not inferred from the code.

## Context

The model used to be close to one world, one place, so representing a world as a single card in
Places Web matched reality. That is no longer true: a world can now hold many independent scenes,
each a row in the `places` table with its own id, title, description and image.

Worked example, `emgeducation.dcl.eth` ("EMG World"): 28 places, among them `EMG Chess 1`,
`EMG WildLife Surveyor`, `EMG G4-1`, `EMG G5-4`.

## How common this is

Measured across the whole production catalogue on 2026-09-08, in answer to Kim asking how many
worlds have multiple scenes:

```
 scenes  worlds
      1   1587
      2     35
      3      8
      4      2
      5      3
      6      1
      7      3
     10      2
     24      1   antela.dcl.eth
     25      1   kuruk.dcl.eth
     26      1   xdstandart.dcl.eth
     28      1   emgeducation.dcl.eth
     32      1   emgverse.dcl.eth
     62      1   italy2026.dcl.eth
```

**60 of 1,647 worlds hold more than one scene, so 3.6%.** The remaining 96.4% are still one to one,
which is why the old mental model survived this long: it broke in a handful of cases, and those
cases are large. The worked example is not the worst one, `italy2026.dcl.eth` has 62 scenes.

**361 scenes live inside those 60 worlds.** That is the real size of what is undiscoverable today,
rather than the 28 of the worked example, and it is the number the decision below should be weighed
against.

Method caveat, because it changes the answer: counting naively gives 1,657 worlds with scenes out of
1,647 that exist. Ten worlds carry their name with different capitalisation between the `worlds`
table and their place rows (`DRmeta.dcl.eth` against `drmeta.dcl.eth`, `iKaraoke.dcl.eth` against
`ikaraoke.dcl.eth`, and eight more), so a count keyed on the raw `world_name` splits them. Normalise
to lowercase. This is the same defect places#880 is fixing, and those ten worlds are its concrete
case.

## Verified behaviour

Same world, six queries against production:

| Query                                    | Rows for this world |
| ---------------------------------------- | ------------------- |
| `/api/places?names=emgeducation.dcl.eth` | **28 places**       |
| `/api/places` (no filters)               | 0                   |
| `/api/places?search=EMG`                 | 0                   |
| `/api/worlds?names=emgeducation.dcl.eth` | 1 world             |
| `/api/destinations?only_worlds=true`     | 1 world, ranking 38 |
| `/api/destinations?only_places=true`     | 0                   |

Both of the things people report are therefore true at once, and neither is wrong. They are two
endpoints looking at the same world.

## Why the current behaviour is coherent

Three independent mechanisms line up, which is why this is not a UI defect:

1. **The places query hides world scenes from browse.** `PlaceModel.buildSubQuery` adds
   `AND world is false` unless the caller passes `names`, `ids` or `only_highlighted`
   (`src/entities/Place/model.ts:144-150`). `?names=` is a deliberate lookup that lifts the filter,
   and it is the only path by which the 28 surface.
2. **A world has exactly one ranking slot.** Browse orders worlds by `worlds.ranking`
   (`src/entities/Destination/model.ts:48` and `:269`), a single column on the world row. The place
   rows behind a world have their own `ranking` column, but nothing reads it for browse.
3. **The destinations feed excludes world-backed places outright.** Both branches pass
   `worldFilter: "always"` (`src/entities/Destination/model.ts:234` and `:286`), so a place with
   `world = true` can never appear in the feed, whatever its ranking.

The ranking pipeline agrees with this: monodata#529 makes a world rank once per world rather than
once per parcel, keyed on the lowercased `world_name`.

## The question

Not whether Places Web renders worlds incorrectly, it does not. Whether sub-places inside a world
are intentionally meant to be undiscoverable.

Today they are unreachable by browsing or searching. A user has to already know the world name and
call one specific parameter. For a world used as a campus or an event venue with distinct rooms,
that is a real cost, and it is the cost that prompted the question.

## Options and what each one costs

### Option A: one card per world (today's behaviour, made explicit)

The world is the destination; its internal layout is the creator's business.

- **Places:** no change to browse. Worth adding a short note to the OpenAPI description of
  `/places` saying that world scenes are excluded unless `names`, `ids` or `only_highlighted` is
  passed, so the next person does not read the 28 as a bug.
- **Ranking pipeline:** no change. monodata#529 is already the right shape.
- **Cleanup that becomes worthwhile:** the inner place rows should not carry rankings at all, since
  nothing reads them. See "Technical debt" below.
- **Cost:** sub-scenes stay undiscoverable. Accepting this is a real product position, not a
  non-decision, and it should be written down as such so it stops being re-litigated.

### Option B: one card per place

Each scene competes on its own merits and becomes reachable.

- **Places:** the places branch of the destinations query would have to stop excluding
  `world = true` rows, which means `worldFilter: "always"` can no longer be unconditional. The
  content quality gate then applies to each sub-scene, so a world with 28 rooms and one shared
  thumbnail would mostly be filtered out; that interaction needs checking before committing.
  Worlds and places would also have to stop being two separate branches for the same world, or the
  same world appears both as itself and as its 28 rooms.
- **Ranking pipeline:** monodata#529 would have to be substantially reversed. Its whole point is
  one ranking per world; this option needs one ranking per place inside the world, which is what
  the per-parcel bug was doing accidentally and badly (a world received nine rankings between 2 and
  122 and kept one at random).
- **Cost:** a single world could occupy many positions in the feed, up to 28 in this example. That
  is a feed fairness question rather than a technical one: 28 cards from one creator crowd out
  everyone else, and the ranking alone does not prevent it.

### Option C: something in between

Two sub-shapes, and they are not equivalent.

- **A cap per world.** The feed admits at most N entries from any one world. Cheapest to reason
  about, and it bounds the fairness problem directly. It needs a decision on which N entries win
  when more than N qualify (highest ranked, presumably) and where the cap is enforced: doing it in
  the ranking pipeline keeps the feed simple, doing it in the feed keeps the pipeline honest about
  what qualified.
- **Creator selects which scenes surface.** Closest to intent, and the most work: it needs a new
  per-place flag, a way for the creator to set it (worlds-content-server settings, most likely,
  since that is where `show_in_places` already comes from), and the same plumbing through
  `stg_places` that `exclude_from_ranking` needed. Note the precedent: `show_in_places` is already
  a creator-controlled, server-side filter on worlds, so this is the same idea one level down.

Either sub-shape still requires Option B's changes to the feed and the pipeline, plus the cap or
the flag on top. Neither is a smaller version of B.

## Technical debt found while investigating

Separate from the product question, and deliberately left out of the Slack thread so it does not
muddy it:

- One of the 28 places carries `ranking = 24`. It is a dead value: nothing reads the ranking of a
  world-backed place, because the feed excludes them. It was written by the per-parcel bug that
  monodata#529 fixes. Under Option A these values should be cleared and the pipeline should never
  write them; under Option B they become meaningful and would need to be computed properly.
- Stale rankings from the retired legacy pipeline still sit in the `ranking` column of destinations
  that no longer qualify. Measured on 2026-09-08: 12 destinations carry values above 137, the new
  feed's maximum, so they outrank every destination the new score actually qualified, and at least
  17 pairs of Genesis City places share a ranking value because one of each pair is a leftover from
  an earlier run. The fix under discussion is an endpoint that atomically replaces the whole
  automated set, so a run unranks everything it does not name. That is independent of this document
  but touches the same column, so sequence the two.

## References

- Slack thread, 2026-09-08, raised with Nico Earnshaw, Kim Currier, Bay Backner, cc Vicky de Campos.
- monodata#529, `fix(dwh-next): rank a world once, not once per parcel`.
- monodata#497, the discovery ranking model and the feed it replaces.
- places#882, `exclude_from_ranking`, the precedent for a per-destination editorial flag and for
  plumbing a new column through `stg_places`.
- places#883, the `only_excluded_from_ranking` and `only_highlighted` list filters, and the reason a
  flag without a way to query it is not finished.
- `src/entities/Place/model.ts:144-150`, the conditional that hides world scenes from browse.
- `src/entities/Destination/model.ts:48`, `:234`, `:269`, `:286`, the world ranking column and the
  two branches that exclude world-backed places.
