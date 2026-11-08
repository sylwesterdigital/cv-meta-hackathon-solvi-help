# SOLVI.help v0.2.240 — Time-bounded creative job orchestration

## Verified failure

At 00:16:28 an authenticated @all request asked robots to walk and build surreal sculptures for **15 mintues**. Albert completed an eight-part levitation loop by 00:17:09, another eight-part totem by 00:17:53, and a seven-part totem by 00:18:28. Each group subtask was marked completed and stopped without tracking the shared 15-minute deadline. At 00:22:30 Albert began a new, single-object Pink Long Limo request, saving parts 1–11 by 00:23:25, then waiting until 00:25:30 to save part 12 and stop. The delay was the built-in localBurst=10 limit falling back to an interval of 180 seconds. These were scheduler defects; scene saves and Muse design were functioning.

## Implementation and controls

- A single wall-clock deadline is computed from the original saved human message timestamp for each timed @all group role. Named instructions use their own acceptance time. Both `15 minutes` and the observed `15 mintues` are parsed. Duration is capped at 60 minutes; ordinary one-off construction does not inherit a timer.
- Each completed design remains a checkpoint, not an assignment completion. The next design slot is distributed across the authorized time window, with at most **9 designs per robot/session**, each at most **12 bounded primitives**. This gives the 15-minute request a bounded cost and object budget rather than unlimited billed inference or infinite scene mutation.
- During the slot wait, the last completed plan remains persisted so a browser refresh or deadline crossing cannot lose completion proof. At the next slot, the robot saves a compact record of the prior series' real object IDs and advances to a new model-designed assembly using an independent project tag and a new collision-checked site. Partial designs still resume exactly.
- The group assignment stays assigned until expiration, and the backend rejects early completion regardless of client declarations. Final scene verification inspects the active design, prior series' real object IDs and ownership, and series-specific tags. Empty or fake receipts do not complete a session. Unclaimed timed group jobs expire as blocked; they cannot be assigned after the deadline.
- All parts of an active creative design continue at ~2.8-second scheduling intervals and are not subject to the legacy 10-cycle burst quota or a 180-second fallback.
- Timed construction requires an authenticated active browser, an editable robot, working Meta design access, an available unobstructed worksite, and successful scene saves. Physical movement and rendering do not run when every browser is closed. A robot may complete a structure slightly past the deadline if a previously started design still has parts to verify. This patch does not add unrestricted AI-generated code or independently create new realms.

## Watcher acceptance

1. Validate the SHA-256 release manifest, original GLB/media files, dependency preparation, full npm tests, full Flask/SQLite tests, and browser module import graph. Do not deploy if any fail.
2. Issue `@All walk around for 15 mintues and build surreal sculptures from cubes and spheres`. Within the first few minutes verify one completed model plan and a saved `CREATIVE SESSION CHECKPOINT`, **not** an `AUTONOMY STOP`. Observe further designs over the session and the server denying completion before its deadline.
3. Verify each new design creates its own namespaced primitives at a different collision-checked site. Reload one browser between designs: previous component IDs must remain, and neither the deadline nor the design index must reset.
4. Verify an `@Albert ... build ... for 15 minutes` named instruction also keeps the order active across complete structures. A one-off `@Albert create a pink car` must still stop after a confirmed single object/assembly.
5. Verify a twelve-part pink vehicle no longer pauses for 180 seconds after the tenth component. Verify STOP, permissions, and handoff remain effective.
6. At or after the deadline, verify the group server accepts completion only when the expected scene parts and archived earlier structures exist; it rejects fraudulent or missing object IDs.

## Explicit scope

The requested window is a maximum wall-clock work assignment, not a guarantee that every minute contains movement. Nine designs are paced across the window, with real relocation when a new site is selected. Site obstructions, Meta API limits, user stop, browser shutdown, or permission changes can still stop or defer work. No off-browser 3D simulation, unlimited object creation, or new realm instances are enabled.
