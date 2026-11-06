# SOLVI.help v0.2.214 — City teamwork and speaking portrait

## Trigger and permissions

Start in Robot routines → Work orders → **Start city team** (explicit confirmation). The button assigns up to eight eligible editable robots to housing, roads, pedestrian paths and community furnishing roles. Existing generic local construction tasks may be replaced on explicit confirmation; existing named can-cleanup and other important tasks are preserved. An explicit human `@all start building more roads`, `@all start building more homes`, or `@all start building a city with homes roads parks` assigns only idle editable robots. Conversation by itself, without a direct construction command, does not create objects. A robot already under direct control is not assigned.

## Execution

Each role is a saved local_project work order, with bounded milestones and a common proposed neighbourhood anchor. The normal planner finds a collision-checked staging position; unreachable common locations fall back to a verified reachable local site, and failure remains a failure. Housing: up to two 5×4 m shells/floors plus furnishings. Roads: two independently saved 8 m procedural roadway segments. Footpaths: two 8 m pedestrian paths. Commons: table, chairs and drinks using existing generator. These are limited object additions, NOT a general-purpose city layout or continuous human-level urban planning. Road segments are not claimed to link every home unless verified in the live realm.

Per-robot work-order state stores the team ID, role, bounded anchor and actual created scene IDs. The backend validates this data and scene edits still require the existing owner/room policy, object-save checks and no destructive scene resets. The robot Work orders status and Brain log expose milestones and blockers. No extra Meta inference is required to perform local role steps.

## Portrait

When voice playback actually starts, one pink masked microphone appears near the bottom of the round portrait, not across the face. The outer border alone gently pulses; reduced-motion preference is respected. Existing non-speaking failed-task orange dashed border is separate.

## Verification

Run full npm test, backend standalone checks, syntax checks and fresh ZIP manifest verification. In two signed-in clients confirm changing positions and voiced mic marker, create a city team and inspect actual new roads and houses after a reload. Test permissions with non-owner robots and blocked sites: no false scene mutations or completed-task claims. The browser tab must remain open. Live Meta, Flask HTTP, scene authorisation, multi-user sync and watcher deployment remain unverified until executed.
