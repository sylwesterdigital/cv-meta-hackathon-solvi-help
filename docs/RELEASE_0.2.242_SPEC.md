# SOLVI.help v0.2.242 — smooth walking and local robot-eye frame preview

## Existing execution preserved

Opt-in geometric smoothing occurs after `planRobotTravelRoute`. `smoothRobotWaypoints` samples short quadratic corner arcs and verifies every point and line segment against the same obstacle footprint with 0.30m padding. An unsafe arc returns the exact unsmoothed A* route. Routes with real barrier-scanning checkpoints retain their original waypoints. Robot velocity remains frame-stepped and collision checked; no teleporting or wall crossing is introduced.

## UI

- The **Smooth paths** checkbox in the robot control switcher defaults to off, applies to newly planned routes for editable robots, and persists only in this browser's localStorage.
- The **Eyes** checkbox defaults to on; the preview above robot roundels shows a 16:9 panel with the last actual locally captured robot head JPEG, robot name, capture timestamp and relative age. It is deliberately NOT labelled live.
- Original square camera frames are contained inside the 16:9 panel without cropping; that avoids misrepresenting what the robot saw.
- The editor holds at most the most recent local frame per robot and revokes generated image URLs when replaced, hidden, or changing realm.
- Camera images are not newly shared with other users, uploaded for UI preview, or retained by the server for this feature. Existing vision and room-media consent policies are unchanged.

## Regression and watcher checks

1. `npm test` checks curved route geometry, obstacle fallback, A* wall detours and exact destination retention.
2. Confirm a real signed-in 3D scene, select a robot, enable **Smooth paths**, and request a route around a structure. The path should visibly round safe corners, but never enter a wall or cut a monitored fence/checkpoint.
3. Disable smoothing; route again and confirm ordinary A* waypoint behavior.
4. Select Albert's portrait; initiate a new head-camera capture or wait for scheduled reconnaissance. The 16:9 Eyes panel must update with the actual JPEG and timestamp; select another robot and confirm it shows that robot's own frame or an explicit no-frame state.
5. Switch realms. Old preview must disappear, even when robots have identical display names in different realms.
6. Ensure `npm test`, Flask/SQLite integration, browser module imports, Nginx tests and two-client scene synchronization pass under the existing watcher. The client-only camera panel does not provide remote frame sharing or autonomous execution with the browser closed.
