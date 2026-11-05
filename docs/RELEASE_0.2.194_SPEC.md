# SOLVI.help v0.2.194 — Scene and Preset Consistency Implementation Specification

## User-reported failures

- Saving a procedural preset sometimes returns **"Invalid preset properties"**, including cubes carrying generated `openings` arrays.
- Some edits are visible on one client but not another; disappearing groups of placed furniture indicate missed save events, stale room snapshots, or backend rejections.
- Single-stroke stairs can lose colour or texture after synchronisation/rebuild.
- Live diagnostics show `presence-sync` repeatedly without scene-save/scene-error evidence.

## Data contract and fixes

1. **Presets** (`backend/server.py`): validate `openings` using the same `valid_cube_openings()` array schema as scene-object updates. Reject wrong object types and malformed furniture, stairs, wall and ladder presets with specific errors. Preserve existing preset fields, ownership stripping and thumbnail rules.
2. **Procedural appearance** (`js/editor.js`): redirect generic stair Colour and Texture editing to `stairs.color` / `stairs.surface.color` / `stairs.surface.texture` and call `rebuildOfficeStairs`. The procedural configuration must be included in the scene snapshot and applied by peers; generic mesh appearance is never the only source of truth.
3. **Durable upserts**: `queueSave` marks a generation for each dirty object; per-object POST saves are serialised by ID, successful responses acknowledge only the matching generation, and transient failures retry up to three times with bounded delays. Permanent errors are retained as dirty and made visible; do not claim saved. Removal has retries and diagnostic entries.
4. **Scene snapshots**: merge scene revisions without overwriting locally dirty or pending-remove objects; do not apply fetched snapshots older than the last known revision. A remote revision gap triggers an authoritative fetch. Local unsaved edits survive a reconnect and initial loaded-room race.
5. **Safe manual Save**: flush all pending changed objects individually rather than PUTting a potentially stale full scene list that could delete other participants' work. The existing full-scene API remains for specialised transactional clients; bulk PUT now begins a SQLite `BEGIN IMMEDIATE` transaction before compare-and-swap.
6. **Scene-health observability**: emit `scene-revision-received`, `scene-revision-gap`, `scene-reconciled`, `scene-object-saved`, `scene-save-failed`, `scene-object-applied`, `scene-object-removed`, `scene-remove-failed`, and `scene-conflict-preserved` to the bounded existing Live diagnostics panel. Only safe metadata (room, ID, kind, name, revision, action, reason) is logged; no token or payload contents. Distinguish mere `presence-sync` from real scene reconciliation.
7. **Missed WebSocket events**: on join/rejoin, and at most every 90 seconds while connected, fetch the authoritative room scene. Reconciliation never blocks the renderer.
8. **Capacity parity**: bounded scene limit increased from 128 to 512 in single-object upsert, full scene PUT, realm cloning, archive validation and full exports; no unbounded scenes.

## Suggested two-browser acceptance checks

- Open two separate authenticated profiles in the same room. Add a cube, a laptop and a table on browser A. Confirm each appears on B after one save revision and that both clients converge after a reload/reconnection.
- Save a cut-out cube as a preset and instantiate it in another room; confirm openings preserved.
- Make a single-stroke staircase with a nondefault colour and texture, save it, reload and verify on the peer and original browser.
- Create a furnished house, make concurrent edits by two profiles, press Save on each, and confirm neither browser deletes another's objects. Inspect diagnostic save acknowledgements.
- Temporarily block API or WebSocket and verify failed saves show in diagnostics and local unsaved changes remain visible. Reconnect and confirm recovery.
- Verify tool and equipment presets, laptop open/close/media, fridge items and both original GLBs remain functional.

## Limitations

Automated unit and static validation cover protocol events, sanitisation, persistence code paths and appearance rules. Full Flask integration, simultaneous real browsers/WebGL and production network failures are **not proven** by these tests. A scene object may still be rejected for permission or invalid metadata; diagnostics must expose the failure. Old furniture absent from the server database cannot be recreated by this release; back up SQLite before deployment and inspect any previous realm snapshots if items have already disappeared.
