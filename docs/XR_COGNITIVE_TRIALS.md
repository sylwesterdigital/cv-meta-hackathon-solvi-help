# XR spatial cognitive trials — integration specification (not activated in v0.2.6)

Derived conceptually from the submitted Solvi v0.10.1 prototype, without copying its UI or runtime code.

## Trial: coloured-hand / coloured-object contact
1. A room moderator assigns left/right hand or controller colour identifiers (the physical wearable is optional).
2. Display a small set of 3D targets within comfortable arm reach. The user must touch the correct-colour target with the designated controller tip or hand joint.
3. Capture stimulus onset using `performance.now()` inside the XR animation frame, and capture first validated physical contact in the **same** clock domain.
4. Record reactionTimeMs, selected hand, expected hand, correct colour, actual colour, 3D contact point, trial ID and misses; debounce contact for 100–250ms.
5. Keep comfort/caution controls, pause, skip, undo and export; explicitly avoid clinical interpretation.
6. Only broadcast compact result events into the room; store per-trial data on server with user consent and room-scoped access control.
7. For WebXR hands use native joint poses (index-finger-tip, wrist); for controllers use controller grip/tip and haptic feedback when supported. If no XR device, permit desktop pointer but label the result as pointer-based and not comparable.
8. Aggregate summary table: duration, attempts, success %, median reaction time, left/right split, timestamps, device type; export CSV and JSON.

**Status:** The input mapping, trial scene, event recording, scoring and analytics are requirements for a subsequent release, not features asserted to work in this release.
