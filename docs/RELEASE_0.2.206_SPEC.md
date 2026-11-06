# SOLVI.help v0.2.206 — Equipment Inventory Usability & Compact Tool Grip

## Problem
The v0.2.205 Held inventory displayed a very tall item preview that visually swallowed its action row, leaving no visible Drop/Store/Dig controls. The tool grip section exposed 9 numeric offsets and many technical choices simultaneously in a narrow object inspector.

## Acceptance criteria
1. Inventory → Held presents one or two **immediately visible** Drop actions above the scroll region, labelled with the equipped object's name and hand. The control disappears after a successful drop; unauthorized actions are disabled.
2. Inventory item rows must be compact and keep Drop/Store/Dig within view near the corresponding thumbnail. A preview must never consume available action height.
3. Dropping a held tool removes its scene `storage` claim, reenables visible world object physics, places the tool near the avatar and queues an object-level multiplayer save, preserving identity.
4. Tool grip editing exposes Hand, Bone, Angle and Tool action animation at once, with contact and position offsets under an optional Advanced accordion, which starts collapsed.
5. All per-hand grip options (bone, followRotation, position, rotation, anchor) remain editable and persist as previously. Opening Grip starts with Advanced folded.
6. UI changes do not affect robot scenes, SQLite schema, media, avatar binaries, or existing animation logic.

## Browser acceptance checklist
- Lemox holds a shovel; B → Held shows **Drop Shovel (right)** at the top. Click once; the shovel appears on the ground, leaves Held, and appears on a second client.
- Hold tools in both hands. Two individually labelled Drop buttons are visible. Drop one; the other remains held.
- Check another participant's equipment without edit rights: Drop is disabled.
- Open Grip from Held. Hand/Bone/Angle/Action animation are immediately visible. Advanced can reveal position and anchor and changes survive saving and reloading.
- Check 320px, 390px, laptop and desktop viewport widths. Inventory cards remain scrollable and Drop remains accessible without scrolling.

## Verification limits
Local automated DOM/action tests and source regressions cannot substitute for browser visual checks or production multiplayer tests. Watcher Flask integration and live two-client validation remain required.
