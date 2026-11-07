# SOLVI.help v0.2.227 — Conversation to verified room furnishing

## User-visible failure addressed
In Nowhere the request `@Lea yo uare free to add to this house more furnutures` was classified as visual chat; Lea promised to add a bed and table, but no saved work order existed (`active_task:null`). `@Lea please do what you said earlier` was classified as another chat. No physical edit occurred.

## Implementation
- The authenticated human chat-to-work-order bridge accepts a named robot's open-ended but clearly authorised furniture request. With no specified variants it selects a minimal, bounded bed and table on a recognised editable room floor. Misspellings like `yo uare` and `furnutures` are normalised *only for parsing*, while chat text itself is preserved.
- A direct `@Robot please do what you said earlier` resumes an existing persisted furnishing run immediately. If no run exists, the bridge may read the last 80 room messages and match a *recent explicit* robot promise naming supported furnishings, but the new HUMAN follow-up is the actual edit authorisation. A model statement alone never creates scene objects.
- Shared floors already authored as editor cubes remain preferred. For a closed ground-level procedural wall house with no floor cube, a candidate is permitted only if the authorised robot is inside the wall polygon, the entire item footprint remains inside with clearance, height is ground-level, and navigation obstacles do not overlap. Multistorey room arrays, unclosed outlines, remote rooms and floor-cube bypasses are rejected.
- The editor creates a procedural object through the existing tool and requires a server-acknowledged `/api/scene/object` save. Retry-safe object IDs are retained. One obstructed furniture item does not erase the other item. Where an avatar clip is available, a short pickup gesture accompanies placement, but animation is not evidence of success.
- Normal vision questions and ordinary conversation still use Meta. No new unrestricted AI powers, model access, permissions or subscription service are introduced.

## Deployment gate
Run Mac watcher tests, including complete Flask HTTP integration, before GitHub/Ubuntu push. Do not deploy unless the ZIP manifest is valid and no `.pyc` or `__pycache__` files are present. Browser deployment and two-client persistent geometry remain unverified in this release package.

## Acceptance in Nowhere
1. In a room containing a closed procedural wooden house, place an editable Lea avatar on the ground and ask `@Lea you are free to add furniture to this house`.
2. Check `ROOM FURNISHING ASSIGNED`; the saved order should contain `bed + table` and start a local tool action without a paid Meta planning request.
3. Verify `ROOM FURNITURE SAVED` for each item, actual scene IDs, and persistence after reloading two clients. Only then claim a built room.
4. Follow up with `@Lea please do what you said earlier` during a pending order; it should resume/recheck without starting duplicates. Try the follow-up with no active order after a recent explicit pledge; the robot must derive only the named items.
5. Repeat on a wall-only room, a cube-floor room, a room with occupied clearance, a second floor, and an unclosed wall outline; do not create objects through walls or on an invented floor.
6. Verify the existing Meta-free vision-search command, object permissions and the earlier box/can cleanup workflow remain functional.

## Known limitations
Physical work still executes only in a visible authenticated browser with editor rights. Ground-floor wall rooms must actually be closed procedural wall polygons; imported GLB buildings and unsupported elevations do not acquire inferred floors. The default furnished room consists of a bed and a table, not open-ended generated furniture. A chat promise or a test pass is not proof of live world edits.
