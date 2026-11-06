# SOLVI.help v0.2.211 — smooth autonomous walking across multiplayer clients

## Reported defect
Autonomous robot paths walk smoothly on the controlling browser but move like ghosts between sporadic positions on other signed-in clients. In v0.2.210, the robot-input WebSocket path predicts manually controlled movement, whereas `tickRobots()` autonomous paths save robot positions periodically using scene object updates. A remote browser often receives only persisted pose checkpoints. The existing `robot-motion` handler also translated received poses into a stopped `robot-input` frame, making autonomous robot animation end immediately. The scene replication path explicitly protected manually driven robots from stale checkpoints, not navigation streams.

## Fix
- Owner tab publishes compact, authorised `robot-motion` snapshots at approximately 9Hz *after* pathfinding, collision and physics have moved the robot; a final idle snapshot terminates each mission. Vertical position and heading are included. A scene save occurs on task completion and at 5-second recovery checkpoints, not as an animation transport.
- Receiver stores up to seven ordered snapshots per robot and renders about 145 ms behind the network using per-frame position and shortest-angle yaw interpolation. Remote browsers do **not** run the owner A* planner or infer a straight crossing through obstacles. Stop at barrier-camera checkpoints is conveyed as an idle animation state while keeping the same mission on the owner.
- Skip stale/out-of-order samples, handle a changed controller or reconnect, stop animation if the stream goes silent, and avoid interpolating an invented long crossing from a stale join-time scene position. Only a bounded correction is interpolated on the first frame; large join errors initialise from the authoritative live pose instead of walking through geometry.
- A fresh live pose stream protects the visual transform from object-level scene checkpoint writes, while the old `robot-input` prediction and correction are retained for keyboard control. Manual control cancels the remote autonomous playback, not the inverse. Lifts/conveyors continue through their existing vertical motion path.
- Backend `robot-motion` authorisation still verifies the scene robot and editor rights before relaying. Sequence numbers are bounded and preserved; live relay is limited to 20Hz per robot per socket. These ephemeral packets never mutate SQLite, scene objects, ownership rules, avatar assets or physics.

## Manual acceptance tests
1. Open the realm in two **different signed-in profiles** in the same realm, with both WebSockets connected. Enable opt-in roaming for Lemox. Starting the walk in A must show walking (not teleporting) and correct facing in B for the full route.
2. Request a path around a long fence. Watch bend(s) in both clients: B must follow Lemox's actual owner path around the fence, not take a shortcut across it or create a ghost jump between saved checkpoints. Camera-scan pauses must look idle, then resume walking.
3. Halt/finish the route. Both clients must stop walking at the same final position, without drift. Trigger another route, run/walk mix, and manual arrow-key driving; manual controls must not be broken.
4. Refresh B while A walks: the first fresh pose may catch up to the actual current position, but subsequent frames must be smooth; no artificial long straight path from an old checkpoint. Reconnect B and ensure out-of-order or stale messages cannot rewind motion.
5. Verify a full scene reload after walking recovers the last saved robot position and never deletes, regenerates, or alters owned avatars, bags, furniture, user settings or room records. Observe CPU/network use with several simultaneous robots.
6. Validate server rejection of motion packets from a non-owner in an owner-restricted realm; verify no unauthorised world edits or room cross-talk.

## Verification limits
Static and JavaScript test results demonstrate packet interpolation and code integration, but this environment cannot establish live two-browser WebGL/GLB animation, WebSocket latency, or Flask HTTP behaviour. Production deployment requires the existing watcher, production backup, and manual two-profile browser verification. No schema migration or binary media changes.
