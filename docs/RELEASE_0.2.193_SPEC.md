# SOLVI.help v0.2.193 — Implementation Specification

## Scope and objective

Deliver procedurally generated tools and devices using the existing Three.js scene/editor framework, bounded server-side scene validation, reversible scene edits and versioned presets. Keep the previous robots, navigation, Umami analytics, rainbow wordmark, media sources and watcher contract intact. Everything is editable, saveable, and synchronisable through existing room JSON; no external 3D assets.

## Object catalogue

### Tools category

| Variant | Default handle (m) | Construction | Configurable |
| --- | ---: | --- | --- |
| `shovel` | 1.08 | round handle, rectangular metal spade and tip | handle length/radius; head width/depth; shaft, bristle and metal colours |
| `axe` | 0.85 | handle and metal axe head | same |
| `rake` | 1.38 | handle, crossbar, individual teeth | same |
| `stick` | 1.25 | cylinder | length, radius and colour |
| `broom` | 1.29 | shaft, broom block and bristle head | same |
| `mop` | 1.37 | shaft, rectangular mop plate and fibres | same |
| `saw` | 0.67 | horizontal grip and metal blade with teeth | same |

All tools are initially pickable dynamic furniture objects with `inventory.category='tool'`, available in **Add → Tools**, stored with pickable/inventory category intact in the existing room/preset JSON, and bounded by both client and backend validators. Model parts are ordinary meshes.

### Equipment additions

| Variant | Physical appearance | Inspector/interaction |
| --- | --- | --- |
| `keyboard` | slab and individual keycaps | width, depth, height, frame colour |
| `trackpad` | pad or mouse/stylus presentation | switch `deviceMode` between trackpad, mouse and stylus via inspector |
| `mouse` | compact mouse body | dimensions/colour |
| `printer` | body, feed lid, output paper | dimensions/colour; non-operating printer model |
| `laptop` | base with keycaps and touch area, movable screen lid | `open`, `screenAngle`, `powered`, media source and channels |
| `fridge` | hollow five-panel carcass, shelves, side-hinged door, handle and button | `open`, shelves, dimensions and shelf storage UI |

## Interaction states

`fridge.open` and `laptop.open` are persistent booleans; default false. They are controlled by clicking/tapping the fridge door, handle or front button, and laptop lid/back or hinge. The same state is editable in the inspector. Every state change checks existing object ownership, records undo/redo, updates geometry and physics, and queues a room save. Screen clicks are handled by the pre-existing smart-media system and do not close the laptop. `trackpad.deviceMode` is one of `trackpad`, `mouse`, `stylus`, changed in the inspector.

## Media behaviour

When open and powered, the laptop renders an `equipmentScreen` mesh compatible with existing TV/monitor `syncEquipmentMedia()` and `smartScreenClick()`. Supported sources are existing scene media or up to twelve HTTPS HLS/MP4/WebM channels. Existing browser autoplay, remote CORS and codec constraints still apply. Closing the lid removes the active screen and disposes any playback resources. The laptop does not implement an independent player.

## Refrigerator inventory

A fridge contains visible shelves and an actual hollow cavity. The inspector shows valid nearby `can`, `bottle` or `box` furniture objects, limited to objects within three world units that the user can edit. Items must fit the bound slot width, depth and height. The current fridge supports a maximum of five intermediate shelves, four columns and two depth rows: **at most 48 slots**. The stored object's persisted `storage` is `{type:'container',containerId:'<UUID>',slot:<integer>}`; the server validates identifier syntax and the slot index. Storing automatically enables the object's `pickable` flag. Stored items are attached by calculated fridge-local shelf positions each scene tick, without parenting scene objects or creating nested scene records. They are visible only when the door is open and have physics collisions removed while stored. **Put on shelf** and **Take out** buttons are enabled only while the door is open; removal places the item in front of the fridge and restores its physics. Missing/invalid container references are released on scene reconciliation; removing a fridge releases its contents rather than silently deleting them. Other actors cannot store/take objects they cannot edit.

## Compatibility and exclusions

No asset downloads; maintain original GLB bytes. No robot-operated tool semantics, text entry on the virtual keyboard, active printer or physical hinge motor simulation in this release. Media playback needs a browser-permitted stream. Do not advertise these as implemented. Existing screen channel settings and scene media must remain compatible.

## Test acceptance

1. Add each tool and each new equipment device; verify generated mesh and inspector controls.
2. Change dimensions/colours, save and reload; verify bounded settings and visual appearance.
3. Click fridge handle/button and laptop lid/back; verify open/close and undo/persistence.
4. Open laptop, play existing smart-screen channels, close lid; verify playback disposal and reopen behaviour.
5. Store a can, bottle and box where dimensions fit; verify slot assignment, room reload, visibility and removal; reject oversize/full/unauthorised storage.
6. Validate frontend and server numeric/boolean/enum constraints; reject malformed `container` storage identifiers/slots. Verify that `cleanStorage` preserves valid container references and room reload/reconciliation retains shelf contents.
7. Run the entire existing JS test suite (904 cases after the storage-cleaner regression) and backend standalone tests; verify archive SHA-256 and GLB byte identity.
8. Deploy only through existing Mac `updates/` watcher; never infer deployment from a local test.
