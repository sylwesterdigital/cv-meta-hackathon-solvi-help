# SOLVI.help v0.2.224 — Construction recovery and integration test repair

Release scope: repair the **undeployed** v0.2.223 backend test failure and improve execution of an authorised robot's existing multi-house goal in Nowhere. This is a complete application release, not a replacement of the Mac watcher or a remote production deployment.

## Deployment regression: missing Meta key versus deterministic vision command

v0.2.223 intercepted an explicit, valid `vision_search` operation when no Meta key was configured. The Mac watcher stopped in `backend/test_api.py` with `KeyError: 'command'`. The corrected route gives a saved transparent model-key notice **only** when no independently executable parser acknowledgement exists. Explicit `find the red sofa and sit on it` remains a real, six-direction visual-search task without a Meta key. Actual SAM perception may still need its own configured provider; a command's existence does not prove an image match or successful physical movement.

An invalid model planner decision or parsing error now produces a safely validated `invalid-model-plan` result rather than propagating a generic `TypeError` 502 to the browser. The model output is never executed directly.

## Executable direct named house requests

A human instruction such as `@Ania can you build one more interesting house but make it cosy interior?` now creates a persistent `local_project` work order on an editor-authorised Ania. This supersedes a stale house-building agent order, resets per-order failure counters, and starts real collision-checked construction. It does not require a Meta key and never edits other users' scene objects without permission. Discussion alone, an unqualified `go for it`, or a robot reply cannot start construction.

## Site recovery and bounded creativity

The supported house builder can create physical floor + wall shell with roof, doorway, windows, plus a bed, table, and chair. A plural house goal requests two, whereas an explicit *array* can request three, the existing persistent state limit. The builder retains scene-object IDs; a completed house restores a bounded retry budget for the next new house. Generated homes can vary supported dimensions and roof shapes. A cosy house uses a smaller footprint and a shed roof by default; it does not promise dynamically generated interior layouts beyond available tools.

If no clear building footprint remains, the robot can attempt up to two 15 m, collision-checked retreat/reorientation scouts; each allows four further placement attempts. If still blocked, Brain decision logs identify the site-search failure and preserve the unfinished objective. No teleporting, unchecked wall crossing, unlimited retries, or unverified completed house claims.

The state explains missing `Allow scene changes` permission directly instead of reporting generic model inactivity. Robots cannot override that setting or an owner restriction themselves.

## Optional human design question

A multi-house project can ask one short question *after the first verified house*: prefer a **flat, shed, or pyramid roof for the next house**? The answer is optional; construction continues with the default. A matching `@Ania flat roof` answer updates a saved preference on that authorised local project. It affects only the next unbuilt structure. The endpoint is authenticated, robot-owned, project-scoped, and rate-limited; it creates no billable Meta call.

This release does not add a universal TV-size placement executor. Asking “27-inch or 100-inch TV?” without such a tool would create an unfulfillable promise, so the first conversational preference is tied to a real existing procedural option.

## Testing and safety

- Full JavaScript suite in six batches: 1,088/1,088 passed.
- Nine existing standalone backend tests and the new `backend/test_autonomy_recovery_224.py` pass.
- Parser tests and work-order state tests verify safe handling of malformed plans, limited roof styles, and original `vision_search` routing without a Meta key.
- Existing scene-edit permissions, robot ownership, object IDs, original media/avatar files, and multiplayer authoritativeness remain unchanged.
- `backend/test_api.py` **cannot run in the packaging environment** because Flask is not installed. The Mac watcher must run this complete suite, including line 741 of the older test and all remaining cases, *before* performing a GitHub push.
- No production, two-browser, model-provider, or actual world-building success is claimed in this source release.

## Live acceptance

1. Deploy the clean ZIP via the existing Mac watcher and verify that backend Flask tests, including the previously failing `vision_search` assertion, pass.
2. In Nowhere, confirm the authorised operator can edit Ania and that `Allow scene changes` is enabled for the saved construction work order.
3. Send `@Ania can you build one more cosy house with a bed, table and chair?` as the human account. Verify `DIRECT BUILD ASSIGNED` and individual scene-object IDs instead of a chat-only pledge.
4. Give a multi-house goal to a robot and confirm a single optional roof-style question after the first verified home. Reply `@Robot flat roof`; verify the **following** home gets that roof and earlier buildings are unchanged.
5. Test full or obstructed worksites: check for at most two safe repositioning attempts, sensible stated blocker, no claims of success if nothing is created.
6. Open the same realm in a second browser and verify saved structure IDs and positions persist.

## macOS watcher diagnostic noise

`Python(PID) MallocStackLogging: can't turn off malloc stack logging because it was not enabled.` is a macOS child-process diagnostic. It did **not** cause the v0.2.223 Flask failure. The optional standalone `SOLVI_PATCH_WATCHER_MALLOC_LOGS.py` supplied previously can filter that exact line in the external watcher after a `--check`; it is not shipped inside this application release and does not hide genuine test failures or nonzero exit codes.
