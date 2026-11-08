# SOLVI.help v0.2.252 — Valid example instructions

These examples exercise preserved v0.2.251 features, not new runtime capabilities.

## Amorphous

Open **Add → Geometry → Amorphous**, create a rock, change its seed and resolution, enable smooth shading and Glow or Rainbow, save, then reload the realm. The rock should retain its same seeded geometry and chosen settings.

## Meta Vehicle Lab

Open **Meta Vehicle Lab** in the tools window. Select a starter blueprint, change the chassis dimensions and wheel count, create the assembly, save and reload. The components should remain an editable collection with colliders. Driving controls, motors, steering and suspension are **not** implemented in this release.

## `/ai` chat

`/ai Explain how SOLVI builds an Amorphous mesh and saves its settings.`

`/ai What does the current vehicle lab support, and what remains to make a car drivable?`

`/ai --file Draft a short Markdown guide to building a procedural organic sculpture.`

Attach a supported image to a chat message and write:

`/ai Describe the main objects visible in this attached picture.`

`/ai --eyes @Lemox: Describe the latest real robot-eye observation in the current realm.`

Use an actual in-realm robot name for `--eyes`. The command does not provide image generation or editing; it can analyze existing images with the authenticated Meta service.

## Watcher validation

From the app directory run `npm test`. The README-size gate should pass without relaxing its limit. After normal dependency installation, the watcher must also pass Flask/SQLite tests before deployment.
