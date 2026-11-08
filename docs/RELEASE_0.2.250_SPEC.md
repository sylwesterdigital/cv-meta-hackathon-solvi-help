# SOLVI.help v0.2.250 — Verified wide eyes and operator autonomy recovery

## Changes

1. **Real automatic wide eye frames.** The 210° × 135° local mosaic is produced from six genuine 512×512 head-camera JPEG Blobs, not six frame descriptors. Previous `Promise.all(frames.map(imagePixels))` passed metadata objects to `createImageBitmap()`, causing a `TypeError` and repeatedly showing the narrow raw JPEG. The fixed stitcher passes `frame.blob`; a behavioral test mocks `createImageBitmap` to prove it receives six Blobs. The Eyes toggle continues to trigger automatic surveys for the selected authorized robot. A small refresh icon remains as a recovery affordance, without a prominent `210°` button label. The central 72° JPEG is preserved for detailed Muse perception; the wide panorama is a *sequential approximation* of peripheral field of view, not live binocular stereo.
2. **Meta autonomous proposals.** A valid proposal previously reached `audit_event('robot-autonomy-proposed',...,action=plan['action'],...)` and raised `TypeError: multiple values for argument 'action'`, because the helper already takes `action` as its first positional parameter. This returned a misleading `502 meta-internal stage=parse-decision`. The audit metadata now uses `proposed_action`, with *no change* to tool authorization, model schema validation, or browser-side physical execution. Invalid proposals still cannot execute tools.
3. **Creative worksite recovery.** When the signed-in robot has an authorized creative work order but no safe site, its existing validated Muse design and project IDs are preserved. Search now considers a small additional set of more distant sites *only when actual collision-checked paths meet the existing 90 m travel cap*. A ground-level worker may make up to two collision-checked `recover_route` relocation attempts before deferring for an extended window. An upper-level robot with no supported verified ground transfer defers instead of repeatedly attempting ground-level construction every eight seconds. State is saved in the same work order (`creativeSiteFailures`, `creativeSiteScouts`, `creativeRetryAt`, `creativeNeedsScout`). No teleportation, collision bypass, or automatic construction on unsupported floors is introduced.

## Validation performed in the release environment

- 1,200 / 1,200 JavaScript tests passed.
- New functional image test actually invokes `stitchRobotWideEye` with six JPEG Blob arguments and rejects frame descriptors.
- New recovery tests cover bounded retries, above-ground deferral, and reachable alternate worksite search.
- Meta proposed-action audit conflict checked in source; Python backend syntax passes.
- Python creative design, scene collection and Nginx checks passed.
- All changed JavaScript modules pass Node syntax checks.
- ZIP archive and per-file SHA-256 manifest must match for deployment.

## Mac watcher gates not available in this isolated sandbox

- `python -m pytest` / full Flask-SQLite API tests (Flask is not installed here).
- Browser module graph with generated Three.js vendor files (`node scripts/prepare_vendor.mjs` then `node scripts/check_browser_modules.mjs`).
- Live Meta `POST /api/robots/autonomy/plan` response with six camera frames; confirm a successful `META PROPOSAL` rather than `parse-decision 502`.
- Genuine 3D rendering, six-frame mosaic, navigating alternate ground sites, refresh, and two-client persistence.

## Acceptance checks

- In a signed-in, visible 3D session, select a controllable robot and enable Eyes. Wait for the local six-frame survey. The last-eye preview must show `Stitched wide eyes` and scenery beyond the narrow central view. Brains → Vision → Capture eyes still produces a raw central image, by design. No `createImageBitmap` TypeError should appear.
- Start Meta agent planning on Lola with a bounded goal, six-camera vision and scene changes as authorized. A valid model JSON proposal must yield `META PROPOSAL` and a validated tool action without `TypeError parse-decision` errors; if the model itself refuses or returns invalid JSON, no scene edit is allowed.
- Start a creative project on open ground. If the initial site is obstructed, look for `CREATIVE RELOCATION PENDING`, a genuine navigation result, and a new site search; no same-position eight-second failure spam. If an avatar is on an unsupported upper floor, expect `CREATIVE SITE DEFERRED`, not a virtual teleport to ground.
- Switch realms mid-wide-capture and verify that the capture is discarded and no old-realm image leaks into the new realm. Verify all project member IDs and objects persist across reloads.
