# SOLVI.help v0.2.208 — Drink, Backpack and Hand Interaction

## Issue
Previous releases treated a backpack visible in the GLB as purely cosmetic unless a separate scene backpack object was stored as `type:worn`. Cans and bottles spawned as ordinary furniture rather than pickable drink items; even when physically carried by the legacy `ObjectCarry` system, Shift+I and U did not work because the item lacked a persistent `held` record. This was contradictory to the I key and Held inventory UI.

## Implemented flow
- **I**: pick up a nearby eligible can/bottle into a hand (or drop what is currently held). Can/bottle props now spawn with `pickable=true`, `inventory:{category:"food",size:"pocket",consumable:true}`.
- **Shift+I**: stow a held item *directly* into the functioning backpack, not automatically into a pocket. A legacy temporarily carried can/bottle is converted to Held first. If there is no functional backpack, Inventory → Backpack gives a clear enable option instead of silently pretending the model is an inventory container.
- **U**: drink the contents of a held can/bottle. It becomes **Empty Can** or **Empty Bottle** (`consumable:false`) in the same hand; no object is deleted. Further drinking is rejected. Existing shovel/tool U actions are untouched.
- **B**: open/close inventory. Held shows explicit To backpack and Drop controls and shortcut labels. Backpack tab shows status and an Enable/Disable avatar backpack control only when the avatar does not already have a separately equipped scene backpack.
- Backpacks represented by worn scene items use their existing stable object ID; avatar-integrated backpacks use the robot's ID as a virtual bag reference. The latter is *explicitly activated* and saved as `backpackEnabled` on the robot. There is no unreliable inference from unlabelled GLB meshes and no duplicate rendered backpack. Both have 24-slot capacity and the existing permissions model.
- Server validates the new robot flag, rejects remote storage into unenabled or unauthorized virtual bags, and bulk scene validation checks avatar-bag references. Disabling an avatar backpack with contents is blocked. Removing its robot holder releases bag contents into the world.

## Persistence & compatibility
Only a backward-compatible optional `backpackEnabled:boolean` robot scene property is new. No SQLite schema migration. Existing backpack furniture and equipment objects, rooms, can/bottle geometry, owner IDs, and all other inventory storage types remain unchanged. This release does not automatically classify every decorative backpack mesh as a physical container: click **Enable avatar backpack** once if the backpack is baked into the avatar model.

## Verification checklist
1. Create can and bottle; press I to hold. Press I again to drop. Confirm persistence and two-client scene identity.
2. Hold can; press U, becomes Empty Can. Press U again: no second drink. Press I to drop empty can.
3. Avatar with a scene-worn backpack: hold can; Shift+I stores it, Backpack tab lists it, Held again retrieves it.
4. Avatar with only a backpack model: B → Backpack → Enable avatar backpack; hold can; Shift+I stores. Attempt disable with contents: refused; after emptying: can disable.
5. Existing legacy `robotCarry` can: Shift+I/U promotes to persistent Held first, then performs requested action.
6. Confirm HTTP object-save authorization, bulk validation, room reloads, and two-client appearance. Production checks require Mac watcher and a browser.
