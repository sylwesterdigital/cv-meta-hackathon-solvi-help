# SOLVI.help v0.2.209 — Active robot life loop

## Purpose
The old proactive model could talk and observe but could not initiate real travel. This release adds a separately enabled, browser-driven idle exploration loop without giving model prose write access to the scene.

## Enable
Open a robot’s Brains → Identity and enable **Autonomous roaming & peer visits**, then Save identity. **Proactive conversation** is separately required for optional peer questions. The prior camera-autonomy setting controls billable Meta visual interpretation independently. Neither prior setting silently enables movement.

## Behaviour
- Every six seconds, a visible authenticated browser considers one opted-in editable idle robot. Local planning is not a Meta call and is not an independently running server agent.
- Choose unvisited, nearby named scene objects or another robot at least 7 m away, otherwise try 11–19 m exploration headings. Exclude recent target IDs and recent failed/visited waypoints. Keep furniture and robot stand-off distances.
- Use the existing editor's A* route and physics collision recovery. Only real `solvi:robot-task-update` outcomes complete the activity. No teleporting, bypassing collision, or auto-mutation of a scene object.
- A 22-second server-scoped authorisation lease blocks competing clients, refuses agents with active saved work orders or pending human tasks, requires `initiativeMove=true` on the authoritative scene, and checks editing rights. One-time non-replayable receipts preserve server memory labelled `client-reported` rather than visual proof.
- On successful peer arrival, **Proactive conversation** optionally asks the peer for evidence or a safe next experiment; the existing speech cooldown, permissions, and depth-limited reaction path apply.
- After every third successful travel decision, store one raw head-camera JPEG in the local brain gallery. It is not described as a Meta interpretation. Existing billable camera perception retains its own reservation, 2-minute cooldown, and daily spending bound.

## Limits
Not a 24/7 background service, independent general-purpose planning, actual visual scene understanding every six seconds, automatic construction, physical experimental manipulation, real semantic learning, or success proof from planned destinations. Browser closure, hidden tab, permission loss, XR, manually controlled robots, human tasks and active work orders prevent new roaming.

## Manual acceptance
1. Open two accounts or tabs. Without opting in, no robots autonomously start moving.
2. Enable a robot's roaming; watch an 11–19 m novelty route or an approach to a nearby object. Confirm actual displacement and `LIFE` trace.
3. Request a manual movement mid-exploration: human command must take priority. Start an enabled work order: no new life lease should be granted.
4. Enable Proactive conversation; walk near a different robot. After an actual arrival, check one bounded peer question and attributed conversation.
5. Disable roaming, switch realms, hide the tab, or sign out: no new independent routes.
6. Confirm fresh SQLite memory `Life activity (client-reported)` and that model observations remain separate. Confirm no scene reset and two-client position sync.
7. Run the Mac watcher Flask suite and check deployment status before any production claim.

## Data compatibility
Optional `robot.brain.initiativeMove` boolean only, default disabled. No SQLite migration. No original GLB/media changes. No credentials in ZIP.
