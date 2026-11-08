# SOLVI.help v0.2.243 — Supported example instructions and interactions

These commands are for **v0.2.243**. An authenticated browser, editable robot, active realm, and Meta model configuration are still required for model-designed construction. Some work takes multiple cycles. A chat acknowledgement is not proof of a scene edit.

## 1. Use `$` to refer to an existing realm object

In the chat composer type:

`@Albert go to $`

The object menu should open (even though `@Albert` appeared earlier). Select `MointainMovieLounge1-2-c` or another real object. The application inserts a reference containing the object's saved ID. Send the message and verify an actual movement receipt. If the selected object was removed before execution, the server must reject it rather than choose an object with a similar name.

Filter by folder or part label with `@Albert go to $Pink` to find a matching member of a pink creative collection. Only actual scene objects are executable navigation targets; collection folder headers are organization, not physical objects.

## 2. Select an object from the 3D world

Click a saved primitive in the 3D stage (for example an old `SOLVI Creative` float cube). The **Objects** window should open, its collection expand, and the exact selected row should be highlighted and scrolled into view. Selection does not move the camera.

## 3. Work with collapsible collections

Open **Objects**. New robot-created builds appear as folders such as `Albert - Pink Elephant Metropolis 001A` (the suffix varies). Expand the folder to show primitives labeled `cube · ...`, `sphere · ...`, or `cylinder · ...`. Historical robot creations are auto-grouped under stable `Creative build ###X` folders. Use **Rename** to apply a better project name. All original primitive IDs remain in the saved scene.

To make a collection manually: choose **Bulk**, tick at least two editable unlocked non-robot objects, choose **Group selected**, and enter a short name. The new collection is saved as metadata on each member. **Ungroup** removes the membership without deleting the primitives.

## 4. One transform gizmo for a collection

Enable **Edit** mode, open **Objects**, and click **Move** on a collection whose members are all editable and unlocked. Use **G** (translate), **R** (rotate), or **S** (scale), or the transform buttons, to manipulate all members with the same pivot. Release the gizmo; each member's resulting pose is persisted through the normal scene-save path. Move a small collection a short distance and check positions after a second browser reload. Grouping does not merge geometry and does not remove individual editability.

## 5. Test automatic project organization

`@Albert perform an extreme creative session of building an amazing metropolis for pink elephants.`

Expected: a time-bounded creative assignment, model design, saved primitives, and a readable named collection per project. The design content depends on Muse. Verify `MUSE DESIGN COMMITTED`, `CREATIVE PART SAVED`, and independently saved scene objects. It should **not** merely say that no task is scheduled.

`@All perform a creative session of building a surreal public square with sculptures, arches and landmarks.`

Expected: separate supported work assignments to available editable robots rather than duplicate unowned work. Completion requires actual saved scene objects.

## Watcher and live acceptance

Run `./solvi-watch.sh --once` after dropping the intact ZIP into `updates/`. On the live service, test both current and historical robot collections. Check object selection, searches, group translate/rotate/scale, reload in a second browser, and the `$` autocomplete from a message that already contains `@Albert`. Locked, read-only, and robot members must not be movable through a collection gizmo.

**Limitations:** Folder metadata is persisted with members, not an independent scene item; existing completed projects still retain original internal names for receipt verification. Group transforms persist member objects individually rather than in one atomic server transaction; partial network failures may require retry/reload. The 3D and Flask integration checks must be performed by the Mac watcher/live browser.
