# SOLVI.help v0.2.251 — Amorphous Geometry, Meta Vehicle Lab and General `/ai`

## Summary

This release adds three *bounded* capabilities to the existing SOLVI scene engine rather than importing a second engine. It uses the provided `META_VEHICLE_LAB_UPDATE_v0.2.3(1).zip` as a blueprint/UI reference. That source is a separate Three.js + cannon-es demo; the adapted implementation uses SOLVI's Three.js renderer, existing scene objects, save pipeline and Rapier collision layer.

## 1. Amorphous Geometry

- New **Add → Geometry → Amorphous** and editable inspector parameters.
- Base shapes: sphere, cube-like, and icosahedron-like.
- Seeded, deterministic 3D noise displacement; radius, distortion, frequency, seed, mesh resolution (6–64), smooth/faceted normals.
- Existing object color/texture controls, plus animated `MeshStandardMaterial` `onBeforeCompile` effects for pulsating glow, rainbow and swirl and a 0–5 speed setting.
- Same scene serialization, snapshot validation, geometry presets, object selection, and physics support as standard primitives; static Trimesh collider by default.
- **Limits:** no sculpt brush, arbitrary topology generator, offline decimation algorithm, bone animation, animated geometry displacement, or guaranteed performance at the highest detail on low-end devices. Resolution is adjustable mesh subdivision, not a full mesh-decimation library. Effects animate while a rendering browser is running.

## 2. Meta Vehicle Lab

- New **Add → Meta Vehicle Lab** floating control window with an editable parameter panel and top-view blueprint preview.
- Starter blueprints: City Car, Explorer Rover, Delivery Van and Concept Racer. User-entered chassis width/length/height, wheel count (4/6/8), axle offset, wheel radius, chassis/wheel colors.
- Add to realm creates a named collection of independently editable chassis/cabin/wheel scene objects with static Rapier collider settings, using the existing collision-checked placement procedure.
- Optional chassis **visual** replacement via a GLB previously uploaded and available in the realm; original scene and account ownership rules remain in force.
- Blueprints can be saved in the current browser or exported as JSON for reuse; completed object collections can use existing **Objects → Save preset → Creative Builds** when their member types are portable.
- **Limits:** this version is an assembly/blueprint lab with static colliders. It does **not** drive, steer, apply torque, connect parts with motor joints, calculate suspension, or integrate another physics engine. Wheel component visual models are still procedural cylinders. Complex imported models are not yet portable Creative Builds presets. Collision behavior must be inspected with scene physics on.

## 3. General `/ai` command

- Normal chat inputs beginning with `/ai` are sent to authenticated `/api/ai/assist` and do not become robotic scene commands.
- Uses SOLVI's existing configured Meta Muse Spark text/vision Responses API (valid model allowlist only). Supports prompts about system help, procedural methods, a bounded read-only realm index, whitelisted public source excerpts, and optionally user-owned attached JPEG/PNG/WebP or a real selected robot-eye frame.
- `/ai --eyes @Robot: ...` uploads the real last available current-realm capture; rejects missing captures.
- `/ai --file ...` makes a downloadable **review-only text, Markdown, JavaScript or Python draft**. Does not install code, modify local files, rewrite the application, or execute arbitrary model output.
- Images can be **analyzed**, subject to model capability; image creation and image-to-image transformation are **not implemented** because the bundled Meta API adapter exposes no image-generation endpoint. The UI explicitly declines `/ai --image` rather than claiming success.
- Server validates user session, scene scope, attachment ownership and format (up to 3 / 4 MB each for AI), model IDs, request length and per-user rate. Code context is public and curated; no API keys, server data files or unrestricted source execution are provided.

## Validation conducted in the packaging environment

- 1,205/1,205 JavaScript tests passed, including v0.2.251 regression cases for generated shapes, object hydration, portable blueprints, and AI command parsing.
- Python compilation and standalone creative geometry/Nginx configuration tests passed, plus JavaScript and installer shell syntax.
- Manifest SHA-256 and ZIP integrity verified after packaging; unchanged binary assets preserved.
- **Not verified locally:** Flask-backed integration tests (Flask not installed), Meta provider responses in a signed-in production browser, visual shader quality, scene-save round trip under multiple clients, collision interactions, or the optional GLB visual swap. The Mac watcher and signed-in live acceptance must pass before deployment is considered verified.

## Mac watcher deployment

Put the ZIP unchanged under `updates/` and run `./solvi-watch.sh --once`. The watcher must check its file manifest, run the full backend tests, and only deploy if the complete release gate passes.

## Acceptance tests

See `Solvi-0.2.251-example-instructions.md` for numbered interactive checks. Priority gates:
1. Create/save/reload Amorphous; geometry persists with identical seed/settings.
2. Create vehicle, move collection, enable physics, reload in a second client; no duplicate IDs or orphan members.
3. Use `/ai` text, attached picture, robot-eye picture and downloadable draft, with permission enforcement; no robot commands emitted.
4. Ensure `/ai --image` states unavailable rather than inventing output.
