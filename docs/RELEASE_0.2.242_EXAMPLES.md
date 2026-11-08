# SOLVI.help v0.2.242 — Valid example instructions and UI controls

These examples work with the v0.2.242 interface when the named robot exists in the current realm, the browser is signed in, the robot is editable, and navigation/camera permissions are available. These are usage examples, not new hardcoded phrases.

## Smooth robot walking (optional)

1. In the small robot-control bar above the camera control, tick **Smooth paths**. It defaults to **off** to preserve the old collision-checked route. This option applies to the next robot route planned in this browser, not to a route already underway.
2. Type `@Albert go to $` and pick an actual current-realm object from the `$` list, such as **MointainMovieLounge1-2-c**. SOLVI inserts the exact object ID. Confirm that Albert rounds safe turns on the approach rather than zigzagging through grid corners.
3. As a simpler alternative, type `@Albert walk 4 metres and return 3 times` or `@Albert turn right 90 degrees then walk 2 metres`. A straight route should stay straight; existing collision and robot-movement checks still apply.
4. Untick **Smooth paths**, give the same valid route again, and compare the unsmoothed A* result. Barrier and fence reconnaissance checkpoint routes intentionally retain their original exact waypoints even when the toggle is on.

## See what the robot saw

5. In the robot-control bar, tick **Eyes** (on by default). Select **Albert's circular portrait**. A 16:9 rectangular panel appears immediately above the robot faces. If Albert has not captured a camera image in the current realm, the panel explicitly says so.
6. With Albert selected, open **Brains → Vision → Capture eyes** (or **Scan 180°**). The panel updates to show the **actual latest JPEG capture** and its age, e.g. `8s ago · ...`. A square camera image is fitted inside the 16:9 frame without cropping or stretching.
7. Select **Viola's portrait**. The panel switches to Viola's own latest capture or a clear no-image state. It must not show Albert's eyes under Viola's name.
8. Wait for an enabled automatic reconnaissance capture in an active browser. The latest frame should appear even before Muse has analysed it. This is a *last capture*, not streaming video; the age increases while no new capture occurs.
9. Change to another realm. The previous realm's photo must disappear. Disable **Eyes** to hide the panel; enable it to see newly captured evidence.

## Existing creative commands remain valid

10. `@Albert perform an extreme creative session of building an amazing metropolis for pink elephants.` Starts the previously supported bounded design session; this release does **not** change its design quota.
11. `@All perform a creative session of building a surreal public square with sculptures, arches and landmarks.` Creates independent authorized work orders when eligible robots are present.
12. `@Albert stop` can interrupt a supported active movement/work operation.

## Conditions and limitations

- A real signed-in scene and active browser are required for robot movement and autonomous head-camera perception. It does not run physical scene steps while the browser is closed.
- Smooth paths does not bypass collision, unlock a closed room, or imply that a character can fit through a too-small gap. The exact raw route is used if rounding cannot be verified as safe.
- The preview is a **local, ephemeral last-camera frame**, not new server storage, publishing to chat, or shared remote live video.
- Browser-native virtual-camera captures are generally square (512 × 512); the display panel is 16:9 with letterboxing to protect the original field of view.
