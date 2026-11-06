# SOLVI.help v0.2.216 — Remote robot floor authority and production diagnostics

## Reproduced source-level regression

The live robot-motion packet already carried X, Y and Z, but the receiver interpolated it in `editor.js` before `ScenePhysics.tick()` ran its own character controller for *every* robot. Independently integrated Rapier vertical gravity can choose a different landing surface on another client (for example, second floor vs third floor). The manual keyboard controller also did not publish the full pose stream; only the autonomous robot journey did.

## Changes

- A controlling client now publishes the actual post-physics full XYZ pose at ~9 Hz for **manual** and autonomous motion; existing `robot-input` messages are retained for prediction.
- A receiving client uses the interpolated remote XYZ pose as the source of truth for its kinematic body while the live stream is current. It must not run an independent gravity/collision solver for that same robot. Remote-owned static robots do not fall locally when the stream ends.
- The same remote input/pose maps prevent a client from rebroadcasting someone else's robot input as a second controller.
- All original 3D models, saved rooms, robot mission work orders, inventories, avatar files, and permissions are unchanged. No database migration.

## CORS investigation (a different server)

The SHA-256 bytes of `js/smart-media-playlist.js` are identical across v0.2.208–v0.2.215. SOLVI's Nginx configuration generator is also identical. The Rantlist `.m3u8` browser request reported `Access-Control-Allow-Origin: https://mojoworks.xyz` rather than `https://solvi.help`. A valid origin change must be made in the **Rantlist media host configuration or upstream/CDN**; no frontend script can legitimately change that response header. See `docs/RANTLIST_MEDIA_ORIGIN_REPAIR.md` for an allowlist configuration and verification commands. No arbitrary third-party proxy has been added.

## 502 / 429 investigation (not claimed fixed)

502 across `/api/me`, scene and robots endpoints and a connection reset indicate a backend/Nginx or upstream failure separate from remote-media CORS. 429 signifies rate limiting and requires response headers plus backend logs to attribute to the application or provider. The supplied read-only `scripts/diagnose-production.sh` prints systemd, local Gunicorn health, HTTPS health, recent service/Nginx errors, OOM evidence and CORS responses with both origins. No deployment scripts silently alter the unrelated Rantlist host.

## Acceptance criteria

1. Two separate signed-in profiles open the same realm, one robot on the third storey. Start manual keyboard motion; the remote position must stay at the correct elevation, preserving the continuous gait.
2. Begin autonomous movement on the same floor; both clients must agree on the floor while moving and after stopping. Test stopping for >3 seconds, and after both browsers reload.
3. Validate lift ascent/descent and ladder use on both clients; lift-specific transport logic remains intact.
4. Inspect browser network for `robot-motion` packets including nonzero Y; confirm the remote physics body is not applying secondary gravity to received poses.
5. Run `scripts/diagnose-production.sh` before changing a failing backend. Record the actual service/Nginx failure or rate-limit response headers; do not assume CORS caused 502.
6. Verify Rantlist playlist *and segment* CORS using `Origin: https://solvi.help`; keep `https://mojoworks.xyz` working if required.

## Verification scope

Local unit/source regression tests and ZIP hash checks do not constitute a live dual-browser, full Flask HTTP, WebSocket or remote HLS playback test. Do not mark production fixed without those checks.
