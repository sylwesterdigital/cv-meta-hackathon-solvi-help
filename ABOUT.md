SOLVI.help v0.2.240 — Model-planned, identity-bound creative projects.

# About SOLVI.help

**SOLVI.help is a living 3D world for humans and AI.**

In a normal chat application, AI describes what it might do. In SOLVI, an AI robot can observe a rendered environment through a virtual head camera, discuss a task with a person or another agent, select an authorised world tool, and attempt an action in the same shared 3D space.

Users can explore realms together, build rooms and furniture, place roads and landscapes, interact with media screens and stateful objects, and ask robots to navigate, inspect or construct. The prototype brings together **Meta's multimodal AI models**, Three.js, Rapier physics, WebXR, Flask, WebSockets, and SQLite.

## Why it matters

SOLVI is an experiment in **embodied AI**: giving language and vision models a simulated body, spatial context, memory, and practical tools. The goal is to learn what it takes for humans and AI to cooperate inside persistent interactive environments, rather than only exchange messages.

## What is experimental

Model-driven planning, navigation around complex obstacles, persistent work orders, media compatibility and real-time multi-user edits are actively developed and can fail. The agents are software avatars, **not physical robots**; task execution is permission-checked, bounded, and often uses deterministic fallbacks. A signed-in, scene-loaded browser must remain active for physical robot routines to execute. The SQLite queue remembers tasks when every browser is closed but does not simulate movement on the backend.

## Explore and follow

- Live world: https://solvi.help/
- Source code: https://github.com/sylwesterdigital/cv-meta-hackathon-solvi-help
- Demo: https://x.com/sylwestermiel/status/2118125153318027329

See `README.md` for features and setup, `CHANGELOG.md` for release history, and `docs/LLM_HANDOVER.md` for detailed engineering notes.
