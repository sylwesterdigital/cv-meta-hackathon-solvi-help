# SOLVI.help v0.2.220 — Persistent fictional character brain

## Scope
The release adds a source-of-truth, versioned 30-category / 96-bipolar-trait character schema to each robot's saved `brain.character`. Existing free-text personality, scenario, memory, conversations and work orders remain available and unchanged. Traits are simulated behavioural preferences, not consciousness, a right to bypass permissions, or evidence of real emotion.

## UI and persistence
In Robot Brains, the new **Traits** tab has heat-gradient 0–100 sliders. The displayed descriptive name varies from the low pole to a balanced spectrum to the high pole. Searchable categories, presets (balanced, explorer, builder, caretaker, analyst and fictional trickster), import/export as `SOLVI.robot.character` JSON, summary, behavioural preview and Save character are supported. Existing Brain window drag/resize works; chosen size is locally remembered. Saving writes through the existing revisioned scene API and shared-client editor (normal edit permissions).

## Relationships
A SQLite `robot_relationships` table records **observed** messages initiated toward peers and replies; the Relationships Brain tab reads that ledger. These facts are not inferred friendship/commitment/attraction, nor proof of a visit or completed build. The ledger is room-scoped and exists across service restarts. Robot memory remains a separate existing table.

## Model and execution
When saved, a character's complete numeric trait package is provided to Meta autonomous planning and conversation contexts. Scene-based tools, work orders and the actual permission checks remain the only executors. Structured `robot-character-policy.json` specifies advisory action weights, while client preferences influence local exploration, retries and pacing, without increasing paid vision rates or granting new abilities. The `POST /api/robots/character/evaluate` endpoint returns a **read-only advisory** score and permission eligibility; it never executes an action.

## Verification and limitations
The backend validates known version, keys, integer bounds 0–100 and allowed shape; unknown imported trait keys are rejected. Real browser persistence, profile-edit merge under concurrent clients, personality effectiveness, relationship prompts and multiplayer behaviour need deployment checks. No asynchronous server-side autonomous cognition, spontaneous new procedural tool creation, generative images/documents or independent model-directed arbitrary action chains are implemented. A verified action receipt is still needed for every physical claim.

## Manual acceptance
1. Select robot → Brain → Traits; select Builder; change Persistence to 100 and Honesty to 0; save; reload scene in another browser and verify all 96 values survive.
2. Export JSON and import into another editable robot; edit a slider and confirm name changes; ensure malformed JSON and out-of-range/unknown keys fail.
3. Have robots exchange one real message and check the Relationships tab; it must not claim a meeting without same-floor navigation evidence.
4. Trigger a blocked, permitted local work order with two distinct trait profiles; verify retries remain bounded and physical validation overrides preferences.
5. Confirm all existing media, 3D models, work orders, scene permissions, avatar settings and native Meta/voice flows remain functional.
