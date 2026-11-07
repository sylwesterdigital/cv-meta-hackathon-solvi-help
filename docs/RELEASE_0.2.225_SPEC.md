# SOLVI.help v0.2.225 — Grounded fictional character self-awareness

Robots already received 96 numerical traits in Meta conversations. However, some models falsely told users they could not see their own trait numbers. This release adds a deterministic read-only profile introspection path, a concise benefit/trade-off schema and explicit Meta self-report instructions.

## Direct questions
An authenticated user can say `@Ania describe your own strengths and weaknesses` or `@Ania what is your curiosity value?`. The saved chat response is attributed to Ania but clearly marked as a **SOLVI saved-profile report, no Meta call**. Exact values come from `robot.brain.character` and the schema; a missing saved profile is reported rather than fabricated. Other commands and the missing-Meta notice preserve their priority.

## Inspection API
`GET /api/robots/character/self?room=<room>&robot_id=<id>` returns the versioned saved character values and compact positive tendencies, limits, and recommended checks. It authenticates, is room-scoped and read-only. No scene edits, model calls, or extra permissions are conferred.

## Planner and dialogue
Meta context includes the saved trait values followed by a bounded summary of both sides of the bipolar preferences, with exact numerical access positioned before longer biographies. The prompt explicitly requires honest numerical reports when asked, and one concrete compensating technique when a preference could make task execution harder. Character traits are fictional preferences; they are not independent intelligence tests, emotions, capabilities, or consciousness.

## Policy reference correction
The `build` action previously included a weight for nonexistent `creativity`; the schema uses `inventiveness`. All three policy copies (backend, source JSON and JavaScript schema) now use the real key. All action permissions and scene validation remain authoritative.

## Boundaries
This is not an autonomous planning engine or automatic cure for blocked construction. It improves profile-grounding, direct answers and model instructions, without replacing the existing validated executor. Model variability and live browser integration require production checks. No SQLite schema migration, original media replacements, or Mac watcher changes.

## Acceptance
1. In Nowhere, save Ania's character values. In the same or another browser, ask `@Ania what is your curiosity value?` with no Meta key. Verify an exact 100/100 for the example configuration, and a saved non-model response.
2. Ask `@Ania describe your strengths and weaknesses`. Verify a correct downside for low resourcefulness/low deliberation, with no false technical incapability or claimed consciousness.
3. Ask to construct a house without Meta. Verify that the new read-only branch does not steal the executable house command or return a character profile.
4. Set a robot to have no saved profile. Verify the reply states that the profile has not been saved.
5. Run the full backend Flask watcher test plus the JavaScript suite before any live push; verify all existing realms and original assets remain intact.
