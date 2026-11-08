# SOLVI.help v0.2.248 — Straighten zigzag navigation and refresh genuine wide robot eyes

## Root causes

- v0.2.247 corner smoothing rounded the A* grid turns without removing turns when a direct clear line was available. This made the robot trace a smooth *zigzag* even in unobstructed space.
- v0.2.247 automatically stitched Wide Eyes images only from periodic autonomous reconnaissance and displayed a raw square JPEG from other captures (notably barrier checkpoints). The eyes view therefore often remained narrow.

## Path execution

- **Smooth paths** remains opt-in. A new string-pulling pass joins each point to the furthest safe subsequent waypoint, removing unnecessary left-right bends. A continuous expanded-AABB intersection test prevents shortcuts through even very thin walls; no model prediction or teleporting is involved.
- The shortened path is rounded only where a genuine obstacle detour still requires a corner. When no obstacle blocks the direct route, the result is one straight segment to the unchanged exact destination.
- Barrier observation checkpoints remain mandatory and use the original exact positions. Shortcuts run independently between each checkpoint. The robot still physically visits any required checkpoint and sends the same verifiable motion telemetry.
- If the robot starts within a collision clearance pad or a candidate fails geometry checks, the original A* segments are retained. This preserves the planner's narrow start-escape allowance.
- A clean route never turns through locked scene geometry; dynamic obstacles can still require replanning.

## Wider Eyes preview

- A selected, editable robot can trigger a local six-direction panorama from **any** genuine camera frame event, including a barrier-checkpoint JPEG and a manually captured photo. Selection and enabling Eyes can also initiate a wide capture even before a new periodic reconnaissance event.
- The wide image covers an approximate **210° horizontal × 135° vertical** panorama, stitched from actual head camera renders using the current robot pose. Captures are client-local and throttled to once per two minutes per robot/realm, with an in-flight guard.
- The original 72° central JPEG is retained independently and sent unchanged to Muse for perception. Wide capture does not issue a second AI request, doesn't claim binocular stereopsis or foveated acuity, and is not live video.
- Robot and realm switches cancel publication of outdated captures. Stale/missing wide captures may display the most recent raw JPEG with its honest age and label. The preview never fabricates a view.

## Tests and deployment

- JavaScript regressions cover direct-line simplification, thin-wall intersections, genuine obstacle detours, start-collision pads, exact checkpoint preservation, and camera-frame-driven wide previews.
- Full JavaScript suite, syntax tests, Nginx checks, ZIP integrity and SHA-256 must pass locally. The watcher must still run Flask/SQLite integration, browser vendors and live 3D acceptance before deployment.
- The scene schema, existing robots, media, previously created structures, and server persistence endpoints are unchanged. No database reset is necessary.

## Live acceptance

1. Enable Smooth paths, walk a robot toward a far empty waypoint, and confirm its actual debug route has a **single straight leg**, not a sequence of rounded left-right turns. Compare with smoothing off.
2. Walk around a fence/house; verify only necessary bends remain, the avatar stays collision-free and any barrier camera checkpoint is still visited.
3. Select Lemox or another editable robot and enable Eyes. After a manual or barrier-checkpoint raw capture, the preview should show **Stitched wide eyes** with peripheral scenery at both sides. Verify the robot/realm label and timestamps; changing realms must never reuse the old image.
4. In the Brain log, verify that the main perception API still receives the original central JPEG and that the wide survey logs a local capture rather than another Muse inference.
