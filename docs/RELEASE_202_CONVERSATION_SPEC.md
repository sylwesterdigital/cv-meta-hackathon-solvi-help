# SOLVI.help v0.2.202 — Conversation Continuity and Robot Command Routing

## Problem evidence

The supplied trace shows a person saying they built the world "with a help of Open AI LLM". The deterministic backend matches `help` anywhere in the text and writes `My assigned task: ...`; this is a false classification of ordinary dialogue. The robot response prompt also contains only six recent room messages, making introductions and follow-up questions disappear amid other robot turns. The trace includes repeated camera scenery and a scene object with an implausible Y coordinate of -532553.75. A disabled saved work order is still included in every ordinary reply. These conditions compete with the latest question and coherent dialogue.

## v0.2.202 requirements

1. Command-guide help and immediate stop match only explicit requests; natural references to assistance, bus stops, stopping by, or not stopping are ordinary dialogue. Do not weaken valid go-to, turn, patrol or physical commands.
2. `robot_conversation_excerpt`: fetch at most 90 recent room-scoped messages; keep the latest 8 plus earlier messages directly involving the target robot, capped at 18 total, oldest-first. Resolve speaker through joined `users.name` and explicit robot speaker override. No cross-room or unauthorized private sources.
3. `robot_scene_excerpt`: select up to 15 finite, spatially nearby or named scene objects and expose total scene-object count without interpreting a scene index as vision. Ignore malformed coordinates.
4. Send only concise non-camera, non-duplicated relevant experience events; continue to include last actual camera observation separately with age. Only include enabled saved work orders.
5. Do not write `My assigned task` memory for a non-executable informational help response. Maintain existing SQLite schema, avatar assets, scene object write paths, authentication and networking.
6. Test the actual Python functions through AST extraction, then the whole Node regression suite, backend syntax/tests, archive SHA256 manifest, and exact ZIP extraction.

## Explicit limitations

The changes improve context delivery and parser correctness, but cannot guarantee the Meta model will always answer coherently. An introduction older than the bounded 90-message window will eventually fall out; no durable biographical profile is inferred automatically. Live multi-client dialogue, provider latency and the real Meta responses are not testable locally without the production environment. No changes to model pricing or autonomous work-order execution are asserted.
