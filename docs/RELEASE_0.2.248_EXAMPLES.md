# SOLVI.help v0.2.248 — Valid example instructions

Use a signed-in, active 3D realm with an editable robot and correctly configured Meta access for creative tasks. Smooth paths and Eyes are UI checkboxes in the robot control strip, not chat commands.

## Smooth walking

1. Enable **Smooth paths**. In SOLVI chat: `@Lemox go to $` — choose a real object at the other end of an open floor from the `$` picker. A clear route should be mostly a **single straight line**, rather than rounded zigzags.
2. `@Lemox walk 8 metres forward` — in clear space the path should be direct. Compare by toggling **Smooth paths** off and repeating in a suitable test area.
3. `@Lemox go to $` — select an object behind a real wall or obstacle. Verify the route safely detours and preserves any barrier camera checkpoints rather than taking a straight line through geometry.
4. `@Lemox stop` — interrupts a mission when the parser supports stop for the selected robot.

## Real wide robot-eye preview

1. Select **Lemox** in the robot portrait strip and enable **Eyes**. With the browser visible, the app should produce a real 210° × 135° stitched image (at most once per 120 seconds for that robot/realm).
2. Open **Brains → Vision → Capture eyes** for a new central JPEG. The new preview should then refresh with **Stitched wide eyes** when the local six-camera capture completes. The raw image remains in the Brain gallery.
3. For a manual immediate confirmation, use **Brains → Vision → Wide Eyes 210°**. That tool is independent of the automatic preview rate limit.
4. Change realms and robots: the preview must show only the selected robot's actual camera, or an honest no-capture state.

## Existing creative construction (unchanged in this release)

1. `@Bee please build a pink arch from cubes and cylinders near the open space in front of you.`
2. `@Viola please start a creative session designing abstract sculptures beside Bee's work, within the safe build area.`
3. `@Bee please continue extending your maze with clear corridors and 90-degree corners for 15 minutes.`

Accept a task as complete only after persistent object receipts, not because a robot said it would do the work. This release does not add unrestricted research, off-browser movement or an unlimited tool system.

## Watcher

Place `Solvi-0.2.248.zip` intact into `updates/` and run `./solvi-watch.sh --once`. Keep the production deployment gated by Flask/SQLite and live two-client smoke tests.
