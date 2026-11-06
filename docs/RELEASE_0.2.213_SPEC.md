# SOLVI.help v0.2.213 — Execution and observability

## Why
Hoe replied to a requested can-table cleanup but the unrelated `@all build more homes` local project stayed active. Multiple Meta subsystems also reported different key states, and retry/backoff constants were buried in code. Small speech blurbs and opaque map visuals hid useful context.

## Changes

1. Per-user `robot_autonomy_preferences` stored in SQLite; authenticated GET/PUT supports 15–600 s failure retry, a max retry >= base, and 20–600 s model planning cooldown. Existing daily provider budget remains enforced. A key-status endpoint checks the exact credential selection used by planning, without disclosing secrets; merely finding a credential does not prove provider acceptance. Session keys stay specific to each browser tab.
2. Explicit, user-sent, named requests to clear cans from a table create a persistent `local_project` (not a chat-only assurance) that supersedes the old work order for that robot only. It identifies the relevant home and nearby table cans, validates ownership/proximity, uses the existing Held and Drink actions, creates a real bin using the procedural furniture editor, transfers empty cans into 24-slot persistent bin storage, then verifies that no matching loose cans remain. Does not remove the cans from the world, fake an animation, or violate owner permissions.
3. Longer speech bubbles and visible speaking border/microphone overlays on robot face selectors; speaking activity originates in real voice-playback events. Reduced-motion support.
4. Map surface roughly 25% opaque with real object footprint rectangles. Named scene object mentions trigger a temporary pulsing marker; ambiguous / unmentioned objects do not create fabricated map pins. Dialogue instructions favour landmarks over raw coordinates.

## Known limitations

- Model key presence is not proof of Meta provider acceptance: use the existing Settings key-test button to verify. Meta API client sessions remain tab-scoped.
- Robots still need the operator's signed-in visible browser to run work orders. They cannot work continuously after browser closure.
- A cleanup request might stop if the correct home, bin placement, or a reachable can cannot be established. All such cases must remain UNFINISHED, not silently reported as success. The robot may be unable to reach a table inside a physically closed or collider-blocked room; this release does not implement unrestricted flight.
- The bin's contents are hidden stored scene objects (not free-body falling can simulation). Their IDs and inventory state persist; backend verifies object permissions, empty-can status, unique slots, and bin ownership.
- Map footprints use world-axis-aligned 2D bounding boxes, not exact rotated wall polygons or a floorplan rasterizer. Highlighting requires a name match to an actual scene object.
- Full Flask HTTP/WebSocket, real provider and live two-browser spatial UI must be verified on the Mac watcher/deployment. Existing scenes, GLBs and database must not be reset.

## Acceptance check

1. Load v0.2.213 in two connected browsers. Open Settings → Meta AI. Verify a tab-only Meta key shows session presence only in its tab; the other tab identifies missing server/session key. Save a custom retry and reload, confirm persistence.
2. With a blocked Meta planning call, verify the UI and Brain log show the real reason and configured retry seconds; existing local work can continue. Set the key and verify missing-key cooldown is cleared.
3. In Hoe's home, put three pickable cans on a table, enable authorised robot scene changes and ask `@Hoe return home, pick up and drink the cans from the table, put empties in a bin, and clear the table`. Watch each pickup/drink/store receipt; reload in two browsers and verify same can IDs and their bin container status. If route blocked, expect explicit unfinished state and a can still held, not a completion claim.
4. Check a full-length robot speech bubble and speaking-portrait outline and mic during genuine voice playback (not merely text display). Reduced-motion should not animate the border.
5. Open the minimap and confirm translucency and building/furniture footprints; have a robot mention a named visible scene object and observe the map marker blink near that object.
