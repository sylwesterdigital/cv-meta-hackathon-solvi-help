# SOLVI.help v0.2.207 — Tool Grip UI & I-key Pickup/Drop

## Problem reproduced
The equipped shovel could be picked up with **I** but pressing **I** again attempted to store it instead of dropping it. A shovel configured as backpack-sized therefore failed to stow without a bag, forcing repeated use of Inventory. The grip inspector remained too tall, with mixed label sizes and redundant instructions. Aiming a shovel could also close Inventory before an invalid ground click.

## Behaviour
- In robot-control mode **I** first drops the right-hand held item, otherwise the left-hand held item, otherwise picks up a nearby pickable object. Existing temporary `robotCarry` remains first priority and uses its normal drop path. **I does not require a backpack to release an item.**
- **B** toggles Inventory open/closed; **Shift+I** still equips/removes a backpack; **U** uses equipped tool; **O** throws a transiently carried object. Shortcuts are shown on buttons and in the robot shortcut overlay.
- The held-item Drop button remains above the scroll region and identifies the item and hand. There is no redundant in-card Drop. Failed actions do not hide Inventory. Grip editing and Aim dig keep Inventory open.
- The tool Grip editor follows the existing Transform design: Attach (hand, bone, follow), Angle ° (X/Y/Z plus reset), Action (clip). Advanced holds offset/contact X/Y/Z and is collapsed initially. No repetitive help paragraphs or mixed font sizes.
- A held item's physics body is intentionally absent. Its properties no longer display the misleading missing-body warning while held.

## Acceptance checks
1. Equip a backpack-sized Shovel with I. Press I again with no backpack: shovel returns to the world, Held clears, scene object save is queued. Repeat with left hand and transient carried objects.
2. Hold shovel; B shows Held, and B again hides Inventory. Press I while Inventory is open; it drops without hiding the panel. U triggers shovel Dig ahead. Shift+I retains backpack handling.
3. Click Aim dig, then a blocked or invalid spot: the panel remains open. Esc exits aiming. Valid dig continues using the existing excavation mark and multiplayer save.
4. Select Grip: compact attachment, angle/reset, and action clip are visible; Advanced stays collapsed until requested. Change each axis and hand, then reload to verify existing saved per-hand grip schema.
5. On a held item, do not show a missing-physics-body warning. Dropped world items retain normal physics diagnostics.
6. Verify the UI at 390px, 600px, and desktop inspector widths and test both clients in the same room.

## Data and scope
Existing SQLite schema, API routes, robot tools, scene persistence, assets, GLB rigs, model catalog, and original item IDs are unchanged. Full Flask HTTP tests and live visual alignment remain for the Mac watcher and post-deployment browser testing; no production deployment is implied.
