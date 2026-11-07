# SOLVI.help v0.2.234 — Durable group tasks and verified action

## Observed defect

On 7 November 2026 the `@all` request to clear `Box copy...` objects into `Bin - Big Junk` near BeachUmbrella generated redundant robot acknowledgements rather than verified motion. Version 0.2.232 assigned one idle robot only when it could immediately resolve the destination and worker. A missed assignment had no room-level queue; robot work orders had a nominal 180-second interval. A saved camera caption from 80+ seconds earlier is not evidence of the present object pose.

## Implemented contract

1. **Ingest:** Only an authenticated, saved, human `@all` message can enqueue cleanup or a bounded locally supported construction project. The server independently classifies the source message; negative instructions and ordinary conversation are rejected. Replayed message IDs are idempotent and identical in-flight room cleanup requests coalesce. Unresolved requests persist in the new `robot_group_intents` SQLite table rather than becoming conversation promises.
2. **Dispatch:** A signed-in browser with a loaded scene polls pending group work every ~3 seconds and immediately attempts dispatch on a new message or task handoff. It selects the nearest available editable, non-controlled, non-mission robot to **unfinished** Box copies, preferring a different robot after a failed assignment. Independent construction intents can occupy different idle workers; existing assigned work remains intact. Server work-order commit and queue claim occur under `BEGIN IMMEDIATE`, with one cleanup worker per room. The worker starts only after the server confirms the claim.
3. **Grounding:** Destination selection uses previously saved human room messages and an actual matching loaded scene object ID. `Small Bin` cannot stand in for `Bin - Big Junk`. The server checks that the target is present and named by a human before allowing an assignment. A later human `@all` clarification retargets the same active group job and its saved work order together, after the current physical step; a bot cannot silently rename the destination. Missing bins, permission failures and no free robots are explicit pending states; they do not become fabricated success.
4. **Freshness:** Before every cleanup action the worker re-examines current scene objects and, when permitted, captures a new real head-camera view. Old frames and chat speculation are not valid live observations. It rechecks proximity and permissions after each physical route and immediately before pickup/storage.
5. **Execution:** Use existing collision-checked navigation and inventory hold/Store or Drop. For a native bin, verify genuine container storage; for an imported model bin, verify the save-acknowledged object is **beside** the bin. No invisible container inventory is invented. Each box maintains its object ID and individually saved progress.
6. **Recovery:** Blocked items are deferred while other items are tried. After three cycles without progress, a worker must safely put down held cargo and save its position before group reassignment. A group task can be delegated up to four times; thereafter it reports an explicit blocked reason. Active cargo-carrying jobs cannot be stolen. If an assigned robot or its saved order disappears, the queue safely reopens the pending task.
7. **Completion:** Only the backend can close a group cleanup after checking all matching Box-copy objects in the current persisted room scene for their named container ID or near-bin world positions. Model or robot responses cannot independently assert completion. Bounded build group tasks require a newly created, server-visible object ID that was not present when the task was claimed.
8. **Persistence and concurrency:** The worker order stores the original group message ID and per-item progress. A separate explicit task cannot overwrite a still-assigned group work order. Queue and orders persist across refresh and while the browser is closed; **physical execution does not occur while the browser is closed**.

## Expected Brain / work-order events

`GROUP QUEUED` → `GROUP DELEGATED` → `ORDER COMMITTED` → `ACTION STARTED` → `LIVE SCENE` / `FRESH CAMERA` → `BOX HELD` → `BOX STORED` or `BOX DELIVERED NEAR` → `GROUP CLEANUP VERIFIED`.

On failure: `GROUP WAITING`, `BOX SKIPPED`, `SAFE HANDOFF DROP`, `GROUP HANDOFF`, or `GROUP BLOCKED`. Logs distinguish a saved plan from an actual persisted physical action.

## Watcher staging and acceptance

Copy the **ZIP without extracting** into `<repository-root>/updates/` and let the existing watcher verify its SHA-256 manifest, package/release version, browser import graph, npm tests, isolated Flask/SQLite integration, Git synchronization and Ubuntu deploy. Do not overwrite `solvi-watch.sh`, local avatar GLBs, or production SQLite with the ZIP. A valid watcher run is a **prerequisite**, not proof of live scene movement.

After watcher succeeds, in the browser test a room containing editable `Box copy1`, `Box copy2`, a model named exactly `Bin - Big Junk`, an unrelated `Small Bin`, and several robots at different positions. Check: one closest free robot acts immediately; busy/controlled robots are skipped; cargo is actually moved and saved; a second browser reload sees the new pose; nonexistent bins leave pending work; two simultaneous requests do not duplicate pick-ups; an obstructed route yields a safe alternative worker when no cargo is held; separate building goals progress on other robots; and final server receipt rejects an unmoved box. Test browser refresh/resume and permission loss. Use development realm data; do not manipulate production users' rooms during testing.

## Limits

No unrestricted autonomous invention of new tools, no infinite retries, no autonomous avatar simulation in Flask, and no guarantee of complex navigation success. Under a local environment without npm/Flask dependencies, only syntax, standalone Node regression tests and isolated Python helper tests can run. The watcher must perform full integration and browser smoke checks before declaring the release live.
