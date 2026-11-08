# SOLVI.help v0.2.251 — Valid test instructions

**Requires:** signed-in SOLVI.help browser using v0.2.251, permission to edit the current realm; configured Meta API key for `/ai` requests. All names/objects refer to the currently loaded realm. A browser session must stay open for scene editing and animated effects.

## A. Amorphous Geometry — Add window

1. Open **Add → Geometry → Amorphous**. A deformed 3D primitive should appear in an available, collision-safe placement.
2. Select it, then in **Geometry properties** set **Base geometry → Sphere**, **Distortion → 0.35**, **Frequency → 2.5**, **Seed → 31**, **Resolution → 18**, and **Normals → Faceted**. This is a rock-like low-resolution specimen.
3. Change **Resolution** to **48** and **Normals → Smooth**. The stone should have finer detail, while retaining its seed and approximate silhouette.
4. Choose a color and existing texture through the normal object material controls. Under **Animated surface**, choose **Glow**, **Rainbow gradient**, or **Swirl**; change **Speed** in the geometry-property selector.
5. Rename the object **Rock 001**, save the scene, reload, and compare its silhouette and shader effect. The same seed/settings should reconstruct the same mesh.
6. Use **Save as preset** on the selected object if the account supports geometry presets, and restore it to check deterministic geometry.

## B. Meta Vehicle Lab — floating Add window

1. Open **Add → Meta Vehicle Lab**.
2. Select **City Car**, adjust **Chassis length** to **4.2 m**, **Width** to **1.8 m**, **Wheel radius** to **0.42 m**, choose a paint color, and select **4 wheels**.
3. Look at the blueprint schematic, then choose **Add to realm**. The new parts should appear as an editable collection of a chassis, cabin, and four wheel primitives. An unsuccessful placement must not create an overlapping vehicle.
4. In **Objects**, expand the vehicle folder, examine the individual parts, use the collection **Move** gizmo, save the realm, and verify positions after reload.
5. Select **Explorer Rover** and test **6 wheels** with a different color; save the blueprint locally and export its JSON. The blueprint must not contain private account IDs or scene object IDs.
6. **Optional model swap:** Import a permitted GLB into the realm first using the regular model uploader. Reopen Meta Vehicle Lab, choose it under **Optional chassis GLB**, then add a new assembly. Only the chassis visual uses the model; the vehicle retains its editor/physics collision configuration.
7. In **World Settings**, enable physics to check that static chassis/wheel colliders interact with other supported physics objects. This release does **not** steer, accelerate, drive, or simulate sprung suspension.

## C. General Meta AI in chat — type the following

- `/ai What is the difference between a static and a dynamic Rapier collider in SOLVI.help?`
- `/ai Can you explain how to make an Amorphous stone with a rough faceted silhouette?`
- `/ai Which procedural geometry tools can I use to build a vehicle chassis in this realm?`
- `/ai How does the SOLVI browser scene communicate with the backend? Describe only the source excerpts that are available.`
- `/ai --file Write a markdown README documenting how to use Amorphous Geometry and Meta Vehicle Lab.`
- `/ai --file Draft a small JavaScript geometry helper using validated numeric inputs. Do not deploy it.`

### Image context

1. Attach a **JPEG/PNG/WebP** to the normal chat composer (maximum three images, individually no larger than **4 MB** for Meta AI analysis), then type `/ai Analyze this image and propose three possible stone sculpture shapes based on what it shows.`
2. Capture a real robot head-camera frame in the current realm and enter `/ai --eyes @Lemox: What objects appear in the latest actual robot camera frame?` Replace Lemox with a robot available in that realm. If no capture exists, the chat should say so instead of inventing one.
3. Try `/ai --image Make this reference photo look like a futuristic sculpture.` This is a **capability-check case**: the app should clearly state that image generation/editing is not configured, and must not claim an image was produced.

## Acceptance and limitations

- Normal `/ai` questions and draft files do not create robot work orders, move objects, or edit application code.
- Backend must reject unauthenticated `/ai`, unowned image attachment IDs, unsupported model IDs, and excessive request frequency.
- Image analysis relies on configured Meta vision capability; no image generation/editing or binary file transformation adapter is included.
- Vehicles are **editable, collidable collections with static parts**, not yet motorized or physically rigidly linked into a single drivable simulation.
- A failed placement must not add untracked vehicle components. No more than **512 total scene objects** may be created in one realm.
- A full browser/physics test plus Mac watcher Flask integration suite is required before considering production behavior verified.
