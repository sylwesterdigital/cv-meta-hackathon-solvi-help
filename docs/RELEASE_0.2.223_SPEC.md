# SOLVI.help v0.2.224 — Meta Access Notices for Addressed Robots

## Problem
When a user addresses a robot with no Meta API key available, `/api/robots/react` previously returned `triggered: true, responded: false`, producing only a developer trace. Users saw no chat response.

## Change
- On a validated human-addressed conversational message (including an explicit visual question), publish a persistent `robot-system-notice` message attributed to the addressed robot.
- The predefined notice explains that free-form conversation needs a Meta key, Settings → Meta AI supports user-owned browser tab keys, and administrator server inference is an existing option. A possible later managed subscription/usage model is not implied to be live.
- An improperly formatted browser key and HTTP 401/403 provider rejection generate separate truthful notices. Every notice is marked as automatic, without a model call or usage charge (provider rejection may have made a failed request).
- Retain existing `robot_reactions` per-(message,robot) deduplication. No robot-to-robot automatic status reply. Supported deterministic robot actions still execute without inference.
- Show explicit Meta-access-needed state in the chat footer and add a short policy explanation to Meta settings.

## Tests
- Missing/invalid/rejected text selection and no credentials disclosed.
- No-key direct/visual messages take the notice branch; deterministic command bypasses it.
- Per-message deduplication, authenticated room routing, peer loop prevention and persist/publish semantics.
- Version/cache consistency, full JS suite, standalone backend tests, generated-file exclusion and ZIP manifest verification.

## Not included
No maintainer-funded proxy, billing, key provisioning, subscription gateway or account billing promise is created. Production provider and multi-client checks remain necessary.
