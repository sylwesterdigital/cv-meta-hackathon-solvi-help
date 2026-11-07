# SOLVI v0.2.237 — Declarative Muse Design Contract

## Why

The v0.2.236 browser could build a saved 8-piece arch but could not execute requests for a yellow submarine, a pink sphere, or an unfamiliar object. A rigid noun-to-template switch was an architectural bottleneck. The server model can propose geometry, but tool execution must stay in the authorized scene.

## Mechanism

1. A signed-in human explicitly instructs an addressed robot (resolved from the **current realm** by unique display name to its immutable object ID), or the @all queue atomically assigns three unique sub-jobs to available workers.
2. The bound, saved `local_project` work order in SQLite must include `allowChanges=true`, exact `room` and `robotId`. Server refuses design inference without that record and the correct robot edit permission.
3. `POST /api/robots/autonomy/design` sends the saved human goal and current room scene plus limited current-realm conversation to Muse. New object names do not need hardcoded vocabulary; contextual prior robot design proposals supply *descriptive context*, not authorization.
4. A design is JSON data only: `name`, `site_distance`, 1–12 `parts`, each `{kind: cube|sphere|cylinder, label, color: #rrggbb, offset:{x,y,z}, size:{width,height,depth}}`. Strict bounded floats, shape, keys and colors are checked server- and client-side. JSON containing scripts, URLs, unexpected fields or oversized dimensions is refused.
5. Persist the chosen design and placement site before edits, then use the existing checked editor/physics/persistence tools. Save one part per cycle with its original scene object ID. Completed team projects are independently verified against saved room scene IDs, owners, names, geometry, dimensions, colors and planned positions.
6. Distinct new robot default names prevent ambiguous targeting; existing user-assigned names and scene IDs remain intact. Jobs are loaded for the selected realm only; conversations from other realms do not shape a task.

## Watcher gates

- `npm test` and Node syntax checks, `python3 backend/test_nginx.py`, Flask `backend/test_api.py` (including dynamically mocked Muse response), Python/shell syntax, generated vendor/import graph, browser HTTP smoke.
- After deployment, use 2 browsers to test an unfamiliar structure, 1m pink sphere, yellow submarine 30m in front of a robot, group independent assignments, refresh resumption, and crossing to a different realm.

## Known limitations

- Requires a configured Meta Muse key; if unavailable/invalid, task stays pending and nothing is substituted.
- Components are still bounded to primitives, 12 per design and 12m height; no freeform mesh generation, true new procedural API invention, physics simulation without an active authorized browser, or autonomous creation of a *new realm*.
- Existing v0.2.236 saved eight-part projects are maintained for continuity, not silently redesigned. Existing structures are not yet generically remodelled via arbitrary conversational edits.
- Real-time two-browser live acceptance is not established by passing static or unit tests.
