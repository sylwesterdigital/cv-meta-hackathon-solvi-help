# SOLVI.help v0.2.243 — Scene collections, selection, and exact chat object references

## Changes

- Fix the `$` autocomplete bug caused by a preceding `@` mention taking priority. `activeReferenceQuery` chooses the latest active trigger at the cursor; the candidate filter uses actual current-realm IDs and includes human-friendly display labels for search.
- Clicking an item in the stage invokes object selection with `revealInList`, opens the Objects panel, clears the incompatible type/text filter, expands the selected collection, highlights the original object ID, and scrolls that row into view. Camera selection is not repositioned.
- Add persistent optional `collection` metadata (`{id,name}`) to editable scene objects. The backend validates this in both atomic object PATCH-equivalent POST and full scene PUT. `collectionOptOut` allows legacy creative parts to be ungrouped without changing server-receipt object names.
- Automatically organize new robot creative primitives under a `Robot - Design 001A` style folder. Original `SOLVI Creative · UUID ...` names remain intact internally because server-side creative completion and recovery verify their exact structure. Render only short part names within the folder.
- Recognize old saved creative projects from their names as legacy folders without a bulk database migration. Renaming such a folder writes collection metadata on existing members.
- Add manual Group selected, Rename, Ungroup, folder collapse, and Move actions to Objects. Move uses a temporary Three.js transform pivot and applies the same matrix delta to each independently persisted member. The pivot is not a scene object, and it is removed on selection/realm change.
- Only fully editable, unlocked, non-robot collections have group transforms. Ownership and lock restrictions stay in force.

## Tests / deployment gates

- `npm test`: existing regression suite plus `release-243-collections-and-references.test.mjs`.
- `python backend/test_scene_collections_243.py` validates strict schema and both backend routes without Flask dependencies.
- `python -m py_compile backend/server.py`, JavaScript `node --check`, shell syntax, Nginx test, and ZIP manifest/hash verification.
- **Mac watcher** must run Flask/SQLite integration before publishing. **Live acceptance** must verify group transforms with two clients, including current-realm selection, robot-generated collections, and network retries.

## Scope / remaining constraints

- This is object organization and group manipulation, **not** native Three.js scene parenting. Individual objects keep their world transforms and collision bodies, and only their membership metadata is added.
- Per-member transform saves are not a server-atomic group transaction; possible partial save failures require reload and retry.
- Existing robot task authorization, identity, realm boundaries, and saved scene receipts are unchanged. This release does not implement new procedural design capabilities beyond those shipped in v0.2.242.
