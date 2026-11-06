# SOLVI.help v0.2.205 — Held Tool Actions and Digging

## Intended user workflow

1. Control a robot, approach a Pickable shovel, then press **I** to Hold or use **B → Held → Hold nearby item**.
2. Open **B → Held**. **Drop** releases the same scene item to the ground with physics. **Store** uses a pocket or a worn backpack if the item's size permits. **Grip** opens per-hand rig bone, offset and angle editing; **Switch hand** uses the left/right profile.
3. For an equipped shovel, choose **Dig ahead** or press **U** to dig ~1.05 metres ahead of the avatar. Alternatively choose **Aim dig**, click a visible bare-ground position within 0.55–2.8 metres of the robot, or press Escape to cancel.
4. Digging checks the actual world floor and nearby persisted object footprints. No digging through floors, walls, occupied furniture, or another excavation marker. Invalid actions report why and do not write to the scene.
5. A successful dig creates an independent `furniture` scene object of subtype `excavation`: dark depression illusion, raised earthen rim and soil fragments. It receives an ordinary UUID, owner, scene history and queued room save; other clients see the marker through normal `scene-changed` reconciliation. The base ground is not cut or physically deformed: **an excavation mark is a visual world effect, not a navigable hole**.
6. If the avatar GLB includes an animation named Digging or another recognized shovel action, play that animation as a one-shot. Otherwise use a short procedural upper-arm/spine digging motion. The bundled `solvi-character.glb` has no Digging clip.
7. Every portable tool has a `Tool use animation` selector next to its grip settings, with `Auto`, `None`, or a validated clip from the selected avatar's actual GLB. Other tools may replay their configured animation, but no chopping, sawing, sweeping, or other irreversible target effect is claimed yet.

## Technical contract

- Registry: `js/tool-activities.js` (`TOOL_ACTIVITIES`, `resolveToolAnimation`, `digAheadPoint`, `validDigTarget`).
- Inventory: `js/robot-inventory.js` (`actionClip` sanitized through `cleanInventory`, Use and Aim buttons, existing Store/Drop unaffected).
- Editor: `performToolUse` verifies both robot and tool ownership, held-state relationship and tool variant; validates the site; constructs the excavation mark through `objectFor` + `rebuildFurniture`; queues per-object room persistence. `aimHeldTool` consumes a click before regular object selection; Escape cancels.
- Procedural visuals: `js/primitive-properties.js` includes the `excavation` variant. Its geometry is generated from standard primitives with the usual furniture colour/scale settings. Physics is `off` so the soil ring does not catch robots like a roadblock.
- Avatar animation: `js/robots.js` owns a bounded `robotToolAction` transient action, plays a matching GLB clip when authored or animates arms/spine as a short fallback. `held-equipment.js` then recalculates the attached tool grip from the updated hand bones every frame.
- Multiplayer animation: authenticated `robot-tool-use` WebSocket message, validated by `valid_robot_tool_use_message` in `backend/server.py`. The relay requires the caller to have control of the actor and the corresponding actually-held tool in the same room. Only the bounded action name and clip string are relayed; the client ignores unrecognized clips. The permanent excavation is synced separately by the ordinary scene object save, not by trusting a client `robot-tool-use` message.
- Backend inventory validation allows optional safe `inventory.actionClip` <=100 characters; the scene furniture allowlist includes `excavation`. No database schema changes.
- Existing backpack, pocket, tool grip, profile recovery, physics, scene revision and SQLite persistence paths remain intact.

## Verification/acceptance

- Equip shovel; B → Held → Drop: the same object reappears on the ground, with storage cleared and normal physics.
- Equip and switch hands; change grip; switch clips; save and reload; authored action clip remains and is validated by the server.
- Use U or Dig ahead on bare ground: an excavation footprint is created and appears after a scene reload and in a second client.
- Aim dig at empty ground near robot: target is accepted. Aim at a house floor, wall, table, previous excavation or beyond 2.8 m: no footprint is created and an explanatory warning appears. Escape cancels without any scene write.
- With a custom GLB containing Digging: play authored Digging clip. With the bundled SOLVI GLB lacking it: apply procedural fallback without pretending an authored clip exists.
- Send a `robot-tool-use` packet from a nonowner or without the matching held shovel: backend must reject it silently; no other client should animate.
- Other tool animations never damage users or edit the terrain; this is not an attack system.
- Both clients observe the excavation marker via scene persistence, while the temporary animation syncs over WebSocket when connected.

## Known limitations

- The shared Three.js ground mesh is non-deformable. Excavation currently adds a *visual dig marker*, with no cut-out, soil volume, obstacle-aware trench or altered Rapier ground collider.
- The existing avatar lacks an authored Digging clip. Procedural fallback is intentionally basic and depends on imported bone names/rigging. Custom avatars may be visually different.
- Sawing, chopping, raking, sweeping, and mopping have optional animation playback only; target-specific world edits are not included. No tool attack or damaging avatar contact is implemented.
- Full Flask HTTP integration and live two-client synchronization must be validated by the Mac watcher/browser environment.
