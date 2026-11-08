# SOLVI.help v0.2.241 — Speaking-volume outlines, room-object references and creative-session routing

## Problem and measured evidence

- In-world comic balloon borders were fixed black even when a robot's speech waveform was available in Web Audio.
- `@` completion showed plain names and a robot suffix with little separation; selecting objects by typing was impossible.
- The authenticated human instruction `@Albert and now perform extreme creative session of building an amazing metropolis for pink elephants` was routed into Muse conversation instead of the persistent work-order path. The robot said it had no scheduled tool task.
- A previously working model design pipeline can create and independently persist cubes, spheres and cylinders, but it must not be confused with unlimited tool generation.

## Implemented

1. **Audio-reactive comic outline**: real streamed/audio-file TTS emits PCM RMS levels via `solvi:robot-speech-level`, attenuated by configured voice output gain. The in-world speech balloon adjusts only its border/shadow; its white background and black words stay stable. The browser `speechSynthesis` fallback cannot expose PCM samples; it supplies an expressly synthetic cadence and is never reported as measured audio. Lifecycle cleanup is bound to speaking stop, realm switch and widget teardown. Reduced motion is already respected for decorative avatar animations.
2. **Grounded object references**: type `$` in the composer to see only nonrobot objects loaded by the current scene editor. Selecting an object inserts `$[Object name](UUID)` into the outgoing chat payload. Displayed chat renders a clickable `$Object name` chip that selects that exact object; when its UUID/name cannot be found in the current loaded realm the chip is disabled. Backend `go to` / `sit` resolves the UUID plus matching name against the *current saved scene* and refuses a stale or another-realm reference. Other robot-human references still use `@`.
3. **Participants with roundels**: `@` suggestions now include a 28-pixel circular portrait (where a media portrait is saved), or initials. Robot and person labels have separate trailing type text and consistent gap; selection logic retains existing multiword matching behavior.
4. **General creative authorization**: named human requests phrased as `perform ... creative session of building` create an actual named work order. Group `@all perform...` enters the durable server group queue, even for novel inventions such as a city for pink elephants. A creative session without a numerical duration is given a bounded **15-minute** work window. Single-object requests remain one-off and finite. Muse plans up to nine distinctive related assembly stages with at most twelve validated primitives each, with the established collision, permissions, immutable object IDs and save receipts.
5. **In-app help and examples** now describe natural goals and `$`/`@` completion instead of displaying a fixed language command list.

## Watcher acceptance gates

- Manifest path SHA-256 and original assets, npm dependencies/vendor import map, all JavaScript tests, Flask/SQLite integration tests and Nginx syntax must pass prior to deployment.
- Speak one robot reply using the local/ElevenLabs PCM source: the black outer comic border modulates in step with actual waveform loudness without changing the text's opacity. Speak using an explicitly selected device voice: the border should gently pulse, not claim true waveform measurement. Stop voice and change realms; the border must reset.
- Type `@Al`; verify Albert's portrait/initials and legible gap before the Robot label. Tab/arrow/Enter selects; Escape closes. Type `$` and choose a saved cube/sofa in the current realm. Chat displays a clickable label; click navigates the inspector to that saved object. Switch realms and verify the old object reference cannot direct robot movement.
- With editable Albert and Meta key, send the exact metropolis instruction quoted above. Verify `CREATIVE GOAL COMMITTED`, `MUSE DESIGN COMMITTED`, `CREATIVE PART SAVED`, then a `CREATIVE SESSION CHECKPOINT` without early stop and subsequent distinct design stages through the bounded session. If the key or editor rights are absent, the order must not falsely report created objects.
- `@Albert create a pink sphere` remains a single task. A negative instruction such as `@all do not build anything` must not create any creative group job.
- Reload during a session: the deadline, current design and saved object IDs must remain; duplicate parts must not be created.

## Explicit limitations

The `@` portrait appears if the account/robot has a saved media avatar. Generic browser speech synthesis has no PCM output accessible to the application, so its border cadence is an animation, not a volume reading. `$` identity checks are enforced on navigation commands; not every legacy tool yet consumes the ID reference syntax. Muse has a declarative primitive toolset, not arbitrary generated JavaScript, dynamic installed plugins, or off-browser autonomous physics. The 15-minute default has a nine-design/108-primitive budget and needs a running signed-in scene. A complete city is not guaranteed from this bounded session.
