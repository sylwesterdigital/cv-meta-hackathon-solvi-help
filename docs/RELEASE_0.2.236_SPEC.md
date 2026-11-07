# SOLVI.help v0.2.236 — Creative robot construction, not conversation

## Reproduction

A human sent `@All hey robots, can you mess around and start building procedural mega strcutures please.` Albert and Viola replied with ideas but no build action. Another named request to create a 1 m yellow cube at Albert's front was treated as dialogue; their work orders either did not exist or remained stalled. Prior group queue only supported small pre-approved housing/park goals, while arbitrary primitive creation was not exposed to the robot editor.

## Implementation

1. The authenticated, saved human @All creative instruction now creates three distinct pending server tasks (`message_id:0`, `:1`, `:2`), each assigned only to one free editable non-controlled robot. The parent message remains the authorisation. A repeated identical group message while pending is deduplicated. Other work orders are preserved.
2. Megastructure projects create a bounded tower, arch or pavilion with eight individually named and saved cube components. An explicitly requested 1 m cube is a one-component project; the backend verifies the corresponding expected count. These are functional meshes using existing Three.js primitives and Rapier static physics, not imagined constructs or opaque model output. Projects within the current room are limited to a <=7m building site and <=12m height.
3. A direct `@Albert ... create and add a yellow cube 1m ... in front` invokes the same checked primitive tool with a 1x1x1 m yellow cube at a robot-relative position. The existing Work orders Local project mode also accepts creative goals.
4. The robot walks to a collision-checked building site, records the exact site, creates one part, waits for a normal authoritative /api/scene/object persistence acknowledgement, then continues. Any failed save retains the pending part ID; a reload or handoff reuses the persistent object name/project ID. Placement also checks actual nearby robot footprints to avoid creating geometry around workers.
5. Work-order state stores bounded creativeSite/creativeBuilt/creativePending keys, validated by Flask. Group completion independently validates eight saved, owner-owned cube objects with project-specific names and dimensions. No group task is completed merely by model dialogue.
6. After repeated failures the task can safely release and retry with another editable robot. No teleport, remote editing, hidden API-key use or scene-object deletion was added.

## Watcher acceptance

- Confirm all JavaScript tests, browser modules graph and Flask/SQLite integration pass on the Mac watcher. Verify version 0.2.236 and full ZIP SHA-256 manifest.
- In a signed-in 3D room with at least three eligible free editable robots and a clear exterior workspace, submit the literal @All megastructure command. Brain must show `GROUP DELEGATED`, `CREATIVE SITE COMMITTED`, `CREATIVE PART SAVED (1/8 ... 8/8)`, and `CREATIVE PROJECT VERIFIED`, separately for each worker.
- In a second client reload confirm cube primitive IDs, color, geometry and ownership persist. Force one saved object to be missing; the backend must reject completion, and the browser must rebuild only missing elements on continuation.
- Ask one free robot for a yellow 1 m cube in front. Verify the physical object's colour/size and authoritative saved position, not a chat response. Verify blocked worksite/permission errors cannot claim completion.
- Verify Box-copy cleanup, ordinary house orders, media, original GLBs and existing saved realms are untouched.

## Explicit limitations

- This version implements bounded template-based procedural creative structures, not unrestricted AI-generated architectures, cross-realm environment generation, or 24/7 server-based 3D simulation.
- Scene editing requires an authenticated visible browser with edit rights and a clear, reachable worksite; imported models may still obstruct pathfinding. Full live browser acceptance is mandatory after deployment.
- The local sandbox can run Node and Python syntax tests but may lack full Flask/npm dependencies; watcher is authoritative for integration deployment.
