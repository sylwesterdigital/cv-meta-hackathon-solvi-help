# SOLVI.help v0.2.199 — Outdoor drawing and initial placement compatibility

## Problem

Clicking **Add → Outdoor infrastructure → Draw road** in a wide, outdoor scene immediately displayed a false “No visible, collision-free space” error before the first path point. The camera had a clear view of ground, and roads are intentionally laid out over larger distances than the maximum radius used for small furniture placement.

## Cause

`startInfrastructureDrawing` creates an empty provisional infrastructure draft through `SceneEditor.add('furniture', false, undefined, false, 'infrastructure')`. The v0.2.197 automatic placement gate was applied unconditionally to all furniture, including these hidden drafts. It incorrectly tried to find a camera-near place for a road footprint before the user drew the line. Distant ground and existing nearby objects caused a draft rejection, so drawing could not start.

## Required behaviour

1. **Roads, motorways, footpaths, curbs, fences, hedges, wall lines:** start drawing instantly without testing camera-distance, object footprint, collision or target occlusion; collect world-space canvas click positions and build a preview from the actual path; save the completed path using normal per-object scene persistence.
2. **Vegetation polygons and similar sketched areas:** collect polygon points, then create a temporary unsaved object whose final origin/geometry is assigned by the polygon workflow. Do not require a successful furniture-placement candidate.
3. **3D curves and paired portals:** objects created with later explicit coordinates should not be blocked by the new-primitive placement policy. Both must still save their completed objects through existing scene handlers.
4. **Ordinary primitives/furniture/tools/equipment/presets:** retain smart camera-visible, collision-aware initial placement, including surface support for small tabletop props. Do not disable collision detection globally.
5. **Persistence/security:** do not publish or save an unfinished draft; use the same authenticated per-object scene save and backend validation when finished. Keep the previous v0.2.196 scene data protections intact.

## Implementation

`app/js/editor.js` introduces an `explicitlyPositionedDraft` guard inside `SceneEditor.add` limited to `persist=false` with `kind` `curve`, `portal`, or furniture variants `infrastructure`, `groundPlot`, `cropBed`, `waterPatch`, `vegetationArea`. These drafts skip smart positioning, do not change the recent-placement anchor and start at zero until the drawing system provides their coordinates. The road drawing module itself already uses a ray-to-ground plane intersect with no 15m distance cap, and `finishInfrastructureDrawing` transforms the user's world-space path points to local coordinates before calling `queueSave`.

## Automated acceptance tests

`tests/release-199-drawn-infrastructure-placement.test.mjs` executes the real editor `add` method with smart placement forced to fail; verifies all five furniture draft variants, curve, portal; verifies ordinary furniture and primitives still fail safely and successful ordinary furniture still saves; and checks the source interfaces for road/path, vegetation, curve geometries, and persistent completed path saves.

## Live acceptance checklist

- From an elevated camera view away from the buildings, use **Draw road** and draw a road by clicking two or more distant ground points; verify no collision toast, see the preview, finish and see the road.
- Repeat with **Draw motorway**, footpath, fence and hedge; confirm they follow actual cursor-drawn points rather than spawning by the camera.
- Draw a remote forest / crop plot; draw a 3D curve and create a portal pair; confirm they can complete in crowded scenes.
- In a room, add a can to a tabletop and a larger item to a floor. Normal placement collision/visibility protection must remain.
- Reload the room and log in with a second browser account. Confirm all finished paths and objects exist, and inspect Live diagnostics for actual save errors rather than only presence-sync.
- Do not infer restored missing historical furniture from this fix. If objects were deleted previously, inspect existing SQLite backups/snapshots separately.

## Verification limits

Full JavaScript test suite, backend syntax and manifest verification are required for release packaging. Browser WebGL pointer behaviour and actual two-client authoritative multiplayer saves cannot be simulated by the unit suite; confirm after watcher deployment.
