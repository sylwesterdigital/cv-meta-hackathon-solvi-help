# SOLVI.help v0.2.221 — Compact Character Traits and Watcher Log Hygiene

## Behaviour
- Brain → Traits: 96 trait rows are compact three-cell grids (current spectrum title, consistent-width slider, 0–100 value). Redundant end captions and horizontal row dividers are removed.
- Slider tracks are **solid** and follow their actual value via an RGB interpolation of blue (0), cyan (25), green (50), yellow (70), orange (85), red (100). Track and accessible state update while dragging.
- Narrow screens preserve aligned slider widths and may wrap long names without affecting control widths.
- Saved profiles, presets, JSON import/export, backend character validation, and actual decision rules are unchanged.

## macOS deployment log
- The watcher lives outside `app/` and is **not updated** by application release ZIPs. A separate optional `SOLVI_PATCH_WATCHER_MALLOC_LOGS.py` patches the current watcher in place only when its expected structure is present, after making a backup. It removes one exact macOS `MallocStackLogging` diagnostic from command output; command exit codes, other diagnostics, test failures, and application errors remain visible.

## Validation
- Run the dedicated `release-221-compact-traits.test.mjs`, full Node regression suite and archive manifest verification. Watcher logging patch requires separate opt-in installation; it is not silently installed.
- Live WebGL/CSS layout on narrow and wide devices and macOS watcher use still need production acceptance testing.
