# SOLVI.help v0.2.247 — Valid examples and acceptance instructions

Use these in the currently loaded realm, while signed in with edit rights to the named robots. Meta Muse must be configured, and the 3D browser must remain active for physical movement and construction. The commands are natural-language human objectives; accepted construction jobs are **not** proof of completed scene edits until parts are saved and independently verified.

## Collaborative, durable construction (chat)

1. `@Bee please start a creative session building two conker gatekeepers beside the north corner of your maze, using brown spheres and narrow cylinder legs.`
   - Expect a **named** `creative_build` job assigned to Bee (or pending while Bee is busy), model design and saved parts. Without an explicit duration, the creative session is capped at **15 minutes**.
2. `@Viola go to @Bee and help embellish the maze with two little gatekeeper figures made from brown spheres, slender legs and expressive eyes.`
   - Expect Viola's own queued task, a worksite near Bee's current position if reachable, then camera/physical movement and verified geometry. Do not expect Bee's existing task to be overwritten.
3. `@Bee please continue to create and extend the maze until I ask you to stop.`
   - Expect a **new bounded 15-minute** amendment queued for Bee; it starts after her earlier order has finished or been released. The phrase “until I ask you to stop” does not grant unlimited unattended construction.
4. `@Albert please create a pink elephant sculpture with a rounded trunk, legs and ears in a clear area ahead of you.`
   - Expect a single human-authorized creative object design (within the app's supported primitives), real scene saves and a verified receipt.
5. `@Bee please explain how your maze was built.`
   - **Non-executable** example: this is a conversation question and must not create or consume a construction order.

## Robot-eye preview (UI)

1. Select a robot portrait (e.g. Viola) and enable **Eyes**.
2. In **Brains → Vision**, choose **Wide Eyes 210°** for an immediate manual test. The 16:9 panel should show a stitched image labelled wide/peripheral, rather than only the square central screenshot.
3. For the automatic behavior, leave the scene open with Eyes enabled until the next eligible autonomous reconnaissance. After the real center-frame model observation, expect `WIDE RECONNAISSANCE` in the Brain log and the same preview to show **Stitched wide eyes · 210° horizontal × 135° vertical**.
4. Change the realm: the old robot-eye view must disappear. Switch between robots: each shows only its own latest authentic capture. Panorama is not stereo vision and is never described as live video.

## Collections (UI)

1. Open **Objects** and expand one of the robot-created folders, such as `Bee - Flying Spaghetti Monster Landmark 006F`.
2. The five actions should fit in **one row**: four-way-arrow **Transform**, pencil **Rename**, **Ungroup**, floppy **Save preset**, and trash **Delete**. Hover or focus to read a tooltip; keyboard focus must remain visible.
3. Save the group to **Presets → Creative Builds**, then instantiate it elsewhere. This must create new object/collection IDs, leaving the original group unchanged.
4. To remove a group, select the trash icon, verify the confirmation names the whole group and all members, then accept only if they are editable. For multiple groups use **Bulk** and select the target folders before the destructive confirmation.

## Watcher and browser gates

Place `Solvi-0.2.247.zip` **intact** in `updates/`, then run `./solvi-watch.sh --once`. The watcher must pass Flask/SQLite integration, JavaScript, Nginx, and vendor/build checks. Test both roles in a live signed-in 3D client and verify in a second client; a locally passing ZIP does not imply production deployment.
