# SOLVI.help v0.2.215 — Multi-storey procedural furniture placement

## Problem and root cause

On the third floor of a procedural multi-storey building, Add object → Table/Chair and saved presets could show “No visible, collision-free space.” The existing support detection recognised only primitive `cube`/`plane` floor slabs and selected tabletops. A building generated as a procedural `wall` object stores each room ceiling as a `wallCeiling` mesh; the ceiling of one storey acts as the floor of the next, but previously appeared only as an obstacle. Ground-level fallback could not reliably reach elevated rooms.

## Implementation

- `js/scene-placement.js`: Enumerate actual horizontal structural slab/flat-roof meshes inside each procedural wall group; derive the top elevation and world-space upper-face triangles from the real transformed geometry (including repeated room arrays). Do not assume every wall group or steep roof is a floor.
- `js/smart-placement-math.js`: For structural supports, compute exact triangle–footprint rectangle intersection coverage instead of accepting only rectangle corner tests. Lift holes, skylight openings and concave outlines are not usable surfaces.
- Tag each supporting ceiling’s obstacle independently; only ignore its own collider, never the whole `wall` group. Preserve occlusion, collision and object-size checks for all neighbouring room walls and existing furniture.
- If an elevated floor lies beneath the camera but no clear visible candidate exists, reject Add instead of placing a new item invisibly on the ground level. Existing cube and plane floor support, tabletop placement, saved presets, edit history, object-level persistence and ownership remain as before.

## Verification

Targeted source-level regression tests cover: third-floor structural support detection; real upper-level chair placement; walls remaining collision blockers; rejecting an object spanning a lift opening; rejecting a fully occupied elevated floor rather than dropping an item to ground; and excluding sheer walls and pitched roof surfaces. Run full Node tests and the available backend standalone checks. A WebGL browser and live multiplayer session are not available for complete user-facing verification in this environment. No production deployment claimed.

## Manual acceptance after Mac watcher deployment

1. Open an existing saved vertical Room Array building with ceilings enabled and enter its third floor. Press Shift+A and add a Chair, Table, Sofa and Stool. Verify they appear on the third-floor surface rather than ground level. Reload and check all new objects and the original room are intact in a second signed-in client.
2. Repeat with one recently saved furniture preset. Confirm its base rests on the same level.
3. Add a table near an edge and lift opening; attempts to span open space, overlap a wall/other furniture, or place behind a wall must be rejected. A valid patch of floor elsewhere should still accept furniture.
4. Test ground-floor rooms, independent cube/plane elevated floors, existing tabletop can/bottle placement and visible small objects to confirm no regression.
5. If an upper floor has no ceiling slab and no independent floor, placement must not invent a support. No new floor geometry is created by this patch.

All original bundled media/3D assets remain byte-for-byte unchanged. No SQLite migration, new browser dependency, or authority relaxation.
