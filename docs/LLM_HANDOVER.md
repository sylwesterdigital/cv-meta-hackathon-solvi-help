# SOLVI.help — Master Project Handover for the Next LLM / Developer

**Document status:** Engineering handover prepared 31 October 2026.  
**Latest source prepared in this handover:** v0.2.95, **Profile-based, application-wide administrator session**.  
**Previous distributed release:** v0.2.94, `SOLVI_RELEASE_v0.2.94_FLASK_SCENE_REVISION_TEST_FIX.zip`.  
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
