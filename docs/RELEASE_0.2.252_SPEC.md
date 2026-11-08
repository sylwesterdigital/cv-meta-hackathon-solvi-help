# SOLVI.help v0.2.252 — README test-gate repair

## Root cause

The Mac watcher correctly rejected `Solvi-0.2.251.zip` during `npm test`, before GitHub write or Ubuntu deployment. The failing test was `tests/release-195-public-readme-about.test.mjs`: the public `README.md` exceeded its existing 12,000-character limit.

## Changes

- Remove duplicated historical version announcements from the top of `README.md`, while retaining the project introduction, startup instructions, limitations, and pointers to the full `CHANGELOG.md`.
- Update the previously stale README packaged-version line.
- Add a regression test to enforce the unchanged README size gate and verify the version agrees with `package.json`.
- Synchronize source release identifiers to v0.2.252. Prior versions remain in the changelog and historical specifications.

## Preserved implementation

The v0.2.251 Amorphous Geometry, native Meta Vehicle Lab and `/ai` contextual chat features are unchanged, including prior limitations: vehicle assemblies are not drivable; image generation/editing and silent application-file overwrites are not implemented.

## Watcher gate

1. Place this intact ZIP in `updates/`; execute `./solvi-watch.sh --once`.
2. Confirm the unchanged README size assertion, all JavaScript regression tests, and the normal Flask/SQLite tests pass.
3. Confirm SHA-256 manifest and the browser's new version mapping.
4. After deployment, open Add → Geometry → Amorphous and Meta Vehicle Lab, inspect a saved scene, and test `/ai` with a text question and a user-attached image.
5. Verify a second client sees the same saved scene data. A Mac watcher test pass is not itself a live 3D acceptance test.

Do not delete realm databases or locally supplied binary assets; do not bypass failed backend checks.
