# SOLVI.help v0.2.203 — Captioned Robot Command Authorization Hotfix

## Incident
The v0.2.202 Mac `updates/` watcher rejected the deployment on 2026-11-05 22:55:02 UTC. `backend/test_api.py` expected HTTP 403 when a different profile issued `CC: Jessica, stop` in a room with `robots=owned`, but the reply was HTTP 200 with `Robot heard the message. Set a Meta key to enable speech.`. The watcher reported **GitHub unchanged** and **Website unchanged**.

## Cause
The conversation-safety parser introduced in v0.2.202 matched stop/help only when the operative command began the parsed clause. The normalizer stripped the `CC:` prefix and tagged robot handles (`@Jessica`) but retained an untagged vocative (`Jessica,`). `plan_robot_command` therefore saw `jessica, stop` and returned no executable command, bypassing the owner-only authorization check.

## Implementation
- At command parser entry, remove ONLY the correctly matched target robot name at the START of the clause (optional `@`; with or without comma), then use the existing strict imperative grammar. No unconstrained searching for `stop` or `help`.
- Continue to ignore incidental `stop`, `help`, and other keywords in ordinary conversation.
- Permission-denied command and identity-preference routes discard the reservation from `robot_reactions` before responding HTTP 403.
- Extend `backend/test_api.py` with an unauthorized profile and `CC: Jessica, stop`, `Jessica, stop`, `@Jessica stop`, `CC: Jessica, please stop` under `robots=owned`. Confirm rejection and no deduplication record.
- Execute the real Python parser from a JavaScript regression test without requiring Flask in the local build sandbox.

## Acceptance
1. With `robots=owned` and an owner-created Jessica, an unrelated profile says `CC: Jessica, stop`; `/api/robots/react` returns 403 whether or not Meta is configured.
2. The exact command format without `CC:` or with `@Jessica` also returns 403 for that profile.
3. Authorized owner commands continue to return a `scene-command` STOP.
4. `@Jessica I built this with the help of AI`, `Jessica, I waited at the bus stop`, and `@Jessica stop by my home` remain conversational, not privileged STOP or HELP.
5. No rejected command consumes a `robot_reactions` record.
6. Existing room data, profiles, GLBs, and v0.2.202 conversation continuity are unchanged.

## Limits
Local environment does not have Flask and has no package-index network access. The Mac watcher backend integration is the authoritative test for the specific HTTP 403 case. Do not claim deployment unless that watcher completes successfully.
