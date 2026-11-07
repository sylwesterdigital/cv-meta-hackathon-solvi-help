# SOLVI.help v0.2.235 — Mac watcher group claim regression repair

## Reproduction and cause

On 2026-11-07, the v0.2.234 watcher validated ZIP checksums and passed JavaScript tests, then failed isolated Flask integration at `backend/test_api.py` on the assertion that a second robot claim must return HTTP 409. The failing payload changed `robot_id` from Lea to Lola without changing `order.robotId` from Lea. The backend validates these fields before checking the task status, so it correctly replied HTTP 400 (malformed identity/order pairing). GitHub and the production site remained unchanged.

## Patch

- Preserve backend validation and atomic `BEGIN IMMEDIATE` assignment semantics; do not let a mismatched identity pass in order to satisfy an incorrect assertion.
- Prove malformed identity/order returns HTTP 400 and a useful diagnostic.
- Prove a *validly constructed competing claim* from a different robot returns HTTP 409 when the original job is already assigned.
- Query SQLite to verify the first assigned worker remains assigned, and the failed competing claim did not create an order for the second worker.
- Bump package, server health, module cache references, release-feed metadata, and version-sensitive tests to 0.2.235. Preserve all existing avatar/scene/media binaries and preexisting deployment gates.

## Required watcher verification

1. Copy the full v0.2.235 ZIP directly to `updates/`, without extraction or changing `solvi-watch.sh`.
2. Run `./solvi-watch.sh --once` and verify ZIP integrity, Node.js suite, Python syntax, Flask/SQLite integration, Git/Ubuntu stages, and HTTPS smoke tests.
3. Inspect the integration log for `PASS: authenticated group queue...`, not just a successful ZIP hash check.
4. In a signed-in 3D scene, repeat the Box-copy cleanup in a room with actual `Bin - Big Junk` and `Small Bin` objects. Observe nearest eligible robot assignment, live pickup, saved delivery, reload from a second browser, and no duplicate worker.

## Limits

This release repairs a test contract; it does not add browser-closed physics execution or verify live 3D movement by itself. The sandbox lacks Flask packages and npm dependencies; watcher execution is required before production can be considered validated. Do not deploy over existing realm databases or avatar assets outside the normal watcher safeguards.
