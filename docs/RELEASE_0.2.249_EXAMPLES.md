# SOLVI.help v0.2.249 — valid example instructions

This release changes camera and map UI behavior, not the robot command language. The following are supported patterns for existing authorized robots in the active realm:

1. **Sit and inspect camera:** Select Lemox, set **Chase**, then `@Lemox go to $` (pick an existing chair from the current realm), followed by `@Lemox sit on $` with the exact chair reference. Observe the 180° seat turn without a camera flip.
2. **Stand:** With Lemox selected for robot control, press **J** (the in-app Sit / Stand key). Then send `@Lemox walk 2 metres forward`. Observe when Chase resumes its normal heading tracking.
3. **Wide eye survey:** Select Lemox, enable **Eyes**, click **210° ↻** above its portraits, and verify the label *Stitched wide eyes · 210° horizontal × 135° vertical*. In Brains, compare **Capture eyes** (single raw JPEG) and **Wide Eyes 210°** (six-view panorama).
4. **Map:** Open Map, drag its resize grip to a wide horizontal panel and then to a tall panel. Drag diagonally with the mouse or touch. Object shapes must not stretch or drift against the cursor.
5. **Existing creative builds:** `@Lemox perform a creative session building a surreal entrance plaza with colourful shapes for 15 minutes.` This remains subject to the authorization and browser limits of v0.2.248.

Object `'$'` examples require choosing a real scene object from the suggestions and successful navigation; a text-only literal `$` is not itself a destination.
