# SOLVI.help v0.2.197 — Smart Placement of New Objects

## Problem

The default Add and saved-preset actions placed objects at a single camera-ground intersection regardless of distance, previous additions, obstructions, nearby furniture or room walls. This often put chairs, tools and appliances out of sight or behind walls. Manually moving many new items was tedious.

## Scope

- Apply to manually added furniture, procedural tools, equipment, primitives, editable text, and reusable saved-object presets.
- Prefer proximity to the last locally added object **in the same realm**. Keep candidate locations in the active viewport and as close to the viewer as is practical; when possible remain in the central 88% of the view width and 84% of its height.
- Use actual world-space geometry extents, respecting height and existing rotation. Test bounded candidate locations for collisions against furniture, walls, fences and other solids. Treat a wall group as separate physical segments so its bounding rectangle does not exclude the whole house interior; actual doors/openings remain usable.
- Check a three-dimensional camera-to-object sight line for occlusion. Ignore cosmetic ground plots, roads/footpaths and robots when estimating static placement collisions.
- If no visible collision-free candidate exists, do **not** publish/save the new object. Show a clear camera-adjustment message. For already-built preset objects, also remove the provisional local mesh and rigid body.
- Do not move existing objects. Do not modify scene storage format, change existing saved poses, or alter AI robot construction/navigation. Continue to permit manual position adjustment after creation.

## Acceptance checks

1. In a small enclosed room, add a table then several small objects: all should be visible, near one another and non-overlapping.
2. With an opaque wall crossing the centre of the view, additions should appear on the visible side instead of behind the wall.
3. With a door gap visible, the planner may place objects in view through that opening; it must not treat the room's entire bounding box as blocked.
4. With a completely obstructed frame, add must warn and leave scene-object count and room revision unchanged.
5. Repeat for saved presets and verify a second browser receives the same object pose; the backend scene record is still a normal room-scene object.
6. Enter a new realm: previous-room placement anchor is forgotten; all existing objects remain exactly where they were saved.

## Limitations

- Automatic placement is for ground-level newly created objects, not arranging decor on shelves or choosing a surface inside a cabinet.
- The planner uses conservative world bounding boxes for furniture and per-mesh footprints for wall structures; unusual hollow furniture and complex imported meshes may leave extra clearance.
- Real WebGL/camera and live multiplayer acceptance still require browser testing after watcher deployment.
