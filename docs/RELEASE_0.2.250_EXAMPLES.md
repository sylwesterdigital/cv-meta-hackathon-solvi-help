# SOLVI.help v0.2.250 — Valid example instructions and tests

These examples assume a signed-in, visible 3D tab, a robot in the current realm with scene-edit permission, and a usable Meta key for new model-generated plans. Do not send a `$` as literal destination text: select an actual object from the live `$` picker.

## Creative work (ground level)

- `@Harrisa please start a creative session building colorful surreal sculptures from cubes, spheres and cylinders in a clear outdoor part of this realm for 15 minutes.`
  - Expected: a saved order, validated Muse design, actual route to a verified site, scene-save receipts and continuing timed checkpoints. If no site is reachable, it must scout then defer rather than invent success.
- `@All please start a 15-minute creative building session making distinct small geometric sculptures in safe outdoor locations. Work on different projects and verify your objects.`
  - Expected: separate realm-bound worker assignments, not several copies of one promised chat response.
- `@Jess please create a colorful sculpture using a sphere and cylinders in an accessible open area.`
  - If Jess is still on an unsupported upper floor, the correct response is a specific defer/recovery record, not placing geometry at ground coordinates from upstairs.

## Existing objects and movement

- Type `@Lola go to $`, then **select an actual scene object** from the autocomplete list and send the completed reference.
  - Expected: a real collision-checked route, or an explicit obstruction. No ghost target from another realm.

## Wide robot eyes (UI workflow)

1. Select **Lemox** or another editable, active robot from the face selector; turn on **Eyes**.
2. Wait for its actual six-frame survey. The panel should show **Stitched wide eyes · 210° horizontal × 135° vertical** once complete, without the previous `createImageBitmap` TypeError. The small refresh icon is optional if the capture fails or ages out; the user should not need it for normal operation.
3. Open **Brains → Vision → Capture eyes**. It deliberately shows the original **raw central JPEG** for model evidence, not the stitched peripheral panorama. Select the stitched entry from the Vision gallery to compare.
4. Change the selected robot or realm. A prior robot/realm's panorama must not remain as the new robot's evidence.

## Meta planner check (Work Orders)

1. Choose an editable robot and set **Meta agent** with the bounded goal: `Inspect the current realm and propose one safe useful task; if no usable task is authorized, explain the blocker.`
2. Enable 360-camera planning, start the loop, and review **Brains → Decision log**. A valid model-selected action must reach `META PROPOSAL`, not `META FAILED · TypeError · stage: parse-decision`.
3. The action must still pass existing scene permission, identity, collision and server save checks; a model proposal alone is not proof of physical work.
