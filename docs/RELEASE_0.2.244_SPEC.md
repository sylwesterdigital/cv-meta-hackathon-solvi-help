# SOLVI.help v0.2.244 — Objects selection emergency fix

## Confirmed bugs

1. Clicking a stage object executed `querySelector('[data-object-id=+obj.userData.editorId+]')`, a **literal invalid selector** (not JavaScript interpolation). This raised a DOM `SyntaxError` and interrupted post-selection UI work. The new `findSceneObjectRow` helper compares `dataset.objectId` against the exact ID, without building a selector from user-controlled data.
2. `ui-controls.js` automatically icon-decorated newly created collection heading buttons. The global icon-only preference then hid the dynamically created `.ui-button-label`. Object rows were similarly affected. Collection actions are now exempt from icon decoration and CSS explicitly preserves object names.

## Service failures

The simultaneous 502 responses for `/api/me`, `/api/scene/object`, `queue`, and `start` are upstream errors, not caused by `querySelector`. Nginx or the Flask/Gunicorn service must be checked through system logs. This release does **not** claim to repair an unidentified server crash. Avoid further construction edits when `/api/me` is 502. No database resets.

## Watcher acceptance

- Run `npm test` and confirm the release-244 regression tests pass.
- Run `python -m py_compile backend/server.py` and `python backend/test_scene_collections_243.py`.
- Run standard Mac watcher Flask/SQLite integration, static browser-module check and Nginx validation.
- Open Objects with `Settings → Button labels → Icons only` and verify folders, action buttons, and object names are visible.
- Click a primitive in the stage and confirm its exact row is selected, its folder is expanded and scrolled into view, with no console `SyntaxError`.
- Switch to text/auto label preferences and confirm names remain visible.
- Verify `/api/me`, `/api/scene/object`, queue, and start HTTP health from the actual backend and proxy after deployment; a 502 blocks acceptance until the upstream cause is addressed.
- Verify the second browser sees the same saved objects and collections.
