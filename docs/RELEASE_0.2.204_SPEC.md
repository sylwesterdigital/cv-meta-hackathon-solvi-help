# SOLVI.help v0.2.204 — Skinned Tool Grip Profiles: Implementation Specification

## Problem

The v0.2.200 held inventory attached every tool with the same inferred hand bone and a hardcoded single-axis tilt. In real use an axe, shovel, broom and saw need individual bone references, two-handedness/handedness, model-local handle anchor and independent orientation/position calibration. The previous UI offered no held-tool grip editor; a similar editor existed only for backpacks.

## Implemented scope

1. **Scene-backed grip data**: `inventory.grip` may contain independent `right` and/or `left` records. Each record contains `bone` (`hand` by default, aliases or `rig:ExactBoneName`), `followRotation` (bool), `position` (3 signed metres relative to bone-space), `rotation` (3 signed degrees), `anchor` (the selected contact point in *tool-local metres*). No schema migration.
2. **Hand and bone selection**: grip editor lists semantic aliases and the actual available bone names on the current avatar rig. The bundled avatar has `mixamorig:RightHand` / `mixamorig:LeftHand`; these are preferred by default. Missing bones fall back to the matching hand, then the auto hand finder or a body-relative pose. A rig entry for the opposite hand never crosses hands.
3. **Authoring UI**: Inventory → Held → Switch hand changes the occupied hand only when the target hand is free; Grip switches to Edit mode and selects the equipped tool. In selected object properties, Tool grip controls edit the right or left profile live, including offset, rotation, handle contact and reset to per-tool defaults. Requires edit ownership.
4. **Multiplayer**: Saving uses the existing object-level scene snapshot / `queueSave`, with strict server validation through `valid_inventory_item` and `valid_tool_grip`. All clients reconstruct the same held pose after avatar animation. Presets use the same validated inventory schema; realm exports/imports carry object inventory and holder references.
5. **Safety**: numeric position/rotation/anchor ranges are ±2m / ±720° / ±3m; invalid values and unknown bone tokens are rejected server-side; no arbitrary JS/HTML code in bone names.

## Acceptance tests

- Equip shovel and saw independently: default handle contact must differ; hands follow corresponding animation bones.
- Adjust each tool's bone and offsets in Edit mode, save, reload scene, and confirm the position remains stable.
- Select an actual Mixamo bone; after switching to a different avatar lacking that bone the tool must remain on the correct hand.
- Try both right and left-hand values; ensure updates do not modify the opposite side's profile.
- Check the Switch hand action refuses a hand already occupied; also check malformed floats, unexpected keys and opposite-hand bone names do not pass backend persistence.
- Verify a tool preset retains grip data and multiplayer clients see the same animated attachment.
- The Use action still displays a not-implemented notice; no false digging or damage claims.

## Deployment and verification

Full local Node/standalone backend tests and fresh-ZIP SHA-256 manifest verification must pass. The Mac watcher performs the Flask integration check and then GitHub/Ubuntu deployment. Live rig calibration and two-browser appearance need manual verification after successful deployment; the deployed version is unknown until then.
