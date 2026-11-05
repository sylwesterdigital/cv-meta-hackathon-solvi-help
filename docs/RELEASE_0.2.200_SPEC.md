# SOLVI.help v0.2.200 — Persistent Held Tools & Equipment

## Scope

This release extends v0.2.199 with an authoritative, scene-persisted **held equipment** slot. Tool objects remain actual scene objects rather than duplicated inventories. The UI now has Held, Pockets, Wearable and Backpack tabs; a Hold nearby item button; and Hold / Store / Drop item actions.

### Data contract

`storage: {"type":"held","holderId":"robot-editor-id","hand":"right"}` (or `left`) is a valid location for any pickable, non-world, non-wearable item. The same object ID moves between locations. A single hand cannot hold two objects. Scene saves validate holder existence, editor permissions, and duplicate-hand collisions inside SQLite's `BEGIN IMMEDIATE` transaction. Bulk scene replacement validates the same occupancy invariant and holder edit permissions. When an avatar is deleted, its pocket, held, and worn items are returned to world storage in the same server transaction, and a bulk scene change refreshes other clients.

### Avatar attachment

`js/held-equipment.js` locates the right/left animated hand bone (fallback to shoulder-relative avatar pose for rigs without a suitable bone), and updates held object transforms after character animation on every browser client. Physics colliders are removed while held. Long tools grip near the handle rather than at blade tips. The original GLBs are not modified.

### Storage rules

Small items may go to pockets when space is available. Large tools require an equipped backpack with spare capacity; without one they remain held or may be dropped. A dropped item becomes a dynamic scene object with its original ID. Wearables remain separate. Transient throw/pickup cannot start while persistent held equipment occupies a hand.

### UX

Inventory B displays Held tab and other tabs. `Hold nearby item` holds portable objects in an available hand. Each stored item has Hold and Drop; each held item has Store and Drop, and tool Use clearly reports that a specialised tool action is not implemented yet. Robot-mode I pickup prefers holding tools; pressing I while the right hand holds equipment attempts to store it.

### Limitations and safety

- Tool use (digging, chopping, sweeping, sawing) is intentionally **not** implemented; Use is a visible unavailable-action notice.
- Actual browser-based skeletal attachment must be checked with each avatar's GLB bone naming; a safe hand-relative pose is used when a rig bone is missing.
- Offline Flask integration and real-time two-client browser behaviour require the existing Mac deployment watcher and two live clients.
- Changes are not deployed by preparing this package. Back up production SQLite before deploying.
- Previously lost scene objects remain a separate, unresolved recovery problem.

### Manual acceptance test

1. With Physics enabled and a nearby procedural saw, switch to Robot mode, press I or open Inventory → Hold nearby item. Saw appears in right hand.
2. Walk/turn in two logged-in clients; both should see the same held saw following the hand.
3. Open Inventory → Held; Store should fail clearly if saw size is bag-only and no backpack is equipped.
4. Equip a backpack, Store saw, verify it disappears from hand and appears in Backpack. Hold again. Drop and confirm world object retains the same editor ID on both clients.
5. Hold another tool in left hand, reject a third, reload both clients, verify persistence.
6. Verify ordinary pocket items, wearable slots, transient object-carry/throw, construction and road drawing still function.
