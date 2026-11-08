# SOLVI.help v0.2.244 — Supported example instructions and UI tests

**Object reference:** type `@Albert go to $`, then choose the current-realm object using the suggestion list.

**Selection test:** click an existing sculpture primitive on the stage; the Objects panel must open to its highlighted object in the correct expanded collection.

**Collection test:** select **Move** on an editable folder, move it using the gizmo, **Save** and reload in a second client to check transforms.

**Icon-only regression:** choose **Icons only** in display settings, open Objects, and verify every collection title, **Move**, **Rename**, **Ungroup**, and member name is readable.

**Robot motion:** `@Albert go to $` followed by choosing an actual object; verify a real collision-checked route.

**Creative task:** `@Albert build a pink elephant sculpture in this realm.` Validated Meta design and edit access required; check scene receipts rather than dialogue.

**Service health:** if API requests return 502, stop adding objects and check the backend service and Nginx error logs before further scene mutations.

The browser must be open for robot physical execution. Tools and model credentials must be configured for model-driven creation.
