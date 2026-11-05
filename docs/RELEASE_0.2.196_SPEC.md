# SOLVI.help v0.2.196 — Procedural Furniture Persistence and Scene Recovery

## Problem

Client `sanitiseFurniture` emits 129 fields for ordinary furniture, props, tools and office devices. Server `valid_basic_furniture` only accepted up to 120. `object_presets` nested dictionary guard also capped at 120, resulting in `Invalid basic furniture` and failed saves. Locally rendered objects subsequently disappear after room reload because rejected objects never reached shared SQLite storage. This does not prove how already-stored objects disappeared; remote production DB and prior backups need investigation.

## Required changes

1. Shared compatibility: accept bounded furniture payloads up to 200 fields but still reject any unrecognised field, invalid numeric bounds, disallowed URLs, invalid open/state types or oversized channels. Presets use the same complete validation. Test every normal furniture/tool/device variant.
2. Never silently erase a full populated realm in a bulk save. Any full replacement removing over 25% of more than four objects needs explicit `confirmDestructive:true`, a revision check, and a durable pre-replacement backup. Per-object updates remain atomic and ownership-validated.
3. Retain 32 compressed, SHA256-checksummed before-change snapshots per room. Store a pre-upgrade baseline from any populated room at server start. Provide read-only API endpoints to list and download snapshots. Stop short of automatic restoration.
4. Validate incoming scene snapshots before changing WebGL objects; reject bad object IDs, transforms, duplicate IDs and unexpectedly empty same-room responses. Store a small last-good local copy if quota allows.
5. Offline recovery CLI lists live/legacy/snapshots, exports JSON, or restores a specific snapshot only after stopping the service, backing up SQLite and providing an exact confirmation flag. Never overwrite a live realm automatically.
6. Preserve existing avatars, robot systems, camera, analytics, custom media and source asset binaries byte-for-byte. Package complete `app/` plus SHA256 manifest for Mac watcher.

## Manual verification after deployment

- Safely back up production SQLite BEFORE deploying or opening/editing the scene.
- Open two authenticated clients in main. Add rake, all other tools, chair, table, laptop, fridge and screen; verify each save acknowledgement and presence in second client.
- Save each as a preset. Reload both browsers; verify objects and colours survive.
- Click Reload while a transient GET is malformed/empty: populated world should not be destructively cleared.
- Inspect `/api/scene/backups?room=main` authenticated as a user and confirm original populated pre-upgrade snapshot exists if the server DB was populated at first run. Download by ID and verify objects.
- Check older SQLite backups/realm exports for already lost furniture. Do not restore one client without coordinating other collaborators.

## Known limitations

Flask integration, two-browser WebGL behaviour and live SQLite recovery cannot be verified in the isolated local test environment without production data and credentials. The pre-upgrade baseline cannot recreate historical state already deleted before this release.
