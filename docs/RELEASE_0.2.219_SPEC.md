# SOLVI.help v0.2.219 — Cargo running, lifting, conditional throwing and description filters

## Goal
Improve the existing verified Box copy → Bin - Big Junk workflow without turning object handling into mere dialogue or compromising permission checks.

## Changed
- On authorised robot work-order navigation, long obstacle-free route legs may switch temporarily to the Run gait and speed, returning to Walk near colleagues, obstacles, route bends and final approach. The normal path planner, physical collision and remote gait packets are retained.
- A floor-level object pickup can play an existing avatar Lifting/Pickup clip, independently of the acknowledged inventory hold; absence of an authored clip is not represented as an animation success.
- Physical throwing is optional and heavily constrained: live physics, ownership, an actual Throw clip, sufficiently wide open bin, same floor, no bystanders or corridor obstacles, and ballistic preflight. When attempted, the object must truly land inside the bin and receive a persistent server acknowledgement to count. A missed throw is logged once, then the robot reverts to carrying. A small bin or short route uses carrying directly.
- Constrain collection to mentioned colours and contents when supported by the scene object metadata. A box without known contents cannot satisfy a contents-specific instruction and is not blindly taken. The parser distinguishes a pink bin from pink boxes, supports exclusions, and retains stable IDs.
- The `cleanupThrowTried` array is validated within the existing saved work-order state. No database migration, destructive scene change, new credentials or avatar/media files are needed.

## Technical files
`js/robot-transfer-decisions.js`, `js/robot-autonomy.js`, `js/robots.js`, `backend/server.py`, version and regression files. Original objects remain bounded by existing inventory, bin capacity and owner/editor requirements.

## Acceptance after deployment
1. In Loft 16, put one pink and one blue `Box copyN` on the ground, plus `Bin - Big Junk`. Give Lea an explicit instruction **only the pink Box copies**. Check only the pink object ID is moved, with server-acknowledged bin storage and the blue object untouched.
2. Place a Box copy 25+ metres away on a straight unoccupied path. Observe a brief Run animation/speed, then Walk on approach or when another robot crosses the route. Both clients must display matching movement.
3. Use an avatar that has an authored Lifting clip. Check the clip plays during pickup from the floor, and the item is actually held via scene inventory.
4. For a physically large, open bin and no bystanders, allow a conservative throw; confirm an actual in-bin landing AND persistence across browser reload. For a miss or too-small aperture, the robot must carry it instead and never claim an unsuccessful throw as stored.
5. Ask for boxes containing an untracked item. Expect a clear refusal to guess which opaque boxes have that content, with no unrelated objects moved.
6. Verify all original assets, multiplayer scene IDs, permissions and bin capacity, backend operation, and Mac watcher deployment.

## Limitations
The physical throw test is source-verified, not calibrated against every rig, gravity/physics setting or bin variant. Throwing is not forced; it is skipped whenever the preflight or real landing fails. The source environment does not run live WebGL or two-browser tests. The application still executes robot work in a visible authorised client.
