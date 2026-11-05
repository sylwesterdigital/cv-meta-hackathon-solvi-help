# SOLVI.help v0.2.198 — Smart Surface Placement (Implementation Specification)

## Problem
The previous ground-only v0.2.197 planner treated physical tables and even an entire raised house floor as blocking obstacles. In a furnished room it often refused to create any object despite clear visible space on tables, producing the toast "No visible, collision-free space".

## Behaviour
1. New small props (can, bottle, mug, glass, plate, bowl, flowerpot, box, keyboard, trackpad, mouse, printer, laptop, miniComputer and sufficiently small geometric primitives) may use tabletop support surfaces.
2. Eligible small props first search real table/stool/cabinet top geometry; if none visible/available, search raised floor slabs; otherwise use the existing unobstructed ground planner.
3. All other objects can use horizontal cube/plane floor slabs or original ground search, but cannot be stacked on desks by accident.
4. A support object's own collider is deliberately excluded from collision and occlusion checks only for *that surface*. Every other obstacle, including another placed object and real walls, remains enforced.
5. All four corners of an object footprint must fit inside the support polygon; no overhang for rotated tables or circular tops. Use true support height plus a small clearance and project the resulting 3D target through the current camera.
6. Respect last-added anchor when nearby. Never publish a rejected initial position; manual transforms after placement remain unchanged.
7. Scene storage, existing objects, work orders, network protocols, and database schema remain unchanged.

## Validation checklist
- Add several cans/bottles onto one table; second object should be nearby and not overlap.
- Place table and chair on a wide primitive red floor slab; the slab should not invalidate placements.
- Test walls, occluded rooms, round tops, narrow desks and a completely full table.
- Reload browser and compare items/positions across two signed-in clients.
- Run complete JavaScript regression suite, backend syntax/standalone tests, archive SHA-256 verification; verify unchanged GLBs.

## Scope limits
The algorithm approximates flat tabletops and floor slabs from genuine procedural dimensions, not arbitrary mesh/model tops or cabinet internal shelves. Full browser and production multiplayer validation is still required.
