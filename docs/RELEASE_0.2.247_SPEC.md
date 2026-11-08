# SOLVI.help v0.2.247 — Actual peripheral reconnaissance, named robot tasks, compact collection icons

## Why

The 210° Wide Eyes feature introduced in v0.2.246 required a manual Vision capture. Routine autonomous reconnaissance still published only a 72° square head-camera JPEG. The screenshots consequently continued to show the narrow view. Separately, a human instruction such as `@Bee please start now creative session flanking the north corner cap with two conker guards` was interpreted as dialogue when the robot had no work order. In v0.2.247, an explicit named authorization creates an actual persistable task; a robot's spoken intention alone still cannot edit the world.

## Wide robot-eye preview

- During an authorized autonomous head-camera observation, the original square 72° capture goes unchanged to Muse as evidence.
- If **Eyes** is enabled, the scene browser is visible, and there has not been a wide survey for this robot in the last 120 seconds, SOLVI renders six *real*, local head-camera views: front, left, right, rear, up, down. Each view uses 94° perspective.
- SOLVI stitches a 210° × 135° approximate peripheral panorama, publishes it as the latest **Eyes** preview for the selected robot, and marks it `Stitched wide eyes`. A 240-second per-robot recent-panorama preference prevents the next narrow reconnaissance image from immediately replacing the panorama. After that, the most recent central image may be displayed until another panorama is available.
- A realm change or robot change prevents an old camera frame being published for a different scene. The capture is a sequential panorama, **not** a simultaneous binocular simulation or a truly undistorted human FOV. Only the real central frame is submitted to Muse during normal reconnaissance; wide surveys make no additional model request.
- Automatic reconnaissance is time/cooldown limited. For immediate visual confirmation, use the existing **Brains → Vision → Wide Eyes 210°** control.

## Human-authorized named creative work

- The saved **human** room message is the authority: messages from other robots, speculation, questions, requests for descriptions, and negatives do not create work.
- A message addressed to one currently existing, editable robot can request a new creative session, an amendment/continuation, a novel object, or collaborative construction. Authorization is based on action intent rather than a list of modelable object nouns; Muse still designs within SOLVI's validated cube/sphere/cylinder geometry schema.
- `/api/robots/autonomy/group/queue` creates exactly one `named_creative_build` row in SQLite for the requested robot and realm; repeated submission of the same message ID is idempotent. A different named robot may not claim this assignment.
- Claiming a task and committing its robot work order are atomic. A busy robot keeps its old work, and the new named request stays pending instead of silently overwriting it. An untimed named `creative session` / explicitly requested indefinite continuation receives a bounded **15-minute** default. A task that expires before the robot can claim it becomes blocked rather than executing late without authorization. Explicitly scheduled durations respect existing limits.
- A request to `@Viola go to @Bee and help embellish...` may anchor Viola's placement to Bee's **current, same-realm** pose, using the normal collision-checked site search and physical path rather than teleporting or reusing an old memory.
- Scene completion must pass the same server verification of actual newly saved components; replies like `no actual tool task scheduled` are no longer appropriate when there is a pending human assignment. This is still **browser-executed**, not offline/server-side animation.

## One-row collection controls

Expanded Objects folders display five compact icons in one row: **Transform (move)**, **Rename (pencil)**, **Ungroup**, **Save preset (floppy)** and **Delete (trash)**. Descriptive `title` tooltips and `aria-label`s remain, including in icons-only mode. The former permission checks, confirmation dialog for destructive deletion, and scene/preset persistence flows remain in place. Folder names and counts stay readable outside the icon row.

## Verification

- Local JavaScript suite: 1,184 of 1,184 tests pass; new tests cover named intent parsing, busy worker protection, same-realm camera guard, icon controls and the six-view capture workflow.
- `backend/test_api.py` adds actual Flask/SQLite HTTP tests for saved human chat authorization, one-task deduplication, correct robot ID, wrong-robot rejection, busy amendment preservation and rejection of a fake completion. **This full integration block must run on the Mac watcher, not in this sandbox**.
- Python syntax, shell syntax, JavaScript syntax and Python Nginx-config tests pass locally; package SHA-256 manifest is checked when ZIP is assembled.
- Live browser acceptance: enable Eyes and watch a routine reconnaissance panorama after its cooldown; compare with the manual Wide Eyes action; instruct Bee and Viola while a prior order is running; verify one named claim each, saved parts and persistence after a second-client refresh; verify responsive collection icons with mouse and keyboard.

## Limits

- Remote scene execution requires a signed-in active 3D browser; no backend animation while all browsers are closed.
- If Meta Muse is not available, the authorized order must remain outstanding; no fabricated creative structure is substituted.
- A camera panorama is sequential and therefore can show a moving scene at different instants. Its wide peripheral projection is nonlinear, not native human stereoscopic vision.
- The named creative queue provides safe ordering and existing primitive tools; it is not unrestricted model-authored executable tool generation or an indefinite autonomous build grant.
