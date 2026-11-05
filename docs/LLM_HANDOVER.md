# SOLVI.help Master LLM Handover — v0.2.198

## v0.2.198 — Smart support-surface placement (2026-11-05)

**Verification:** Complete source JavaScript regression suite 939/939; all 6 standalone Python backend tests passed, 13 backend modules parsed, shell installer syntax passed. Package contains 466 SHA-256-verified application files; original two GLB model bytes unchanged. Full Flask integration, real browser WebGL placement and live multiplayer validation still require deployment checks.

**Incident:** v0.2.197 falsely reported no collision-free visible space for cans and other small props in crowded indoor scenes. It planned on groundY=0 only, treated tables as fully solid obstacles, and treated broad low primitive cube floors as blocked volumes. Screenshots showed available tabletops and user unable to create props.

**Code:** `js/scene-placement.js` now detects horizontal tabletop and floor slab support geometry (table/stool/cabinet; broad, low cube and horizontal plane), creates safe world-space polygons, selects tabletop first for small eligible items and floor support for any object. The pure `js/smart-placement-math.js` supports deterministic raised-surface candidate search with conservative footprint containment, obstacle-overlap and true camera visibility; the supporting object's own AABB is omitted only while placing *on that support*. Original ground planner remains fallback. Add and preset flows still publish only after safe positioning through the existing per-object queueSave path.

**Tests:** `tests/release-198-smart-support-surface-placement.test.mjs` adds tabletop, raised floor, repeated small object, overhang, occlusion, below-top camera, and full-table cases. Version updated to 0.2.198.

**Limits:** Actual production scene and browser camera untested locally; not guaranteed to recover any previously lost objects; no schema changes. Full two-client test on deployment required.


## v0.2.197 — Visibility-aware placement of new scene objects

- A new dependency-free candidate planner in `js/smart-placement-math.js` scores placements by screen-centred framing, camera proximity and distance to the last object placed in the same room. Collision checks use 3D AABBs, not a naive 2D proximity threshold; the camera sight line must be clear. Bounded deterministic sample sets avoid an expensive physics scan.
- `js/scene-placement.js` adapts the planner to Three.js geometry; generated wall groups and long fences are checked per mesh segment to keep room interiors and actual doorways available. Walkable roads, footpaths and ground-plot furnishings do not block placement.
- `js/editor.js` integrates the new rule into Add and saved-preset insertion *before* scene publishing. Failed preset placement cleans up its provisional rigid body and object without sending network changes. Room switches/scene replacement clear the previous-object anchor. Manual move/rotate/scale, robot worksite placement, and media insertion remain independent.
- New `tests/release-197-smart-object-placement.test.mjs` covers same-room proximity, small rooms, walls, door gaps, 3D occlusion, distinct floor elevations, safe failure, deterministic results and editor integration.
- Prior v0.2.196 scene snapshots, full furniture schema, backup tooling and all other features remain intact. No production recovery or deployment has been verified here.

**Local verification for v0.2.197:** 929/929 JavaScript tests passed from source; all six standalone backend checks, 13 Python AST modules, and shell syntax passed. The complete v0.2.197 ZIP was assembled with 464 SHA-256-verified application files and original 3D model bytes unchanged; 929/929 JavaScript tests also passed directly from a fresh extraction of that ZIP. Full Flask integration, live WebGL hit testing and two-client multiplayer behaviour have not been exercised here. The most recently confirmed live version in conversation remains v0.2.189, not proof of deployment for newer ZIPs. The prior production SQLite furniture-recovery incident remains unresolved without user-provided DB inspection and backups.

## v0.2.196 — Critical: furniture rejected on save; rooms appear empty

**Reported on 2026-11-05:** User screenshots show `Scene object NOT saved: Rake · Invalid basic furniture`, and reports that prior sets of furnished interiors have disappeared and a fresh load reports furniture as invalid. Treat as a data-integrity incident, not cosmetic. The precise production SQLite data has not been inspected here; loss and recovery are not independently confirmed. The user most recently confirmed v0.2.189 deployed; later watcher logs have not been supplied.

**Confirmed cause:** `app/js/primitive-properties.js` generates a **129-property** config for every one of 46 types (45 regular furniture/tool/equipment/nature variants plus infrastructure). Backend `valid_basic_furniture` rejected non-infrastructure dicts with more than 120 fields; `_preset_finite` also rejected nested dicts over 120. As a result, the server rejected object saves/presets even though the editor had rendered them locally. Loading the room later couldn't show locally created unsaved furniture, and periodic presence-sync is not a scene-save guarantee.

**Changes:**
- `backend/server.py`: enlarge field count to **200** in `valid_basic_furniture` and `_preset_finite`, preserving the existing strict enumerated field-name, type, numeric-range, HTTPS media, and semantic validators. Tests exercise 45 complete 129-field default configurations; infrastructure schema still requires valid physical points. Do not solve by accepting arbitrary keys/values.
- Add `scene_snapshots` SQLite table with zlib-compressed SHA256-verified, timestamped per-room full scene snapshots; retain 32 snapshots/room. On first startup under v0.2.196, save each already-populated room as `pre-upgrade`. Backup before bulk overwrites and deletes; during edits, snapshots every ten revisions or five minutes. The backup is committed in the same transaction as the mutation; no automatic restoration occurs.
- Read-only authenticated `GET /api/scene/backups?room=main` lists revisions. `GET /api/scene/backups/<snapshotId>?room=main` provides JSON snapshot data. No automatic full-room restore over other users' edits.
- `backend/scene_recovery.py`: offline inspect/export and optional explicitly confirmed snapshot restore; requires `--service-stopped --confirm RESTORE:<room>`, creates a transactionally consistent SQLite `.before-restore-*.sqlite3` backup and increments scene revision. Existing pre-v0.2.196 databases may only contain `room_scenes`, `scene` legacy payload, or independent backups; newly introduced snapshots cannot reconstruct previously deleted historical objects.
- In `editor.js`, import `scene-snapshot-guard.js` to reject malformed/missing/duplicate transformed objects and unexpected empty same-room responses before clearing the scene; preserve bounded 3MB local last-good read-only JSON when possible (`solvi-scene-last-good-<room>`). Do not auto-reupload local snapshots or silently overwrite remote scenes.
- Bulk `PUT /api/scene` now requires `confirmDestructive:true` when removing over 25% of a populated scene of at least five objects; normal per-object saves remain backward compatible.
- Version updated to 0.2.196 in index import maps, backend health, installer, package, releases and diagnostics. Preserve all originals and all v0.2.195 project/README/ABOUT/CHANGELOG split, v0.2.193 tools and earlier builds.

**URGENT recovery advice:** STOP editing scenes and back up the actual production SQLite database including WAL/SHM using SQLite backup API (not an unsafe copy while live). Before changing versions or restoring, inspect `room_scenes`, old `scene` and older database/realm exports. This release creates backups only of data still present on startup. Do not promise lost interiors automatically restored.

**Testing confirmed:** JS tests **920/920 passed** from source and from a fresh extraction of the complete v0.2.196 ZIP. Six standalone backend test scripts passed; 13 backend Python modules pass AST syntax, installer and deployment shell scripts pass Bash syntax. Offline recovery CLI was tested against a disposable SQLite database: it exported snapshots, restored a two-object scene and preserved the pre-restore DB copy. The complete release archive contains 461 application files with SHA-256 checks verified and original bundled GLBs byte-for-byte unchanged. **Not verified locally:** full Flask test API (Flask not installed), real WebGL browser UI/two-client sync, production SQLite contents, actual recovery of missing production furniture, or successful deployment. Do not claim production recovery or deployment.

---

## Preserved handover v0.2.195


## v0.2.195 — Public project README and About

- Confirmed root `README.md` saved earlier is a ~7 KB public project explanation; application `app/README.md` had grown into a ~156 KB chronological dev log by v0.2.194. This caused confusion about where the project introduction belongs.
- Preserve the entire v0.2.194 app README verbatim within the new `app/CHANGELOG.md`, preceded by a v0.2.195 entry. Replace `app/README.md` with a concise project overview based on the original public README; add `app/ABOUT.md` and an About tab within the existing in-app Dev log dialog.
- Restore and independently provide repository-root `README.md` (with `app/`-relative links), since the watcher ZIP contract allows only `manifest.json` + `app/**`; it cannot write a root repository README by itself. The user may need a separate ordinary git commit for this document.
- The About tab is local static markup and does not load markdown, external scripts, or API keys. Existing release notes, diagnostics, save, scenes, avatars and robotics are unchanged.
- Add `app/docs/RELEASE_0.2.195_SPEC.md` and tests covering README/CHANGELOG/ABOUT separation, tab semantics and links.
- **Deployment:** Not confirmed. User reported previous v0.2.194 ZIP and asked for proper README. Do not assume any v0.2.190–v0.2.195 deployments without watcher success logs.

## Scene and preset consistency; preserving edits across multiplayer clients

**Status:** v0.2.195 full local release candidate for the Mac `updates/` watcher. Not confirmed deployed. The user most recently confirmed v0.2.189 live; subsequent ZIPs were produced without watcher logs confirming deployment. Do not claim GitHub push or Ubuntu deployment. Back up the production SQLite database and existing realm archives before deploying. This update cannot restore objects previously deleted from the server; old scene snapshots/backups are required for recovery.

**Reported symptoms:** screenshot showed `Preset could not be saved: Invalid preset properties`; remote clients sometimes missed furniture or furnished houses appeared to vanish; single-line stairs reverted custom colours; Live diagnostics showed periodic `presence-sync` but no object-save failures. The user's laptop-error description was incomplete, so avoid asserting an unknown laptop issue was fixed.

**Confirmed causes and fixes:**

1. `backend/server.py` `/api/object-presets` mistakenly treated cube `openings` (an array) as a dictionary and responded `Invalid preset properties`. Fix to use the same `valid_cube_openings` schema as `/api/scene/object`, validate specialised furniture, stair, ladder and wall presets, and preserve user-presets ownership/field restrictions.
2. Generic `objectColor` and `texturePreset` editing on stairs changed transient rendered mesh materials rather than canonical parametric `stairs.surface` fields. Update canonical `stairs.color`, `stairs.surface.color` and `stairs.surface.texture` and rebuild geometry/physics before queuing a scene save; inspector reflects the saved fields.
3. Previous manual scene Save could PUT an entire stale scene snapshot, overwriting objects added by another client; update to flush dirty per-object POSTs instead. Add dirty generations, serialised in-flight per-object saves, bounded transient retries, explicit permanent failures, and diagnostics. Atomic full-scene revision check now starts SQLite `BEGIN IMMEDIATE` before comparing revision, avoiding interleaved writes.
4. Missed WebSocket scene notifications and reconnects had no independent scene health signal. `live.js` requests authoritative scene reconciliation on join and periodically (90-second bound), and `editor.js` fetches/merges revisions, protects locally dirty objects/removals, ignores stale snapshots, and reports revision gaps/conflicts. `room-diagnostics.js` now sanitises and displays object save/receive/reconciliation/failure events with no credentials or full payloads. Presence heartbeats remain distinct from scene health.
5. The previous 128-scene-object ceiling could reject larger furnished spaces while presence sync continued normally. Raise the bounded limit to 512 consistently in per-object saves, bulk save, room clone, archive import and full export. Higher limits do not guarantee GPU performance; the client is still responsible for budget decisions.

**Source files:** `app/backend/server.py`, `app/backend/realm_archives.py`, `app/js/editor.js`, `app/js/live.js`, `app/js/studio.js`, `app/js/room-diagnostics.js`, versioned metadata (`index.html`, `package.json`, `releases.json`, installer and robot-brains), tests and `app/docs/RELEASE_0.2.194_SPEC.md`. Legacy tests updated only for version expectations and whitespace in the `queueSave` source form. All prior v0.2.193 tools/equipment/fridge/laptop features and earlier navigation/Umami/rainbow features remain. Original GLBs must remain byte-for-byte identical.

**Testing:** Complete JS suite passed **910/910** in source with `node --test --test-concurrency=2 tests/*.test.mjs`. Six standalone backend test modules passed, AST parsing of 12 Python backend modules passed, both deployment shell scripts passed Bash syntax. The v0.2.194 test verifies WebSocket revision events and join reconciliation, metadata sanitisation, cube opening preset validation including backend validator AST execution, stair surface settings, scene-save guards, and capacity consistency. Full Flask `test_api.py` integration, real WebGL/two-browser concurrency, and production behaviour have not been verified locally; the Mac watcher and manual two-profile test must confirm them.

**Critical two-client acceptance:** Log in as two different profiles in `main`. Add a cube with cut-out, save as preset, place furniture and laptop inside a house, alter stairs surface colour and texture, and confirm peer receives and reloads same objects. Edit concurrently in both clients, press Save, reload and compare. Check `scene-object-saved`, `scene-revision-received`, `scene-reconciled`, and any `scene-save-failed` in Live diagnostic. Test brief network failure/reconnect. If missing old objects, inspect SQLite snapshots/backups; this code cannot reconstruct lost items. Read the bundled implementation spec for a step-by-step checklist.

---

# SOLVI.help v0.2.193 — Procedural tools, interactive devices and fridge/laptop

Added Tools category (shovel, axe, rake, stick, broom, mop, saw); keyboard, switchable trackpad/mouse/stylus, printer, laptop and hollow fridge in Equipment. Fridge and laptop support saved open/closed states from click targets or inspector. Laptop shares the existing TV/monitor smart-media engine. Fridge can persistently hold fitting can/bottle/box scene items by real container storage references (up to 48 computed shelf slots), with physics removed while stored and restored when taken out. The container storage whitelist in `robot-inventory.js` is critical. Ownership, scene persistence, undo, browser permissions, backend validators and mobile tap handling reuse current architecture. See `docs/RELEASE_0.2.193_SPEC.md`. No virtual text input, active printing, robot tool-use semantics or hinge motor simulation are provided; live browser behaviour and deployment must be verified. Preserve GLBs and all earlier SOLVI features. Full regression suite 904/904 tests passed in source prior to the final server preset metadata correction; focused v0.2.193 tests and backend syntax passed after that correction. Final archive retest follows. The six backend standalone tests passed.

---

# SOLVI.help v0.2.192 — Wordmark rainbow animation

Only `.help` in the topbar wordmark receives a CSS-only intermittent vertical rainbow (9s show/hide pulse; 6s seamless flow). Original base text remains in place; reduced-motion preference disables animation. The SOLVI portion, version label, startup, backend, Meta/robot logic, and nonblocking Umami loader are unchanged. Source: `index.html`, `styles.css`; regression: `tests/release-192-wordmark-rainbow.test.mjs`. The release ZIP must remain watcher-compatible and preserve both source GLBs.

# SOLVI.help v0.2.182 — Autonomous Robot Operators, Meta 360° perception and service work orders

**Status:** Release candidate for the unchanged `updates/` deployment watcher; **not yet deployed or browser-verified**.

### Operator workflow

Open **Robot routines → Autonomous robot operator · work orders**. Choose an editable robot and work mode, then **Run once** or **Start loop**. Modes: **Meta agent** (select a new scene-grounded action after each outcome); **Deliver** (walk, lift a Pickable object, move and drop); **Build furniture** (chair, bed, sofa, stool, office chair, table or cabinet); **Assist** (visit a colleague and address a question through the existing robot-to-robot reply engine); or **Rest** (walk to and sit on a seat, create a chair first only when authorised, then stand up). Stop individual robots or all robot work orders directly in the panel. Loops require an open, signed-in foreground browser tab; they are not background Ubuntu services.

**Existing-tool integration:** Navigation uses the existing `receiveRobotCommand(go_to)` route and task-update completion, A* avoidance, live movement animation and scene persistence. Carrying uses the I-key pickup/drop implementation, physics and edit permissions. Rest uses J-key seating/standing animations. Construction uses the procedural Basic Furniture mesh generator, clearance check, Rapier static collider, scene save and Undo. Automatic deletion is limited to furniture created by that robot in the current autonomy session, never unrelated objects.

**Meta vision:** With the camera checkbox enabled, each Meta agent decision receives six genuine 512×512 JPEG robot-head renders at 0/60/120/180/240/300 degrees, processed by configured Meta Muse Spark 1.3 via the authenticated server endpoint. Scene inventory/object IDs are provided separately and must not be conflated with visual confirmation. The existing SAM 3.1 robot visual search is available for focused object inspection. Meta chooses only one validated action from `visit`, `deliver`, `build`, `remove`, `rest`, `ask`, `inspect`, `idle`. Model text is never executed as code, and completion is only recorded after real tool results. Limits: at least 180 seconds between agent decisions, 36 decisions per user/day in the server process, a 60-second per-robot speech cooldown, plus an explicit confirmation before billable requests. The Meta service, model capabilities and billable amounts depend on its configured API key.

**Safety / current scope:** Robot and object ownership, active realm and tab session are checked. Physics must be on and the selected object must be Pickable for delivery. Large/obstructed scenes may make safe routes impossible; the task reports failure and a later loop can choose a different action. Robot control is one browser-tab local scheduler; do not assume distributed job-locking between two simultaneously enabled tabs, persistent offline autonomy, general autonomous tool use outside the action allowlist, real sleeping animations for every avatar rig, unrestricted deletion or live VR/browser verification. Physical objects remain ordinary scene entities and saved room data is not intentionally reset.

**Files:** `js/robot-autonomy.js`, `js/robot-autonomy-core.js`, `js/editor.js`, `js/studio.js`, `index.html`, `styles.css`, `backend/server.py`, `backend/test_autonomy.py`, `tests/release-182-autonomous-operators.test.mjs`, legacy regression expectation updates, release/version metadata and handover. **Deployment:** Place only the complete, hash-manifested application ZIP in `updates/`; do not modify the existing watcher, GitHub HTTPS workflow, Ubuntu provisioning, original avatar GLBs or users' saved scenes.

---

# SOLVI.help Master LLM Handover — v0.2.181

## Release 0.2.181 — authoritative multiplayer room presence and diagnostics for everyone

- Fix Brave/Safari inconsistent room counts by resolving the signed-in profile’s saved realm before starting its authenticated WebSocket connection.
- Treat the server room snapshot as join confirmation, refresh authoritative presence every 15 seconds, and reconcile late movement packets when a presence notification was missed.
- Reconnect sockets with bounded backoff rather than permanently stopping after two failures; replace lingering same-user WebSocket sessions safely without removing the active replacement.
- Make per-browser room and application debugging visible to regular users in the existing Dev log via a Live diagnostics tab, including room, participant count, socket/JS errors and robot event summaries, with Copy/Clear and credential filtering.
- Add multi-client and disconnect regression tests and preserve all existing browser/scene, avatar, GitHub HTTPS and watcher deployment contracts.


**Server protocol:** `/ws` authenticates a user and room, sends `{type:"snapshot",room,peers}` as explicit join acknowledgement. While connected, clients can request `{type:"presence-sync"}` to receive an authoritative snapshot excluding themselves. Superseding a previous socket for the same authenticated user does not permit the old socket to evict or mutate the new connection. The number of room participants is the snapshot count + local participant, not merely an open TCP/WebSocket socket. Authentication still enforces the profile’s active tab session; different profiles are independent clients.

**Browser:** In `studio.js`, `configureRooms()` completes before `solvi:authenticated`, so the socket always joins the remembered per-user realm. `LiveRoom` no longer claims shared connection until it receives a snapshot; it retries indefinitely with at most 30-second backoff, refreshes presence every 15 seconds, detects missing joins from movement packets and reports status. `pagehide` / BFCache restoration remain supported.

**Visibility:** Every user can open **Dev log → Live diagnostics**. Local events include join, member counts, socket errors/retries, browser exceptions and short robot trace metadata; records are bounded, locally held, copyable and cleared on demand. Does not require admin access and excludes raw WebSocket frames, credentials, model prompts or responses. Existing release notes and opt-in detailed robot traces remain available.

**Tests:** `tests/release-181-room-presence.test.mjs` covers two browsers, missed joins, presence resync, reconnection, safe diagnostics and remembered realm ordering. The app ZIP is the only artifact for `updates/`; it does not modify the existing GitHub HTTPS recovery watcher.

---

# SOLVI.help Master LLM Handover — v0.2.180

## Release 0.2.180 — top-floor roof ownership and XR Sprite safety

- **Office walls / room arrays:** In `js/office-wall-math.js`, `wallRoofCopyIndices(settings)` selects the highest Y array instance (including direction -1) as sole owner of the roof for vertical arrays. A horizontal (X/Z) room array is a row of separate rooms and retains one roof on each, rather than stripping roofing from adjacent buildings. Existing single-level room roof behaviour stays unchanged. No new persistence schema; previous scenes automatically regenerate with the correction.
- **Geometry:** `js/office-walls.js` tags all roof-only meshes and accessories (flat/pitched/pyramid, chimney, solar and skylight). The array cloner only clones these onto the selected upper level and removes any source roof that would otherwise remain on a lower level. Ceiling/soffit meshes are independent (`wallCeiling`) and remain at each generated storey, including lift openings. Rebuild and presets reuse the same rules.
- **WebXR crash:** `THREE.Raycaster.setFromXRController()` sets the ray but does not populate `Raycaster.camera`. `Sprite.raycast()` requires that camera for billboards (media captions, names, status sprites). `js/world.js` now sets `.camera` to the XR headset camera or main camera before XR intersections. Full-room smart-screen raycasts happen only when selecting, not on every controller-movement frame. `js/editor.js` ignores Sprite label intersections when deciding closest physical smart-screen occluder. XR device rendering avoids `renderer.setSize()` on resize while `renderer.xr.isPresenting`.
- **BFCache:** `main.js` reconnects the `LiveRoom` after persisted Back-Forward Cache page return; `live.js` drops the old socket handle upon closing so a stale CONNECTING/OPEN socket does not prevent reconnection.
- **Validation:** `tests/release-180-roof-xr.test.mjs` adds six tests; full suite, all JS syntax, backend Nginx/realm checks, original avatar hashes and extracted watcher ZIP must all pass. No live headset testing has been carried out. 

**Files:** `js/office-wall-math.js`, `js/office-walls.js`, `js/world.js`, `js/editor.js`, `js/main.js`, `js/live.js`, `index.html`, `tests/release-180-roof-xr.test.mjs`, metadata, docs.

---

# SOLVI.help Master LLM Handover — v0.2.179

## Release 0.2.179: one-row Control Switcher, explicit GitHub diagnostics

- Unify Control Switcher actions into one compact draggable row: scene/robot name, local control icon, camera mode icon and short label, contextual follow-distance slider, and small consistent white floppy Save icon.
- Remove persistent Start entry/last/saved dropdown. Show three compact start-location actions only when Save is opened; keep per-room choice, signed-off saved position, Shift+P, keyboard Escape and accessible labels.
- Use seven user-provided vector UI icons locally with forced consistent monochrome icon treatment; preserve the existing robot portrait strip and camera mode cycling.
- Add precise GitHub push diagnostics and explicit remote/pending/HTTP error classification to the optional installed deployment-watcher patch, without treating HTTPS authentication as successful publication.
- Add focused UI/regression tests, version all browser assets, retain avatar bytes and watcher-safe hashed release ZIP.

**UI contract:** `#controlSwitcher` retains draggable ownership of robot portraits and a single `.control-switcher-action-row`. The row includes scene/robot control, camera mode, contextual distance slider, Save floppy and portrait size actions. `#cameraStartMode` does not exist. `#cameraStartChoices` appears only on Save; Entry and Last set the preference for the *next* visit; Here confirms and saves pose to the same per-room localStorage keys (`solvi-camera-*`), not the scene. All SVG icons are local and forced to the same readable foreground, including the floppy. Orbit/Chase/Smart/Free cycling remains V and camera start menu is Shift+P. No changes to scene saving or robot ownership.

**Deployment watcher:** separate optional installer updates an existing `SOLVI_GITHUB_TRANSIENT_PUSH_V3` watcher to retain verbose GitHub 5xx diagnostics (request ID, UTC, remote, branch and SHA, return code). Confirmed GitHub-only `--sync-github` is distinct from Ubuntu deployment. Do not put installer packages into the application `updates/` watcher directory. Application ZIP alone does not rewrite the locally configured watcher.

**Sources:** `index.html`, `js/world.js`, `js/editor.js`, `styles.css`, `assets/ui-icons/switch-*.svg`, `tests/release-179-control-switcher.test.mjs`, version metadata. Original avatar GLBs unchanged.

---

# SOLVI.help Master LLM Handover — v0.2.176

## v0.2.176 — Compact, consistent infrastructure Properties and real material finishes

- The infrastructure drawing workflow lives solely in the standard draggable **Properties** inspector. Its drawing controls render **one horizontal row** with an accent-coloured **Save wall / Save road / Save fence / Save hedge / Save path** action, **Undo**, and **Cancel**; the action labels remain readable at compact and mobile widths.
- **Save** is the explicit commit point: drafts remain temporary 3D scene previews, are not persisted/transmitted until Save (or Enter), and Cancel restores the previously saved object or discards a new draft. Esc is also available. Single-line / multiline / freehand are preserved.
- The previous 54 px furniture-grid selector forced status into vertical one-word columns. `.infra-inspector-status` and `.infra-inspector-actions` no longer have the `furniture-field-full` class; new high-specificity rules span all grid columns. Status is now a compact single-line `N points · Live construction` caption, not multi-line instructions. Drawing mode is likewise full-width with an accessible label.
- **Texture / variation seed** is no longer exposed in Properties. It remains an internal, stable seed for asphalt grain and saved legacy infrastructure. The **Material finish** selector for walls/fences now uses SOLVI's existing `wallPresetTexture()` generator for Wood, Concrete, Bricks, Metal, Plaster, Marble and Granite, with metal roughness/metalness settings. Road/footpath surface types remain separate (Asphalt, Concrete, Gravel, Pavers, Earth). No external asset dependency.
- New `infraTexture` key is cleaned by `cleanInfrastructure()`, persists via `sanitiseFurniture()` and scene presets, and is accepted by backend `valid_basic_furniture()` with a default of `none` for legacy scene payloads.
- Updated regression coverage for compact controls, named texture options, sanitizer defaults and source-level checks; preserve full syntax/test, complete hashed manifest, unchanged bundled avatar GLBs. Live DOM/WebGL tests still need browser verification.

**Files**: `js/editor.js`, `js/infrastructure-drawing.js`, `js/procedural-infrastructure.js`, `styles.css`, `backend/server.py`, `tests/release-173-infrastructure.test.mjs`, `tests/release-176-infrastructure-inspector-ux.test.mjs`, frontend/backend version metadata.

---

# SOLVI.help Master LLM Handover — v0.2.175

## Release v0.2.175 — LIVE 3D INFRASTRUCTURE CONSTRUCTION PREVIEW

**Requested UX correction:** The prior outdoor drawing tool displayed only a thin outline floating on the ground while users attempted to construct a wall or fence. From now on a path of two or more committed vertices builds the actual THREE.js geometry with the same generator used by saved furniture. The preview is displayed in world space and replaces the detached line-only guide. The existing draggable Properties inspector controls dimensions, materials, lane layout, fence and hedge type while constructing. Any change to the selected object regenerates the preview, including user input and the shared slider. The preview never attaches itself to the pointer, and UI clicks are never interpreted as placing points. One-line mode permits inspection and adjustment before Finish rather than immediately saving at the second point. Freehand rebuilds are throttled (~70 ms), and every old renderable/texture is disposed to avoid leaks. Temporary render groups are not collider objects, saved scene objects or multiplayer objects. Finishing a path persists it with normal Undo and static collider setup. Cancel discards a new draft or restores all pre-redraw settings to the original object. Existing presets and infrastructures remain compatible.

**Files:** `js/infrastructure-drawing.js`, `js/editor.js`, new `tests/release-175-live-construction-preview.test.mjs`, synchronized frontend/backend/release metadata. No new runtime dependencies. Continue using the original watcher with ZIP containing root `manifest.json` and all application files under `app/` with full SHA-256 map.

**Testing:** Full JavaScript suite and independent extracted ZIP verification; check backend Python syntax, Nginx, shell install, and GLB identity. No browser-based 3D/WebXR performance test is available in the container.

---

# SOLVI.help Master LLM Handover — v0.2.174

## Release v0.2.174 — No-popup drawing & connected roads

**Changes:** All outdoor line drawing (wall, plank/rod/mesh fence, hedge, curb, footpath, road/motorway) now starts in the standard draggable Properties window. Modes: single line, multiline/polyline, freehand. The Properties window shows type settings and Undo / Finish / Cancel buttons, using one existing inspector instead of an independent popup. Only committed vertices appear in the guide line; pointer movement over the canvas and controls never stretches a phantom segment. Newly drawn structures remain invisible, unsaved drafts until two or more valid points are committed; cancel discards them. Roads use a continuous indexed 3D ribbon with corner miters and optional sampled cubic smoothing; top/side faces are connected, and road/curb/sidewalk pieces use trimesh colliders. Existing paint, directional arrows, hedges, light fixtures and save/undo behaviour are preserved. Lanes are integers 1 through 6 (including the shared range slider).

**Affected code:** `js/procedural-infrastructure.js` (connected ribbon), `js/infrastructure-drawing.js` (native inspector-only draw flow), `js/editor.js` (UI, integer control, draft lifecycle), `styles.css`, `tests/release-173-infrastructure.test.mjs`. Backend schema remains compatible.

**Deployment discipline:** Root `manifest.json`, one SHA-256 entry for every `app/` file, synchronized versions in package/release/frontend/health/installer/tests, no caches/node_modules. Keep bundled avatar GLBs byte-identical. Full browser/WebXR graphics tests require deployed runtime.

---

# SOLVI.help Master LLM Handover — v0.2.173

## Release v0.2.173 — Outdoor infrastructure drawing, road design and landscaping

**Shipped:** Line, polyline and freehand drawing for roads, motorways, pavements / footpaths, curbs, solid walls, plank / wire-mesh / metal-rod fences and planted hedges. A compact draw panel controls type, mode, path smoothing, closing, undo and commit. Objects persist as one scene furniture entity compatible with account presets, existing multiplayer room saves, edit permissions and Undo. Inspector controls include road width, lane count (1–6), one-way vs two-way, line colour/width/dash spacing, asphalt/gravel/concrete/pavers/earth finishes, optional side curbs, side pavements, streetlights and spacing/height; fence structure, post spacing, plank spacing and material; hedge density and foliage colour. `infraPoints` are deterministic bounded local paths (2–80 points). A redraw edits the selected entity in its existing transform. WebXR optimisations use InstancedMesh batching for repeated noncollidable pieces and at most three live point lights per infrastructure object. Physical walls, road slabs, curbs, footpaths, fence rails and hedge cores use static Rapier box colliders.

**Sources:** `js/procedural-infrastructure.js` (schemas, line geometry, materials, renderer), `js/infrastructure-drawing.js` (draw UI and actions), `js/primitive-properties.js` (furniture integration), `js/editor.js` (tool menus, pointer events, inspector), `backend/server.py` (payload validation), `tests/release-173-infrastructure.test.mjs` (render structure, bounds, save wiring and backend schema validation).

**Validation:** Full JS regression suite, isolated Python validation of a sanitized infrastructure payload, Nginx/realm archive tests and all syntax checks. Run `npm test` against the final extracted archive. Archive must contain root `manifest.json` and *only* `app/<relative-path>` files, every one SHA-256 checked; no Python caches, symlinks or `node_modules`. Original bundled GLBs must stay byte-identical. Full visual inspection in WebGL and WebXR devices remains unverified.

---


## Release v0.2.168 — Stable inspector / pointed reactive grass / walkable terrain hills

- **Inspector slider:** A single contextual numeric range is now rendered as a fixed-position anchored popover below its active field row. It is moved to `document.body`, updated during editor scroll and window resize, and hidden by Escape or outside click. **Other controls no longer move when selecting a slider.** The existing three-column responsive layout remains intact.
- **Pointed grass:** The former square-ended blades are now seven-vertex/five-triangle tapered shapes terminating in a single point. They retain one instanced mesh per Nature patch; GPU wind continues in the shader.
- **Robot-reactive grass:** The render frame calls `updateGrassRobotInfluence(robots,dt)` after robot movement; up to four nearest-by-movement robot influences are uploaded to the grass vertex shader. Blades within about 1.55 m bend away in proportion to movement, with no CPU mesh mutation. Teleport jumps and initial states are ignored.
- **Terrain hills:** Nature ground/crop/vegetation-area surfaces use adaptive, bounded interior triangulation plus smooth multi-frequency seeded relief. Existing vegetation arrays now lift instanced shrubs, trunks and foliage onto their generated terrain elevations. Their inspector exposes terrain relief and hill irregularity. Static Rapier trimeshes are active by default for new patches, and older saved patches with physics off are upgraded in-memory to provide walkable surfaces for robots and XR teleport rays.
- **Known limitation:** The room's global base floor still remains at Y=0. Existing lake patches can show water surfaces and concave basin meshes, but literal below-global-floor swimming is not solved by this release; requires a future floor-cutout/heightfield and separate buoyancy model.
- **Regression tests:** 764/764 JavaScript tests pass as of release build. v0.2.168 regression file: `tests/release-168-grass-terrain-inspector.test.mjs`. Backend Nginx, realm archive, installer shell and Python source syntax checks pass. Full live WebGL/WebXR visual and device tests remain unverified.
- **Release packaging:** Preserve all avatar GLBs. Root `manifest.json` must have version `0.2.168` and one `sha256` hash entry for **every** `app/<path>` member. Archive must contain *exactly* `manifest.json` plus `app/*`, no directories or caches. `package.json`, `releases.json.currentVersion`, latest releases entry, frontend asset cache versions, health API version, Ubuntu installer expected version, and version-specific tests must all agree. Watcher validation must be passed before placing in `updates/`.

---

## Previous master handover and deployment correction (v0.2.167)

# SOLVI.help v0.2.167 — Terrain Relief, Lake Patches & Deployment Correction

**Build status:** Watcher-compatible manifest, version metadata and SHA-256 checks verified locally. Full npm and backend integration tests remain unverified in this environment due to unavailable npm/Python dependencies; the watcher runs these tests before deploying.

## Correction to the first failed v0.2.167 packages

- Initial package: manifest file list did not match ZIP entries. This was a packaging error.
- Second package: `releases.json.currentVersion` remained at `0.2.166`, causing an early watcher validation failure.
- Corrected archive: root manifest `0.2.167`, package `0.2.167`, `releases.json.currentVersion` and first release entry `0.2.167`, frontend cache version, API health version, Ubuntu installer version and historical test expectations agree.
- Each application file has an exact SHA-256 entry in the root manifest; generated bytecode and caches are excluded.

## Terrain and lake implementation

- `waterPatch` joins Nature objects and presets and supports polygon drawing or square/circle/oval shape controls.
- Freehand ground polygons auto-close; existing polygons keep stable scene identifiers and settings.
- Raised ground/crop plots use subdivided, seeded terrain meshes. Procedural grass and crop positions use their elevation.
- Lake patches have sculpted, downward-sloping geometry, editable water depth/level/bank irregularity and a semi-transparent water surface.
- Static terrain colliders use Rapier triangle meshes for valid patch topography, rather than a single bounding box. Default global flat-floor collision may still limit true below-zero underwater movement; verify in live runtime.
- Backend validation and Nature preset categorization include the new fields and variants.

## Files changed in the retry

`app/releases.json`, `app/index.html`, `app/package.json`, `app/backend/server.py`, `app/backend/install-ubuntu.sh`, `app/js/procedural-vegetation.js`, `app/js/scene-physics.js`, `app/js/editor.js`, `app/js/vegetation-drawing.js`, `app/js/primitive-properties.js`, `app/js/object-preset-data.js`, versioned tests, documentation, and release manifest.

## Prior master handover

# SOLVI.help v0.2.166 — Vegetation arrays, orchards and brushwood

Add seeded Nature arrays as a single persistent Vegetation Area object with orchard rows, mixed forests, clustered thickets, and brushwood patches; keep the entire patch under one multiplayer object ID.

Add individually editable Shrub / Brushwood objects with adjustable height, spread, branch count, foliage clusters and shape, all compatible with the existing Nature preset gallery.

Draw orchard/forest/brushwood planting areas on the ground with the existing polygon closure, smoothing and redraw tools; expose density, spacing, species, scatter seed, cluster strength and scale variation in compact Properties.

Use bounded shared InstancedMesh batches for trunks, crowns, conifers, palms, shrubs and undergrowth rather than creating a separate mesh per plant; retain deterministic restoration and prior v0.2.165 Nature scenes.

Extend backend validation and add multi-mode deterministic scattering, geometry-budget and editor integration regression tests.

## Implementation notes

- Nature > Shrub: individual low-growing shrub. Configure shrub height, radius, foliage/branch count, colour, seed and shape. Save as Nature preset.
- Nature > Vegetation Area: polygon-generated area. Set mode Orchard/Forest/Thicket/Brushwood, plant count, spacing, row jitter, clustering, size variation, tree species and soil/grass settings.
- Nature > Draw forest / orchard area or Draw brushwood area: click surface points and close/save; existing redraw and boundary smoothing work.
- Orchard rows use a seeded grid; forest/thicket/brushwood use polygon-contained, separated seeded scattering with optional clustered concentrations. All regenerate deterministically after load or multiplayer synchronisation.
- The entire area has one saved object ID. Instanced geometry batches keep draw calls bounded; instances do not each create a Rapier collider.
- Bounds: max 160 plants per vegetation area; at most 22 foliage clusters per shrub in an area; polygon at most 80 valid coordinates and area draw bounds unchanged.
- Current scope is procedural appearance and placement, not growth/harvesting/plant simulation. Live browser/WebXR behaviour remains unverified.

## Earlier handover

# SOLVI.help — Master LLM Handover v0.2.165

## v0.2.165 — Grass rendering, blossoms, palm trees and procedural bark

**Baseline:** complete v0.2.164 application release. **Deployment:** the complete `SOLVI_RELEASE_v0.2.165_GRASS_WIND_BLOSSOM_PALM.zip` is intended for the unchanged `updates/` watcher. No watcher changes, media server changes, or external packages introduced.

**Implemented changes:**

- **Tree style controls:** Existing broadleaf, conifer and orchard remain. Added **Blossom** and **Palm / coconut** styles, fruit selector **Coconuts**, adjustable Blossom colour, Blossom density and Palm fronds. New natural leaf size defaults use three-times more smaller instanced foliage clusters (bounded at 180); seed values keep object appearances deterministic across clients and scene reloads.
- **Tree structure and trunk material:** Segmented tapered trunks receive bounded sinusoidal irregularity (`trunkWobble`), and the existing procedural **Wood** texture is selectable as **Trunk texture**; new trees default to Wood while explicitly saved older texture choices are retained. The existing vegetation branches can still participate in physics, while leaf/floral instances have no colliders. Palm leaves are lightweight, curved, double-sided leaflets batched into one BufferGeometry draw call; optional coconuts use one instanced mesh.
- **Blossoms:** seeded instanced pink/pastel blossom clusters with editable tint and density, rather than forcing bright fruit. Existing tree colour and fruit types retain their semantics.
- **Soil/grass plot:** Removed the previous per-cell checkerboard output and dark color jitter. Ground ShaderMaterial now uses continuous multiscale interpolation of hash-based value noise, with tone mapping and colour-space conversion for more natural ground cover blending. Sand/clay/compost/loam soil presets and drawn polygon vertices are retained. Existing crop beds automatically benefit from the ground shader improvements.
- **Blade grass:** Instead of static low-poly cones, one THREE.InstancedMesh per plot draws up to 2,200 narrow three-segment PlaneGeometry blades (zero physical colliders). The Three.js MeshStandardMaterial's vertex shader is amended with time-driven sway using instanced positions. Wind strength, wind speed, grass width, density and height are editable. Per-frame work updates one small uniform; no CPU per-blade animation, geometry shader or tessellation stage is used. Grass in soil-only mode remains omitted. Each plot has a bounded instance limit and an input-dependent deterministic position seed.
- **Numeric preview:** Basic Furniture's delegated numeric `input` event schedules a short bounded preview rebuild before blur/Enter, preserving the original snapshot for Undo when `change` commits the edit. Non-numeric settings continue using normal `change` handlers; the existing Save/scene replication path remains unchanged.

**Integration points:** `js/procedural-vegetation.js`, `js/primitive-properties.js`, `js/editor.js`, `backend/server.py`, versioned HTML import map, `releases.json`, deployment installer expected version, and new focused Node regression tests. The server accepts new bounded settings (`leafSize`, `trunkWobble`, `blossomDensity`, `palmFronds`, `grassWidth`, `windStrength`, `windSpeed`, `blossomColor`), plus `treeStyle=blossom|palm` and `fruitType=coconut`; invalid values remain rejected. Previous scene objects and account-scoped presets require no migration.

**Performance and compatibility:** Geometry budgets are explicit for network/VR safety; native Three.js/WebGL primitives are used rather than copying Unity's geometry or tessellation shader pipeline. The two user-provided Grass Shader tutorials were used as design references for gradient/noise, random blade orientation, wind modulation and distance/complexity concerns; no tutorial code or third-party shader engine was bundled. Multi-plot high-density rendering can still cause performance issues on constrained XR devices and will need performance profiling.

**Validation:** 753/753 JavaScript tests, including 5 new regression checks for the rendering path, plus Python syntax, Nginx tests, realm archive tests and installer shell syntax. Exact release manifest hashes, original avatar GLB preservation and independently re-extracted tests are recorded in package verification. **Live WebGL/WebXR rendering, GPU shader compilation, wind visual quality and VR FPS remain unverified** until deployed.

---

## Previous handover (v0.2.164 and earlier)

# SOLVI.help — Master LLM Handover v0.2.164

## This release: low-cost organic environment

**Baseline:** v0.2.163, with all historical functionality retained. **Deployment:** place `SOLVI_RELEASE_v0.2.164_NATURE_TREES_SOIL_CULTIVATION.zip` in `updates/` for the unchanged watcher. This is a complete application ZIP, not a partial patch.

**What shipped:**

- `Add → Nature & cultivation → Tree` adds a single procedural tree, placed at the camera-centred ground point. Supported tree styles: deciduous, conifer and orchard. Adjustable height, trunk radius, canopy radius, branch count, instanced foliage clusters, colour, fruit type (none/apple/orange/plum) and seeded reproducibility.
- `Ground plot` and `Crop bed` procedural objects: editable soil/grass material using a simple GPU shader for soil grain and patchy grass blending. The grass and crops are instanced low-poly meshes with no active Rapier collisions. Each crop bed supports carrot, tomato, lettuce and strawberry *visual forms*, row count, spacing and manually adjustable growth percentage.
- `Draw grass / soil plot` or `Draw vegetable bed` in the same Add menu activates an interactive canvas-ground drawing tool. Click polygon corners; Enter, Save or click near start closes the outline, with optional smoothing. Escape cancels. The saved local X/Z polygon is bounded (3–80 vertices, ±80 m), persisted and synchronized as furniture configuration.
- `Save as preset` retains all tree/plot/crop configurations and adds a `Nature` filter to the saved Presets gallery. Existing per-account preset endpoints and scene object IDs are reused, so no new database table is required.

**Technical implementation:**

- New `js/procedural-vegetation.js` contains sanitizers, seeded low-poly tree branch/foliage mesh generation, plot polygon validation/optional smoothing, a minimal soil/grass shader and instanced vegetation. Default trees use modest geometry; configured caps: 28 branches, 60 foliage clusters, 450 grass instances and 180 plants per plot. Branch segments are collision-capable; soft vegetation is not.
- New `js/vegetation-drawing.js` handles temporary 3D line previews, ray intersections with the ground, auto-closure and independent insertion. It shares existing spatial drawing input interception but does not modify saved scene until Commit.
- Updated `js/primitive-properties.js`, `js/editor.js`, `js/object-preset-data.js`, `js/object-presets.js`, `backend/server.py`, `index.html` and the browser import map. Backend furniture payload size allowance is 120 named fields because existing schema normalization now contains new bounded vegetation fields. Unknown keys and invalid nested polygon values remain rejected.
- The user-supplied ez-tree source is MIT licensed; SOLVI's generator was written separately, with no ez-tree runtime or lil-gui bundled.

**Verification:** 748/748 Node tests; targeted backend validation; static JavaScript/Python and installer syntax. Archive checksum manifest and unchanged original bundled avatar models are required before deployment. Real WebGL compile, plot drawing in a live browser, VR frame rate, room sync, and growth visuals remain unverified until deployed.

**Deliberately not implemented:** autonomous plant growth over time, watering/nutrients/harvest mechanics, true terrain height displacement, imported floorplan AI, biome-scale forest scatter or an extensive ez-tree GUI. Those should be separate future work to maintain WebXR performance.

---

## Previous handover (v0.2.163 and earlier)

# SOLVI.help — Master LLM Handover v0.2.163

## Current release

**v0.2.163 — Seat-exit clearance, compact playable audio recording labels, ergonomic office-chair upgrades, correctly centred Delete icons, and improved Save Chat Portrait exposure.** This release supersedes v0.2.162 and is a complete watcher-compatible application ZIP. Deploy the new release by placing the ZIP in the existing `updates/` folder. No watcher replacement is required. No live server deployment has been performed by this assistant.

### Changes implemented

1. **Stand outside seat geometry (J):** `js/robot-seating.js` adds `standClearancePosition(robot,target,margin)` and calls it in `standUp`. When an avatar stands from a chair, sofa, bed, or supported seat, the algorithm traces the avatar's facing direction through the object's transformed local geometry bounds, with an extra capsule clearance. It preserves world Y and the yaw established during sitting. The avatar's Rapier body is updated via `editor.physics.applyEditedPose` before the next simulation step, and the new transform is saved. If the seat was deleted or is unavailable, standing still works without moving the avatar. Real-world obstacle avoidance outside the original seat is not implemented; future refinement may choose another clear direction if the forward exit is blocked by a wall or another object.
2. **Audio media labels and direct playback:** `js/scene-media.js` replaces two huge rectangular name/date sprites with one compact, sRGB-rendered canvas-based audio label. It displays the recording author and a compact local date/time, plus a PLAY/PAUSE affordance that tracks the media element's actual playing state. The label is raycastable via `mediaPlaybackLabel`, and `js/editor.js` routes desktop and WebXR pointer selections to the same `toggleSceneMediaPlayback` path. It remains a transient visual, not part of the room's persisted media schema. Source audio uses existing positional sound and permission rules.
3. **Office-chair geometry:** `js/primitive-properties.js` extends Office chair with optional `ergonomicBack` (real open lumbar section made of frame rails), `armrests` (paired support and pads), and a five-spoke/pedestal office base with individual spherical casters. Four-leg mode is preserved. The two options are present in the Basic Furniture inspector (`js/editor.js`) and persisted through existing procedural scene/preset pathways. `backend/server.py` accepts only boolean values for the new keys and still rejects unrecognised settings. Older Office chair records receive sensible defaults, without modifying their object identities.
4. **Delete icon centring:** `styles.css` gives preset Delete controls exactly one icon. The general auto-icon pseudo-element is suppressed for buttons that already contain an inline trash-can SVG, which is centred with absolute 50% positioning and translation. Keyboard/accessible names are preserved.
5. **Save Chat Portrait exposure:** `captureRobotPortrait` in `js/robots.js` now renders to an sRGB offscreen colour target and uses temporary neutral key/fill lighting, so avatars whose current world lighting is dark still generate a clear profile portrait. Temporary lights and renderer state are removed/restored in `finally`; the existing robot eye-view capture remains unchanged. Saved portrait still uses the ordinary authenticated media upload and room save.

### Validation performed

- **741/741 JavaScript tests passed** (734 prior tests plus seven new v0.2.163 tests).
- Regression coverage includes safe stand position and physics update, deleted-seat fallback, one readable label + desktop/XR click handling, optional ergonomic chair controls and casters, validated backend options, sRGB portrait illumination, and true single-centred Delete SVG.
- Historical mock geometry tests were updated to provide sphere geometry and mesh rotation required by the new chair caster geometry; functional assertions were not weakened.
- Python AST syntax checks, `backend/test_nginx.py`, `backend/test_realm_archives.py`, and `bash -n backend/install-ubuntu.sh` passed.
- Manifest SHA-256 verified for all packaged application files. All previous bundled GLBs are preserved byte-for-byte. The ZIP contains no generated Python `.pyc`, `__pycache__`, or `node_modules` files.
- Independent extraction of ZIP and full test rerun: recorded in release verification below.

### Live checks after watcher deployment

- Sit on a rotated sofa/office chair and press J again: avatar must stand beyond the furniture footprint without changing its new heading or snapping back when Rapier advances.
- Add an audio recording orb or imported speaker model, inspect the compact name/date + Play label; click the speaker or label to Play and Pause on desktop, then test with WebXR rays.
- Configure Office chair with and without Open ergonomic back, Armrests and Headrest; switch pedestal/four legs, inspect five individual caster spheres, then save and restore as a preset.
- Inspect the Presets overlay and confirm its single trash glyph remains centred in both normal and icon-only button modes.
- Capture Save Chat Portrait in the same room as before and compare headshot brightness. Actual display and WebGL colour management remain browser-dependent.

**Known limits:** Real browser rendering/illumination, physical clearance around nearby obstacles, WebXR ray interaction, remote sound source URLs and multi-client state still require testing on deployed SOLVI. The seat exit algorithm clears the chosen seat footprint; it is not a general navigation planner. No external CORS or Rantlist configuration was changed in this release.

---

## Historical v0.2.162 handover (preserved)

# SOLVI.help — Master LLM Handover v0.2.162

## Current release

**v0.2.162 — Robot locomotion continuity, brighter robot eye-camera captures, procedural office chair and translucent bottle liquid.** This release supersedes v0.2.161 and is packaged as a complete watcher-compatible application ZIP. Place the ZIP in `updates/` and let the existing watcher verify/build/test/deploy. No watcher modifications are required.

### Changes implemented in v0.2.162

1. **Pickup → locomotion:** `animateRobots` in `js/robots.js` now gives genuine local/remote movement precedence over the Pick Up/Lifting and held poses. The `ObjectCarry` state machine continues its timing and hand attachment independently, avoiding a sliding avatar while carrying a box. Jumping, falling, ladder and sitting remain protected animation states. Paused animation actions are recovered into the requested gait when genuine movement exists. `MotionController.play` in `js/animations.js` restarts an unexpectedly paused looping gait instead of silently returning.
2. **Robot eye-camera:** `captureRobotView` now requests an sRGB WebGL render target before reading GPU pixels for JPEG capture; previously the default target could yield dark linear pixel readback. Its offscreen camera still uses the scene's ordinary lighting and exposure. Not an artificial brightness filter; genuinely dark rooms remain dark. Live hardware/browser check required.
3. **Office chair:** Added `officeChair` to Basic Furniture, server validation, seating choices and preset storage. It is an editable procedural mesh with seat cushion, backrest and optional headrest. The existing Base/legs selector offers pedestal, four legs, caster wheels or no base; the default is one pedestal.
4. **Bottle liquid:** New numeric `fluidOpacity` parameter (default 0.52, 0–1) independent of bottle shell opacity; simulation retains adjustable fill level 0–100%, colour and optional cork/cap, and adds a slim meniscus surface at the fluid top. Existing saved bottle configurations default safely.
5. **SVG controls:** The user-supplied Delete SVG is bundled under `assets/ui-icons/delete.svg`. Focused CSS rules keep Play/Pause/Stop/Record/Delete SVG glyphs horizontally and vertically centred within SOLVI buttons, respecting the existing icon system.

### Validation performed

- **734/734 JavaScript tests passed** (727 historical + 7 new release tests).
- `backend/test_nginx.py` and `backend/test_realm_archives.py` passed.
- Python syntax compilation and installer Bash syntax passed.
- Backend furniture schema acceptance is exercised in a focused Python AST validator test.
- Complete ZIP manifest SHA-256 verified for every included application file; original GLBs match v0.2.161 byte-for-byte; no `__pycache__` or `.pyc` included.
- `backend/test_api.py` could not complete in this isolated environment because Flask is not installed; watcher will run backend smoke tests where dependencies are installed.
- Browser bundle-map script was unable to run without generated `vendor/three` dependencies in this isolated environment; the watcher normally generates vendor assets during its build step.
- **No live browser, WebXR, or cross-client animation verification was performed.** The camera colour-space correction and skeleton animation recovery require testing in the deployed WebGL runtime.

### Live acceptance checks

- Pick up a box, immediately walk/run; the gait becomes Walk/Run while the box stays attached, and I/O continue to drop/throw reliably.
- Test normal walking after a long action and after Jump; verify there are no persistent frozen-frame skating poses.
- Capture robot eye frames in a room that appears normally lit and compare their brightness/colour with the scene. Do not expect ambient light where none exists.
- Add an Office chair from Basic Furniture, switch between pedestal and four-leg bases, toggle headrest, save as a preset, reload and sit on it.
- Add a bottle, set shell opacity and fluid opacity independently, change fill level, remove cap; verify transparent liquid in the rendered 3D scene and stable save/load.
- Inspect icon-only Delete and media control buttons for centred SVG artwork.

---

## Historical v0.2.161 handover (preserved)

# SOLVI.help — Master LLM Handover v0.2.161

**Release:** v0.2.161 — Consistent inventory and preset galleries, bottle fill, backpack shortcut.

## Changes implemented

- **Robot inventory (B):** The existing inventory is now a SOLVI draggable tool window using the global drag/position persistence logic, compact location tabs, the active robot’s saved portrait (when available), and thumbnail cards for stored objects. The robot and stored item IDs, scene-backed pocket/worn/bag state, and existing actions remain unchanged. A letter fallback appears when no portrait exists. Image thumbnails use the existing shared offscreen 3D preview system where the mesh is available; otherwise a category initial appears.
- **Shift+I backpack action:** In robot-control mode, Shift+I collects a faced, nearby eligible backpack, drops a currently held backpack, or takes off the worn back-slot backpack onto the ground. The bag’s contents remain referenced to that backpack ID. Normal I pickup/drop/throw controls are preserved. The dynamically generated shortcut overlay includes Shift+I.
- **Preset tiles:** Image region is one accessible click/Enter/Space Add action (the gallery closes on success), without being a generic button decorated by the app’s auto-icon `+` rule. Label and category sit over a lower gradient on the image. Delete is the existing isolated top-right SVG icon. The black empty thumbnail/upper-right crop issue is addressed by using the *shared independent* WebGL thumbnail renderer, not the live world WebGL framebuffer and GPU readback. Perspective orientation and orthographic camera framing come from actual projected 3D bounds with 14% safe margin. Gallery previews regenerate on demand from saved furniture, office stairs, and primitive geometry instead of trusting an older saved crop. Original saved preset data remains unchanged.
- **Procedural bottles:** New `bottleOpacity` in [0,1], `fluidLevel` in [0,100], and `fluidColor` hex. A separate liquid cylinder sits inside the real lathed hollow bottle, with cap/cork optional. The settings appear in the compact furniture inspector and persist through the existing furniture/preset/scene path. Backend validation accepts these known fields and rejects invalid values. Existing bottles load with sensible defaults.
- **UI consistency:** Inventory adopts SOLVI panel colors, border, controls, draggable header, photo and compact item cards. Preset thumbnails fill the card with a consistently sized image, name/meta overlay, and no outside Add/Delete rows.

## Files changed

`js/object-presets.js`, `js/robot-inventory.js`, `js/primitive-properties.js`, `js/editor.js`, `js/robot-shortcut-help.js`, `js/studio.js`, `styles.css`, `index.html`, `backend/server.py`, version files and `tests/release-161-inventory-presets-bottles.test.mjs`.

## Validation and limits

- `npm test`: **727/727 passing**, including six new tests and legacy expectation updates for intentional viewer/drag changes.
- Python AST, Nginx configuration regression test, installer bash syntax and versioned import map passed.
- Complete ZIP manifest and all SHA-256 hashes verified. No `__pycache__`, `.pyc` or compiled generated files. Original bundled GLB avatars match v0.2.160 byte-for-byte.
- **Not browser verified:** image framing / GPU context limits, actual draggable window interaction, WebXR rendering and physical backpack handling. The watcher must run its full deployment tests; a successful package build is not evidence of a live deployment.

## Deployment

Drop the v0.2.161 ZIP into the existing `updates/` directory. No watcher changes are needed. Test Presets appearance, bottle opacity/fill and Shift+I on the deployed site. The next major planned milestone is the 2D/AI layout planner.

---

# SOLVI.help — Master LLM Handover v0.2.160

**Release:** v0.2.160 — Smart TV channel menu synchronisation and image-first procedural Presets gallery.

## User-visible changes

- **In-world TV/monitor channel menus:** One saved `channels` array is used by the inspector, in-world canvas menu, initial channel configuration and playback. After a channel is added, removed, or loaded through scene/preset/remote changes, `syncEquipmentMedia()` synchronises the display on every update. `syncSmartScreen()` now redraws the menu texture on the same screen mesh when channels/options change, keeping the playing source and its positional audio if the same URL still exists. Removing a playing channel returns to the menu. If an external material change replaces the screen map, the menu is reattached.
- **Presets gallery:** One large image-first tile per preset; clicking the thumbnail creates a new scene instance and immediately closes Presets. No large Add button, no permanent plus icon, and no separate Delete row. A compact SVG trash button overlays the top-right corner of the image. The searchable categories, existing preset storage, object identities and scene-centred placement remain unchanged.
- **Better thumbnails:** The transient offscreen renderer uses actual projected bounding-box corners to compute the orthographic frustum, centres the object for unusual geometry, and fits with approximately 10% safe margin. It uses brighter fixed studio lights on a neutral background, a 384 × 256 thumbnail, and restores the scene's renderer target, viewport, scissor and XR state. Saved procedural furniture previews are regenerated locally from saved object settings, including previously poorly framed images. If WebGL capture fails, an existing saved thumbnail can still be shown.

## Technical implementation
- `js/smart-media-playlist.js`: `syncSmartScreen()` compares sanitised config and updates an existing canvas menu texture in place rather than always destroying the HLS/video/audio graph. `smartScreenChannelCount()` exposes the current in-world channel count for diagnostic tests. Existing per-channel click targeting, WebXR ray routing and Rantlist CORS requirements are unchanged.
- `js/equipment-media.js`: `syncEquipmentMedia()` invokes live menu sync before checking its existing change cache; it continues supporting uploaded-media sources when no smart channel list is available.
- `js/editor.js`: dispose active equipment media before rebuilding procedural furniture geometry from inspector input, so old screen/audio handles do not outlive their mesh.
- `js/object-presets.js`: `presetProjectedFrustum()` implements camera-space corner fitting; `capturePresetThumbnail()` handles isolated offscreen capture. Gallery card template now consists of clickable picture, compact caption, and absolute-positioned Delete icon.
- `styles.css`: image-forward gallery cards; responsive gallery grid, overlay Delete, thumbnail hover/focus styling.
- New regression tests in `tests/release-160-display-presets.test.mjs`. Two legacy thumbnail tests now verify the projected-bounds algorithm instead of the superseded radius calculation. Metadata consistently identifies v0.2.160, including backend and browser import cache.

## Validation
- **721/721 JavaScript tests passed** with `npm test` in the extracted release worktree.
- Node syntax, Python backend AST, `backend/test_nginx.py`, and `bash -n backend/install-ubuntu.sh` passed.
- Release contains SHA-256 manifest verifying all 384 application files. No generated Python caches or compiled bytecode in the release; original GLBs match v0.2.159 byte-for-byte.
- **Not verified:** live browser WebGL thumbnail images, 3D on-screen menu click, Rantlist HLS playback or cross-client scene rendering. These must be tested after watcher deployment. Do not interpret source checks as live rendering proof.

## Deployment
Place only the release ZIP in the existing `updates/` directory. The existing watcher will verify, test and deploy through GitHub/Ubuntu. No Rantlist/Nginx modification or watcher replacement needed for this update.

---

# SOLVI.help — Master LLM Handover v0.2.159

**Release:** v0.2.159 — spatial 3D audio for TVs, monitors and smart video frames.

## Implementation (2 November 2026)
- **Root cause:** the smart-screen HLS player previously rendered video as a Three.js VideoTexture but did not connect the HTMLVideoElement to a positional sound source. Audio therefore had no distance attenuation or stereo direction relative to the world camera.
- `js/smart-media-playlist.js` now creates exactly one `THREE.PositionalAudio` for the same video element per playing channel. It attaches to the display mesh, so any movement/rotation of the object moves the sound origin. It uses the existing `world.audioListener` attached to the user camera.
- The WebAudio panner uses HRTF positional stereo, inverse distance attenuation, reference distance **2.5 m**, maximum distance **35 m**, rolloff **1**, and a front-facing cone (240° inner/330° outer, 35% rear volume). These are audio defaults, not UI numeric input restrictions.
- `js/equipment-media.js` passes the world listener into procedural TV/monitor screens; `js/scene-media.js` passes it into smart media frames. Original uploaded-media and speaker audio paths remain intact.
- The display's mute icon updates both `HTMLVideoElement.muted` and Three.js audio node gain. WebAudio resumes on user interaction where permitted; browser autoplay rules still apply. Switching channels, going back to menu, removing objects and rehydrating scenes disconnect and release the old WebAudio node. Media sources are not duplicated.
- No new persisted fields, backend storage changes or server proxy changes. Existing saved IPTV channels, HLS links, startup options, screen aspect, and audio enabled settings continue to work. Rantlist CORS must still be configured on Rantlist's `/media/` Nginx location for cross-origin streams.

## Validation
- **718/718 JavaScript tests passed**, including 3 focused tests with a mocked PositionalAudio panner covering emitter placement, HRTF direction, attenuation and mute/disconnection lifecycle.
- Python backend AST, backend Nginx and realm archive tests, installer shell syntax and release manifest/SHA-256 checks passed.
- **Not verified:** live WebGL/WebXR positional listening, Safari playback and third-party HLS CORS and codecs. Browser testing after watcher deployment required.
- Deploy this standard release ZIP with the existing `updates/` watcher; do not place it on the Rantlist server. Original bundled avatar GLB assets are byte-for-byte preserved.

---

# SOLVI.help — Master LLM Handover v0.2.158

**Release:** v0.2.158 — Smart TV sound, startup channel, loop/aspect controls, paste-to-add and IPTV M3U catalogue.

## Current implementation (2 November 2026)
- `js/smart-media-playlist.js`: `cleanSmartOptions`, validated HTTPS media URLs, parsing and bounded CORS browser fetching for IPTV `.m3u` catalogues; mute overlay, saved startup playback, optional aspect-correct black bars, and finite-video loop handling. Smart media is never proxied via an unrestricted backend URL fetch.
- `js/editor.js`: TV and media-frame inspector settings; direct clipboard paste for selected TVs/monitors; searchable playlist import and Add per channel, with existing 12 channel limit and duplicate URL prevention.
- `js/primitive-properties.js`, `backend/server.py`: persisted strict smart option schema; imported scene objects and existing settings remain compatible.
- `js/equipment-media.js`, `js/scene-media.js`: same smart screen configuration flows to procedural displays and uploaded video frame surfaces.
- `styles.css`: compact dark panel layout.
- **Limitations:** browser/media codec support and remote HLS CORS remain external; automatic unmuted playback may be blocked by the browser; IPTV URLs may be offline or subject to channel rights. No server changes are required for IPTV catalogue parsing, but a remote stream’s own origin may still need CORS permission.

## Release verification
- Run `npm test`, syntax checks, Python backend checks, and full archive manifest/hash check. Live WebXR, audio and Safari playback remain unverified until deployment.

---

# SOLVI.help — Master LLM Handover v0.2.157

**Release:** v0.2.157 · Smart media playlists, lifestyle procedural objects, preset framing, wearable calibration.

**Local validation:** 701/701 JavaScript tests passed, backend Python AST and Nginx tests passed, realm archives passed, JavaScript syntax and installer shell syntax passed. Watcher-based npm dependency preparation, actual browser/WebGL/Rapier, external HLS CORS, webcam and multi-client rendering have not been verified here. Original bundled GLBs preserved; no user model edits.

**Usage:** Select a TV, monitor or video media frame; under Smart screen, paste a named HTTPS `.m3u8`, `.mp4`, or `.webm` URL and choose Add channel. Clipboard button requires user activation and browser permission. Switch to Exploration Mode and click the channel tile on the in-world display; in Edit Mode Alt-click it. External HLS requires a server permitting cross-origin segment requests. Use a small on-screen Menu control to return.

**Wearable:** Mark the object Pickable and set its category to Backpack, Jetpack, Parachute or Wearable. In the collapsed Wearable attachment section select bone, follow bone rotation, XYZ position offsets (metres), and XYZ rotation offsets (degrees). Back slot defaults to 90° additional yaw and 0.2 m lower. Model geometry is never modified.

**Outdoor:** Add → Equipment → Sunbed / Deck chair / Beach umbrella. J near the seat enters an authored lying/reclining action if available or the procedural recline; J again stands up and keeps facing. This is a first pass, not verified against all GLB bone rigs.

**Next:** v0.2.157 2D Planner pad; v0.2.158+ AI-assisted layout generation and plan upload interpretation. Test these goals separately.

---

## v0.2.157 — Smart HLS channel galleries, preset thumbnail framing, wearable calibration and outdoor procedural furniture (2 November 2026)

- TV/monitor screens accept up to 12 named HTTPS .m3u8/.mp4/.webm URL channels. The inspector offers direct Paste from clipboard with permission fallback. Each screen boots to an in-world channel grid; clicking a tile starts playback, and a return hotspot returns to the menu. Uses native HLS or vendored Hls.js; muted autoplay is requested only after interaction. Browser codecs, remote CORS, signed URL lifetimes and XR clicks are not guaranteed. No backend proxy for arbitrary URLs. Existing account-uploaded media-ID support remains.
- Video/image media-frame objects reuse the channel gallery when channels are configured. Blank video frames are valid scene objects without an uploaded media ID; they can be configured with streams. Existing uploaded media references remain checked server-side.
- Preset thumbnail capture now frames cloned procedural geometry using an orthographic camera and projected bounding-box corners. Browsing saved furniture presets recreates a thumbnail locally from saved furniture config rather than trusting old off-centre screenshots; no changes to existing saved presets are required.
- Wearable inventory config now optionally saves bone (`auto`, spine levels, chest, head, hips, shoulders), rotation following, XYZ position offsets (m) and XYZ Euler rotation offsets (degrees). Back slot defaults to 90-degree yaw and lower placement, front to opposite yaw; offsets are editable in a compact collapsible inspector. Original GLBs are never modified.
- Procedural sunbed, deck chair and beach umbrella use the existing furniture/preset pipeline. Sunbeds/chairs have adjustable recline angle and a procedural reclined pose or authored Lying/Lie down clip where available. Umbrella has adjustable canopy radius and 3–16 segments, stick, and base. Geometry, collision and real-avatar fit require live evaluation.
- Validation: npm tests, Python syntax/Nginx checks and SHA-256 manifest must be run for each release build. Live GPU, external HLS, stereo/WebXR and multiplayer are not verified locally.

## v0.2.155 deployment correction — test harness dependency injection (2 November 2026)

- **Watcher failure:** the first v0.2.155 ZIP was rejected by `npm test` before any GitHub push or website deployment. Both failing tests threw `ReferenceError: EQUIPMENT_TYPES is not defined`.
- **Cause:** `tests/natural-props-142.test.mjs` and `tests/wall-windows-ceiling-139.test.mjs` execute the furniture module source through `new Function` with imports removed. The v0.2.155 furniture implementation imports `EQUIPMENT_TYPES`, `EQUIPMENT_NUMERIC` and `buildEquipment` from `js/procedural-equipment.js`; the legacy test harnesses had not been updated to supply those dependencies.
- **Correction:** both tests now evaluate the actual equipment module exports against the test Three.js mock and supply those exports to the isolated furniture evaluations. No production JavaScript, backend, models or application features were changed to accommodate the tests.
- **Checks:** complete `npm test` run: **693 tests passed, 0 failed** (Node.js v22.16.0). Backend AST, Nginx validator, installer Bash syntax and ZIP SHA-256 manifest were checked separately. The watcher still needs to complete its own dependency build, API smoke, GitHub and live-host deployment checks.
- **Packaging:** the replacement release uses the same **v0.2.155** version because the original was not deployed, excludes generated `__pycache__` and `.pyc` files, and preserves original bundled GLB bytes. Avoid using the first, failed ZIP.

## v0.2.155 — Procedural displays, office equipment, backpacks and remote furniture reconciliation (2 November 2026)

- **Incremental furniture sync:** `js/editor.js` now compares the fully sanitised incoming furniture settings and replaces the old generated mesh parts within the same stable scene object ID. Rapier synchronisation then refreshes collision parts; unchanged settings do not trigger a rebuild. Live two-client/realm browser verification is still required for the original octagonal table report.
- **New procedural equipment:** TV and monitor (diagonal inches, aspect ratio, case, feet/centre/VESA mounting, screen on/off), mini computer (editable dimensions and LED), open/closed round/square bin with physically open side-panel collider geometry, and boxed/soft backpack with straps and optional front pocket. Integrated as furniture variants so scene saves, duplication, presets and archives use the existing data paths.
- **Media sources:** TVs/monitors can select an existing image/video scene media ID. Video is loaded through the existing authenticated media-blob API using a muted WebGL VideoTexture; missing/unavailable media leaves an inert dark screen. Browser autoplay/codecs still need real-device testing.
- **Inventory UX:** compact 3-across Pickable, Follow hand rotation and Consumable options; clearly labelled item category and size. Newly added procedural backpacks are tagged `inventory.category=backpack`; the existing front/back rig attachment and inventory persistence are reused, including for tagged imported model objects. Per-model fine fitting offsets are not added in this version.
- **Safety:** sanitiser and server enforce finite geometry resource bounds, enumerated variants and bounded media IDs. Generated Python bytecode is excluded from the release. Original bundled GLBs are unchanged.
- **Verification:** JavaScript syntax and focused static regression checks, Python validator and Nginx/installer syntax, checksums and archive structure. Full npm suite and real browser/Rapier/WebXR/multiplayer verification remain unverified in this execution environment because npm dependencies could not be installed.
- **Next roadmap:** v0.2.157 sunbeds/beach umbrella and recline; v0.2.157 global deterministic 2D Planner; v0.2.158+ opt-in AI floor-plan interpretation and layout generation. These are not included in v0.2.155.

## v0.2.154 — Edge-aligned seating, hand-drop and scene-backed inventory (2 November 2026)

- **Surface-aware sitting (`js/robot-seating.js`):** The controlled robot presses **J** near a suitable chair, armchair, stool, sofa, bed, table or substantially flat cube, cylinder, plane, surface or mesh model. The seat planner calculates local mesh bounds, chooses the chair front/nearest open edge, transforms the position and facing into world space, and rejects steep or unsupported surfaces, unreasonable seat heights and seats beyond reach. Robot task `go_sit` now attempts a real aligned seat instead of claiming arrival while standing. Authored **Sitting**, **Sit**, **Sit Down** and related clip names are preferred. If absent, an explicitly procedural seated pose bends the legs and moves the mesh to an approximate resting position. Press **J** again to stand. The new yaw is deliberately retained after standing. Real bone alignment/seat contact and full browser Rapier interplay remain visually unverified; complex model surfaces can be rejected to avoid sitting in empty space.
- **Drop rather than throw (`js/object-carry.js`):** The existing **I** key picks up a nearby Pickable scene object; pressing **I** again while holding it now detaches and places it immediately on the ground just ahead of the avatar, aligns mesh bounds to floor height, restores Dynamic Rapier, clears old velocities, saves and broadcasts the room-authoritative drop transform. **O** remains the separate throw-and-impulse action. Remote clients receive a validated `object-carry/drop` event. Temporary grip state is not persisted.
- **Inventory classification (`js/robot-inventory.js`):** Every Pickable object can opt into an item category: World (ordinary hand carry), General, Key, Money, Phone, Notepad, Tool, Food, Backpack, Jetpack, Parachute or Wearable. The size selector distinguishes a pocket-sized item from one requiring a bag; an individual Consumable flag enables Eat/Use. New items default to **World** so existing pickups and throws behave as before. Pocket inventory has up to 12 items; each backpack up to 24; these are current storage safeguards rather than arbitrary throw-control limits. Large items require a backpack before collection. A nonconsumable tool is inventory-managed but has no fabricated weapon/tool action yet.
- **Wearable bones / dual slots:** Backpack, Jetpack, Parachute and Wearable categories equip at **Back** or **Front**; exactly two wearable positions are provided. The `Spine2`/UpperChest/Chest hierarchy is preferred for attachment; otherwise use an avatar-root fallback. Pose follows rig animation each update. The Front/Back action swaps to a free slot. Jetpack/parachute attachment is cosmetic only (no propulsion/deployment physics yet). Imported rig placement may require future avatar-specific offsets and visual calibration.
- **Persistent containers:** Stored objects remain independent scene objects with their normal unique IDs; `inventory` describes item type and `storage` describes pocket owner, wearable avatar/slot or containing backpack's ID. Physics colliders are suppressed while stored; only worn objects are visible on the avatar. Dropping a backpack leaves its contents attached to the **backpack's ID**, not its former wearer, so its contents are accessible after another permitted user picks up the bag. Empty slots and orphan-reference cleanup are handled during scene replacement. The compact **Inventory (B)** panel offers Pockets, Wearable and Backpack tabs with Drop, To bag/To pocket, Front/Back, Eat/Use.
- **Storage/persistence/permissions:** Scene full and atomic saves, backend validators, room WebSocket replication, scene duplication and realm archive identity remapping retain valid item/storage data. An item placed in a different backpack is not duplicated. Existing owner/room edit permissions still apply; inventory is *per room/realm*, not a cross-realm account inventory. Deleting an item by consuming it is persistent. Food currently disappears after Eat, but does not update hunger/health; arbitrary Use actions for nonconsumable items and equipping tools in hands are not implemented. Deleting a container or losing its owner cleans up orphaned storage state.
- **Checks:** 686/686 Node tests, including 6 new inventory/seating tests and an additional drop regression. Backend Python syntax, Nginx and installer syntax passed; `realm_archives.safe_scene` verified bag/holder ID remapping using an executable Python fixture. The archive excludes all Python-generated bytecode (`__pycache__`, `.pyc`) to avoid the previous watcher rejection. **Not verified:** live browser avatar/bone rigs, GPU seating visuals, real Rapier collisions, actual multi-client session, Flask HTTP integration and WebXR.

## v0.2.153 — Compact furniture grid, keyboard isolation and camera/video UX (2 November 2026)

- **Three-column Basic Furniture inspector:** Numeric parameters use 3 columns with labels above compact dark inputs, 2 on narrow panels. Variant type occupies a whole row. The pre-existing active-field contextual slider remains.
- **Keyboard focus isolation:** Input/select/text-entry keydown and keyup events do not propagate to scene robot/camera shortcuts. The wall-undo capture handler also skips text fields, and robot movement keys are cleared when editing begins.
- **Single stable My camera preview:** Live camera, virtual feed and recorded playback are rendered in one fixed stage immediately below the panel header. Tracking and capture controls overlay the feed. Recording status and four condensed actions fit below the preview without a second video region.
- **Reliable chat video:** Video attachments retrieve the authenticated blob, extract an in-browser frame for a local poster, and play via direct source instead of waiting for HLS manifest negotiation. No poster is uploaded or retained server-side. Playback and decoding errors surface in the player/console. Audio retains the existing streamed path. Media preview costs a full video download on initial chat render (bounded by existing upload limits).
- **Icons / tracking:** Supplied Play/Pause/Stop/Record SVGs are packaged; audio/fullscreen SVGs supplement them. Face/pose frame errors are reported with throttling. MediaPipe/TFLite CPU/XNNPACK warnings alone do not prove a failure.
- **Checks / limits:** Unit/source tests cover above cases; actual browsers, device permissions, codec compatibility and pose inference are not available to verify here.

## v0.2.152 — Unified compact inspector, editable Rapier poses, camera recording consolidation (2 November 2026)

- **Reusable inspector pattern:** Use the term *contextual value scrubber* or *linked numeric inputs with a shared contextual slider*. SOLVI now attaches the same single `#inspectorValueSlider` to the focused Basic Furniture numeric field (in addition to XYZ Transform), rather than repeating sliders per property. The panel keeps the active input mounted during numeric changes, so focus/slider continuity is preserved. Numeric entry still goes through existing `sanitiseFurniture()` bounds to protect geometry and the backend. The style of the Basic Furniture inputs, dropdowns and compatible Properties controls matches compact dark Transform styling; no white numeric boxes.
- **Dynamic transform edit bug:** `ScenePhysics.sync` intentionally does not teleport existing Dynamic Rapier bodies (otherwise gravity would be cancelled). Inspector resets and numeric transforms instead call new `ScenePhysics.applyEditedPose`: build missing collider if required, write the edited THREE translation/quaternion into Rapier, and clear linear/angular velocity on Dynamic bodies. Ordinary real-time physics integration continues unchanged between edits. Physics-off mode remains safe.
- **Preset at 0,0,0 bug:** `SceneEditor.addFromPreset` already computed the viewport-centre ground point and positioned the visual object, but `addSceneEntry` had created the Rapier rigid body at origin first. Now the new explicit edited pose is synchronised after ground positioning, so the next physics tick does not pull Dynamic furniture back to world origin. Preset owner, generated ID, saved settings and history are preserved.
- **Microphone crash:** Audio-only `startRecording(false)` left both `sourceStream` and `preparedVideoStream` null; the previous `if(sourceStream===preparedVideoStream)` was true and called `preparedVideoStream.getTracks()`, throwing. The guard now requires a non-null source first. Recorder failures are reported with `console.error('SOLVI recording: ...',error)` and appropriate user-facing microphone/camera permission or missing-device messages. Real microphone devices and permissions still require browser verification.
- **Single camera:** Video capture and result actions live inside the existing `#webcamPanel` (My camera), reusing the recording status/meter and file actions from the former composer recorder. The webcam feed (`#facePreview`) is the only live camera preview during camera recording, with stored-file preview shown in the same panel after Stop. Virtual scene capture uses that same panel, switching to virtual preview. Voice-only recording stays in the composer. The title-bar is draggable through the existing persisted floating-panel handler; closing the camera discards in-progress camera recordings. The old separate video recorder is no longer launched by the visible video buttons. Original face/hand tracking remains separately controlled.
- **Scope:** Files: `js/editor.js`, `js/scene-physics.js`, `js/studio.js`, `js/face-tracking.js`, `index.html`, `styles.css`, `tests/release-152-editor-camera.test.mjs`, updated legacy media tests, release metadata and handover. Browser/GPU, microphone permissions, actual MediaRecorder output, camera drag interactions, and Rapier gameplay remain unverified in this offline environment. The existing watcher can deploy the release; do not include `__pycache__` or `.pyc` in the archive.

## v0.2.151 — Compact physics opt-ins, centre-ground Add and personal Presets gallery (2 November 2026)

- **Physics panel checkbox repair:** The original `#propertiesPanel .physics-object-controls label{display:block}` and generic 60%-wide input styling caused checkbox controls to become giant and labels to align at the far edge. The Pickable (I/O), Follow hand rotation and Climbable controls now share `#objectPhysicsToggles`, a two-column grid (three on wide viewports) with an explicit 15px checkbox and left-aligned text. Visibility and disabled/checked logic are unchanged.
- **New-object placement:** `js/scene-placement-math.js` computes the viewport-centre ray intersection with world floor Y=0, falling back to the camera orbit target when the camera is level/upward or would project beyond 500m. `js/scene-placement.js` grounds actual mesh bounding-box minimum for newly created procedural geometry/furniture, independent of default pivot offsets. The existing close-camera placement remains for media, model, light and robot; the Add lift uses centre-ground X/Z. Selecting an object still does not alter the camera.
- **Personal presets:** An authenticated per-user SQLite `object_presets` table stores each named procedural template and optional rendered thumbnail. A **Presets** button in World tools and **Presets · saved objects** in the Add menu open a responsive catalogue with `All / Furniture / Props / Geometry / Architecture` tabs, searchable names, preview cards, Add and Delete. An editable supported object exposes **Save as preset** in its Properties. On Add, the editor creates a fresh UUID/user ownership, rebuilds geometry from saved settings, places it at the ground centre, synchronises Rapier, records undo history and saves to the active realm. Presets are independent of scene objects and are accessible in all realms for the authenticated owner.
- **Supported templates:** Furniture including 7 larger Basic furniture variants and 8 Basic prop variants; cube, sphere, cylinder, plane, torus, surface, curve, text, ladder and non-lift stairs. Persist variant/dimensions, named textures and appearance, transforms except source position, physics and Pickable/rotation/Climbable flags. Robots, imported model files, media, random point clouds, unsaved custom-uploaded textures and multi-object lifts are not portable single-object presets; no misleading Save button is shown for them. Custom textures need future asset-backed templates. Maximum 250 presets per user.
- **Preview:** `capturePresetThumbnail` renders a transient clone with studio lighting into a 256×180 WebGL render target, reads/flips pixels to a WebP data URL and restores the main renderer state. If unsupported, the card uses a neutral placeholder; nothing is attached permanently to the scene. 145KB preview cap on backend.
- **Security/compatibility:** Backend authenticates every list, create and delete action, limits sizes and recursive payload data to finite values, strips identity/owner/world-position and unrelated fields, validates supported types and rejects unsafe preview URLs. Existing scenes/release watcher are unchanged; no model GLB modified.
- **Files:** `js/editor.js`, `js/object-presets.js`, `js/object-preset-data.js`, `js/scene-placement.js`, `js/scene-placement-math.js`, `index.html`, `styles.css`, `backend/server.py`, `tests/object-presets-151.test.mjs`, release metadata, handover. Tests are source/runtime logic without full GPU/browser interaction. **Unverified**: live WebGL thumbnail appearance, browser layout/responsiveness, full Flask integration and real Rapier gameplay; watcher re-runs application/backend deployment validation.

## v0.2.150 — Hand-bone rotation, projectile hit reactions, spark emitter (2 November 2026)

- **Per-Pickable orientation control:** `Follow right-hand bone rotation` checkbox appears when a Pickable cube/sphere/curve/model/basic furniture etc is selected. The default for new and legacy objects is enabled. When enabled, carry computes the actual animated right-hand metacarpal/palm world quaternion and preserves the object's orientation relative to the hand at attachment; it repositions the object's geometric centre at the palm as the object rotates. When disabled, the prop retains its original world orientation while following hand position. Use disabled for a javelin/prop that should not rotate with the wrist. For missing or incompatible rigs, use robot-facing fallback. The checkbox persists with scene object, duplication, atomic/full backend saves, and realm archives.
- **Release correctness:** Last held quaternion is retained at release; the validated optional `q` component travels with the existing `object-carry` throw event. Temporary test spheres retain their local-only lifecycle and no scene writes. Rapier physics receives the free body and the launch impulse, with continuous collision detection enabled for projectiles to reduce tunnelling at high speed.
- **Collision event hook:** Physics owns an optional Rapier `EventQueue`, subscribes to collision-start for freshly released objects for up to 12 seconds, reads solver world contact point where available, and estimates the surface contact only if solver data are unavailable. It captures incoming velocity before the physics step (post-contact speed may already be zero). Real robot/model collider contact determines hit; mere nearby appearance does not. World/ground impacts also produce sparks. Each projectile/target pair triggers at most once, up to five contacts per throw.
- **Authored reactions:** Robot victims use existing `hitHead` (`Head Hit`) and `hitBody` (`Hit to Body`) animation aliases, playing only when a matching clip is available. Scene GLB/FBX models now retain their original authored animation clips and can play a matching one-shot hit clip via a transient `AnimationMixer`. Head/body is chosen by contact height relative to the target's world-space bounds. A missing clip is not faked. Requires room Physics and appropriate collider mode on the victim.
- **Spark effects:** Local-only line-segment burst at the physical hit position; fades and disposes geometry and material after ~0.34 seconds. `js/impact-effects.js` has `register(name,emitter)` for a future authorable particle-emitter catalogue and caps simultaneous bursts at 24. No permanent scene records or particles saved/exported. Not a fully configured emitter library yet.
- **Multiplayer:** Backend accepts `throw-hit` only from the owner of a recently released Pickable projectile, checks IDs, permissions, finite contact point and boolean region, limits repeated victims and relays only to that room. Receivers verify that the point remains close to the target's current bounds before playing the same animation/spark. This is visual reaction replication; projectile body physics remains with the existing owner and Rapier snapshots.
- **Changes:** `js/object-carry.js`, `js/editor.js`, `index.html`, `js/scene-physics.js`, `js/scene-models.js`, `js/impact-effects.js`, `js/throw-impact.js`, `js/live.js`, `backend/server.py`, `backend/realm_archives.py`, `tests/throw-impact-150.test.mjs`, regression expectation updates, release metadata and handover. Original owned avatar GLBs remain unchanged.
- **Validation:** 662/662 JavaScript tests passed, including seven new release-focused tests; standalone Nginx and realm-archive checks, Python AST and installer shell syntax passed. **Limitations:** Unit/mock runtime tests and static backend syntax are not a replacement for live browser GPU/real Rapier collision, GLB rig/bone orientation, imported model clips or multiplayer validation. The watcher performs additional npm and deployed service checks. No actual website deployment performed here.

## v0.2.149 packaging correction — watcher retry (2 November 2026)

- **Cause:** The original v0.2.149 ZIP accidentally included `backend/__pycache__/realm_archives.cpython-313.pyc` and its SHA-256 manifest entry. The watcher intentionally refuses to commit generated `.pyc` files at GitHub stage four. Full package verification and application/backend tests had passed first; GitHub and website were reported unchanged.
- **Remedy:** Repacked the *same* v0.2.149 source files without Python bytecode and rebuilt the manifest hashes. No change was made to throwing controls, source code, original GLB assets, or watcher. Reusing v0.2.149 is appropriate because the failed deployment did not advance the deployed version.
- **Deploy:** Put `SOLVI_RELEASE_v0.2.149_UNRESTRICTED_THROW_CONTROLS_CLEAN.zip` in `updates/`. Keep the failed ZIP under `updates/failed/` as a diagnostic record, not for reinstallation. If the environment has changed since failure, watcher preflight will independently validate it.
- **Release-integrity checks:** SHA-256 recomputed for all retained source files; exact manifest/file match; zero `__pycache__`, `.pyc`, `.pyo` and generated cache paths; package/release metadata 0.2.149; avatar bytes identical to the failed ZIP. No second live deployment has been performed in this environment.

## v0.2.149 — Unrestricted Pickup & Throw numeric controls (2 November 2026)

- **No arbitrary min/max:** All eight numeric controls in Robot Properties → Pickup & Throw · right hand now have no HTML `min` or `max` attributes. Angle, hand height, direction, Release delay, Pickup delay, lifting speed, throw speed and throw force accept any finite numeric input that is valid for the setting; **50 m/s** or **100 m/s** no longer silently becomes **3.1 m/s**, and delays do not snap back to **55%**.
- **Physically meaningful input:** Throw force is a *launch speed* and can be zero or positive; lifting/throw animation multipliers must be strictly positive because a zero or negative duration multiplier is undefined. All values must be finite numbers. Bad, empty or nonnumeric entries leave the last valid value in place. There are **no arbitrary upper ceilings**. Values may still exceed engine precision; unsafe impulses are skipped with a visible warning rather than injecting Infinity/NaN into Rapier.
- **Animation timing:** Lifting and Throw no longer apply the previous 0.2–4 second animation-clock clamp, and the actual playback path bypasses the generic 0.3–6.5× animator clamp for these two carry actions only. The numeric value is kept per avatar, saved, duplicated, and validated by the server.
- **Percentage semantics:** Percent settings have no input limits. 0% means at the start, 100% means at the end; negative delay values are effectively immediate and values above 100% release/attach at the clip end, because the animation is finite. The configured value itself is *not* rewritten or clipped.
- **Aiming and guide:** Angle and direction are stored unchanged, including full rotations; modulo 360° is used only for stable trigonometry. Force is mass-scaled as before. The temporary trajectory guide adapts its time window to cover throws longer than the previous 2.55-second prediction. High coordinates that cannot be represented by GPU/physics floats do not enter the preview or impulse calculation.
- **Compatibility:** Existing saved throwSettings values and defaults remain backward compatible. Other robot speed sliders, general animation rates, procedural models, avatar GLBs, nonthrow physics and watcher remain unchanged. No schema migration.
- **Validation:** 655/655 JavaScript tests, including 8 added focused unbounded controls tests; Python source/inspector/ZIP integrity and backend validator checks. Live GPU browser, Flask HTTP integration, XR and live Rapier gameplay still not verified locally.

## v0.2.148 — Fix Release delay reverting to 55% (2 November 2026)

- **Problem:** The Release delay control could appear to snap to 55%: the existing settings sanitizer treated out-of-range numeric edits as invalid and returned the default, and the inspector only applied changes on the browser `change` event (usually blur). A property refresh during editing could rewrite the field before the edit was committed.
- **Fix:** Numeric throw controls now commit valid input as it is typed, protect the actively focused field from same-robot inspector refresh, and preserve the pre-edit snapshot for undo. Completed entries outside the allowed range are clamped to the nearest boundary instead of being reset to the default. An empty/invalid entry restores the last valid value.
- **Scope:** Release delay and Pickup delay remain 5–95%, with the existing 55% default for newly created robots. Angle, direction, hand height, lifting speed, throw speed and throw force share the improved input lifecycle. Per-avatar saving/duplication/imports and animation-frame timing are unchanged; no backend schema change and no avatar GLB changes.
- **Verification:** 647/647 JavaScript tests pass, including five new runtime/UI-listener regressions. Node syntax, Python syntax, Nginx and watcher shell syntax passed. Real browser rendering, full Flask service, deployed multiplayer and live Rapier throw timing not verified locally.

## v0.2.147 — Pickup/Throw animation speeds, force and trajectory guide (2 November 2026)

- **Animation speeds:** In robot **Pickup & Throw · right hand**, Lifting speed (0.50–3.00×) and Throw speed (0.50–3.00×) affect both animation playback and the configured grip/release delays, which remain percentages of those animations. The held object remains attached while the robot returns to Idle/Walking/Running.
- **Throw force:** New per-avatar Throw force value (1.2–10 m/s, default 3.1) sets desired launch speed. The dynamic Rapier impulse is `mass × velocity`, so objects with different mass launch at similar speed in the selected aim direction (subject to physics simulation). Existing Angle (elevation), Direction (yaw) and Hand height offset remain editable.
- **Trajectory guide:** Toggle **Trajectory guide** in that panel to draw a temporary world-space aiming line and endpoint at the right-hand release position. It uses the same launch velocity and gravity as the real thrown object, tries Rapier raycasts to stop at walls/ceilings/other colliders, and otherwise stops at the basic floor plane. The line is a fast approximate prediction, not a guarantee of collision results after moving objects or further impulses. It only updates roughly every 120 ms, creates no scene-object records and never broadcasts.
- **Compatibility:** Former four/five-field saved `throwSettings` are accepted; three new numeric fields default to 1×/1×/3.1 m/s. No changes to original GLB assets.
- **Validation:** 642/642 JavaScript tests before final versioning, including five new runtime tests; Python/Nginx/archive/installer syntax and checks. Live browser, skeletal alignment and real WebXR behaviour unverified.

## v0.2.146 — Configurable pickup timing and temporary hand test sphere (2 November 2026)

- **Pickup delay (%):** A compact per-avatar field in **Pickup & Throw · right hand** controls when the object attaches during the one-shot Lifting clip (5–95%, default 55%). The hand reaches for the floor object first; after grasp, Idle/Walk/Run resumes normally. The existing Throw release delay (%) remains separate.
- **Test sphere:** Press **Test sphere** in the robot's Pickup & Throw panel to attach a small local-only sphere directly to its metacarpal/palm. It does not need a floor object or the I key. Press **O** while controlling the avatar to test the existing Throw animation timing, angle, hand-height offset and direction, with Rapier dynamic collision and gentle impulse. Requires room Physics enabled. Test sphere vanishes 12 seconds after release, or when the scene changes.
- **Privacy/persistence:** Test spheres are transient and never enter scene saves, object lists, avatar settings, realm exports, carry events or physics-state network broadcasts. The regular Pickable-object path continues to replicate to other users.
- **Compatibility:** Existing saved `throwSettings` with the four original fields remain valid server-side, and the new fifth `pickupDelay` is used on updated saves. No GLB or backend schema migration required.
- **Validation:** 637/637 JavaScript tests after three new focused runtime checks; syntax, Nginx and realm archive checks. Local Flask integration/real Three.js GPU rendering unverified.

## v0.2.145 — Palm/metacarpal pickup and timed configurable throws (2 November 2026)

- **Right-hand grip:** Prefer the authored middle metacarpal or palm bone over wrist; fall back to proximal fingers, then a hand bone or a rig-independent palm position. Snowballs and other Pickable objects follow the palm area rather than the wrist.
- **Throw animation timing:** O starts one non-looping Throw clip; the object remains held during arm wind-up and leaves the hand at the configured percentage of the clip, at the live hand world position. Dynamic Rapier physics and a gentle, predominantly forward impulse begin only after detachment.
- **Per-avatar Throw inspector:** Compact collapsible Angle (elevation, −20° to 65°), Hand height offset (−0.35 to +0.65 m), Direction (−90° to +90° relative to facing), and Release delay (5–95% of authored Throw duration). Defaults: 12°, 0 m, 0°, 55%. Settings are saved per avatar and validated in backend, duplicated and exported with realm archives.
- **Multiplayer:** Authoritative throw event is sent at the release frame; remote peers detach immediately upon receiving that event at the authoritative released transform, with no second local impulse.
- **Safety:** Validate launch coordinates and physics state before detaching. Maintain single Lifting action, normal Idle/Walk/Run while carrying and original avatar GLBs unchanged.
- **Verification:** 634/634 JavaScript tests, Python/Nginx/archive/installer syntax and checks; standalone server throw-settings validator tested. Full Flask suite and live browser/GLB-skeleton alignment unverified in local environment.

## v0.2.144 — One-shot Lifting and palm-height forward throws (2 November 2026)

- **Pickup (I):** run only the authored **Lifting** clip once, not Picking Up followed by looping Lifting. Attach at the hand midpoint of the pickup, then clear the action and resume the avatar's normal **Idle / Walk / Run** while the object stays in the right hand.
- **Throw (O):** start the one-shot **Throw** animation, detach the object *immediately*, place it at hand height with safe forward clearance, restore Dynamic Rapier collision, clear old velocity, and apply a mild **mostly forward** mass-scaled physics impulse with a small upward component. The object subsequently flies and falls with normal collisions.
- Server-synchronised carry events retain the authority/client release coordinates; no permanent carried state is saved. Existing Pickable settings and avatar models are unchanged.
- **Testing:** 631/631 JavaScript tests (five new cases cover Lifting-only, post-pickup Idle/Walk/Run, detach-before-physics, hand-height forward throw and remote positions). No live Chrome, Three.js GPU, Rapier or multiplayer session was executed locally.

## v0.2.143 — Pickable objects, right-hand pickup and throw (2 November 2026)

- Add opt-in Pickable property to primitives, models and Basic Furniture; serialize through scene save, duplication, per-object updates and realm archives, with server-side validation.
- I picks up a nearby, front-facing handheld object; Picking Up transitions to Lifting while its world transform follows a detected right-hand bone, with a predictable palm fallback for incompatible rigs.
- O starts the authored Throw action and releases the object at the animation contact phase into dynamic Rapier physics with a bounded forward/upward impulse, gravity and further collisions.
- Carry objects have their collider temporarily removed to avoid ghost collisions with the avatar; dynamic physics is restored on throw or orphan cleanup; only released state is persisted.
- Add authenticated room object-carry events for other clients; keep ownership and permissions checks and reject invalid or unsuitable objects.
- Add seven focused runtime tests for pickup/throw, model bones, object sizing, packet safety, persistence and cleanup. No embedded asset modifications.

### Architecture

- **js/object-carry.js:** `ObjectCarry.pickup/throw/tick/remotePacket`, nearest forward-facing Box3 selection, animation phases, bone/palm lookup, temporary collider removal, dynamic impulse release and orphan recovery.
- **js/animations.js:** `pickUp`, `liftCarry`, `throwObject` aliases. Preferred animation names are **Picking Up**, **Lifting**, **Throw** (case-insensitive aliases); missing clips fall back to existing Idle pose, without blocking physics. The carrying loop is only enabled if an authored Lifting clip exists.
- **js/editor.js:** `KeyI`/`KeyO` work in Exploration and Edit Mode when a robot is selected, without interfering with text input or face-opening commands in scene mode. Pickable property exposed in compact Physics panel, persisted across updates and copies.
- **js/scene-physics.js:** held objects have no collider while attached; throw rebuilds a Dynamic Rapier body and applies impulse, default strength 3.1.
- **backend/server.py**, **js/live.js:** authenticated `object-carry` WebSocket events for pickup/release; payload validates object IDs, Pickable flag, robot ownership/edit permission and finite position. Remote non-authoritative dynamic transforms use existing physics replication.
- **backend/realm_archives.py:** `pickable` retained on imported/exported objects.

### Constraints and verification

- Pickable opt-in defaults to false. Restricted to ordinary primitives, models and furniture, with an effective maximum 1.55 m on the largest bounding-box axis. Room Physics must be enabled.
- Temporary hand poses never become permanent scene data; when thrown, object physics mode becomes Dynamic and is saved. Existing combat KeyT Throw remains independent.
- Local JavaScript tests cover small targets, frontal selection, bone preference, fallback, animation phase, Rapier impulse, permissions, orphan cleanup and source-level persistence. No real browser avatar bone rig / network multiplayer smoke test has been run in this environment. Flask integration tests require its deployment dependencies.
- Deployment watcher `solvi-watch.sh` requires its newer 4,096-entry threshold, available in the previous v0.2.142 handover. The release must include root `manifest.json` and `app/` directory with per-file SHA256 hashes.

## v0.2.142 — Procedural natural materials, Basic props & watcher limit (1 November 2026)

- Add 128x128 deterministic low-memory procedural Wood, Marble and Granite materials with layered noise, cellular speckles and distortion; no network textures.
- Expose natural materials in wall, ceiling, stairs, ladder, furniture, primitive and floor selectors. Provide compact Scale, Distortion and Contrast controls on walls and natural furniture textures.
- Add Basic props with eight editable procedural objects: Plate, Mug, Glass, Bowl, Bottle, Can, Flowerpot and Box; hollow/container profiles with optional handles, bottle lids, flowerpot soil and open-top boxes.
- Preserve prop edits through the existing furniture scene persistence, duplication, room archives, compound collision and multiplayer object updates; update server validation.
- Add procedural texture and prop runtime regressions, retain original avatar assets; requires the updated watcher with a 4096-entry archive safeguard.

- **Verification:** 619/619 JavaScript tests (including three new runtime regressions); Nginx, portable realm archives, backend source parsing, JS syntax and installer shell syntax passed. Browser GPU appearance not verified.
- **Deployment:** replace the local Mac root watcher `solvi-watch.sh` with patched `solvi-watch.sh` download, restart it, then put v0.2.142 ZIP in `updates/`. A release ZIP cannot modify the already running local watcher.

## v0.2.141 — Compact procedural controls and Basic furnitures (1 November 2026)

- **Robot selection:** selected portrait draws a clearly visible 3px accent ring above the photo, inside its roundel, with no cropped inset effect; the active name stays tinted. The +/− buttons remain tiny with transparent backgrounds.
- **Compact consistent inspector:** Ladder, portal, primitive dimensions and the new Basic Furniture panel use tight rows, 27px controls and label/value alignment inspired by Transform fields. Wall/stair builders use reduced inter-row gaps and control heights rather than stacked oversized inputs.
- **Basic furnitures:** Add → Basic furnitures → Table, Chair, Stool, Armchair, Sofa, Bed, Cabinet. Every choice creates an editable `furniture` scene object. Table/stool tops can be rectangular or round, or 3–8 sided polygonal with editable radius and corresponding vertex legs; leg styles are four, three, pedestal, castors or none. Chairs and sofa offer seat/back dimensions, optional headrest, cushion thickness and 2–4 seats; beds have a mattress, optional headboard and floor/leg supports; cabinets expose adjustable dimensions and 0–16 shelves. Colour, upholstery colour and surface texture are editable. All defaults are approximate human-scale metres, and dimensions are bounded.
- **Persistence and physics:** Geometry is rebuilt after edits and saved as bounded furniture configuration; object duplication, scene restore, realtime object patches, JSON/gzip realm export/import and backend full/partial scene validation retain it. Furniture pieces have separate colliders when room Physics is enabled, rather than one solid enclosing box. Existing models and rooms are unchanged.
- **Verification:** 616/616 JavaScript tests, including new runtime mesh generation for seven variants and source-level integration checks. Python syntax, backend furniture validation, Nginx tests, realm archive tests and installer shell syntax pass. Live GPU browser presentation and Rapier behaviour remain unverified.

## v0.2.140 — Room Array and robot switcher controls (1 November 2026)

- The robot switcher +/− SVG files no longer contain opaque white rectangular backdrops; strokes are white on transparency. All button/hover/focus styles explicitly clear backgrounds. The actively controlled robot has a strong accent selection ring and a highlighted name.
- Closed Office Space wall rooms offer a collapsed **Room Array · optional** section. Enable Array, choose total copies **1–16** (including original), axis **X / Y / Z**, direction **+1 / −1**, extra spacing **0–20 m**, and per-iteration rotation offsets **X/Y/Z** (−45° to +45°) or scale deltas **X/Y/Z** (−0.25 to +0.25 per copy). Generated copy scales clamp to 0.2–5.0. Offset spacing is the original room's footprint on the selected axis plus the specified gap. The controls work when editing an already saved closed room and when drawing a new one; other wall types remain unchanged.
- Room arrays are **one saved wall object** containing procedurally generated child meshes, not independent scene objects. All copies include room wall sections, windows, glass, open/close buttons and optional ceilings. Window IDs are namespaced per copy; opening one pane does not open its neighbours or equivalent panes on another floor. The original room/copy is never repositioned.
- Rapier compound colliders account for each copy's geometry position, quaternion and per-axis scale. Ceiling Trimesh colliders rotate and scale with their array copies; real window and lift voids remain in the generated mesh. Lift shaft cuts from the base outline repeat at the same relative location in each copy. Existing room saves and scene/realm export/import remain compatible; arrays are disabled by default.
- Server validates array config (axis, direction, count, gap, finite rotation and scale vectors) and rejects an enabled array on an unclosed wall. Expanded saved window IDs support per-copy state. The backend wall key-count check now accepts all 12 current sanitized fields, fixing a previously latent refusal of otherwise valid walls with both windows and ceilings.
- **Verification:** 614 JavaScript tests, including four new runtime/saved-schema/UI tests. Backend validator executed directly against a real sanitized wall payload plus malformed inputs. No real GPU/Three.js/Rapier full browser or live multiplayer scene test was possible in the local environment; review complex intersecting or highly rotated arrays after deployment.

## v0.2.139 — Circular switcher, Run multiplier, procedural windows and ceilings (1 November 2026)

**New interface:** The robot control switcher container and avatar tiles no longer paint square backgrounds. Portraits occupy the circular crop with robot names overlaid at the upper centre. The selected portrait gets a subtle circle outline. The original plus/minus SVG buttons are tiny, white and fully transparent behind. Empty switcher areas remain draggable. The Run (movement) setting now follows Walk in the compact speed dropdown. It is distinct from Run animation playback and is stored per avatar, validated by the server, sent with robot-input packets and replayed by remote peers. Default: 2.8× speed factor while running, range 1–5×, and Walk behaviour unchanged.

**Procedural windows:** Office wall builder adds an optional Windows section. Settings: enabled/openable, minimum segment width (1.2–15m), minimum wall height (1–10m), relative width (15–70%), relative height (20–75%), glass colour and opacity (0.08–0.85). A qualifying segment gets a proportional one-or-more window distribution. Solid wall is split into side/sill/header masonry so the window is a real architectural hole; a separate glass pane is physically blocking only while closed. Tiny buttons on both faces swing the pane open or closed; state is saved and validated with the wall, including realm export/import. Old wall records remain compatible (windows disabled by default). No blocking invisible full-wall cuboid can cover the opening.

**Flat ceilings and lift openings:** A wall polyline of at least three noncollinear points can optionally generate a flat ceiling/soffit surface at wall height, with independent texture, colour and thickness (0.05–0.6m). The outline closes automatically for the ceiling even when wall drawing is multiline. Optionally detect existing lift footprints and cut holes through the ceiling using actual geometry; supports rotated lifts. Opening geometry and colliders update when lift placement changes. The ceiling is a true upward-walkable XR teleport surface; the underside is not a landing; solid walls and ceiling faces block beams from reaching floors hidden beyond them. A two-point straight line does not define a ceiling area.

**Physics and correctness:** Rapier receives separate per-section wall boxes and a ceiling Trimesh, preserving window and lift gaps. Changing lift positions invalidates and rebuilds roof colliders rather than leaving invisible collision geometry. The generic user-selectable Dynamic + Trimesh mode remains enabled. Tests: 610/610 (including six new tests, one executing actual `rebuildOfficeWall()` with mocked Three.js geometry). Python syntax, Nginx and realm archive checks also pass. Full Flask integration, vendor Three.js GPU rendering and live XR are **not verified locally** because their dependencies are unavailable; inspect actual glazing, ceiling orientation and teleport behaviour in the deployed browser.

**Files:** `js/office-walls.js`, `js/office-wall-math.js`, `js/editor.js`, `js/scene-physics.js`, `js/robot-net.js`, `js/world.js`, `index.html`, `styles.css`, `backend/server.py`, `tests/wall-windows-ceiling-139.test.mjs`, `releases.json`, metadata. The deployment watcher requires a strictly newer manifest version, one root manifest + `app/` source files, ≤350 ZIP entries and exact SHA-256 key matching.

## v0.2.138 — Realm switch responsiveness and scene/physics isolation (1 November 2026)

**Reported:** Switching from the Main realm to another realm can hang Chromium and show *Page Unresponsive*. There was no JavaScript exception or performance profile accompanying the screenshot, so the exact cause of that particular stall is unproven. The source exposed multiple synchronous work paths capable of blocking the main thread, now repaired.

**Changes:**
- `js/studio.js`: the realm chooser no longer calls the previously synchronous `saveRealmView()`, which forced `renderer.render()` and then encoded a canvas via `toDataURL()`. Previously cached realm thumbnails remain displayed. `applyWorldPolicy` now wraps `physics.setEnabled()` in `Promise.resolve(...)`, since disabling physics returns synchronously; the former `.then()` on `undefined` could interrupt the transition. While a realm changes, policy fetches stage physics enablement until the destination scene is ready. The room-change handler brackets scene/world requests with `editor.beginRealmTransition(room,previousRoom)` and `editor.endRealmTransition(room)`, protects against stale overlapping transitions, and handles errors.
- `js/editor.js`: the new transition lifecycle stops outgoing robot simulation, clears remote commands and old physics before changing rooms, invalidates in-flight scene loads, and restores physics only after new scene hydration. Cooperative disposal/recreation now yields via `setTimeout(0)` every three objects, even if `requestAnimationFrame` is throttled. Delayed object-save timers are flushed to their **source** room; asynchronous save responses cannot change the new realm's revision.
- `js/scene-physics.js`: a 100s-of-objects collision rebuild no longer runs synchronously in a single turn. Rapier objects build in batches of three or a seven-millisecond execution budget, then yield. Generation checks stop stale work if the realm changes and the old physics world has been freed. The Physics world is never modified after cancellation.
- Tests: `tests/release-104-stability-and-recording.test.mjs` runs the actual `ScenePhysics.setEnabled` method with a minimal mocked Rapier world and 120 objects; it asserts main-loop yielding, cancellation, world disposal and subsequent complete rebuild. Other tests cover room identity, save isolation and removal of the synchronous realm preview. The pre-existing test suite remains active.

**Limitations and verification:** Source+mock-runtime tests cannot replicate a production Chromium GPU hang on large user-owned worlds. Browser console profiling and actual server realm assets are unavailable. This addresses identifiable freeze vectors without claiming the exact screenshot's root cause was demonstrated. Watcher performs its own Flask and integration stages after upload. Archive must contain only `manifest.json` plus `app/` files with matching SHA-256. Current release is v0.2.138; do not reissue an equal-version archive.

## v0.2.137 — Fix Rapier ladder-top NaN / Three.js audio crash (1 November 2026)

- **Root cause, verified against Rapier 0.21 API:** `ScenePhysics.landAtLadderTop` subtracted `hit.toi`, an obsolete ray-hit property renamed to `hit.timeOfImpact` in Rapier 0.13. When a ladder or opt-in wall/tree had an upper supporting platform, a successful raycast produced a real hit object but `hit.toi` was `undefined`; `floorY` became `NaN` and was written into the avatar's Y position. A following chase/orbit camera inherited the `NaN`; Three.js `AudioListener.updateMatrixWorld` then called `linearRampToValueAtTime` with a non-finite value, throwing every frame. The audio exception is the downstream symptom, not the root.
- **Repair:** Both standard Ladder and Climbable surface top-dismount rays use `hit.timeOfImpact`, require finite distances in each ray's supported range, and verify finite landing positions and expected level. Invalid results do not move or dismount the avatar; the visitor remains attached at the top until a real supported landing exists. Keeps adhesion, tilt, speed and existing controls unchanged.
- **Defence in depth:** `SolviWorld` remembers the last finite camera position, quaternion and orbit target. A non-finite pose is restored before rendering/audio and camera follow is disabled for that incident, rather than letting an unrelated corrupt scene coordinate permanently freeze the app. The normal camera-follow path remains unchanged for finite poses.
- **Regression:** Four new executable tests run the actual production landing method with Rapier-shaped hits, invalid ray distances, full ladder and climbable-surface top dismounts and camera recovery. This exercises the previously failing API mismatch, unlike the original source-only ladder-top test. Live browser/Three.js audio/Rapier and WebXR integration remain unverified; full JS and backend syntax checks run for packaging.

## v0.2.136 — Ladder adhesion and avatar inclination (1 November 2026)

- **Ladder geometry settings:** A new compact **Adhesion (m)** field in the Ladder inspector sets the avatar root's signed normal distance from the rungs, default **0.30 m**, bounded **0.12–0.85 m**. Adjusting it moves attached climbers closer or farther away; no separately configured frame/pose offset. The value is stored inside the ladder config, so it persists across edits, reloads, duplicates and room/realm archives, with backend finite-number/range validation. Older ladders without the field remain valid and adopt the default.
- **Incline-following posture:** The ladder still uses the existing object transform controls for its inclination (rotate it around its local X axis). `js/office-ladder.js` derives the actual world-space up vector and rung-face normal, including arbitrary scene yaw, then constrains the climber at the chosen adhesion offset in the ladder's local frame. The avatar's **render model** leans with that angle and reverses correctly on the opposite face; its Rapier capsule/root orientation stays upright for stable gravity, input, collider and multiplayer behaviour. `js/robots.js` eases visual pitch into alignment while climbing and resets it on Space release, missing ladder or supported top dismount. The legacy SOLVI GLB's 180° visual-yaw correction is accounted for, so pitch direction is correct. Standard, non-climbing locomotion remains unchanged.
- **Animation and collision:** `Climbing Up Wall` remains the preferred climb action; user-configured Climb speed, Down reverse, Space gravity release and platform-checked top dismount are unchanged. Adhesion is a pose-position adjustment, not hand/foot IK: exact rung contact for all GLBs is not guaranteed and should be visually tuned per model/ladder. Collider meshes are unchanged.
- **Verification:** Node regression suite, executable attachment/pose tests, backend ladder field checks and watcher ZIP manifest checks. Live browser, Rapier, WebXR, multi-client movement and avatar-specific visual rung placement remain unverified.

## v0.2.135 — Controlled climb speed; prevent stair transport frame crash (1 November 2026)

- **Crash diagnosis:** `js/stair-transport.js` read `segments[index].top` without verifying the computed index. A non-finite along-distance (`NaN` from a movement coordinate or marker transport phase) produces `NaN` for the array index even if the segment array is nonempty. The ensuing `TypeError: Cannot read properties of undefined (reading 'top')` propagates from `tickStairTransport` into the editor frame loop. Fixed by a shared finite-checked `surfaceHeight()` in `js/transport-support.js`, returning `null` for invalid or missing segments; marker and rider callers skip invalid coordinates, rather than substituting a bogus 0-metre surface or terminating the animation frame. `projectPath` and `pathAt` also reject non-finite coordinates. XR conveyor calculation uses the same safe helper. Reproducible runtime test executes `tickStairTransport` with a corrupt marker phase and an invalid robot pose.
- **Climb speed:** existing compact **Robot speed → Climb** dropdown option exposes a shared slider **0.20–4.00 m/s**, default **1.25 m/s**, per robot/avatar. The editor stores `climbSpeed` in the ordinary scene record and restores it during scene load, duplication and multiplayer patch updates. Both procedural Ladder and opt-in Climbable surfaces consult the same speed. Up/Down and authored Climbing Up Wall animation playback follow the selected speed; the animation rate is proportional to the original 1.25 m/s, bounded by the existing animation mixer. Backend scene validation accepts only finite numeric climb speed in range (not booleans); legacy scene records with no speed use 1.25 m/s.
- **Regression/tests:** 594 JavaScript tests pass, including five new runtime and integration tests for non-finite segment selection, invalid path/speed, correct stair tick behaviour, speed scaling up/down, inspector persistence and backend validator wiring. Nginx tests, realm archive tests, JavaScript syntax, Python AST and installer syntax pass. Flask HTTP integration is **not locally verified** because the Python environment lacks Flask; real browser/WebXR/Rapier visual behaviour remains unverified.

## v0.2.134 — Climbing Up Wall and opt-in Climbable objects (1 November 2026)

- **Ladder animation corrected:** every avatar now selects its authored **Climbing Up Wall** (or Climb Up Wall / Climbing Wall) action first, rather than preferring **Climbing Ladder**. Older Climbing Ladder / Climb clips remain fallbacks when the preferred clip is absent. Up climbs forward and Down plays the available clip backwards; missing clips still avoid pretending an animation exists.
- **Climbable checkbox:** a small, explicit per-object setting in the Physics section of the inspector for walls, imported GLB/FBX models (including trees), and supported procedural shapes. Existing objects default to **off**. The setting persists through scene patches, realm export/import, duplication and multiplayer replication. Backend accepts only boolean values for eligible objects.
- **Actual surface grip:** with the robot portrait selected for manual control, face a climbable object's near-vertical surface and hold **Arrow Up**, or Down from a reachable elevated position. A forward ray must hit a real scene mesh within contact range; large tree crowns and wall bounding boxes alone cannot trigger phantom climbing. After attachment, the same capsule-safe climb constraint as Ladder suspends walking gravity without modifying physical colliders. Space detaches and gravity resumes. At the top, Rapier must detect a supporting surface before the avatar steps off; without support the avatar remains attached and Idle.
- **Limitations:** manual keyboard robot control only; avatar animation depends on clips present in the GLB. No automatic free climbing, AI wall-route planning, hand-over-hand IK, WebXR-specific climbing or live browser/Rapier verification has been performed. A real climb surface must be visible to the forward mesh raycast; objects made only of non-rendered collision shapes do not supply a grip. Very complex foliage may require a properly authored trunk mesh and static collider.
- **Tests:** 589 JavaScript tests pass, including six executable opt-in/raycast/animation/ride tests. Python static checks, Nginx, realm archives and watcher ZIP manifest are verified separately.

## v0.2.133 — Ladder attachment and collision fix (1 November 2026)

- **Root cause:** v0.2.132 recognised only the ladder's positive-Z face, and only inside an unnecessarily narrow approach zone. Avatars approaching from the reverse face collided with the rung/rail colliders but were never identified as climbers. A robot in Scene control also does not receive manual movement keys; choose its portrait in the control switcher.
- **Fixed:** `js/office-ladder.js` detects a climbable `kind=ladder` from **either side** when an owner-controlled or replicated avatar holds Arrow Up close to the ladder. The 1.10 m local approach zone allows engagement **before** Rapier stops the capsule on a rung. Entry outside the immediate contact region requires facing the bars, so an unrelated passer-by is not pulled into an ascent. The climb controller constrains the body to a safe .44 m offset from the rungs on the correct face and retains the avatar's horizontal location on wider ladders.
- **Top exit:** `js/scene-physics.js` raycasts for a supported upper landing **on the opposite side of the approach** and at the climber's actual horizontal coordinate. No platform: remain safely attached; platform: move to its elevation and return to Idle.
- **Physics and input:** Ladder bars retain ordinary Rapier colliders. Once attached, `ScenePhysics.driveRobot()` already handles the active ladder ride outside normal character collision and gravity integration. Press Space to detach and fall. `js/editor.js` ignores stale remote horizontal corrections while the remote avatar is on the ladder. This is manual robot-control climbing (select the robot's portrait first), not an autonomous navigation or WebXR interaction.
- **Tests:** Added seven source/runtime tests to `tests/ladder-132.test.mjs` for both faces, pre-contact acquisition, collision-stopped starting pose, wide-ladder entry, false positive rejection, side-aware top exit, and replicated packet correction. **Browser/real Rapier/WebXR interaction remain unverified.**

## v0.2.132 — Ladder climbing and compact UI (1 November 2026)

- **Office Space → Ladder**, immediately after Stairs advanced: a separate procedural object with **Width, Height, rungs by Count or Gap (m), Texture and Colour**. Rung count is bounded to 320 and the ladder height to 40 m. Its rails and rungs use independent static compound Rapier box colliders by default, never a single blocking full-width cuboid. Transform, persistence, scene archive and server validation are supported.
- **Manual avatar climbing** in robot-control mode: approach the front of a ladder and hold **Arrow Up** to ascend or **Arrow Down** to descend. The avatar stays aligned to the ladder while gravity is suspended, and any available `Climbing Ladder`, `Climb`, `Climbing Up Wall` or `Climbing` animation is selected. Descending plays the mapped clip backwards. If no clip exists, the avatar holds Idle instead of inventing an animation. **Space** releases the ladder and resumes normal Rapier falling and landing on the nearest colliding surface.
- **Top landing safety:** only dismount if a physically supported upper landing is detected immediately behind the top rung; then return to Idle. Without a platform, remain attached, Idle at the top rather than falling into empty space. This is manual climbing, not an autonomous robot navigation task or a validated WebXR climbing interaction.
- **Portrait size controls:** use the uploaded `minus.svg` / `plus.svg` directly and skip the global UI decorator to prevent unrelated robot icons. **Profile Edit Mode** is one compact label and toggle with no secondary description.
- **Tests:** 576 JavaScript tests passed before release versioning (six new ladder checks). Nginx, realm archive, Python syntax and installer checks passed. Local Flask HTTP integration and live browser/Rapier/WebXR/multiplayer climbing have not been verified.

> **v0.2.131 stair-aware robot navigation addendum (1 November 2026):** `js/robot-stair-approach.js` generates candidate entrances exclusively on the accessible low side of standard/advanced stair paths. `js/editor.js` projects these local coordinates using the target object's full `localToWorld` transform, plans and verifies obstacle-avoiding A* paths around actual tread footprints and surrounding objects, and forbids generic partial approach to the inaccessible high/side face. `routeRobot` uses a single continuous planning leg for near stair access rather than splitting through blocked intermediate stair tread points. `js/robots.js` propagates semantic `destinationPart` in task updates. `backend/server.py` gives deterministic low-entrance acknowledgements, discourages ungrounded climbing promises, and emits arrival/blocked replies specifically about reaching the first step. This is **bottom-entrance approach only**, not stair ascent. New tests cover entry direction, high-side detours, rotation/translation, unavailable low entrance and source integration; backend parser regression added. 570/570 JS tests passed. Local Flask integration unverified due absent dependency. Live physics, browser and multiplayer not tested.

> **v0.2.130 addendum (1 November 2026):** Exploration Mode defaults to on via `js/edit-mode.js`, `initEditMode()` called in `js/main.js`. The Profile's accessible `#profileEditMode` switch controls `.solvi-edit-mode` on the root, persists per account in localStorage, and closes editing panels on disabling; `js/editor.js` suppresses inspector creation, wall-builder launch and transform handles when exploring. CSS hides editor toolbox/panels/buttons regardless of later changes to `hidden`; existing robot control, chat, physics and saved scene remain untouched. `js/control-switcher-drag.js` now supports dragging from unoccupied switcher surfaces with pointer capture, excluding portrait/actions; old drag button removed. `js/editor.js` adds persistent 32–84px portrait size `−/+` controls. Robot Rate/Pitch labels are nowrap. In `js/robots.js`, `robotHeadCameraPose` and `captureRobotView` use `Math.PI - yawOffset`, correcting the opposite-sign camera yaw that made stitched panoramas horizontally inconsistent with `js/robot-panorama.js`. Added source and executable synthetic six-camera stitching tests including 60° seams and 360° wrap. Moving-scene panorama seams, browser and WebXR require live verification.

> **v0.2.129 addendum (1 November 2026):** Automatic robot/avatar Push animation must represent actual facing and physical contact. `js/robot-contact.js` exports `PUSH_MAX_FACING_ANGLE=35`, `PUSH_MIN_HEIGHT_FRACTION=.5`, `facingPushContact` and `sizeableFrontalPushContact`, which compare the actor's yaw and intended movement against the nearest surface of an obstacle, reject objects at most half avatar height and objects entirely above/below the avatar. Normalized GLB avatars are approximately 1.75 m tall (scaled with avatar group Y scale). In `js/scene-physics.js`, `noteDynamicPush` additionally requires the matched Dynamic Rapier collider in `characterController.computedCollision()` from the just-computed movement; nearby AABB overlap or collisions against other objects are insufficient. It clears only automatically generated object Push when contact/facing no longer qualifies. The robot-on-robot capsule Push also requires a frontal approach, including verification of remote robot-impact packets. Explicit combat action Push, character movement, physics impulses, existing user-selectable Dynamic/Trimesh collision and fall animations remain intact. New `tests/robot-push-contact-129.test.mjs` covers these conditions with executable physics method harness and pure-geometry tests. Browser/WebXR/multiplayer must be verified after deploying; automated tests do not constitute live browser rendering.

> **v0.2.128 addendum (1 November 2026):** Removed the unrequested limitation restricting Trimesh colliders to Static bodies. `js/physics-options.js` preserves explicit Trimesh selections across Off, Dynamic, Static and Kinematic; `js/editor.js` does not disable/reset the collider selector and preserves it when making a body pushable; `js/scene-physics.js` now builds the chosen triangle mesh for Dynamic, Static, Kinematic, and remotely represented Dynamic bodies, with an error/triangle-budget fallback to a box. Complex wall/stair shapes use selected Trimesh rather than automatically overriding it with default segment colliders. Non-colliding portal FX are excluded from Trimesh generation, and authored cube openings preserve the current body mode in `js/spatial-editor.js` instead of forcibly changing it to Static. Backend scene validation now permits every existing body/collider combination. Five new runtime-path regression tests in `tests/dynamic-trimesh-128.test.mjs`; 546/546 Node tests passed. Flask HTTP integration, browser/Rapier, and remote multiplayer need production watcher checks. Note: this enables user choice; dynamic Trimesh is potentially computationally expensive or unstable for some geometry. No new collider shapes were added beyond the existing Box/Trimesh choices.

> **v0.2.127 addendum (1 November 2026):** All avatars share the same near-level jump/landing rule. The previous Rapier landing code scheduled `Landing` after every completed jump, including flat running jumps, and forcibly set `robotMode='idle'` at touchdown; the non-Rapier fallback also queued Landing and Idle. `js/animation-tuning.js` now provides `isLevelJumpLanding` (deliberate jump returning within 0.35m vertically and not an unrelated fall) and `jumpResumeMode` (per-avatar Run/Walk/Backward/Strafe/Idle from actual motion and the pre-jump gait). `js/robots.js` records `robotJumpReturnMode` at launch; `js/scene-physics.js` suppresses the gratuitous landing reaction for level jumps and restores movement without an Idle frame. Non-Rapier fallback does the same. Genuine ledge drops retain Landing/Hard Landing or the two-clip extreme impact chain. `tests/robot-level-jump-127.test.mjs` adds 5 regression tests; local `npm test` passed 541/541. Live multi-client and avatar-specific playback remain to be verified.

> **v0.2.126 addendum (1 November 2026):** Lift support increased from 12 to 40 floors in `stair-extensions.js`, `lift-sync.js`, `lift-panel-state.js`, `office-stairs.js`, `editor.js`, `index.html`, `backend/server.py` including the live authorized `lift-motion` WebSocket path. `lift.currentHeight` and motion `fromHeight` now permit 312 m, the top-floor elevation for 40 levels at 8 m. Existing short lifts remain unchanged. In-cabin floor selection automatically changes from a vertical strip to a 4-column, <=10-row tactile button bank above 12 floors; optional landing call controls remain independent and stationary. In physics fall handling, an extreme fall **strictly greater than 8 m** selects `fallingImpact` (actual Falling Flat Impact clip) then `standUp` (real Stand Up clip), but only if **both actual authored clip names** exist in the GLB. On lesser falls (>2.5 m), or when either extreme clip is missing, Hard Landing remains a complete one-shot and returns straight to Idle/locomotion. This is triggered on actual Rapier ground contact, never in midair. Severe combat recovery is unaffected. Browser/WebXR and dual-client integration still require live verification.

> **v0.2.125 addendum (1 November 2026):** Remove duplicate Stand Up following hard falls. In `js/scene-physics.js`, landing with fall height greater than 2.5 m still schedules the `hardLanding` one-shot (1.25 s nominal), but now with `next: null`. `js/robots.js` defensively ignores an older queued `standUp` follow-up for `reaction.clip==='hardLanding'`; the reaction clears and the robot resumes Idle or commanded locomotion. Severe combat (`dying` and other non-hardLanding reactions) retains separate Stand Up chaining. Normal `landing` (<=2.5 m), falling, jump physics and fall impact fallback aliases are unchanged. New executable animation lifecycle test covers direct completion and stale follow-up suppression. Full Node tests passed locally; actual browser animation and production deployment not yet verified.

> **v0.2.124 addendum (31 October 2026):** Portal inspector simplified from separate Frame W / H plus Door W / H to one Width and Height. Editing Width or Height calls `resizePortalAperture` in `js/portal-core.js` to alter both the opening and surrounding fixed-thickness frame, preserving saved legacy portal data until explicitly edited. Removed five non-functional colour pills and kept a single native colour selector. Replaced per-property sliders with one contextual `portalParameterRange` that controls the focused Width, Height, Depth, Delay or Opacity number input. Existing trigger, sound, shape/effect, transport, permissions, WebXR, backend portal schema and realm archives are unaffected. Regression tests cover the simplified inspector and dimension coupling; production visual verification is outstanding. Orb gates were further rebuilt as traversable event horizons: the former StandardMaterial opaque sphere and redundant rings are replaced by front-facing view-normal shader layers (transparent animated rim and centered vortex throat), with existing interior star particles. Orb visual meshes are excluded from Rapier compound collision, and the XR trigger tests a standing-body segment so an eye-height headset need not crouch. New geometry-runtime and XR trigger regressions run for all four effects. Browser/Quest 3 rendering remains unverified.

> **v0.2.123 reissue (31 October 2026):** Deployment watcher rejected the attempt to publish v0.2.121 because its local deployed-version record already said 0.2.121. The watcher reported GitHub and website unchanged. This new 0.2.123 archive is a version-safe reissue of the unchanged v0.2.121 portal restoration source, preserving corrected particle point-in-polygon sampling, transaction-safe rebuilds and visible fallback frames. Versions advanced in package.json, releases.json, index.html cache/import map, backend health and installer. ZIP and hashes regenerated without generated build files. The earlier rejected attempt is not evidence of the current live source; production requires watcher confirmation.

> **v0.2.121 hotfix (31 October 2026):** User reported existing paired gates disappeared after v0.2.120. Causal source defect: `js/portal-geometry.js` generated door particles with `shape.containsPoint(...)`, but `THREE.Shape` has no `containsPoint` API. It threw before construction finished; `rebuildPortal` had already cleared the original children, so portal geometry vanished and source-level test suite did not catch it. Fixed with an explicit polygon point-inclusion test, and changed `rebuildPortal` to construct in an offscreen group, swapping into the existing scene object only after success. On failure the old rendered gate and transport configuration are preserved; for brand-new gates a minimal solid-frame fallback remains visible. New executed geometry-construction smoke tests across 5 shapes × 4 FX × Entry/Exit and simulated failures. Scene save/load/portal link and v0.2.120 visuals preserved. A ZIP release alone does not recover scene objects if they were already deleted from the server; existing persisted pairs will re-render after this fix. Node tests are mocks rather than a live WebGL/GPU render, so perform live two-client/browser/XR verification.

> **v0.2.120 addendum (31 October 2026):** Portal visuals were substantially reworked after usability feedback. The old additive planes were replaced with stronger in-world treatments: a visibly animated rainbow border, more pronounced glow/pulse variants, and a shader-driven `mystery` / reality-pull interior intended to feel like the gate is pulling space inward. The portal inspector was also compressed to better match SOLVI’s other property UIs: filler explanatory text removed, compact two-column layout, slider-plus-number rows for dimensions and opacity, and curated colour swatches alongside the colour input. Paired Entry/Exit transport, trigger modes, persistence and archive compatibility remain unchanged. Source tests are green; browser/WebXR visual tuning still needs live verification.

> **v0.2.118 addendum (31 October 2026):** v0.2.117 passed the watcher ZIP/tests/connectivity phases but failed in Git publication because the ZIP manifest included generated `backend/__pycache__/realm_archives.cpython-313.pyc` (and other `.pyc` files). This is a packaging failure, not a portal runtime failure. v0.2.118 is a clean reissue of the same portal visual and shape functionality: all `.pyc/.pyo/__pycache__` entries removed from ZIP and hashes, browser import-map/cache/version strings advanced, and source/avatars preserved. Watcher must confirm live deployment; earlier v0.2.117 attempt did not change GitHub/website.

> **v0.2.117 addendum (31 October 2026):** Paired portals now support independent visual styles on Entry and Exit, including animated rainbow-border, mystery-glow, soft-glow and pulse effects, plus square, rounded, triangle, floor-field and orb portal shapes. The new options are compact portal inspector controls, persist through scene save/load and server validation, and preserve the existing automatic/button trigger, cooldown and WebXR transport behavior. Source tests validate the helpers and integration paths; actual visual tuning in browser/WebXR still requires live verification.

> **v0.2.116 addendum (31 October 2026):** WebXR headset standing on a moving walkway or escalator is carried by the actual tread displacement, including X/Z travel and stair elevation; spectators outside the treads are not moved Optional compact Start, Stop and Reverse controls at both walkway/escalator endpoints, with selectable left/right side positioning and mouse/WebXR controller-ray interaction Server-authorized conveyor-control WebSocket messages synchronize direction and running state, and a saved command timestamp prevents older scene snapshots from reversing newer controls Preserve the original robot rider, lifts, teleportation, and procedural-stair geometry; add tests for XR carrying, switch actions, state validation, and backwards compatibility Source tests validate the helpers and integration paths; actual Quest 3 tracking, two-browser motion and Flask deployment remain unverified.

> **v0.2.115 addendum (31 October 2026):** The v0.2.114 XR surface teleport ZIP was rejected by the Mac watcher because its local deployed.json already reported v0.2.114. v0.2.115 is a version-safe reissue of the same XR feature source. No runtime behaviour changed. Version metadata, backend health, Ubuntu install fallback and all browser import-map/CSS query strings now use v0.2.115. Verify deployment with a fresh watcher log; local watcher state alone is not public-site evidence.

> **v0.2.114 addendum (31 October 2026):** WebXR teleport raycasting previously only intersected `this.floor`, allowed very distant ground hits and used horizontal-only teleport offsets. Controller rays now intersect visible static/kinematic scene meshes and stair treads including user-created static/trimesh curves; nonwalkable solids occlude farther candidates, and contact normals are transformed into world space and oriented toward the ray for backface-safe landing. The first hit must be walkable, within the configured personal XR ray/head distance (default 5m; 2–20m in World Settings), inside the realm, not excessively below the current XR standing level. A ring appears at the actual hit point and follows surface slope. `xrStandingSurfaceY` tracks the standing elevation, including moving lift vertical deltas and portal travel, so headset tracking height is preserved when landing on elevated geometry. The XR per-user setting is localStorage-backed and does not alter realm settings. Source regression tests only; Quest 3 manual tests are still necessary.

> **v0.2.113 addendum (31 October 2026):** Moving walkway/escalator motion now uses tread geometric support instead of excluding all `physicsAirborne` robot frames. Local robot owners carry, publish `robot-motion: conveyor`, and prevent the character controller from overriding the supported rider; the server accepts the additional authorized motion mode, and remote clients interpolate rather than simulating their own unrelated conveyor displacement. Moving markers share a deterministic wall-clock phase. In WebXR, a headset physically inside a moving lift cabin now receives the same Y displacement through `shiftXRViewer`; free camera and non-XR paths are unchanged. Portal XR reference-space teleports use the paired exit portal world height plus the visitor's local entry height (`vertical:true`) rather than clamping Y to zero. Ordinary floor-ray teleport continues to preserve its prior Y handling. The source patches/tests do not prove the behaviour on real Quest 3 or a live multi-client session. New module: `js/transport-support.js`.

> **v0.2.112 addendum (31 October 2026):** Robot riders in moving lifts now have an explicit local, nonpersistent cabin attachment. The lift moves before character physics, carries the robot and Rapier body together, and the character controller suspends vertical gravity while the robot remains in the cabin footprint; walking out or actively jumping detaches. A remote lift-motion packet no longer teleports just the cabin before the rider-carrying tick. Stale remote robot elevation smoothing is skipped while attached. The earlier v0.2.111 code skipped lift carrying when physicsAirborne was true, causing falling on remote-controlled descent. JavaScript/source tests cover these paths; actual dual-client Rapier behaviour requires live verification.

> **v0.2.111 addendum (31 October 2026):** Fixed source-driven lift multiplayer desync: v0.2.110 saved animated lifts roughly every 1.1 seconds; remote scene patches reset the cabin transform but did not reconcile `stairRuntime.height`. Added `lift-sync.js` pure motion timeline with validated `lift.motion` checkpoint (`fromHeight,target,startedAt,speed,active`), server-authorized WebSocket `lift-motion` event and client event replay. The cabin, landing counter-translation, collisions and floor readout share runtime height. Scene patches retain current motion instead of snapping the cabin back. Legacy v0.2.110 lift checkpoints where saved currentHeight indicates an upper level but the cabin transform remains at its original base are reconstructed with a conservative base-height heuristic. Lifts persist at start/arrival/stop, not every 1100ms. Robots carried by the lift are predicted locally on each viewer; only the owning client broadcasts throttled robot lift pose and persists positions. External control switcher gets drag handle and per-tab position, 25%-larger portraits, stronger active highlight. Clicking a robot in 3D/Objects updates `controlledRobotId` and selects Robot Control. 498/498 JavaScript tests passed; Python AST, Nginx, archive and isolated lift-schema validation passed. Code and regression tests packaged; **live two-browser Rapier, Flask/WebSocket integration and deployed state remain unverified**.

> **v0.2.110 addendum (31 October 2026):** New `portal` scene kind, paired Entry/Exit created through Add → Portals → Paired portal. Source modules `js/portal-core.js`, `js/portal-geometry.js`, `js/portal-transport.js`, updates to editor/world/scene-physics/backend/archives, dedicated tests. Both portal halves are independent transformable scene objects linked by `portal.partner` editor IDs, with `role` entry/exit. `portal` data includes `mode` auto/button, `delay` 0..12, frame and aperture dimensions, color, opacity, procedural texture and sound. Real three-part doorway with per-slab collision; owned robots/scene objects teleport to exit and synchronize physics; optionally XR headset/free camera too. Per-client button activation, pulsing strip animation, WebAudio chime, cooldown to avoid loops. Import remaps portal pair IDs. Coplanar procedural stairs/roofs and wall overlays mitigated via small insets/polygon offsets. User reported z-fighting screenshot and requested teleport; browser, XR, Flask integration, multiuser concurrent transport still unverified. Never claim production deployment from the ZIP alone.

> **v0.2.110 addendum (31 October 2026):** New optional fixed landing call button on each floor of procedural lifts. `lift.callButtons` boolean (default false), `lift.callSide` enum left/right (default right), sanitized by `stair-extensions.js` and bounded/validated by backend server `valid_office_stairs` with legacy 5-key lift compatibility. When enabled, `office-stairs.js` attaches per-floor small red numbered call buttons to the `stairShaft` (counter-translated stationary landing group) beside the negative-Z entrance. Call state: red idle, orange requested, green arrived; update via `liftCallState` in `lift-panel-state.js`. `SceneEditor.hitLiftButton` now recursively collects controls so both mouse and WebXR rays find nested shaft buttons, then uses existing permission-checked `activateLiftButton`→`startLift`. UI new checkbox `stairLiftCallButtons` and side selector `stairLiftCallSide` inside Lift stops and cabin. 482/482 JavaScript source tests passed; live browser, XR, multiplayer and Flask test status must be confirmed independently.

> **v0.2.108 update (31 October 2026):** Lift cabin renders inside/outside numbered call-button columns, a live inner floor readout, green idle/red destination/orange passing states and low-volume Web Audio departure/arrival chimes. Mouse click and WebXR select both use SceneEditor.activateLiftButton + startLift, owner check, per-object save. No new serialized geometry fields; regenerated from existing lift levels/height and runtime. Sources: js/lift-panel-state.js (pure), js/lift-chimes.js, js/office-stairs.js, js/stair-transport.js, js/editor.js, js/world.js. Browser/XR and full Flask test remain pending.

> **v0.2.107 addendum (31 October 2026):** Emergency fix to the v0.2.106 stair lift transport crash: a plain `{x,y,z}` lift delta was passed to `transfer`, which attempted `.lengthSq()`. `js/transport-rider.js` validates and translates both plain and THREE vectors, synchronizes a robot body translation and its next kinematic target to avoid the controller overwriting lift motion, and moves the lift kinematic body along with the rendered cabin. Add `assets/ui-icons/square.svg` for a logged 404. Associate admin profile/Tripo password fields with forms and give legacy admin form an accessible username. Added `tests/stair-transport-107.test.mjs`. Full browser/Rapier, Flask integration and production deployment are not confirmed.

> **v0.2.107 addendum (31 October 2026):** Source expands Office Space menu with Stairs advanced / Escalator / Moving walkway / Lift. All are `kind: "stairs"` and use backward-compatible nested `stairs.variant`, `surface`, `rail`, `roof`, `supports`, `transport`, and `lift` data validated in Flask. New modules `js/stair-extensions.js` (geometry math/bounds), `js/stair-transport.js` (per-frame local transport), updated `js/office-stairs.js`, `js/office-stairs-math.js`, scene physics, editor, HTML and CSS. Advanced stairs add procedural posts/rods, ground supports and roof/tunnel panels. Escalators/walkways retain static tread collision and add bounded local surface velocity for owned grounded actors; indicators visibly move. Lift has moving kinematic cabin, anchored stationary landing frames at configurable levels, a Start/Stop action, and saved current height. Save/undo/archive continue under `stairs` field. Transport is a best-effort model; no physically moving tread chain. Real browser+Rapier interactions, inter-client authoritative movement, portal-floor clearance, XR and production performance remain unverified; Flask integration pending watcher. Tests use limited Node concurrency for memory safety. See README v0.2.107.

> **v0.2.105 addendum (31 October 2026):** Fix regression where Robot Control portrait selector was hidden outside control mode and arrow-key motion required the current Properties selection to be a robot. A persistent controlledRobotId now selects the robot for input and follow camera; the portrait row is visible above cameraFollowButton and selecting a portrait switches to Robot Control, clears stale key states, and selects the robot. No visible dropdown. Video recorder in chat and My Camera first opens preview and requires explicit Start; original camera track remains available when preview/recording is discarded. Audio/video chat uses a shared small custom player rather than native HTML media controls; no displayed WebM filename; small download/delete actions. Authenticated GET /api/media/<id>/info serves metadata without eager blob download. User starts on-demand HLS through GET /api/media/<id>/hls-access, browser-native HLS or local hls.js (npm dependency staged by prepare_vendor.mjs to /vendor/hls/hls.min.js), and authenticated direct media is a fallback only. Server DELETE /api/media/<id> enforces uploader/admin and protects scene, environment, bookmarks and profile use, detaching chat references. HLS is VOD, not live streaming or replacing original uploaded files; download uses the original file. Source tests are not browser live verification. **Full Flask integration, browser playback, encoder performance, Quest features and production deployment remain unverified.**

> **v0.2.104 addendum (31 October 2026):** Realm transitions: defer replacing the old scene until the next realm data arrives, reject stale responses and build objects in frame-sized batches World Settings: avoid redundant floor-texture reapplication, physics resets and scene-list rebuilds when no setting changed Chat: render the latest 180 entries initially, progressively load older history, yield frames during long timelines and retain full transcript exports Chat controls: center the downward navigation arrow and enlarge participant avatars by 50 percent Robot Control: replace the visible dropdown with selectable robot portrait/initial buttons above the controller My Camera: Record, Pause/Resume and Stop buttons reuse the active webcam video; recorded clips can be attached to chat, added to the scene or drawn onto a selected cube/plane as a media frame Virtual view capture: optional canvas captureStream recording with MediaRecorder on supported browsers, with a 15 fps capture target and conservative video bitrate; not guaranteed to include Quest passthrough. Browser renderer RESULT_CODE_HUNG reported during realm switching and opening World Settings: causal diagnosis is not established, but redundant environment and physics resets were removed, scene teardown and application were moved to cooperative 10-object frame batches with stale-load token, and chat render windows are capped with manual expansion. Important: the visible robot selector is now portraits but the original select remains hidden for compatibility. Webcam recorder can reuse a cloned video track from face preview, pause/resume, and place a clip on a cube/plane by setting `surfaceDirectMedia`. Virtual scene recorder uses canvas.captureStream(15) only if browser supports it; no guaranteed Quest passthrough or remote avatar capture; full on-device test is required. **Deployment unconfirmed; browser and Flask verification pending.**

> **v0.2.103 addendum (31 October 2026):** Media frames: choose realm chat attachments, camera-bookmark screenshots, uploaded media, live webcam photos or a recorded webcam clip Chat composer: show a live webcam preview during video recording and recorded video playback after stopping Procedural walls: convert individual wall segments to static editable cubes with true O-key cuttable openings and trimesh colliders New robot messages: progressive typing and a subtle bubble entrance animation (history and reduced-motion users unaffected) Compact chat audio play/seek/mute UI; signed expiring HLS VOD access for audio and video on native-HLS browsers; authenticated blob fallback elsewhere. Source package has not been deployed or verified live. HLS is FFmpeg-generated VOD, not a live webcam stream. Scene video uses native HLS with signed temporary URLs on browsers that support it, otherwise direct authenticated blob. Chat audio similarly. Production deployment watcher Flask tests and actual Safari/Chromium media authorization/playback require verification. Conversion splits office wall into per-segment static primitive cubes; meshes remain independently editable/cuttable, not combined CSG across corner seams. New modules: `js/surface-media-sources.js`, `js/compact-audio-player.js`, `js/robot-typing.js`.

> **v0.2.102 addendum (31 October 2026):** Capture O/U and freehand pointer drags on a full-view transparent drawing layer so SOLVI HUDs cannot intercept the gesture; keep the camera locked until the tool ends. Replace the large surface popup and unnecessary Confirm button with a passive compact instruction hint. Drag directly, release to preview, press Enter to keep, or Escape/click elsewhere to discard. Show a filled translucent rectangle and bright border during opening and media drags; show the real cut-through cube immediately on release before saving, with restoration on cancel. Ensure media frame stays visible after release until Enter opens realm chat attachments; add interaction tests for preview, commit and unsaved cancellation. This ZIP is not evidence of production deployment. A scene-level interaction test uses a mocked rendering engine; real Chromium/Flask smoke tests still need to run after watcher deployment.

> **v0.2.100 addendum (31 October 2026):** Replace click-by-click curve placement with continuous pointer-drag drawing projected onto a locked screen-facing, XZ floor, XY, or YZ plane. Orbit is disabled only while drawing. Add Fill end caps checkbox to extruded/beveled curves; persist and validate capEnds for saved and imported curves. Repair O cube openings: true through-hole geometry previews immediately after the drag, Enter / Confirm persists the cutout and exact static trimesh; Escape or canvas click restores the original mesh without saving. Repair U face media mounting: confirm frame rectangle before choosing authenticated realm chat media, and persist the mount with the first object save rather than in a later racing update. Add seven tiny deterministic procedural textures to World Settings floor: concrete, soil, tarmac, sand, tiles, gradient tiles, and random tiles. Respect floor colour and room-scoped environment save. Add regression tests for stroke projection and sampling, open curve caps, floor style normalization and geometry preview/media persistence. Release artifacts are source implementation and test results only, not confirmation of live deployment. Full watcher Flask integration and interactive dual-browser checks remain required.

> **v0.2.99 addendum (31 October 2026):** Objects selection highlights the current editor object. Curves store `curve:{points,offset,extrude,bevel,bevelResolution,resolution}` and are drawn in 3D via the curve sketch panel; existing curves remain editable. `KeyO` enters surface rectangle mode on editable cube faces and persists `openings` per object, generating through-hole meshes and exact static trimesh collisions. `KeyU` draws a media frame on a cube/plane, browsing authenticated current-realm chat attachments via `GET /api/media/room?room=...`; frames save `media.mount:{target,localPoint,localNormal,width,height}` and follow the target every frame. Archive import remaps mount target IDs after cloning metadata. New client modules: `js/curve-geometry.js`, `js/cube-openings.js`, `js/spatial-editor.js`. Validation in Flask `valid_curve_geometry`, `valid_cube_openings`, `valid_surface_mount`. Scope: cube openings only, not arbitrary GLB mesh CSG; the 3D curve sweep is a rounded profile, not Blender's complete bevel/taper stack. Full Flask/browser tests still need deployment watcher/live verification.

> **v0.2.98 addendum (31 October 2026):** The v0.2.97 chat attachment lazy-loading path referenced undeclared variables (`chatAttachmentObserver`, `chatAttachmentCache`) and the admin chat-clear request used an undefined `exact`; these are corrected in v0.2.98 with a server-provided clear timestamp and client filtering to avoid replaying pre-clear messages. Robot jump airtime captures launch horizontal velocity/heading and ignores mid-air steering until physics landing. Continuous walk auto-runs after 2 seconds. Chase Smart threshold moves to Robot Properties, and dragging the camera during chase switches to Orbit Follow. Avatar/Asset galleries have S/M/L cards and primitive inspector now uses one slider. An absent GLB animation action emits a once-per-model/action Brains diagnostic. All items require deployment/browser validation.

> **v0.2.97 addendum (31 October 2026):** Robot routines are now draggable with persisted position; Shift+Up/Down moves free camera only vertically; app-owned confirmation and exact-name dialogs replace blocking browser-native prompts for destructive and paid workflows; chat-clear now invalidates in-flight history/media callbacks and removes local debug and presence events so deleted messages do not reappear from stale responses. Source is tested but not confirmed live. Browser/Flask validation remains necessary.

> **v0.2.96 addendum (31 October 2026):** New Camera Chase Smart with angular threshold and smooth heading catch-up; draggable default-minimized World Tools; per-profile last-realm restoration and stale-scene-load guards; media blob request deduplication and viewport-lazy attachment loading; an admin-only full-room transcript export then exactly confirmed per-room chat flush (chat media/scene files retained). The screenshots showed a browser RESULT_CODE_HUNG and hundreds of blob requests, but live performance gains are not established without browser verification. The deployment watcher must run Flask tests before publishing.

# SOLVI.help — Master Project Handover for the Next LLM / Developer

**Document status:** Engineering handover prepared 31 October 2026.  
**Latest complete source prepared in this handover:** v0.2.103, **media sources, wall cutouts, animated chat, audio HLS VOD**.  
**Previous source baseline for v0.2.102:** v0.2.100, `SOLVI_RELEASE_v0.2.100_FREEHAND_CURVES_OPENINGS_FLOOR.zip` (production deployment remains unverified).  
**Production warning:** The latest **explicitly confirmed successful** deployment in the available conversation was **v0.2.79**, at 2026-10-30 12:40:09 UTC. Many later releases were prepared and tested, but **do not infer production deployment from an artifact link**. v0.2.93 explicitly failed backend tests and did not deploy. Request a fresh watcher log or `/api/health` result to establish the actual live version. A deployment ZIP is not deployment evidence.

> **Instruction to the next LLM:** This is an actively developed **real, multiuser, browser-based 3D application**, not a proposal or mockup. Continue from the **newest actual source release ZIP**, preserve all existing functions, deliver a **new complete release ZIP** through a verified sandbox download link, and describe which tests were truly executed. Do not tell the user to manually modify dozens of files for a code change that can be packaged. Do not repeat history questions already answered here. When a deployment error is provided, identify and repair the exact failure, not a generic unrelated symptom.

## 1. Product, purpose and experience

**SOLVI.help** (`https://solvi.help/`) is an immersive, collaboratively editable Three.js/WebXR world for people, robots and AI. Users enter named persistent **realms**, place/edit 3D objects and animated GLB avatars, communicate through shared chat and media, direct AI-driven robots with natural language, inspect robot camera views and navigation, and interact with rigid-body physics. Robots have persistent identities, configured personality/Brains, movement, speech and perception tools. Multiple browsers share presence, chat, scene state, robot motion and short actions through a Flask/SQLite/WebSocket backend. The application blends a 3D editor, social world, agent sandbox, architectural prototyping tools, and experimental embodied-AI platform.

### Product design priorities

- **Working browser UI beats descriptions.** When the user reports a defect with a screenshot or log, fix the feature and provide a new tested package; avoid repeated theory, unnecessary confirmation, or claiming it is probably only a cache issue when deployment is proven.
- **Keep interaction compact.** Properties and Settings already use a small contextual control with values and **one shared slider**. Avoid giant panels, redundant descriptions, clipped selects, duplicated icons, overcrowded labels, off-screen windows, and hidden essential actions. Floating tool windows should be draggable; mobile responsive layouts matter.
- **Scene precision and physical truth.** Camera-relative placement should be directly ahead of the camera. Navigation must collision-check the actual path and distinguish arrival, safe near-arrival and failure. Never narrate a robot action as completed if transforms did not demonstrate it.
- **Robot animations correspond to the robot's own actual motion.** Another idle robot must not start Running merely because a controlled robot moves. Walk/Run should loop smoothly without tripping, clip resets or sliding. Pushed robots animate based on *their measured displacement* only. Jump remains active through physical ascent/flight until landing; falling and landing reactions depend on fall height. Punch/Kick impulses occur at strike contact and should affect only genuinely colliding, physics-eligible targets.
- **Multiuser reliability matters.** Events and lightweight state prediction/interpolation rather than repeated whole-scene GLB reloads; per-object authoritative updates and owner/permission checks. Scene edits and physics should be observable and truthful from a second connected browser.
- **No silent data loss.** Realm archives must validate every referenced file, report missing assets, and round-trip bytes. Avatar deletion should delete the file on the server, with any referencing robots preserved and reassigned to the protected default model. Protected avatars cannot be deleted.
- **Never expose secrets.** Meta/ElevenLabs/Tripo keys and the administrator password are separate from profile information. Admin authorization must be server-verified, not just a front-end boolean.

## 2. User and collaboration expectations

The user works iteratively, usually requests one release for a batch of changes, and **deploys by dropping a watcher-compatible ZIP into a local Mac `updates/` directory**. The watcher checks hashes/versions, builds assets, runs JS and Flask tests, publishes GitHub main, then deploys Ubuntu. The user shares screenshots, chat logs and deployment logs; use them as primary evidence. Communication should be concise, precise, technical and without self-congratulatory language or repeated assertions that unverified functionality “definitely works.” Do not include unnecessary personal commentary or first-person roleplay. Distinguish **source implemented**, **tests passing**, **deployed**, and **verified live**.

The user has repeatedly been frustrated by regressions: walking animation degraded across several combat/physics releases, robot actions were not visible remotely, Realm imports silently dropped models, Gallery deletion merely hid bundled avatars, and repeated duplicate controls obstructed scenes. **New features must not override, disable, or regress older controls.** Work from the current complete package, not from an earlier baseline.

## 3. Tech stack and source layout

- Frontend: plain ES modules, **Three.js 0.180.0**, GLTF/DRACO/FBX loading, WebXR, HTML/CSS, scene editor, optional voice/video capture. Runs in standard browsers; backend serves static assets too.
- Physics: **`@dimforge/rapier3d-compat` 0.21.0**, dynamic/static/kinematic bodies, static trimeshes, character capsules, robot locomotion/ground checks, object impulses and collision filtering.
- Backend: Python **Flask**, **SQLite**, authenticated API, a WebSocket presence/event loop, optional external AI/STT/TTS. Production Gunicorn `gthread` behind Nginx HTTPS/WebSocket proxy and systemd on Ubuntu.
- Tests: Node's native `node --test tests/*.test.mjs`, Python `backend/test_api.py` (requires Flask), `backend/test_realm_archives.py`, `backend/test_nginx.py`. The watcher also checks source and build outputs.
- Build: `package.json`, `npm run vendor`/`scripts/prepare_vendor.mjs`, `scripts/rapier-vendor.mjs`, `scripts/check_browser_modules.mjs`. Third-party vendor files may be generated on the watcher; do **not** assume they belong in the release ZIP. Application module import maps carry a release-specific `?v=` query for cache busting.

**Important source tree within each ZIP:**

```text
manifest.json                     # ZIP root, exact version and per-app-file SHA-256
app/
  index.html                      # UI markup, modal/drawer elements, module import map
  styles.css                      # CSS conventions, overrides and responsive layouts
  package.json                    # app and dependency versions, npm test/vendor scripts
  releases.json                   # currentVersion and release history
  README.md                       # running release notes and usage details
  docs/LLM_HANDOVER.md            # this document (in v0.2.95+)
  js/
    main.js, studio.js            # app composition, profile/auth, chat, settings, UI wiring
    world.js, editor.js           # renderer, camera, editor, object tools, transforms, saving
    scene-physics.js              # Rapier bodies and colliders
    character-physics.js          # capsule movement, gravity, ground support and jump
    robots.js, animations.js      # avatar model and mixer/clip lifecycle
    animation-tuning.js           # walk/run/jump author-speed controls, smoothing
    robot-contact.js, robot-push.js, robot-combat.js
    robot-net.js                  # multiplayer movement and interpolation
    robot-pathfinding.js, robot-path-visuals.js
    robot-brains.js, robot-observation.js, robot-panorama.js
    robot-speech.js, voice-captions.js, robot-routines.js
    chat-render.js, chat-timeline.js, chat-mentions.js, chat-attachments.js
    avatar-gallery.js, asset-gallery.js, library-management.js
    realm-gallery.js, camera-bookmarks.js
    office-walls.js, office-wall-math.js
    office-stairs.js, office-stairs-math.js
    scene-media.js, scene-models.js, media-drop-dialog.js
    primitive-properties.js, transform-values.js, transform-lock.js
    settings-extended.js, preferences.js, ui-controls.js
    preview-renderer.js, thumbnail-cache.js, minimap.js
    face-tracking.js, hand-gestures.js, xr-navigation.js
  backend/
    server.py                     # Flask/SQLite/REST/WS, auth, validation and room state
    realm_archives.py             # archive validation/export/import helper
    prune_removed_avatars.py      # persistent bundled-avatar deletion across deployments
    install-ubuntu.sh             # service installation, local health, nginx, rollback
    configure-nginx.py
    hash_admin_password.py
    requirements.txt, requirements-stt.txt
    test_api.py, test_realm_archives.py, test_nginx.py
  assets/                         # image, icons, local GLB avatars, bundled models
  tests/                          # extensive JS functional and source regression tests
```

**Inspect the actual latest ZIP before editing:** file names and implementation evolve. This map describes v0.2.94/v0.2.95 source; do not assume particular functions continue unchanged in future versions.

## 4. User profiles, access and administrator workflow

### Normal profiles

User identity is created/claimed through **Profile → Save / Sign in**, with name required and optional email, bio, links and chat bubble colour. Profiles can include photo, 3D avatar headshot and a 15s intro GIF. A user ID, recovery token and tab-scoped auth are used with SQLite. Profile import/export can contain a **sensitive recovery key**; never print it in public diagnostics. User profile login and admin authorization are distinct: being signed in as the site's creator is **not automatically administrative**.

### Administrator, requested in this conversation

**v0.2.95 change:** Move administrator sign-in into the **Profile drawer** under **Administrator access** with password input, Unlock, active status, Dashboard and Lock Admin. Once unlocked, the same **in-memory, approximately 30-minute server-issued admin token** is automatically supplied on all `window.solviAPI.req('/api/...')` requests via `X-Solvi-Admin`. The Profile badge signals the current admin state; Lock Admin revokes the server session through `POST /api/admin/logout` while leaving the ordinary user logged in. Avatar Gallery no longer has its own duplicate password prompt; it can direct a user to Profile. The session is **tab-local and is not written into `localStorage` or exported profiles**, and must be unlocked again after refresh/expiry/logout. When the room WebSocket is connected, admin changes are signaled by a compact `admin-auth` message; the server verifies the session token in SQLite for each protected robot event rather than trusting a client role flag. Room and library controls can refresh when admin status changes.

Existing server authentication: `POST /api/admin/login` requires **both** a valid normal user bearer token and a separate admin password. The server verifies `SOLVI_ADMIN_PASSWORD_HASH` using salted PBKDF2-SHA256 and stores only the hash of a temporary session token in SQLite `admin_sessions`. Failed login has a bounded retry limit. Admin rights permit server operations that already check `admin_authorized()`, including bundled-avatar deletion, management of other people's uploaded libraries, realm ownership overrides, AI server configuration, and diagnostic viewing. This handover also adds server-side `may_edit` admin override for HTTP object edits, with client editor permissions updated to match; WS robot events consult the short-lived admin session only after the regular user joins and authenticates. **Do not equate normal authentication with admin authentication or bypass checks by trusting client flags.** Additional privileged WS message types must receive the same explicit verification.

On the Ubuntu installation, the installer generates a one-time random initial admin password if none was configured. The secret file is root-only at **`/etc/solvi-help-admin-initial.txt`**; the password hash is in `/etc/solvi-help.env`. Never embed either secret in code, ZIP, README, logs, chat or the handover. Password recovery/reset must be explicit, reversible and not delete realm/profile data.

**Admin operations should be globally available across the application** after Profile unlock, not require re-entering the password inside Avatar Edit or Settings. However privileged actions should still prompt for confirmation (for example permanent deletion), and individual API endpoints must enforce authorization on the server. The UI should communicate owner-only versus administrator-only actions and concrete failure reasons.

## 5. Realms and scene data

Realms are named persistent rooms with owner, access policy (open/owned for objects/robots), environment and a JSON scene array stored in SQLite. Main realm is protected against deletion. Gallery cards show screenshots and participant counts; one selection toolbar offers Export, Clone, Rename and protected Delete. Do not reintroduce individual repeated Rename/Delete controls below every realm. A clone creates `Realm copy (1)` or another unique suffix, keeping scene/environment settings and **referencing immutable existing server assets**. A user can still create empty realms.

The editor supports cube, sphere, cylinder, plane, torus and their geometry-specific dimensions/segments; curves/surfaces/text/points; lights; GLB/FBX models; robots; image/video/audio media, and procedural office walls/stairs. Transform includes XYZ position, rotation and scale, linked/uniform scaling, one shared contextual slider and per-object locks. Changes should persist as atomic object operations to avoid overwriting another user's edits. `PUT /api/scene` has revision checks, while `POST /api/scene/object` provides per-object updates. A stale revision must report a conflict, not claim “Saved.” Scene changes should not recreate animated models unnecessarily.

### Realm archive requirements

The gallery supports **Entire realm + assets (`.tar.gz`)**, **JSON without assets** (intentional placeholder primitives), **assets only (`.tar.gz`)**, importing a full realm, and importing assets into a selected realm. Full export must include every server asset actually referenced by the scene (uploaded GLB/FBX, avatars, media, custom speaker models, wall texture media, portraits as supported). Validate the inventory and actual file bytes **before reporting success**. Full import remaps old upload IDs and URLs to new server IDs. It must fail with actionable missing/invalid asset data rather than silently replacing an imported model with a cube. Export/import are not a full account, chat, or billing backup. `backend/realm_archives.py`, `backend/server.py` archive endpoints and `backend/test_realm_archives.py` are the main files.

**Previous failure:** v0.2.74/0.2.75 failed Ubuntu startup with `ModuleNotFoundError: realm_archives` because the installer omitted this helper. Never add a local Python import without ensuring `install-ubuntu.sh` installs and backs up/restores the helper and preflight-imports it before restarting Gunicorn.

### Bundled avatar deletion

Bundled GLBs have server catalog entries, uploads are in SQLite-backed storage, and the default `./assets/solvi-character.glb` is **indelible**. Delete is **real permanent server removal** by owner/admin, **not browser-local “Hide”**. The server records tombstones, so a later release must not re-add permanently deleted bundled avatars. When deleting an avatar referenced by robots in one or several realms, **preserve robot ID, name, owner, position, rotation, Brains, animation configuration and other properties**, changing only the avatar URL to the protected default. Increment scene revisions and publish updates to connected clients. Keep server-side model-asset reference guards, and do not apply the avatar fallback policy to ordinary scene models or media. Uploaded profile avatar references also deserve regression coverage.

## 6. Procedural 3D editor and UX conventions

**Add Object → Office Space → Walls** follows Torus in the menu. Draw a wall by single straight segment, multiline points or drag/freehand. Show a floor cursor, snapped starting point and live cyan wireframe as the pointer moves; optionally show the material behind the wireframe. Configurable grid steps and angular snap increments such as 15°/45°, an adjustable default 2.5 m ceiling guide and 1.7 m human reference assist scale. Width/thickness, height, opacity, colour, textures (plaster/concrete/brick/glass or uploaded texture) and physics (static/dynamic/kinematic) must remain editable after save. **Never create a second wall mesh under an edited wall**: edit one live object and Save commits, Cancel reverts. Undo/redo uses Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z during drawing/editing.

Also supported: polygon/closed-room drawing, procedural stairs following a line, multiline or freehand path, solid or floating stairs, step count or consistent tread/riser dimensions (mm). Collider volumes must match actual segments/steps, not a giant bounding-box fill: an L-shaped wall's empty interior must remain traversable, and a floating stair should leave open space below higher treads. Changes to geometry, material and physics should show live, persist and correctly restore after reload. Keep the editor panel compact, draggable, fully scrollable on mobile, with **one active shared slider**, not numerous redundant sliders or distracting text.

## 7. Robots, AI and multiuser physical behaviour

### Robot identities and Brains

Each robot is a persistent scene object with its own name, owner, avatar URL, transform, movement speed, strafe/turn speed, independent Walk/Run/Jump clip multipliers, configurable animations/combat controls, physics capsule, voice preferences, and Brains fields (personality/history/beliefs/triggers/scenario/initiative). Robots may be controlled locally, addressed through chat, sent on path-planned missions, asked for first-person camera views, or configured for optional bounded recurring observe/follow/discuss routines.

Chat supports `@Elox`, multiple robot mentions, `@All` (bounded recipients and turns), quoted discussion and generated replies. Directed multi-robot clauses must remain independent: `@Elox go to sofa and @Cybert follow Elox` must not cause Elox to follow Cybert. Treat generated dialogue separately from actual movement success. Robot research/discussion can use source metadata from PubMed/Wikipedia when available, but must explicitly admit when live research cannot be verified, never invent citations. Brain debug traces and route overlays are distinct display choices. Normal chat and debug bubbles should share one **chronological** timeline, not append old traces after newer messages.

### Perception, media and XR

Robot Eyes captures *actual rendered camera frames* and supports panoramic `@Name /eyes 180` and `@Name /eyes 360` shared into chat. For 360°, several overlapping directions are stitched; chat should normally show the stitched panorama and collapse source frames. The robot-camera far plane must render the nebula/stars sky dome as the main camera does. Media scene supports 3D audio orbs/speakers, video surfaces, author/date metadata, uploaded colours/textures, positional audio, loop/spatial controls and CC/transcription via server-side Whisper where configured. WebXR ray selection should play/pause/mute/toggle captions and support teleport/media interaction. Media capture and Whisper status depend on server/browser capabilities and should not be falsely guaranteed.

### Navigation and movement

Actual path planning (A*) and collision checking must consider all real obstacles, robots, wall segments and multiple target approaches. An object blocked on one side may be safely approachable from another side; short safe approaches should be reported as *partial* rather than “arrived.” Cybert reaching the red sphere while Elox/Jessica refuse is a known test scene: inspect starting positions, occupied cells, final segment collision and local motion, not generic AI explanations. Robots should avoid obstacle penetration, not accept a user command to ignore collision.

Robot animation mixer has had severe regressions from v0.2.83–0.2.90:

- **Walking:** gait loop should run from the actual avatar's authored Walking clip with no repeated first-stride reset, stutter, limping, slow-motion or unexplained sprint. Use motion hysteresis to tolerate brief frame stalls; tune speed separately from physical travel velocity.
- **Running:** use a real Running animation, not sliding. Movement of robot A must never start Running on stationary robot B.
- **Pushing:** Push is for contact with **movable dynamic objects or another physically displaced robot**, not stairs/static trimeshes. A displaced robot can play temporary walk/backstep/sidestep based on its own displacement and return to Idle when motion stops. Do not trigger reaction based only on proximity.
- **Jump:** space/command launches a physical capsule jump. Jumping-in-place should select `Jumping` if available, moving jump `Jump`, with fallback names if absent. Keep airborne state and animation through ascent and flight until physical landing; do not override with walking mid-flight. Stair stepping and real jumps are not the same.
- **Falling:** use `Falling`/`Falling Idle` and available `Landing`, `Hard Landing`, `Falling Flat Impact`, `Stand Up`/other authored fallbacks according to actual fall height. Leaving an elevated static trimesh must trigger gravity.
- **Combat:** P Punch, K Kick, T Throw with configurable per-robot key and force; match variant clip names such as Hook Punch, Combat Punch, MMA Kick. Apply physics impulse at actual strike phase, near collision surface, only to pushable dynamic bodies or legitimate robot capsule contacts, and emit compact victim hit/reaction events. Do not apply physics impulses after the animation has finished. No direct user-controlled movement should animate an unrelated robot.
- **Multiplayer:** short `robot-input`, `robot-motion`, `robot-action`, `robot-impact` and `physics-state` WebSocket messages, input/pose smoothing and remote prediction so connected users see WALKING avatars rather than ghosts teleporting. Never solve this by reloading models or replacing AnimationMixer every scene refresh. Multi-browser manual verification is essential: many Node tests only examine source state.

**Important:** An avatar may not have clips literally named `Jumping`, `Head Hit`, `Hard Landing`, etc. Query `GLTFLoader.animations` (and the model's actual duration/track properties), choose semantically appropriate fallbacks, and avoid claiming unavailable clips are guaranteed. Avatar library shows counts where metadata can be read.

## 8. Libraries, export, deletion and cache stability

**Avatar Library**: search, image/3D portrait previews, per-avatar GLB action counts, Edit mode with top-right checkbox on each card, Select all, bulk ZIP export and permanently Delete selected with clear confirmation. Deleting a bundled model requires profile-unlocked administrator privileges; deleting uploaded models requires uploader/admin. Provide per-item success and failure reasons. Show disabled protected fallback. Gallery thumbnails should not receive generic decoration icons on top of images. Asset Library uses matching edit/export/delete plus responsive **12 cards per page**, stable portrait dimensions, long filename truncation and no overlap; `Refresh`, Prev/Next. Assets may have `No preview` if GLB processing fails; report it clearly.

The frontend and backend are **cache-sensitive**. v0.2.80 introduced versioned first-party JS module URLs in the `index.html` import map, with stylesheet cache-busting. Every release must update them consistently, otherwise an old editor script can hide features even after successful full-stack deployment. Do not use cache problems as a guess where evidence shows a failed source feature.

## 9. Backend API contracts and security

See `backend/server.py` for exact routes and payload validation. Principal groups:

- Health `/api/health`; profiles `/api/onboard`, `/api/me`, `/api/profile`, `/api/logout`.
- Admin `/api/admin/login`, `/api/admin/stats`, **new** `/api/admin/logout` (in v0.2.95), AI key configuration and diagnostics.
- Realms `/api/rooms`, `/api/rooms/<id>` for create/list/rename/delete, room clone, `/api/realms/<id>/export`, `/api/realms/import`, environment and policies.
- Scenes `/api/scene`, `/api/scene/object`; asset and avatar listings/uploads/read, `/api/library/export`, `/api/library/delete`.
- Chat `/api/messages`, message send, robot routes, visual and AI methods, per-robot logs/usage, media and caption endpoints.
- WebSocket authentication, presence, compact robot input/motion/impact/action/physics snapshots and scene revision notifications.

Server must validate: auth bearer token and X-Solvi-Tab, user/owner, admin token, room policy, object kind/geometry limits, path and ZIP traversal, file signatures, sizes, media access, model refs, physics modes, scene revision and collision values. **Do not relax backend validation merely to make a failing test green.** Use transaction semantics for avatar replacement/deletion and archive import, with cleanup on failure and visible errors. An HTTP 409 (e.g. archive reference conflict) is not necessarily an expired user session; only react to specific session-conflict errors.

### External services

Meta Muse/SAM model calls, ElevenLabs voice, Tripo3D account credentials, optional Whisper STT on Ubuntu. Integration availability and endpoints can change; verify current official API documentation before changing provider URLs. Do not promise account credit balances if the provider exposes no read-only balance endpoint. Model usage costs are estimates, not invoice receipts. Never include keys/passwords in rendered HTML, logs, exports or test fixtures.

## 10. Release engineering — mandatory process

**Baseline is always the highest complete release archive, not only the most recently mentioned patch.** The Mac watcher rejects releases whose semver is not **strictly newer than deployed version**. The user relies on a **real downloadable ZIP**. To prepare a release:

1. Locate and inspect the newest valid `SOLVI_RELEASE_vX.Y.Z_*.zip`; extract to an isolated source tree. Preserve bundled user avatars, original binary assets and existing features.
2. Identify the exact faulty code path and reproduce with a focused test; make minimal changes and add tests for reported behaviour, access restrictions and consequences.
3. Update app-wide version consistently: `package.json`, `releases.json` (currentVersion and release entry), `index.html` visible version, stylesheet version, `main.js` and **every first-party import-map JS version**, `backend/server.py` health version, `backend/install-ubuntu.sh` expected version, and `README.md`. Verify no stale URLs.
4. Run `node --check` for all edited JS, `npm test`, Python AST checks, `backend/test_nginx.py`, `backend/test_realm_archives.py`, `bash -n backend/install-ubuntu.sh`. If Flask is installed, also run `backend/test_api.py` in a **temporary state directory**. If Flask is missing, say that honestly; the watcher will run the real integration test.
5. Package **exactly** a root `manifest.json` and `app/<relative-path>` files. Manifest `version` must match all metadata and `sha256` must contain the checksum of **every** `app/` file. No `.pyc`, `__pycache__`, `.DS_Store`, hidden generated files, duplicate ZIP entries, `node_modules`, `.git`, logs or generated vendor bundles. Preserve required original local GLBs byte-for-byte.
6. Run the local watcher `verify_zip` equivalent or perform the identical structural/hash checks. Confirm file exists at the sandbox path before providing a clickable `[Download ...](sandbox:/mnt/data/...)` link. The user has encountered broken sandbox links: use an **actually created and verified path** rather than inventing or copying a stale filename.
7. Describe only tests actually executed; do not say “deployed” until the user's watcher log confirms `LIVE! vX.Y.Z FULL-STACK DEPLOYED` and public API verification.
8. If the watcher fails, inspect the **detailed log**, find its first meaningful `Traceback`, `INSTALL ERROR`, `ModuleNotFoundError` or assertion, fix that specific issue, and generate a newer compatible release. Preserve rollback safety. If the watcher rejects a reused version, the answer is to use a strictly higher version, not repeat the same ZIP.

Watcher's general phases: **1/5 ZIP manifest, hashes and version → 2/5 assets and JS + Flask integration tests → 3/5 access → 4/5 GitHub main → 5/5 Ubuntu/Gunicorn/Nginx plus public HTTPS health**. GitHub updated but Ubuntu failed means site is **not confirmed deployed** and rollback may have occurred. Public app: `https://solvi.help/`; health: `https://solvi.help/api/health`.

### Critical deployment failures to remember

- **v0.2.72:** an early ZIP contained Python bytecode, which broke GitHub stage; reissued clean ZIP fixed it.
- **v0.2.74/v0.2.75:** Gunicorn worker failed with `ModuleNotFoundError: realm_archives` because `backend/install-ubuntu.sh` had not deployed that new helper. Fixed later with installer copy, rollback and import preflight. The console initially looked like a generic health failure; detailed log exposed the real cause.
- **v0.2.77:** `backend/test_api.py` had a brittle parser trace position assertion (`trace[1]`) that failed after a legitimate trace insertion. Prefer lookup by named step with correct semantics.
- **v0.2.83:** a Flask decorator was mistakenly applied to `valid_robot_combat(settings)` instead of `/api/scene/object` handler, producing `TypeError ... missing settings` during Flask tests. Check handler registration, not only AST/syntax.
- **v0.2.93:** fallback avatar deletion correctly bumped Main realm revision but an older test required `revision==0`. v0.2.94 changed it to assert non-interference when saving another realm. **Do not fix by suppressing revision increments.**
- **v0.2.79:** confirmed live at 2026-10-30 12:40:09 UTC. The Add Object menu still showed older code to one browser, prompting proper import-map versioning in v0.2.80.
- **v0.2.90+ libraries:** hiding a bundled avatar in localStorage is *not* permanent server deletion. Owner/admin checks, tombstones, profile/realm fallback and unambiguous status must work.

## 11. Recent release lineage (orientation, not deployment evidence)

| Version(s) | Main development | Key caution |
|---|---|---|
| 0.2.57–0.2.61 | Robot movement/speech, physics, profile, chat @All, multiple robots | Dialogue does not prove action |
| 0.2.62–0.2.72 | 3D media, Chat-to-scene, debug path, autonomy, research turns, audio speaker/orb | ZIP cleanliness, backend mock sync |
| 0.2.73 | Settings/keys/theme presets, bookmarks, recording, routines | Server/local auth and cost safeguards |
| 0.2.74–0.2.78 | Panoramas, realm archives, geometry, robot routing, background camera and timeline | `realm_archives` install; parser test |
| 0.2.79–0.2.82 | Robot pushing, office walls, cache versions, wireframe/snap/edit/stairs | Panel UX and collision footprints |
| 0.2.83–0.2.89 | Combat impulses, jump/fall animation, multiplayer, gait tuning, uniform scale | Major animation regressions, verify live |
| 0.2.90–0.2.92 | Avatar/Asset bulk management, server deletion, realm clone/archive repair | Ownership, silent import loss and bad cards |
| 0.2.93–0.2.94 | Deleting used avatars preserves realm robots and substitutes default; integration test repair | Scene revision must increment |
| **0.2.95** | **Profile-based global Admin unlock, lock/revoke and consistent API admin token** | **Code packaged, deployment unconfirmed; run watcher** |

## 12. Known limitations and practical next priorities

1. **Live gait and combat quality:** The user still reports tripping, non-native walking and imperfect impacts after multiple releases. Prioritize real dual-browser live repro, clip inspection and deterministic per-robot mixer state before more speed tweaks. Confirm dynamic-object impacts and victim reactions occur at actual contact, not remote ghost movement.
2. **Profile/Admin UI:** Confirm v0.2.95 Profile unlock, lock, status, token expiry, owning a model/realm as admin, and no duplicated passwords in galleries. Test backend session revocation; do not persist admin token in localStorage. Confirm admin operations on API routes and short-lived WebSocket robot-event authorization, including revocation and expiry.
3. **Avatar/Asset libraries:** Verify deletion of unused and in-use avatars, multi-realm fallback, catalog cleanup, redeploy tombstones, owner/admin error reasons, 12-card pagination, mobile responsive layout, and no visual overlaps.
4. **Realm archives:** Test real full export → import of a richly populated realm, including several uploaded GLBs, media, speakers, wall textures, avatars and environment. Confirm every reference and object count; damaged archives must be refused *before* importing partial data.
5. **Procedural Office Space:** Test undo/redo, snap, ceiling/human guide, custom texture persistence, existing-wall edits, closed shapes and floating stairs in the browser; check collision/robot traversal.
6. **WebXR/audio/Whisper:** Headset operation, CC selection, spatial audio, and provider API status can only be assessed live in appropriate browsers/server configurations.
7. **Server Flask tests:** Availability may vary in this assistant's container, so avoid “all backend tests passed” without actually executing them. Watcher output is decisive, including deployment health and rollback.

## 13. How the next LLM should begin

1. **Read this entire handover** and list the files actually mounted in the current conversation. If a ZIP is supplied, inspect its version/manifest and unpack it; otherwise locate the newest verified local release. Never assume archived sandbox paths remain available in a different LLM session; the user may need to reupload the latest ZIP. Do not fabricate paths or links.
2. Identify latest **verified live** version from a deployment log or `/api/health` result, then pick a new higher version. Preserve all current features, data formats, permission rules and user avatars.
3. Read the user's latest screenshots and logs first, locate exact source paths, implement a focused patch with relevant tests, then run broader regression and Python checks.
4. If a library asset/model is shared, treat deletion, object references and future deployments as database lifecycle changes. Do not pretend a frontend hide is deletion.
5. Package a **complete standalone ZIP** with root `manifest.json`, updated hashes, versioned browser import map and no Python caches. Verify the file before offering a **clickable sandbox link**.
6. Tell the user clearly what changed, test counts, what could not be tested, and whether production was actually deployed. Avoid repetitive directions or asking the user to restate this project's history.

### Ready-to-paste starter instruction for a future conversation

> Continue work on **SOLVI.help** from the attached latest release ZIP and this `LLM_HANDOVER.md`. This is an existing Three.js/Rapier/WebXR + Flask/SQLite/WebSocket multiuser 3D world. User-visible changes must be implemented in code, tested, and delivered as a new watcher-compatible, manifest-hashed `SOLVI_RELEASE_vX.Y.Z_...zip` link. Keep backward compatibility, preserve all assets and existing features, avoid silent data loss, distinguish source/tests from production deployment, and use the Mac watcher log as the authoritative deployment result. Prioritize precise interaction, reliable avatar animation/physics, permission-enforced server operations, compact UI, complete realm archives and robust multiplayer. Refer to the handover for history, source modules, versioning, failures and operational requirements. Do not ask the user to repeat project context.

---

**This document contains no user secrets, access tokens or administrator password.** It should be included with every future release and updated when an architectural decision, important failure, or operating procedure changes.


## v0.2.102 addendum
The latest source uses text-parameters.js and text-geometry.js for local persistent text controls, using three bundled typeface JSON fonts copied to vendor/three/fonts by prepare_vendor.mjs. Text has a canvas fallback until the font geometry loads. Scene object text property is server validated. World frame now blocks orbit, navigate and follow updates while a spatial sketch is active. Cube picking uses local ray-vs-primitive box instead of relying on mesh triangles, preserving selection of cut faces. Live browser interaction remains to be confirmed.


## v0.2.169 — Seat alignment and movable furniture riders

- Centre avatars on office-chair and single-seat cushions instead of using their approach-side X coordinate or armrest footprint.
- Allocate distinct seating slots on multi-seat sofas; prevent a second avatar occupying the same chair or sofa slot.
- Add a saved furniture seating behaviour selector: Stand occupants up (non-stickable) or Carry seated occupants (stickable).
- Keep multiple seated avatars anchored to a moving, rotating or dynamically pushed furniture object with local seat transforms and immediate local Rapier pose reconciliation.
- Stand occupants automatically when non-stickable furniture moves, or when furniture is deleted, rather than leaving avatars sitting in the air.
- Persist and validate robot seating anchors in shared scenes, support loading/replaying them in remote clients, and remap seat target IDs through realm archive imports.
- Add six regression tests for furniture-follow, non-stickable release, multi-avatar anchors, centre seating, schema validation and persistence.

Implementation points: `js/robot-seating.js` owns seat-local anchors and physics syncing; `js/editor.js` persists robot seating metadata and follows occupied furniture in the tick loop; `js/primitive-properties.js` saves `seatMoveMode`; `backend/server.py` validates robot `seating` and furniture mode; `backend/realm_archives.py` remaps persistent target references. The default behaviour is **Stand occupants up**; choose **Carry seated occupants** in furniture Properties to attach occupants to transformations.


## v0.2.170 — Stable per-field number range sliders

- Give every numeric furniture and vegetation inspector parameter its own always-visible compact range slider directly beneath the corresponding number input, including orchard/forest scatter, soil, terrain and water parameters.
- Keep the three-column inspector grid stable: all companion range controls are present from render time and do not insert, remove, resize or reflow other fields on focus.
- Synchronise range dragging and typed numeric values in both directions through the existing debounced geometry preview, undo history, physics update and multiplayer save pipeline.
- Preserve the existing floating contextual slider for transform position/rotation/scale, while avoiding redundant popovers over furniture controls.
- Add regression checks for slider creation, numeric bounds, change propagation and consistent non-reflow layout.

Modified: `js/editor.js`, `styles.css`, test `tests/release-170-furniture-ranges.test.mjs`; deployed via strict manifest-hashed full-app ZIP. Browser rendering remains unverified.


## v0.2.171 — Single full-width contextual slider, layout and Transform corrections

- Restore exactly one shared, full-width contextual range slider below the active furniture, vegetation, or Transform XYZ row; remove all v0.2.170 per-field sliders.
- Preserve three-column numeric input positions and dimensions when a user focuses or adjusts values; the common slider is fixed-position and outside the inspector grid.
- Ensure the Transform range remains visible and attached to the correct field through updateInspector refreshes and while editing; make the floating slider appear above draggable panels.
- Synchronise the shared range with typed furniture values; preview changes during a drag, then commit/save one edit on release using the existing scene/physics/undo path.
- Cover row-alignment, transform restoration, no per-field sliders, and furniture preview/commit with release regression tests.

Files: `js/editor.js`, `js/inspector-slider-layout.js`, `styles.css`, `tests/release-170-furniture-ranges.test.mjs`, `tests/release-171-single-row-range.test.mjs`. DOM row geometry uses bounding rectangles and the active field is reconnected after inspector refresh. No duplicated sliders, no per-field range inputs. Full archive manifest and avatar checks required.


## v0.2.172 — Fix deploy-blocking JavaScript syntax and delayed HLS playback

- Fixed **`js/editor.js` line 552**: an accidentally uncommented prose line made `node --check` fail the v0.2.171 deployment. This release adds a test that syntax-checks **every** JavaScript application module, build script and regression test, including during full `npm test`.
- Remote HLS screens and monitors no longer call `HTMLVideoElement.play()` immediately after handing a URL to hls.js. `attachRemoteStream` attaches the media element first, then loads the playlist upon `MEDIA_ATTACHED`; it waits for `MANIFEST_PARSED` and video metadata before playback. Direct MP4/WebM and browser-native HLS also wait for ready metadata.
- If a browser denies unmuted playback (`NotAllowedError`), the playback code automatically retries muted and synchronises the screen's spatial-audio state, allowing viewers to unmute via the existing display button.
- Failed streams now show an explicit message in the on-screen channel menu. `VideoTexture` frame drawing also starts when a source was ready before the canvas was created. Audio speakers use the same readiness checks.
- Existing stream-link restrictions remain: **HTTPS .m3u8/.mp4/.webm** with remote host CORS permissions and browser-supported codecs. A stream hosted without usable CORS, a broken playlist, blocked credentials or incompatible codec cannot be made playable purely by frontend fixes.

Files: `js/editor.js`, `js/smart-media-playlist.js`, `js/equipment-media.js`, `tests/release-172-media-startup-syntax.test.mjs`, versioned `index.html`, backend release metadata, `releases.json`.

Release requirements: archive root `manifest.json` with exact `sha256` hashes of all and only `app/` files; unchanged original bundled GLBs; `npm test` and `node --check` on every JS/MJS file run against the final extracted archive. Browser playback with a real remote IPTV/HLS URL still requires live validation.


## v0.2.173 — Outdoor infrastructure
- Sources: `js/procedural-infrastructure.js`, `js/infrastructure-drawing.js`. The latter runs its own pointer handling before walls/vegetation and creates a single persistent `furniture` entry after >=2 points. Three modes: single-line, polyline, freehand; optional smoothing / closed path.
- `variant: infrastructure`: `infraType` road/footpath/curb/fence/hedge/pathWall, `infraStyle` plank/mesh/rods/solid, `infraSurface` asphalt/concrete/gravel/pavers/earth, `infraTraffic` oneway/twoway, `infraPoints` bounded 2D local path, `infraLanes` 1–6, widths/heights/marks/curbs/pavements/lamps. Central sanitation `cleanInfrastructure`, numeric bounds `INFRASTRUCTURE_NUMERIC` and backend `valid_basic_furniture`.
- Geometry uses segment-aligned boxes for solid collision and shared InstancedMesh batches for repeated pickets, mesh wires, hedges, paint and streetlights. Active PointLight budget is limited to 3 per object for WebXR; other fixtures are emissive. All are generated from one room object; presets and scene save/restore use the existing furniture code path.
- No external library, CDN assets, or installer modifications; originals assets must remain byte-identical.


## v0.2.177 — Drawing undo/redo, continuous freehand, orbit, anti-wedge recovery and comic balloons

- **Infrastructure sessions**: `js/infrastructure-drawing.js` now has scoped `undoStack`/`redoStack` for path points and furniture setting changes. Ctrl/Cmd+Z and Ctrl/Cmd+Y / Shift+Z are captured in `js/editor.js` *before* global scene Undo so an active drawing never undoes another previous edit. One freehand gesture is one Undo action. Normal scene Undo remains active after Save/Cancel.
- **Freehand**: acquisition no longer stops at 80 pointer samples; on demanding strokes, the live path is Douglas-Peucker simplified for geometry (<=80 backend points), preserving endpoints and significant turns. High-frequency WebGL rebuild remains throttled during dragging.
- **Camera**: the full-screen `spatialDrawShield` becomes pointer-pass-through only for infrastructure; right/middle drag and wheel remain available to OrbitControls, while left canvas clicks are intercepted for drawing. A dashed `THREE.LineSegments` guide shows the next provisional segment; it is not part of the persisted object and never changes settings or scene geometry.
- **Properties**: remove the inert `infraWidth` field for wall/fence modes, whose line length is inherently determined by path vertices. Height, thickness, spacing, fence style, colour and procedural texture edits continue to regenerate the actual 3D preview. The compact single Save/Undo/Redo/Cancel row remains in the Properties panel; no separate dialog is introduced.
- **Robot collision recovery**: `js/scene-physics.js` records the last safe grounded position and recovers a motionless, stuck airborne capsule after >1.25 seconds of blocked vertical motion; it resets the frozen fall animation to Idle. Jumping/ladder modes bypass this guard.
- **Speech bubbles**: `js/robot-comic-bubbles.js` projects text overlays near robot heads and follows them each frame; `studio.js` emits speech events for new AI messages and thought events from selected planning traces. SVGs `assets/ui-icons/speech-bubble-{1,2,3}.svg` come from user-uploaded shapes. Auto-duration bounded, screen-safe, pointer-events:none.
- **Font licence**: uploaded `Acme Secret Agent.zip` explicitly states the font **may not be redistributed without permission** and is freeware for independent comic creation only. Consequently **the font is not included in application assets or downloadable ZIP**. CSS prefers a locally installed ACME font, otherwise uses platform comic/system fallbacks. Permission/licensing must be arranged separately to bundle it in a commercial service.
- **Validation**: new `tests/release-177-construction-history-comic.test.mjs`, existing scene/historical suite, `node --check` all shipped JS/MJS, backend Python/Nginx tests, installer syntax, archive exact hash/path validation and source GLB hashes.
- **Caveat**: WebGL and two-client live network behaviour still require browser validation; the robot anti-wedge safeguard is deliberately narrow rather than globally teleporting characters during collisions.


## v0.2.178 — Doors, Roofs, Reload Recovery, Camera Start and Comic Controls

- **Office Space / Walls:** optional per-segment open-to-floor doors in a closed outline; roof variants flat with overhang, single-pitch in four directions and pyramid. Configurable chimney, decorative solar panels, skylight opening. Controls extend the original draggable Office Space wall panel and use the shared contextual full-row slider for numeric controls.
- **Presets:** `wall` scene entries (including closed rooms, openings and roof settings) now qualify for Architecture presets; the shared preset preview renders their procedural geometry; backend validation accepts and bounds the wall payload.
- **Seating:** after room population, restore seated robots against furniture IDs and local seat anchors rather than resetting their pose during asynchronous hydration; on standing, step past the front edge of the furniture and resolve supported Y against built floors and platforms. Avoid procedural leg animation contamination of authored avatar gait.
- **Camera position:** world camera control switcher adds entry, last visit and manually saved start points, scoped to room; save button asks for confirmation, and explicitly does not save game or shared scene. The save control uses SOLVI’s floppy-style drawing-save icon and **Shift+P** outside text fields.
- **Comics:** per-robot shape (rounded, oval, cloud), speech/thought behaviour, all-caps and font choices. No uploaded font binaries are redistributed; Digital Strip appears only when locally available, otherwise CSS falls back to a comic/system font. Existing SVG balloon artwork remains.
- **Testing:** expanded dedicated regression file `tests/release-178-homes-robot-camera.test.mjs`, historical JavaScript suite, backend Python checks, offline deployment manifest SHA-256 verification, and original GLB integrity.

Source changes: `js/office-wall-math.js`, `js/office-walls.js`, `js/editor.js`, `js/robot-seating.js`, `js/robots.js`, `js/world.js`, `js/robot-comic-bubbles.js`, `js/object-presets.js`, `js/object-preset-data.js`, `index.html`, `styles.css`, `backend/server.py`. Browser/WebXR visuals and multiplayer timing require runtime validation.
