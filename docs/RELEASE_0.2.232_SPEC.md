# SOLVI.help v0.2.232 — Group delegation and verified box collection

## Reproduction

At 14:35 in loft-16, @all instructed the robots to move the `Box copy…` items to `Bin - Big Junk`, which had been named in earlier chat near BeachUmbrella. Five robots gave acknowledgement speeches. Lea’s saved cleanup order used the original phrase “to the bin” and failed `No unique explicitly named junk bin found`; no object was moved. The user’s @all message was not committed to any worker.

## Implemented

1. Recognise the human-authored `@all` cleanup request, including passive phrasing and spelling mistakes (`Bbig bin`, `need to be moved`). Chat greetings and negative commands are not work orders.
2. Consult only earlier HUMAN messages and the currently loaded scene for the named `Bin - Big Junk`. Resolve a unique concrete scene ID. If not loaded, save the named destination for a future browser retry; never choose a similarly named Small Bin. A real ID is required before any pickup.
3. Rank available, editable, not-human-controlled, non-mission robots by distance to the actual Box copies. Select **one** delegated worker to prevent simultaneous duplicate pickup attempts. Persist its task and original message ID before the first physical action, then retire obsolete idle copies of the old cleanup mission.
4. Execute one actual Box copy per cycle using checked navigation, the inventory hold tool, server-acknowledged storage for native bins or physical drop near a modelled bin. Each item is independently verified. A modelled bin does **not** gain a hidden inventory or claim “stored inside”; receipt says “delivered beside”.
5. A later `@all` bin-name clarification updates the same stored task; model speech is not treated as an authorized destination correction.
6. On success suppress five redundant model acknowledgements in the initiating browser. Other chat behaviour remains unchanged. Execution is browser-only and requires a signed-in, visible 3D scene and edit permissions.

## Safety and limitations

- No arbitrary scene deletion, teleporting objects, fake move receipts, remote camera movement or bypass of inventory permissions.
- Not a general distributed scheduler across disconnected browsers. Only a single available operator’s browser runs verified scene actions, as in the prior architecture. Multiple simultaneous web operators should not be used as independent schedulers for the same room.
- Imported-model bins accept safe **nearby delivery**, not real container storage; a native procedural bin is required for inside-storage receipts.
- If the user-named bin does not exist in the loaded room, the task reports an explicit missing target; no unrelated container is selected.
- A blocked path, permissions error, or oversized box remains a real blocker; the job retains failed-item retries rather than asserting completion.

## Acceptance checks after watcher deployment

1. In a room containing Box copy1–Box copyN, exactly one editable idle robot is assigned when the logged @all message is sent.
2. Brain: `GROUP DELEGATED`, `ORDER COMMITTED`, `ACTION STARTED`, then `BOX STORED` or `BOX DELIVERED NEAR` after a scene-save receipt.
3. The actual Box copy object is removed from its initial location, and the new storage or near-bin pose is visible after reload to a second client.
4. Busy robots are excluded; a user-controlled robot is not dispatched; the closest available robot is selected.
5. Negative requests and chat greetings do not assign work; a wrong Small Bin is never used for a named Big Junk destination.
6. Confirm watcher `npm test`, backend integration, and browser route execution. This ZIP has NOT been deployed.
