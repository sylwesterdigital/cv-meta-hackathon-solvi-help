# SOLVI.help v0.2.218 — Object transfer and task resilience

## Problem reproduced
Lea was told to collect `Box copyN` props into `Bin - Big Junk`. The command parser misread “can you” as a can-cleanup objective and routed it into a home/table-only routine. Even a physically picked-up box would have been rejected by the original empty-drinks-only bin storage validator. The logs contained misleading conversational agreement without a scene mutation.

## Implemented
- Distinguish modal “can you” from a physical can in local work-goal parsing.
- A direct `@Lea … Box copies … into Bin - Big Junk` instruction becomes a persistent `cleanup_boxes` work order, overriding an old unrelated mission. Only unique, explicitly mentioned bin names are accepted.
- Find procedural `box` furniture named `Box copyN` in the current room. Process one item at a time with normal owner/editor checks, functional inventory pickup, navigation, storage, and server-acknowledged `/api/scene/object` save. Box props stay the SAME scene IDs; no blind deletion or simulated completion.
- Bin may store small `general` procedural boxes as well as empty cans/bottles. The server checks item type, dimensions, ownership, unique occupied slots and capacity. Arbitrary furniture or full drinks remain rejected. If full, the work remains pending.
- After a route failure, attempt up to four collision-checked alternate approaches, with same-floor constraints. A failed object is deferred in a bounded, persisted skip ledger (reason, attempts, retry time); other eligible boxes may be attempted before the deferred item. A previously saved object can be re-verified after reload.
- Explicit, single-object transfer such as `@Lea pick up Box copy7 and put it in Bin - Big Junk` or `@Lea move Box copy7 to Table copy1` can create a persisted, owner-authorised local order grounded in exact, unambiguous scene names, without requiring a model response. Ambiguous targets are not guessed. Supported source object sizes/types are bounded and carry/drop still use the existing inventory tool.
- Live tool receipts appear as `CLEANUP ASSIGNED`, `BOX HELD`, `BOX SKIPPED`, `BOX STORED`, `CLEANUP FINISHED`, `TRANSFER DETOUR`, `TRANSFER VERIFIED` and `TRANSFER FINISHED`; ordinary chat alone is not evidence of success.

## Acceptance test
1. In `loft-16`, sign in with permission to edit Lea, the boxes and the target bin. Confirm `Bin - Big Junk` is present and has fewer than 24 items.
2. Send `@Lea please collect all Box copies into Bin - Big Junk`. Lea should physically approach and hold each reachable box and persist its storage claim against the named bin. Monitor the Brain log, reload both clients, and verify original object IDs remain with `storage.type=container`.
3. Deliberately block one box while leaving another accessible. The task should skip the blocked box, finish the other, and revisit the first later. A failed item must not cause false completion.
4. Ask a single-object move with unique names; verify one scene object moves, and no unrelated objects are touched. Use a destination named `Table` with multiple matches and verify the instruction is rejected as ambiguous.
5. Ensure empty can/bottle disposal remains functional and arbitrary furniture, full drinks, oversized boxes, and unauthorised items cannot be added to bins.
6. Verify replay, refresh, browser-based robot execution, cross-client scene deltas and rate-limit behaviour in the deployed WebGL realm. These live checks have NOT been run in this container.

## Limitations
This is a concrete deterministic transfer workflow, not unrestricted general-purpose model-directed manipulation. Bin capacity is 24, and it is inappropriate to silently destroy or shrink large items. Browser presence and scene-edit permissions remain prerequisites; no server-side physical avatar process runs without an active client. The alternate ground-floor worksite approach is not a new multi-storey elevator capability.
