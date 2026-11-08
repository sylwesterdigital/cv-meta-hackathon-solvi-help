# SOLVI.help v0.2.245 — Objects list display fix

## Reproduced failure

v0.2.244 retained `display:grid` on `.scene-items`. As more robot-created projects appeared in the fixed-height Objects panel, each collection grid row was compressed to about 19 pixels even though its header required 43 pixels. `overflow:hidden` clipped the text and controls, leaving thin horizontal rules. A local headless Chromium reproduction with 25 collections demonstrated the mismatch.

## Corrective behavior

- `#sceneItems` uses a block flow and scrolls vertically; each folder keeps its natural height.
- Collection titles and counts render as independent text nodes rather than depending on icons/toolbar button decoration.
- A full-width accessible disclosure button toggles a folder. Move, Rename, Ungroup are shown in the expanded folder, with object rows beneath them.
- The search field matches collection titles as well as primitive names. The list shows its collection/object counts and an informative empty state.
- Existing collection/scene metadata, permissions, IDs, movement gizmos, and database schema are not modified.

## Acceptance checks after watcher installation

1. In the same realm with 20+ robot projects, open Objects. All folder titles must remain readable, not thin lines.
2. Search a collection by its human-readable title. Verify results show that folder.
3. Expand a folder. Verify Move, Rename, Ungroup and component rows remain visible.
4. Click a saved primitive in the 3D stage. The right folder opens, object row is highlighted and scrolled to.
5. Switch icons-only UI on/off. Folder names and member names must remain readable.
6. In Edit mode, move an owned unlocked collection, save the realm, and verify in a second tab that all components have the correct transforms.
7. Monitor browser console for exceptions and run backend Flask integration tests. A 502 error is a separate upstream health issue and is not repaired by CSS.

## Limitations

Full multiplayer acceptance and the deployed visual result still require the Mac watcher and a real signed-in 3D browser. No changes to existing content are required; do not reset the database.
