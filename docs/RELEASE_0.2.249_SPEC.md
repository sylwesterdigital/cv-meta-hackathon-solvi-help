# SOLVI.help v0.2.249 — camera, wide eyes and map acceptance specification

## Behavior

1. **Seating:** In Chase, Smart Chase or Orbit follow, selecting a chair and sitting may change the avatar yaw to face its seat. The viewer retains the same world-space azimuth and follows only avatar translation through the sit/stand transition. The camera returns to normal chase/orbit behavior only after the robot has actually walked more than 0.55m from its post-stand point. Manual camera mode changes reset the lock. Remote robot movement and seat physics are untouched.
2. **Map:** All map primitives (circles, model footprints, robot indicators, walls, paths) share `mapPixelsPerMeter(zoom,width,height)`, using the shorter canvas dimension. A resized wide map reveals additional horizontal world instead of stretching geometry; a tall map reveals additional vertical world. Pointer dragging translates at the same metric scale on either axis.
3. **Eyes:** The underlying head camera still produces a genuine 512×512 72° raw JPEG; it remains the primary model evidence. When Eyes is enabled, SOLVI separately requests six genuine renders and stitches a **210° × 135° peripheral panorama**. This is not stereo nor real-time video. A capture-ready handshake avoids losing the initial request on startup. The latest successful panorama stays visible with its true age, not silently replaced by later raw JPEGs. The new `210° ↻` control can request a fresh local survey; 8-second user refresh throttling protects the browser. Repeated failed captures are retried after a bounded cooldown, and failure is logged rather than represented as success. The Brains Vision gallery includes both kinds of image.

## Test gates

- `node --test tests/release-249-seat-camera-wide-map.test.mjs`
- `npm test` and `node --check` on changed browser modules.
- `python -m py_compile backend/server.py` and existing Nginx configuration checks.
- Mac watcher full Flask/SQLite integration, then live 3D and 2-client persistence acceptance.

## Manual browser acceptance

- Enable Chase; sit on a rotated chair. The robot should face the chair while the camera holds its original viewing direction. Stand; it remains steady. Walk forward 2 m; heading-follow resumes.
- In Brains, **Capture eyes** displays an honest raw central JPEG. Enable Eyes and press **210° ↻**. The preview should show `Stitched wide eyes` and peripheral scenery; its timestamp should be accurate. Confirm a six-view capture in the Brain trace. Change realms and verify no images from the prior realm appear.
- Open the map, resize to 600 × 250, then 250 × 600. Circles should remain round and squares square, with world distance consistent. Drag diagonally: content tracks the pointer on both axes.

Production deployment is neither performed nor verified by local tests. Do not reset database or discard existing content. The Mac watcher must gate deployment.
