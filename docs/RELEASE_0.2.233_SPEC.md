# SOLVI.help v0.2.233 — Mac watcher npm test reliability

## Trigger

At 18:52:53 the Mac watcher rejected v0.2.232 during `npm test` after validating 564 files and preserving 9 avatar files; `ERR_ASSERTION` reported `actual: null`, `expected: 0`. The short log does not identify a test, so a macOS subprocess launch failure/timeout is a hypothesis, not a proven exclusive root cause.

## Changes

1. Shared test-only `spawnSync` wrapper for the existing Python/Node syntax and AST validation tests. Retry bounded transient launch/timeout errors only (`EAGAIN`, `ENOMEM`, `EINTR`, `EBUSY`, `ETIMEDOUT`) for up to 3 attempts; nonzero exits remain hard failures, malformed input and validation failures are never bypassed.
2. Previously 5–20 s child subprocess budgets now have a 30 s minimum, isolating slow macOS Python startup from source assertion failures. These changes apply only to tests, not production code.
3. Replace Node TAP reporter with built-in `spec` reporter so failing test names and stack traces are collected in the final report even if watcher shows only output tail. Retain `--test-concurrency=2` and `npm test` as the watcher gate.
4. Add regression tests for transient spawn, real nonzero child exit, persistent timeout, signals, and actual JavaScript syntax rejection.
5. All original application modules, backend code except release number, world assets, robot workflows and scene edits remain unchanged.

## Acceptance

- Local and staged full `npm test` both pass; tests can never declare a failed subprocess as success.
- A simulated transient process failure retries before passing; a persistent failure retains `status=null` and prints an identifying error.
- Mac watcher must independently run full npm tests, backend tests and deployment gates; no live deploy can be asserted until its log reports success.

## Operator instructions

- Watcher: KEEP RUNNING.
- Download entire SOLVI_RELEASE_v0.2.233_MAC_WATCHER_TEST_RELIABILITY.zip to your Mac.
- Place directly in `~/Documents/works/cv-meta-hackathon-solvi-help/updates/`.
- No manual command is required.
