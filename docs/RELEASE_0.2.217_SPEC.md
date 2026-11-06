# SOLVI.help v0.2.217 — Furniture seat escape and floor-aware meetings

## Reported regression
A controlled or autonomous avatar may be trapped by a chair/sofa collider even after standing. A robot walking horizontally to another robot on a higher floor can report an encounter from a lower exterior wall. Peer initiators repeat generic non-actionable messages rather than sharing verified work.

## Fix
- Sitting to standing uses a bounded search: front, sides, back, each outside the furniture footprint by a capsule clearance. Samples the path against other objects at the current height, excluding only the seat being exited. Floor support is checked and floor height preserved. All exits blocked -> remain seated; do not teleport through a wall.
- When a controlled robot tries walking or a new autonomous path is requested, recover an already-standing robot only if its feet are genuinely inside an actual seat-footprint on the same storey. Avoid repeated automatic movement without new input; use current editor permissions and save the same scene robot ID.
- Social plan and final task result require compatible heights (1.25m tolerance) in addition to horizontal clearance. Idle roaming avoids selecting robots on another storey. If a peer moves floors during navigation, do not mark arrival.
- Suppress generic "I explored near X / what have you discovered?" questions from idle visits. A recent verified scene-construction receipt can be relayed instead. Never promote chat-only plans or displacement measurements to completed world edits.

## Limitations / non-goals
**This does not autonomously operate lifts, board cabins, climb stairs or complete multi-level peer visits.** A different-floor social mission is now reported as blocked pending a real vertical route instead of completed falsely. The existing elevator control is unchanged. Seat escape is a short local capsule recovery, not continuous collision animation. No new database schema or asset changes.

## Acceptance
1. On a third-storey room, sit on a chair near an obstruction. Press J. The avatar should move clear via an alternate safe exit without falling to the second or ground floor; other clients must agree.
2. Stand inside a sofa and press forward or start a navigation task; move at least half of the seat depth to clear the seating footprint. Test opposite wall and corner exits. If every exit is blocked, do not cross masonry.
3. Attempt to meet a colleague eight metres directly above the robot: a horizontal position near the building wall must NOT count as a meeting. Same-floor, open-door approaches must still work.
4. Enable idle roaming with many robots: repeated generic peer questions must stop. Verified construction receipts may be exchanged if a genuine encounter occurs.
5. Confirm all original room objects, independent avatars, GLBs, presets, inventories, user settings and work orders remain intact. Full dual-browser WebGL/Rapier behaviour is unverified until Mac watcher deployment.
