# SOLVI.help v0.2.231 — Watcher-Staged Deployment Test Fix

## Reproduced failure and root cause

The Mac watcher `solvi-watch.sh` calls `merge_history(stage, manifest)` **before** `npm test`. This overwrites the staged `app/releases.json` with a rolling published feed containing only the **latest 30** releases. However, the legacy test `app/tests/release-195-public-readme-about.test.mjs` asserted that `releases.releases` always contained **v0.2.195** and **v0.2.200**. That assertion is false after the watcher legitimately trims the feed, and produces the exact shape of the observed Mac failure:

```
not ok 5 - release 195 keeps historical release metadata distinct
code: 'ERR_ASSERTION'
expected: true
actual: false
```

The read-only ZIP diagnostic passed because it ran `npm test` against a **fresh extraction without the watcher’s history rewrite**. This is why the same version passed the standalone Mac diagnostic and failed the watcher. The test expectation was incorrect; the watcher’s 30-entry history limit is intentional.

## Code changes

- `app/tests/release-195-public-readme-about.test.mjs`: no longer requires versions 0.2.195 and 0.2.200 to remain in the rolling release feed. It validates the current record, version syntax and nonempty change lists, and checks **CHANGELOG.md** for older history.
- `app/tests/release-231-watcher-stage-parity.test.mjs`: new regression simulating the watcher’s 30-entry pruning, explicitly covering the old failure mode. Also runs correctly when the actual test suite is executed against an already-pruned stage.
- `app/releases.json`: version advanced to 0.2.231; duplicate source release entries corrected. The historical catalog remains intact in the ZIP, while the watcher may publish its own shortened list. No data migration.
- Bump active version in HTML import URLs, server health, installer, package, docs and source/version assertions; preserve earlier releases in historical docs.
- No runtime changes to portal pairs, bed sitting, robot autonomy, scene editing, model APIs, permissions, users, or avatar/media files. No modification of the local watcher and no bypass of `npm test`.

## Verification

- **Reproduced** the legacy test failing on a 30-entry watcher-like v0.2.230 stage (exact `ERR_ASSERTION`, `actual false`, `expected true`).
- **v0.2.231** complete watcher-style 30-entry stage: **1,116 / 1,116 JavaScript tests pass**.
- Alternate watcher stage with older v0.2.200 retained: all seven release-history-focused tests pass.
- All **15 Flask-free Python backend checks pass**; server AST and installer bash syntax checked.
- Complete archive independently extracted and SHA-256 manifest checked. All original 111 avatar/media assets unchanged.
- The macOS watcher must still run `npm install`, vendor preparation, full JavaScript regression, Flask HTTP suite, GitHub write and Ubuntu deployment. None of these live Mac/production gates is claimed as completed here.

## Install — one file, no terminal command

1. **Watcher: KEEP RUNNING.**
2. Download `SOLVI_RELEASE_v0.2.231_WATCHER_STAGE_TEST_FIX.zip` into `~/Documents/works/cv-meta-hackathon-solvi-help/updates/`.
3. The watcher automatically verifies and deploys the release. **Do not run the ZIP manually.**
4. If the watcher still fails, upload the **complete** file named in its `DETAILED LOG:` line under the repository's `.solvi/logs/`, not just the abbreviated final summary. No previously deployed version should be replaced by a failed run.
