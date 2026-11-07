# SOLVI.help v0.2.226 — Proactive, verified room furnishing

## Problem
Ania described furnishing a room with a fridge and television, but her old array-of-houses work order was blocked and chat-to-work recognised only house construction and select cleanup instructions. The procedural `fridge` and `tv` objects already existed in the application, but the autonomous build allowlists excluded them.

## Execution
A direct, authenticated `@Ania but what about adding a fridge and telly to this room?` creates a persistent `local_project` order. It supersedes the stale house work order and creates `fridge`, then `tv` using the existing `SceneEditor` procedural generator. The parser understands imperative or polite human requests, but not unrelated friendly speculation or a negative instruction. Scene changes remain checked against the addressed robot's edit permission.

The robot must be physically on a real editable house-floor cube (`autonomyFloor` / named house floor) of the correct elevation. The editor enumerates available footprints on that floor and rejects overlap with walls, existing furniture and other scene obstacles. These are locally verified scene placements, not evidence that the camera model saw an object. If no room is reachable, the Brain log identifies `NO ROOM FLOOR` or `NO CLEAR ROOM SPOT`; no furniture is created outside the intended room.

The editor's existing `persistObject` calls the normal `/api/scene/object` endpoint. `projectPlaced` receives an ID only after the server acknowledges the save. If the API fails, `projectPending` holds the same ID; the next attempt tries saving that object rather than creating a duplicate. A blocked variant is temporarily added to `projectDeferred` with an exponential bounded retry. Another requested furnishing proceeds before the skipped variant is revisited. Actual stored IDs are used to detect completion after reload.

## Model tools and boundaries
The Meta planner may propose a `furnish_room` action using a validated procedural variant, but the browser checks permissions, floor presence and collision again. Ordinary human-directed execution does not depend on Meta. This does not generate arbitrary 3D models or enable unsupported fridges/TVs to be placed anywhere through walls. The generated TV is a local procedural TV object, not an IPTV subscription or activated media channel. No arbitrary remote commands, new edit permissions, or server-side robot execution are introduced.

## Watcher acceptance
1. Deploy v0.2.226 only after the Flask integration gate passes. Prior v0.2.223 failed before GitHub push on `vision_search`; this request must continue to work without a Meta key.
2. Stand Ania in her own house room in Nowhere. As an authenticated owner, send `@Ania please add a fridge and a telly to this room`. Confirm `ROOM FURNISHING ASSIGNED`, each `ROOM FURNITURE SAVED` with distinct IDs, and a verified end state. Reload both clients; both objects should persist on that floor.
3. If the save API returns an error, confirm no false completion and no repeated duplicate item. Allow network recovery and confirm the original pending ID is saved.
4. Occupy the fridge location with furniture. The robot must choose another clear site or defer the fridge and attempt the TV. It must not overlap the occupied area or declare success without an acknowledged write.
5. Try the same request while the robot is outdoors or another floor: it must explain why a room floor is unavailable rather than placing the furniture randomly.
6. Existing can/box cleanup, house construction, local scene edits, multiplayer, identity, model notices and all original assets must remain unchanged.

## Verification boundary
Code-level regression tests and isolated backend policy checks are not substitutes for live WebGL/Flask/two-browser tests. The Mac watcher must run the full Flask HTTP suite before any production push.
