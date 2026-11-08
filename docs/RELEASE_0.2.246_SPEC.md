# SOLVI.help v0.2.246 — Collections, creative presets, map controls and robot wide eyes

## What changed

**Collection deletion**: An expanded collection now offers **Delete group** (trash action). **Bulk** mode supports checking multiple complete collections, selecting visible groups and deleting them with one confirmation. Groups with any read-only, locked-owner, or protected robot member cannot be removed by a partial group operation. The existing per-object save/delete receipt path remains in use; collection deletion is **not atomic** across members in the backend. If the upstream service fails, incomplete deletions are reported rather than falsely acknowledged.

**Creative Builds presets**: A collection can be saved under a new **Creative Builds** tab of Presets. The server saves the account-owned preset as a validated, portable `creativeBuild` assembly of 1–64 procedural cubes, spheres, cylinders, planes or toruses. The portable payload contains per-part names, local relative transforms and material/geometry settings, not scene IDs, robot IDs, ownership data, uploaded assets, or executable code. Saving the preset is one authenticated database operation. Instantiating the preset creates a new collection and brand-new object IDs using an existing collision-aware placement check, and each new scene object is persisted through the normal edit mechanism. Existing structure objects remain unchanged. The current collection preset feature deliberately does not support arbitrary imported GLBs, custom textures, media, robots, connected portals or lift mechanisms.

**Resizable map**: The map panel accepts CSS corner resizing, constrained by viewport space. The 2D canvas pixel buffer is re-created when the element size changes to avoid stretching. `mapPanAfterDrag` reverses the previous vertical sign so both axes move in the same direction as pointer dragging. The redundant drag-help sentence is removed.

**Wide Eyes**: In Brains → Vision, **Wide Eyes 210°** captures six distinct genuine robot camera frames with 94° perspective FOV at different yaw/pitch headings, then stitches them into a 210° horizontal by 135° vertical equirectangular JPEG. The mosaic can be inspected in the existing last-eyes panel and optionally sent through the existing **Describe frame** action. Standard 72° vision and target-detection ray calibration remain unchanged. This is sequential panoramic peripheral coverage, not simultaneous binocular stereo, retinal foveation, or a physical human visual system.

## Validation and watcher requirements

- New tests cover portable preset normalization and forbidden metadata; backend Flask tests cover preset creation, categorization, retrieval, deletion and rejection of embedded owner/object IDs.
- Map drag-direction and resize metrics are covered by focused JavaScript tests.
- Pure wide-eye projection tests confirm valid coverage to ±105° bearing and ±67.5° elevation, with a six-view coverage sweep.
- Full JavaScript suite, Python syntax, Nginx checks, and archive SHA-256 verification are release gates.
- Full Flask integration and interactive two-browser scene verification **must** run under the Mac watcher. The current sandbox lacks Flask and prepared Three.js vendor files, so a successful watcher/live test is not implied.

## Known limits

- Collection deletion and placement commit independent scene objects, not one atomic multi-object database transaction.
- The 210°×135° mosaic requires six renders and uses a nonlinear equirectangular display; straight lines may appear curved away from the center, by design.
- Width and height of the map are freely adjustable within the browser viewport; resizing does not change physical scene geometry.
- Server-side robot motion continues to require an active authorized browser client.

See `Solvi-0.2.246-example-instructions.md` for exact UI checks and valid creative instructions.
