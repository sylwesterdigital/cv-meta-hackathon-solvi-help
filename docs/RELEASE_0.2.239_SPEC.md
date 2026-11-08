# SOLVI.help v0.2.239 — Model key and creative-series execution

## Root causes observed in Brain logs

At 23:33, creative group tasks were atomically claimed but the design endpoint returned `Muse design requires a configured Meta key`. Chat and perception in the same browser were using Muse successfully because only these older endpoints received the tab-specific `X-Solvi-Model-Key`. The new `/api/robots/autonomy/design` endpoint was not on the `studio.js` header allowlist. The worker retried every three seconds inside the cooldown and then incorrectly yielded its group claim. Separately `@Albert walk around for 15 minutes and build some abstract figures from the cubes` was parsed as a patrol-only request because the named creative authorization required a greeting or “please”, dropping the construction objective.

## Implementation

1. API client forwards the scoped browser key to `/api/robots/autonomy/design` exactly as for `/api/robots/autonomy/plan`. The key is never stored in job state, logs, or scene objects.
2. Design API returns bounded `retry_after_seconds` for throttle responses. Client model-access failures set a persistent `nextMetaAt` and preserve the assigned robot. No group reassignment is attempted for an absent model or design retry cooldown. A credential update event forces safe re-evaluation.
3. Human named imperative `walk ... and build ...` is now authorized in the creative pipeline. It persists a deadline for the requested duration and performs at most three independent, visually distinct Muse-designed assemblies, with a new committed plan and unique project tag at each stage.
4. Backend work-order validation caps `creativeSeriesIndex` to 0..2 and bounds `creativeDeadline`; model does not control the authorization, time, geometry permissions or checked save process.
5. Independent tests cover named combined authorization, model key header, patient scheduler behavior, and stage state validation. Legacy geometry tools and project receipts remain unchanged.

## Watcher acceptance

- Run the full `npm test`, backend Flask/SQLite integration and browser module graph on Mac before GitHub or production deployment.
- In a room with a valid browser-only Meta session key but no server-wide key, request a new creative build. Brain should show `MUSE DESIGN COMMITTED`, then saved real primitives; it must not say `Meta key missing`.
- With the key cleared, assign a creative group project. Verify the **same** robot remains assigned and a single future retry is scheduled instead of three rapid failures and handoff.
- With the key restored, verify the queued project resumes from the same realm/robot and object IDs.
- Send `@Albert walk around for 15 minutes and build some abstract figures from the cubes`. Verify this creates a saved creative order (not patrol-only), uses checked routes, and can save up to three independently designed structures during that window. Finish each before moving to the next; previously saved structures remain after reload.
- Confirm direct STOP, negative commands, already saved towers, box cleanup, avatars and media are unaffected.

## Limitations

- No unattended movement or 3D physics while the authenticated browser is closed. Up to three designs, not unlimited free-running design synthesis; construction can stop earlier for time, permission or collision issues.
- Model inference still requires valid Meta credentials. A configured key may be rejected by Meta; client retries are bounded and no hardcoded replacement structures will be fabricated.
- Imported lounge geometry may obstruct path planning; a missing navigable doorway remains a real blocker. World/realm creation is not implemented by this patch.
