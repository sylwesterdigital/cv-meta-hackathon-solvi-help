# v0.2.204 — Editable animated tool grip and bone attachment (2026-11-05)

- Add per-tool, per-hand Grip settings: actual avatar rig bone, follow bone rotation, hand-space X/Y/Z position, rotation degrees, and tool-local grip point. This replaces the one-tilt-fits-all approach from v0.2.200.
- Tools default to the actual Mixamo hand bone, rather than finger joints, with tool-specific contact points and baseline orientations. The selected item's inventory/grip profile persists with scene and saved presets; remote clients reconstruct the animation from the same record, without per-frame socket updates.
- Inventory → Held → Switch hand swaps an equipped item between available hands; Grip opens Edit mode on the equipped object; the selected tool inspector shows the editable settings and rig bone choices. Changes are previewed immediately and recorded through the existing validated object-save flow. Reset restores tool-specific defaults for the chosen hand.
- If an avatar rig lacks the requested bone, use the corresponding hand, never the opposite hand. Validate aliases, bounded finite numerical offsets, and rig-name syntax on the backend. No database schema changes, no model asset edits.
- **Scope boundary:** This release configures equipment holding, not digging, sawing, chopping, sweeping or combat tool effects. The existing Use button continues to indicate that actions are not implemented. These require their own target/action/world-physics implementation and must not be presented as complete.

# v0.2.203 — Backend authorization fix for captioned robot commands (2026-11-05)

- Fix failed v0.2.202 Mac watcher integration assertion: `CC: Jessica, stop` now gets parsed as a real privileged STOP command; when robot policy is `owned`, non-owner attempts return HTTP 403 even without a Meta API key.
- Keep ordinary conversation about help, stopping at a bus stop and other non-imperatives on the conversational path.
- Clear pending reaction claims on rejected privileged robot commands and identity-setting requests; add explicit backend and real-Python-parser regression tests.
- Full existing scene, profiles, inventory and the previous v0.2.202 conversation improvements are preserved. The failed v0.2.202 watcher run changed neither GitHub nor production.

# v0.2.202 — Natural robot conversation and follow-up continuity (2026-11-05)

- Fix accidental command-guide routing when a participant says "with the help of OpenAI". Only an explicit request for help/commands starts the command guide; ordinary discussion stays with Muse. Standalone Stop/Halt/Freeze still work, but references to bus stops, not stopping, or approaching somebody and stopping nearby do not preempt conversation or movement.
- Include recent direct exchanges with the addressed robot in its conversation prompt, even when other robots have spoken since; attribute every speaker by their saved room display name. Retrieve from existing room-scoped SQLite messages; no new long-term user profiling or migration.
- Exclude disabled old work orders, stale/duplicate camera-observation memories, and implausible malformed scene coordinates from conversation context. Prefer objects nearby or explicitly mentioned.
- Preserve actual executable allowlisted commands, ongoing tasks, scene data, avatars, media and all previous fixes. Full end-to-end model conversational quality must still be verified after deployment.

# v0.2.201 — Sign-in and world startup recovery (2026-11-05)

- Remove startup dependency on Meta model-catalog API (up to 65 seconds external wait); scene starts independently of AI provider availability.
- Newest profile tab owns the session; stale tab yields without deleting the new tab token.
- Public backend health is retryable; profile submission is guarded against duplicate clicks and surfaces recovery errors.
- Authenticated scene boot is not suppressed by optional room/world settings errors. No scene or DB schema migration.

## v0.2.200 — Persistent hand-held equipment and multiplayer storage

- Add persistent Held inventory tab with Hold nearby, Hold, Store, Drop and explicit non-destructive Use controls for tools.
- Keep each held scene item attached to the avatar right or left hand bone after animation; remove held collision body; preserve scene identity across pocket, worn backpack, hand and ground.
- Enforce single occupancy of each avatar hand and owner permissions in transactional per-object scene writes; reject malformed held claims and duplicate hand slots during bulk replacement.
- Maintain strict item size and backpack availability rules; remap persistent held holder references through realm exports/imports and avoid clearing a held item when a holder delta is temporarily missing.
- Preserve previous object-placement, room persistence/recovery, all original 3D assets, and existing deployment watcher packaging contract.

## v0.2.199 — Outdoor road and path drawing no longer blocked by smart furniture placement

- Restore road/motorway/path/fence drawing in open terrain and at a distance from the camera: creating the unsaved infrastructure draft no longer invokes room furniture visibility and collision restrictions.
- Extend the same fix to explicit-geometry workflows for vegetation plots, ground plots, beds, lakes, 3D curves and paired portals.
- Keep roads and fences positioned from the user's actual drawn points and publish only their finished shapes through the existing per-object multiplayer persistence path.
- Do not weaken smart placement for newly added independent furniture, tools, props or presets. No schema changes; preserve server scene backups and recovery safeguards.

## v0.2.198 — Smart tabletop and raised-floor placement

- Fix v0.2.197 placement failure in populated houses: small objects (cans, bottles, mugs, plates, laptops and similar props) are placed on **visible existing tables** or other genuine horizontal support surfaces before ground-level placement is considered.
- Detect real table/cabinet tops and broad low floor slabs (including raised cube and horizontal plane floors); place the new object's bottom at the support height rather than rejecting every candidate because the support's own collider fills the footprint.
- Use deterministic candidate sampling, entire object-footprint containment, 3D overlap avoidance, camera projection/occlusion checks and recent-placement proximity. Never publish a rejected object; all successful additions retain the normal per-object multiplayer scene save path.
- No scene format or database migration. No changes to robot autonomy, recovery snapshots, original 3D models or unrelated editor behaviour.
- Local WebGL viewport and live two-client behaviour require deployment verification.

## v0.2.197 — Smart, room-aware object placement

- New primitives, tools, devices, furniture and saved presets favour positions beside the last addition in the current realm, close to the viewport centre and the viewer.
- Candidate selection checks XZ and height-specific collisions, individual wall/fence mesh segments, and 3D camera line of sight: no more placing a new object blindly behind a room wall or already occupied furniture.
- Prevent publishing invalid placements; display a message suggesting a clearer view instead of creating a hidden or overlapping multiplayer object. Saved scene state and all older objects remain unchanged.
- Preserve the v0.2.196 scene recovery/snapshot protections and manual repositioning paths.

## v0.2.196 — Furniture persistence and scene recovery

- Fix all default furniture/tool/equipment save failures caused by a backend property-count mismatch: 129 generated fields versus 120 allowed; preserve strict field allowlists and numeric bounds.
- Save compressed, checksummed, bounded room-scene recovery snapshots before destructive operations; include safe read-only snapshot APIs and offline restore utility.
- Prevent malformed or unexpectedly empty scene loads from discarding a previously populated client room; keep an optional last-good local JSON copy.
- Keep v0.2.195 About and README separation and all previous features.

# SOLVI.help v0.2.195 — Project README and About

- Restore a concise, public-facing README for the app and separately provide the GitHub-root README.
- Preserve previous development notes in `CHANGELOG.md`; detailed technical handover stays in `docs/LLM_HANDOVER.md`.
- Add an accessible About tab in the existing Dev log window, leaving release notes and live diagnostics unchanged.
- No changes to scene, multiplayer, editor, robot or backend persistence behaviour.

---

# SOLVI.help v0.2.194 — Reliable shared scene editing

This release fixes procedural preset saving and multiplayer scene consistency. Cube presets now accept validated cut-out openings. Stairs keep their edited colour and texture after a save, another client's update, and a reload. Live diagnostics report actual scene revisions and save failures, not just presence heartbeats. A periodic server reconciliation recovers missed scene events, while locally pending edits are protected. The Save button flushes changed objects without replacing the whole room snapshot. Capacity is now 512 objects per realm across editing and archive workflows.

**Use the existing Mac `updates/` release watcher to deploy the complete ZIP.** A local unit-test pass is not proof of a successful two-browser production session. Review [`docs/RELEASE_0.2.194_SPEC.md`](docs/RELEASE_0.2.194_SPEC.md) for acceptance steps and known limitations.

# SOLVI.help v0.2.193 — Procedural tools & interactive equipment

This complete SOLVI.help release adds seven basic procedural tools, keyboard/trackpad/mouse/printer/laptop/fridge devices, persistent laptop/fridge open states, laptop media playback and refrigerator item storage.

**Spec:** [`docs/RELEASE_0.2.193_SPEC.md`](docs/RELEASE_0.2.193_SPEC.md).

- Only the `.help` portion of the existing header wordmark briefly reveals a vertically scrolling rainbow. `SOLVI` and the current version text are visually unchanged.
- The rainbow fades in and out on a nine-second CSS-only cycle. Two identical gradient halves make the six-second vertical flow seamless, including at loop boundaries.
- The original grey `.help` text remains underneath the overlay; reduced-motion users always see the original static text. No JavaScript, network requests or layout changes.
- Full regression coverage: `tests/release-192-wordmark-rainbow.test.mjs` plus the existing suite. Previous analytics, navigation and robot work remain intact.

# SOLVI v0.2.191 — Non-blocking Umami analytics

- Add opt-in-free Umami website analytics via the supplied analytics.mielniczuk.com endpoint and website ID, without modifying the Meta/robot application module graph.
- Load the tracker only after page load and idle scheduling, with an independent async script so analytics latency cannot delay 3D startup, DOM readiness or normal user interaction.
- Ignore blocked or failed analytics requests, remove a hanging tracker after 8 seconds and never retry in a loop; test load/error/timeout/startup isolation.
- Retain the v0.2.190 fence-aware navigation and stuck-recovery code, unchanged avatar binaries, full watcher release manifest and existing deployment contract.

# SOLVI v0.2.191 — Fence-aware navigation and physical stall recovery

- Correct long procedural fence, hedge and wall obstacle detection using bounded, transformed physical path segments regardless of stale user-visible names (e.g. Footpath); long colliders are never silently omitted from route planning.
- Allow a bounded extended A* search around long barriers and reject routes crossing real solid geometry; no teleporting or moving scene structures.
- Measure real robot progress during active animation and create a bounded recovery subtask when contact stops movement; refresh the scene and route around a temporary observed blocker.
- Keep temporary stall blockers transient, do not mutate objects, and stop with explicit task failure after bounded retries rather than walking forever into a fence.
- Add regression tests for a 40m fence detour, transformed walls, navigable ground paths, and stalled animation; preserve full original binary assets and the existing deployment watcher.

## v0.2.191 deployment hotfix — Flask relay integration test

The first v0.2.191 ZIP did not deploy: the watcher aborted `backend/test_api.py` in the two-hop relay check after `@Jessica talk to @Elox about the scene` returned an implicit camera request rather than an `answer`. The new recipient parser correctly identifies only Jessica as an operator; the implicit visual router must also recognise the second `@Elox` handle as a conversation target. This hotfix prevents automatic camera diversion for multi-handle social instructions while retaining implicit camera refresh for true one-to-one chat and explicit image questions. The backend integration assertion now checks this distinction directly.

Same v0.2.191 release version: the failed archive was not deployed. No watcher changes or avatar changes. A watcher Flask integration rerun is required for final deployment confirmation.

---

# SOLVI.help v0.2.191 — multi-robot command routing and mission progression

**Observed problems:** A human message addressed to Jess and Suck asking them to find Elox caused all three robots to reply “cannot identify one exact destination.” Later, a hospital goal repeatedly reused an old small house and stopped at PARTIAL rather than contacting Elox and completing missing furniture. The Meta planner failed at `parse-decision` with a `TypeError`.

**Fix:** Initial @handles are the operators; later @handles after verbs such as *find*, *meet* and *tell* are task targets, not additional recipients. Each addressed robot receives a bounded, real `go_to` task to the named target. Where the request includes “tell him to ...”, the robot forwards that request through chat only once client-verified arrival is recorded. That conversation does not automatically grant the other robot permission to build or bypass work-order opt-in.

**Autonomy:** A recurring goal “Find @Elox and build with him a hospital” now prioritises reaching and speaking with Elox before authorised construction. Verified contacts are included in the server's bounded SQLite mission state. Existing house rehydration continues to site inspection and furniture creation in the same execution cycle. A previous small home is not silently treated as a suitably sized hospital. The mission retains partial/unavailable care status rather than claiming hospital services that do not exist.

**Meta parser:** Text extraction tolerates null/malformed Responses content and tool-call validation rejects or normalises wrong-typed model fields. This addresses known `parse-decision TypeError` possibilities but is **not proof that the actual production Meta response is corrected**; live logs remain necessary.

**Acceptance:** After deployment, `@Jess @Suck can you please go and find @Elox and tell him to build a hospital?` should address only Jess/Suck and produce collision-checked routes to Elox. A follow-up work order still requires explicit authorisation of construction in Routines → Work orders. `Find @Elox and build with him a hospital` should contact Elox then proceed to an appropriate house site/furnishings over successive autonomous cycles. No server-side WebGL worker, unpermitted task delegation or direct medical-care tools are introduced.

**Deploy:** Complete SHA-256 application ZIP in the existing `updates/` folder; watcher unchanged. Preserve original avatar GLB bytes. Validate package/test consistency before deployment.

---

# SOLVI.help v0.2.188 — Door-aware social navigation and natural robot replies

A robot outside a house can no longer claim to have met another robot by reaching the near side of a window. Social approach points must be both walkable **and directly accessible without passing through walls or glass**; indoor targets require travelling through an actual door opening. Other robots are moving people rather than immovable A* obstacles: local capsule collision remains active, but approach replans avoid building a permanent wall around each avatar. The current route is rechecked once per second against room changes, and a moving target can be reacquired. A near-wall avatar may exit conservative safety padding only while moving away from the real masonry; physical wall intersections remain prohibited.

Robot replies prioritize the requested answer and available work-order results, with at most one concise colloquial aside grounded in actual observations or the current plan. No hidden reasoning is published.

**Tests:** `tests/release-188-social-navigation.test.mjs` covers window false-arrival, doorway entry, sealed-room rejection, dynamic avatar handling, geometry-change invalidation and near-wall exits. Full JS, backend, installer, manifest and extracted-release checks are required. Browser/WebGL/Rapier live testing is still needed.

**Deployment:** Place the complete v0.2.188 ZIP in the unchanged `updates/` watcher folder. The package contains root `manifest.json` with SHA-256 for every `app/` file and preserves all original bundled avatars. No watcher change.

---

# SOLVI.help v0.2.187 — reliable robot routes around houses

**Problem fixed:** A robot attempting to reach another robot across a house could falsely report “no collision-free route found.” The route executor split journeys into straight-line 18 m chunks and required each arbitrary midpoint to be reachable. When a midpoint landed inside a building, the whole journey failed even when the existing A* planner could walk around the building.

**Navigation:** `planRobotTravelRoute` builds complete journeys through safe reachable staging points, tries both sides of obstacles and never reports success for an approximate endpoint. The editor uses it for all robot routes, while preserving the original physically animated walking, movement telemetry, replanning and arrival confirmation. Target-robot approach/retargeting considers reachable sides of a stable feet capsule, not animation-inflated GLTF bounding boxes. High-altitude wall/stair subparts are excluded from ground-level obstacle checks, while actual ground-level walls remain solid. This does not give robots permission to pass through buildings or teleport.

**Acceptance test:** Place Jess on the far side of a small house from Zuck; issue an authorised `go_to` or following action. Jess should take a curved walking route around a side of the house and stop near Zuck, unless the whole area is physically enclosed. Enable Robot Path Debug to inspect the planned path versus the measured trail. This geometry test passes locally, but live WebGL/Rapier browser testing remains necessary.

**Deployment:** Place only the complete hashed v0.2.187 application ZIP in the existing `updates/` watcher directory. Original bundled GLB bytes and all GitHub HTTPS/Ubuntu watcher behavior are preserved.

---

# SOLVI.help v0.2.186 — robot-selected construction sites and simplified work orders

**Work orders:** Select a robot, choose one action, and use **Run once**. The page now displays only inputs used by the current mode; e.g. **Build furniture** needs a furniture type and authorised scene changes, while **House** uses the Goal to interpret bounded building dimensions (3–8 m). Direct modes do not invoke the Meta planner; Start loop is reserved for the agent. Hidden previous mode fields cannot leak into saved work orders.

**Construction:** The robot finds a nearby free rectangular site, verifies an A* route to an exterior staging location, physically walks there with existing avatar gait animations, checks observed arrival, performs a brief pickup gesture and only then creates the selected procedural object. The builder checks the footprint again at commit time. Unreachable, obstructed or non-ground start positions fail openly; the user does not have to move the robot manually. The house tool still generates procedural walls/roof/floor rather than hand-building each brick; interior furnishings can still be added by existing scene tools once the shell is placed. Browser/WebXR visual verification remains necessary.

**Deployment:** As before: complete SHA-256 `manifest.json` + `app/` ZIP, unchanged GitHub/Ubuntu watcher, original avatar byte preservation. Browser active for execution; server SQLite mission persistence remains.

---

# SOLVI.help v0.2.186 — durable robot work orders and hospital-first recovery

An authenticated, bounded work-order record in SQLite now stores each robot's goal, explicit enable/stop flag, last tool result, retry/cooldown state and saved project IDs. **Work still executes only in a signed-in visible browser with the loaded 3D world**. Previously enabled recurring orders resume after authentication and successful scene restoration; stopping the order disables automatic resumption. A completed single-run task is never automatically repeated. Real scene tool IDs are revalidated on every use.

Construction goals that explicitly mention a hospital or clinic now trigger the existing house/room construction and bed-furnishing API even if Meta planning fails. The robot can place cosmetic bottles/cans and attempt to invite named colleagues on subsequent cycles, while reporting hospital medical care as unsupported. Repeated generic Wikipedia searches no longer substitute for building. The Meta planning endpoint now labels the failure stage and can retry a refused six-frame image request with one real frame and then a clearly marked text-only input, without exposing credentials or raw provider payloads.

---

# SOLVI.help v0.2.186 — autonomous recovery and natural project conversations

This complete release builds on v0.2.183. Robot work orders no longer stop at the first Meta planning error: a state-aware, permission-checked controller can resume incomplete construction, attempt a single renewed site inspection, consult task-relevant public background, ask another robot for help, or rest. Failed work remains visibly partial or blocked. The Meta endpoint retries text-only on specific image-path exceptions, without claiming six-frame perception succeeded. New authenticated `robot_work_events` receipts record client-observed outcomes; the social discussion endpoint uses those receipts for casual short project reviews, not fabricated debate references. Hospital construction may add multiple beds but medicine/medical care remain unsupported. Read detailed Master LLM Handover for scope, validation and limitations.

---

# SOLVI.help v0.2.182 — Autonomous Robot Operators, Meta 360° perception and service work orders

**Status:** Release candidate for the unchanged `updates/` deployment watcher; **not yet deployed or browser-verified**.

### Operator workflow

Open **Robot routines → Autonomous robot operator · work orders**. Choose an editable robot and work mode, then **Run once** or **Start loop**. Modes: **Meta agent** (select a new scene-grounded action after each outcome); **Deliver** (walk, lift a Pickable object, move and drop); **Build furniture** (chair, bed, sofa, stool, office chair, table or cabinet); **Assist** (visit a colleague and address a question through the existing robot-to-robot reply engine); or **Rest** (walk to and sit on a seat, create a chair first only when authorised, then stand up). Stop individual robots or all robot work orders directly in the panel. Loops require an open, signed-in foreground browser tab; they are not background Ubuntu services.

**Existing-tool integration:** Navigation uses the existing `receiveRobotCommand(go_to)` route and task-update completion, A* avoidance, live movement animation and scene persistence. Carrying uses the I-key pickup/drop implementation, physics and edit permissions. Rest uses J-key seating/standing animations. Construction uses the procedural Basic Furniture mesh generator, clearance check, Rapier static collider, scene save and Undo. Automatic deletion is limited to furniture created by that robot in the current autonomy session, never unrelated objects.

**Meta vision:** With the camera checkbox enabled, each Meta agent decision receives six genuine 512×512 JPEG robot-head renders at 0/60/120/180/240/300 degrees, processed by configured Meta Muse Spark 1.3 via the authenticated server endpoint. Scene inventory/object IDs are provided separately and must not be conflated with visual confirmation. The existing SAM 3.1 robot visual search is available for focused object inspection. Meta chooses only one validated action from `visit`, `deliver`, `build`, `remove`, `rest`, `ask`, `inspect`, `idle`. Model text is never executed as code, and completion is only recorded after real tool results. Limits: at least 180 seconds between agent decisions, 36 decisions per user/day in the server process, a 60-second per-robot speech cooldown, plus an explicit confirmation before billable requests. The Meta service, model capabilities and billable amounts depend on its configured API key.

**Safety / current scope:** Robot and object ownership, active realm and tab session are checked. Physics must be on and the selected object must be Pickable for delivery. Large/obstructed scenes may make safe routes impossible; the task reports failure and a later loop can choose a different action. Robot control is one browser-tab local scheduler; do not assume distributed job-locking between two simultaneously enabled tabs, persistent offline autonomy, general autonomous tool use outside the action allowlist, real sleeping animations for every avatar rig, unrestricted deletion or live VR/browser verification. Physical objects remain ordinary scene entities and saved room data is not intentionally reset.

**Files:** `js/robot-autonomy.js`, `js/robot-autonomy-core.js`, `js/editor.js`, `js/studio.js`, `index.html`, `styles.css`, `backend/server.py`, `backend/test_autonomy.py`, `tests/release-182-autonomous-operators.test.mjs`, legacy regression expectation updates, release/version metadata and handover. **Deployment:** Place only the complete, hash-manifested application ZIP in `updates/`; do not modify the existing watcher, GitHub HTTPS workflow, Ubuntu provisioning, original avatar GLBs or users' saved scenes.

---

## SOLVI.help v0.2.181 — multiplayer presence and open diagnostics

- Fix Brave/Safari inconsistent room counts by resolving the signed-in profile’s saved realm before starting its authenticated WebSocket connection.
- Treat the server room snapshot as join confirmation, refresh authoritative presence every 15 seconds, and reconcile late movement packets when a presence notification was missed.
- Reconnect sockets with bounded backoff rather than permanently stopping after two failures; replace lingering same-user WebSocket sessions safely without removing the active replacement.
- Make per-browser room and application debugging visible to regular users in the existing Dev log via a Live diagnostics tab, including room, participant count, socket/JS errors and robot event summaries, with Copy/Clear and credential filtering.
- Add multi-client and disconnect regression tests and preserve all existing browser/scene, avatar, GitHub HTTPS and watcher deployment contracts.

Deployment: copy the **standalone release ZIP** directly into the SOLVI repository’s `updates/` directory. The watcher validates and deploys it. Do not place installer ZIPs in `updates/`.

---

## SOLVI.help v0.2.181 — top-floor roofs and WebXR raycasting recovery

- Vertically stacked Office Space wall arrays create exactly one roof at the highest level, including chimney, solar panels and skylight; their intermediate ceiling slabs remain intact. Horizontal arrays keep independent roofs per adjacent room.
- XR controller rays now always supply the headset camera before intersecting any Sprite; smart-screen scans run only on controller selection, not continuously. Window resizing avoids WebGLRenderer.setSize while XR is active.
- After a browser Back-Forward Cache restore, the shared-room WebSocket reconnects rather than remaining permanently stopped.
- Installation: place the **standalone watcher-format** `SOLVI_RELEASE_v0.2.181_...zip` into the SOLVI repository's `updates/` directory (not installer or recovery ZIPs). Watcher GitHub HTTPS/pending-5xx configuration remains local and is not altered.

## SOLVI.help v0.2.179 — compact camera/robot controls

- Unify Control Switcher actions into one compact draggable row: scene/robot name, local control icon, camera mode icon and short label, contextual follow-distance slider, and small consistent white floppy Save icon.
- Remove persistent Start entry/last/saved dropdown. Show three compact start-location actions only when Save is opened; keep per-room choice, signed-off saved position, Shift+P, keyboard Escape and accessible labels.
- Use seven user-provided vector UI icons locally with forced consistent monochrome icon treatment; preserve the existing robot portrait strip and camera mode cycling.

---

# SOLVI.help v0.2.178 — Homes, Seating and Camera Recovery

- Add individual full-height door openings to existing Office Space wall segments, selectable during the Closed Outline draft; preserve openings in saved wall objects and Architecture presets.
- Generate saved single-slope roofs (4 orientations), flat overhang roofs and pyramid roofs, with optional chimney, solar-panel details and roof opening; validate and preview through the existing Office Space wall panel.
- Restore saved seating anchors after furniture and robot scene hydration, stand clear of chair and sofa fronts, recover robot foot elevation from upper-storey supporting surfaces, and avoid stale procedural leg poses in authored walking animation.
- Add entry/last/saved per-room camera start position, a one-click save-with-confirmation Shift+P action in the shared Control Switcher beside follow/distance controls; save camera pose only, not world state.
- Introduce per-robot comic speech/thought bubble options for shape (rounded/oval/cloud), Digital Strip or fallback font family, all-caps and visibility, without redistributing uploaded font binaries.
- Unify the Office Space wall numeric slider with the shared active-field slider beneath the focused row; add backend and regression checks for new door/roof/preset, camera, seating and comic settings.

# SOLVI.help v0.2.176 — Inspector Construction UX and Infrastructure Material Finishes

- Replace fragmented Finish/Undo/Cancel controls and unreadable column-wrapped status with a single full-width inline row: an accent-coloured, descriptive Save construction action, Undo and Cancel, plus a concise single-line preview status in the standard draggable Properties inspector.
- Fix the 54px legacy furniture-column CSS override that squeezed drawing status and drawing mode into vertical letter stacks; keep the compact three-column property grid unchanged for normal settings.
- Remove the exposed arbitrary texture/variation seed from infrastructure Properties; add actual selectable Wood, Concrete, Brick, Metal, Plaster, Marble and Granite finishes for solid walls and fences using SOLVI’s existing procedural texture generator.
- Keep the deterministic internal material seed for asphalt/paving texture generation, but make roads use named surface presets and walls/fences use visible named finishes; validate infraTexture on the backend with legacy defaults.
- Retain unsaved 3D live previews, single-line, polyline and freehand modes, existing scene persistence, undo/cancel restoration, multiplayer and avatar GLBs; test focused UI, sanitizer, backend and archive watcher consistency.

# SOLVI.help v0.2.175 — Real-time 3D infrastructure preview

Freehand and primitive-shape lake/terrain plots, terrain collision geometry, editable relief/depth settings.

# SOLVI.help v0.2.166 — Forest arrays, orchards and brushwood

Add seeded Nature arrays as a single persistent Vegetation Area object with orchard rows, mixed forests, clustered thickets, and brushwood patches; keep the entire patch under one multiplayer object ID.

Add individually editable Shrub / Brushwood objects with adjustable height, spread, branch count, foliage clusters and shape, all compatible with the existing Nature preset gallery.

Draw orchard/forest/brushwood planting areas on the ground with the existing polygon closure, smoothing and redraw tools; expose density, spacing, species, scatter seed, cluster strength and scale variation in compact Properties.

Use bounded shared InstancedMesh batches for trunks, crowns, conifers, palms, shrubs and undergrowth rather than creating a separate mesh per plant; retain deterministic restoration and prior v0.2.165 Nature scenes.

Extend backend validation and add multi-mode deterministic scattering, geometry-budget and editor integration regression tests.

All scatter arrays are saved with the parent vegetation object; per-plant IDs and hundreds of physics bodies are not created. WebGL/WebXR appearance and interactive performance remain to be verified in a browser.

## SOLVI.help v0.2.165 — Organic vegetation rendering and tree variants

A complete backward-compatible release on v0.2.164. New: blossom/palm/coconut trees; smaller seeded foliage; editable wood bark, frond counts and trunk irregularity; smoother soil material; instanced thin grass blades with animated GPU wind and live preview of numeric parameter changes. Uses native Three.js features with no geometry-shader or runtime GUI dependency. Geometry counts are bounded for WebXR. Use the existing ZIP watcher for deployment. Browser/WebXR rendering and exact frame rates require live testing.

## SOLVI.help v0.2.164 — Procedural trees, grass/soil plots and cultivation beds

Full watcher-compatible application release based on v0.2.163. Use Add → Nature & cultivation to plant Tree, Ground plot or Crop bed. For freehand plots use Draw grass / soil plot or Draw vegetable bed; click ground corners, click near the first to close, or press Enter to auto-close. Optional Smooth closed outline (Chaikin) is available before Save. Edit soil preset, mixed grass amount, seed and plant settings in the compact furniture inspector. Trees have broadleaf/conifer/orchard forms, branch and foliage budgets, optional fruits and stable seeds. Crop beds have planting rows and manual growth percentage (visual only; harvesting and autonomous growth not yet implemented). Save as preset in Properties and filter by Nature in the Presets gallery.

Geometry is deterministic and capped (28 branches, 60 leaf clusters, 450 grass instances, 180 crop instances per object) to limit WebXR cost. Nature objects use existing furniture scene sync, authenticated account preset storage and deployment watcher. This release does not import ez-tree's large editor or add its runtime to SOLVI. The user-provided reference ez-tree is MIT licensed (Daniel Greenheck, 2024); the renderer here is independently implemented.

Automated checks cover JavaScript regressions and procedural geometry bounds, backend validation and release integrity. Visual performance, screenshot quality and real multiplayer/WebXR interaction require live browser testing.

## SOLVI.help v0.2.164 — Seat-exit clearance, clickable audio labels, ergonomic office chair and brighter portraits

This full application release supersedes v0.2.162. Place the ZIP in the standard `updates/` directory for the existing SOLVI watcher. Changes: seat clearance and physics synchronisation when standing; one compact, interactive media recording label; office-chair lumbar opening, armrests and five caster wheels; centred preset Delete icons; correctly encoded and lit Save Chat Portrait headshots. No avatar GLBs were changed. Live browser/WebXR validation remains necessary.

## SOLVI.help v0.2.162 — Locomotion, robot-camera exposure, office chair and bottle fluid

See releases.json for changes. Existing v0.2.161 content is preserved below.

## SOLVI.help v0.2.161 — Inventory, preset thumbnails, bottles and backpack controls

- Inventory (B) now uses the shared draggable-window system, with the controlled robot’s portrait, compact storage tabs and object-thumbnail cards. Inventory and saved scene identities remain unchanged.
- Preset cards use the whole preview surface as their accessible Add action, with caption and Delete overlaid on the image. The automatic button icon pipeline no longer injects the unwanted + glyph. Cards regenerate procedural furniture, stairs and primitive thumbnails from their saved geometry using the shared independent offscreen WebGL renderer rather than stale world-renderer readbacks.
- Bottles have configurable opacity (0–1), liquid colour and 0–100% fill levels. Uncapping reveals a hollow neck; the fill is a separate volume inside the bottle. Frontend and backend agree on the schema; existing bottle scenes remain loadable.
- Shift+I collects a nearby pickable backpack or removes a worn backpack to the floor, retaining its saved contents. Ordinary I remains unchanged.
- Browser visuals and real two-client physics are not asserted without deployment verification.

## SOLVI.help v0.2.160 — Smart-screen menu synchronisation and image-first preset gallery

- The inspector, scene state, remote update and in-world menu all use one sanitised `channels` array. Changing channels redraws the menu texture on the existing TV/monitor without requiring a model rebuild, and preserves a still-valid playing channel and its spatial audio connection. The menu is restored when a scene's display material was regenerated.
- Presets now show an image-first gallery card: click the picture to add and close, and use a small top-right SVG delete overlay. No permanent plus symbol or extra Add button, and no separate Delete row. Card title/category remain compact below the image.
- Thumbnail capture uses the projected 3D box corners in thumbnail-camera space to calculate an accurate orthographic frustum, centering unusual proportions and off-origin models. The capture uses fixed studio lighting, restores WebGL/XR renderer state, and regenerates saved procedural furniture previews from the saved configuration instead of relying on older cropped thumbnail bytes.
- No changes to release watcher or saved object schemas. All changes limited to rendering, synchronisation, and tests. No original GLB assets altered.
- Actual live browser rendering and two-client / HLS transitions still require deployment verification.

## SOLVI.help v0.2.159 — Spatial smart-screen audio

- Route every playing smart TV, monitor, and compatible video frame through a dedicated Three.js PositionalAudio node attached to the screen geometry. The same HLS/video element supplies the image and the Web Audio stream (no duplicated sound).
- The camera/XR audio listener supplies position and orientation; positional HRTF panning, inverse distance falloff (2.5 m reference; 35 m max), and a forward-facing speaker cone apply automatically.
- The on-screen audio icon mutes/unmutes the corresponding Web Audio gain as well as the HTMLVideoElement. Resuming audio requires a browser user gesture when autoplay policies apply.
- On channel change, return-to-menu, scene removal, or resync, disconnect the prior audio source and stop the old player. Unsupported browsers fail back to ordinary video audio with a console warning.
- No saved scene schema or backend media proxy change; external hosts still need CORS-compatible HLS playlists, segments, and codecs.
- Browser/WebXR spatial response and autoplay restrictions require validation after deployment.

## SOLVI.help v0.2.158 — Smart TV audio, startup playback and IPTV catalogue support

### Changes
- TV, monitor and smart video frame: on-screen sound icon, audio enabled/start-muted, configurable startup channel, opt-in play on startup, original-aspect letterboxing and MP4/WebM loop on/off.
- When a TV or monitor is selected, pasting a supported HTTPS stream link directly adds its channel; no Paste clipboard button is required.
- Paste or enter HTTPS `.m3u` playlist URLs (e.g. the IPTV-org project’s country/category playlists), load the catalogue, search, and click Add for an individual channel. Catalogues are not persisted; selected playable URLs are saved up to 12 channels per display.
- Browser HLS playback still requires the stream origin to allow cross-origin requests, compatible codecs and sometimes user activation for audio. Live IPTV may not provide a finite end, so looping only affects finite MP4/WebM files.
- All original scene data and avatar model bytes are preserved.

## SOLVI.help v0.2.157 — World interactions, lamps and audio

- Fix smart-screen selection in Edit Mode and WebXR; add Play buttons for saved TV, monitor and media-frame channels and handle screen cleanup safely.
- Improve remote walking animation tolerance, add contextual Cmd+/ robot keyboard help derived from per-robot combat shortcut settings and an explicit wearable Take off action.
- Improve procedural preset card layout and center/safely frame thumbnail captures; clicking the preview directly adds an object.
- Add procedural lamps with sphere/cuboid/pyramid shades, point/spot lights, adjustable intensity/range/opacity and a physical power switch.
- Add procedural speakers with named saved HTTPS media channels, spatial audio, playback by clicking in-world or selecting a channel in Properties.
- Synchronise stair root and tread surface color during editing, retain collision and persistence, preserve existing avatar GLBs and scene compatibility.

## v0.2.157 — smart displays and outdoor equipment

- Add TV, monitor and media-frame smart-channel galleries for up to 12 HTTPS HLS/MP4/WebM sources, with explicit in-world selection and return-to-menu controls.
- Allow clipboard paste of validated media URLs in Properties; playback uses native HLS or bundled Hls.js when supported, without arbitrary server-side URL fetching.
- Reframe new procedural preset thumbnails using geometry-bound orthographic projection; regenerate existing furniture thumbnails locally when browsing Presets.
- Expose wearable attachment skeleton bone, follow-rotation choice and XYZ position/rotation offsets in object Properties; lower default backpack position and rotate back slot by 90 degrees.
- Add procedural sunbed, deck chair and beach umbrella variants with compact parameters and safe compound collision; sunbed and deck chair support reclined sitting and authored lying-clip fallback.
- Retain versioned browser modules, existing scene/preset structures and uploaded avatar files; validate new fields in backend and import/export paths.

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


## v0.2.169 — Furniture seating and transform-follow

- Centre avatars on office-chair and single-seat cushions instead of using their approach-side X coordinate or armrest footprint.
- Allocate distinct seating slots on multi-seat sofas; prevent a second avatar occupying the same chair or sofa slot.
- Add a saved furniture seating behaviour selector: Stand occupants up (non-stickable) or Carry seated occupants (stickable).
- Keep multiple seated avatars anchored to a moving, rotating or dynamically pushed furniture object with local seat transforms and immediate local Rapier pose reconciliation.
- Stand occupants automatically when non-stickable furniture moves, or when furniture is deleted, rather than leaving avatars sitting in the air.
- Persist and validate robot seating anchors in shared scenes, support loading/replaying them in remote clients, and remap seat target IDs through realm archive imports.
- Add six regression tests for furniture-follow, non-stickable release, multi-avatar anchors, centre seating, schema validation and persistence.


## v0.2.170 — Stable per-field number range sliders

- Give every numeric furniture and vegetation inspector parameter its own always-visible compact range slider directly beneath the corresponding number input, including orchard/forest scatter, soil, terrain and water parameters.
- Keep the three-column inspector grid stable: all companion range controls are present from render time and do not insert, remove, resize or reflow other fields on focus.
- Synchronise range dragging and typed numeric values in both directions through the existing debounced geometry preview, undo history, physics update and multiplayer save pipeline.
- Preserve the existing floating contextual slider for transform position/rotation/scale, while avoiding redundant popovers over furniture controls.
- Add regression checks for slider creation, numeric bounds, change propagation and consistent non-reflow layout.


## v0.2.171 — One shared range slider per active row (corrects v0.2.170)

- Restore exactly one shared, full-width contextual range slider below the active furniture, vegetation, or Transform XYZ row; remove all v0.2.170 per-field sliders.
- Preserve three-column numeric input positions and dimensions when a user focuses or adjusts values; the common slider is fixed-position and outside the inspector grid.
- Ensure the Transform range remains visible and attached to the correct field through updateInspector refreshes and while editing; make the floating slider appear above draggable panels.
- Synchronise the shared range with typed furniture values; preview changes during a drag, then commit/save one edit on release using the existing scene/physics/undo path.
- Cover row-alignment, transform restoration, no per-field sliders, and furniture preview/commit with release regression tests.


## v0.2.173 — Fix deploy-blocking JavaScript syntax and delayed HLS playback

- Fixed **`js/editor.js` line 552**: an accidentally uncommented prose line made `node --check` fail the v0.2.171 deployment. This release adds a test that syntax-checks **every** JavaScript application module, build script and regression test, including during full `npm test`.
- Remote HLS screens and monitors no longer call `HTMLVideoElement.play()` immediately after handing a URL to hls.js. `attachRemoteStream` attaches the media element first, then loads the playlist upon `MEDIA_ATTACHED`; it waits for `MANIFEST_PARSED` and video metadata before playback. Direct MP4/WebM and browser-native HLS also wait for ready metadata.
- If a browser denies unmuted playback (`NotAllowedError`), the playback code automatically retries muted and synchronises the screen's spatial-audio state, allowing viewers to unmute via the existing display button.
- Failed streams now show an explicit message in the on-screen channel menu. `VideoTexture` frame drawing also starts when a source was ready before the canvas was created. Audio speakers use the same readiness checks.
- Existing stream-link restrictions remain: **HTTPS .m3u8/.mp4/.webm** with remote host CORS permissions and browser-supported codecs. A stream hosted without usable CORS, a broken playlist, blocked credentials or incompatible codec cannot be made playable purely by frontend fixes.

Files: `js/editor.js`, `js/smart-media-playlist.js`, `js/equipment-media.js`, `tests/release-172-media-startup-syntax.test.mjs`, versioned `index.html`, backend release metadata, `releases.json`.

Release requirements: archive root `manifest.json` with exact `sha256` hashes of all and only `app/` files; unchanged original bundled GLBs; `npm test` and `node --check` on every JS/MJS file run against the final extracted archive. Browser playback with a real remote IPTV/HLS URL still requires live validation.

## v0.2.173 — Outdoor Infrastructure drawing

Draw line, polyline or freehand roads, footpaths, curbs, walls, metal rod / wire mesh / plank fences, or hedges from Add > Outdoor infrastructure. Complete with Enter or Create, cancel with Escape. After adding, use the compact object inspector to adjust lanes, road surface, marking colours and spacing, traffic direction, curb / footpath options, streetlights and fence dimensions; each path is one saved furniture object with static collision surfaces, preset support, undo and room synchronisation.


## v0.2.174 — Continuous roads, native inspector drawing

- Joined 3D road, footpath and curb ribbon surfaces share indexed vertices through every curve and corner. No disconnected rectangular slabs or triangular gaps.
- Single, polyline, and freehand drawing run directly inside the existing movable Properties window. No additional infrastructure drawing popup is created.
- Canvas preview displays committed path segments only; the cursor cannot drag a ghost line over application controls.
- Add-tool selection opens road/wall/fence/hedge settings immediately and creates a provisional (unsaved) drawing target. Commit after a valid path; Cancel removes it without persisting.
- Lane numbers are integers from 1–6, with whole-number shared slider stepping and readable values.
- Indexed road mesh supports a static Rapier trimesh collider so characters and XR teleportation see continuous surfaces.



## v0.2.175 — Live infrastructure construction

- Show real generated 3D infrastructure geometry immediately after two committed ground points: textured walls, plank/mesh/rod fences, hedges, curbs, continuous paved footpaths and roads including lane markings and streetlights.
- Rebuild the live construction preview when Properties values change, so dimensions, height, textures, fence spacing, road settings and smoothing are visible before saving; no pointer-following phantom line.
- Keep preview geometry isolated from the saved scene and collider world; dispose temporary geometry, textures and materials between updates, and throttle freehand preview construction for WebXR.
- Single-line drawing remains editable until the user chooses Finish; Cancel restores original infrastructure furniture properties and appearance, and no draft is saved or transmitted.
- Add runtime-mocked drawing and preview regression tests, verify all JavaScript syntax and watcher-compatible versioned ZIP with SHA-256 for each application file.
