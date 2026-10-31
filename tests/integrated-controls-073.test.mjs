import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('camera bookmarks persist by user and realm and offer shareable teleport',()=>{
 const server=read('backend/server.py'),client=read('js/camera-bookmarks.js'),html=read('index.html');
 assert.match(server,/CREATE TABLE IF NOT EXISTS camera_bookmarks/);
 assert.match(server,/user_id=\?/);
 assert.match(server,/@app\.get\('\/api\/bookmarks\/<bid>'\)/);
 for(const id of ['bookmarksToolButton','cameraBookmarkCapture','cameraBookmarkRealm','cameraBookmarkExport','cameraBookmarkImport','cameraBookmarkClear'])assert.ok(html.includes(`id="${id}"`));
 assert.match(client,/Teleport/);assert.match(client,/Share in chat/);assert.match(client,/confirmAction\(/);
});
test('integration keys are verified read-only, Tripo check does not launch a generation task',()=>{
 const backend=read('backend/server.py');
 assert.match(backend,/@app\.post\('\/api\/integrations\/check'\)/);
 assert.match(backend,/https:\/\/api\.meta\.ai\/v1\/models/);
 assert.match(backend,/elevenlabs\.io\/v1\/user\/subscription/);
 assert.match(backend,/openapi\.tripo3d\.ai\/v3\/account\/balance/);
 assert.match(backend,/def check_whisper\(\)/);
 assert.doesNotMatch(backend.slice(backend.indexOf('def check_integration'),backend.indexOf("@app.get('/api/integrations/whisper')")),/generate_image|text_to_model/);
});
test('separate robot path and chat debug toggles and chat Shift+Arrow history',()=>{
 const studio=read('js/studio.js'),robotDebug=read('js/robot-debug.js'),html=read('index.html');
 assert.match(robotDebug,/ROBOT_PATH_ALL_KEY/);assert.match(robotDebug,/robotPathVisible/);
 assert.ok(html.includes('id="debugSelectedRobot"')&&html.includes('id="pathSelectedRobot"'));
 assert.ok(html.includes('id="debugAllRobots"')&&html.includes('id="pathAllRobots"'));
 assert.match(studio,/chatDraftHistory/);assert.match(studio,/e\.shiftKey&&\(e\.key==='ArrowUp'/);
});
test('recorded media supports review and explicit attach or blue scene orb',()=>{
 const studio=read('js/studio.js'),html=read('index.html');
 for(const id of ['composerRecorderTime','composerRecorderLevel','composerRecorderStop','composerRecorderCancel','composerRecorderPreview','composerRecorderAttach','composerRecorderScene'])assert.ok(html.includes(`id="${id}"`));
 assert.match(studio,/new MediaRecorder\(recordStream/);assert.match(studio,/recordingCancelled/);assert.match(studio,/shape:'orb'/);
 assert.match(read('js/scene-media.js'),/SphereGeometry\(\.42/);
});
test('robot recurring routines are explicit session-only and bounded',()=>{
 const routine=read('js/robot-routines.js'),html=read('index.html');
 assert.match(routine,/setInterval/);assert.match(routine,/window\.addEventListener\('solvi:room-changed',stopAll\)/);
 assert.match(routine,/editor\.routeRobot/);
 assert.match(routine,/confirmAction\('This recurring discussion sends billable AI requests/);
 assert.match(html,/id="routineToolButton"/);
});
test('XR controller ray chooses media before floor teleport and renders only while targeted',()=>{
 const world=read('js/world.js');
 assert.match(world,/this\.xrMediaControls=new THREE\.Group/);
 assert.match(world,/setSceneMediaMuted\(mediaTarget/);
 assert.match(world,/toggleSceneMediaPlayback\(mediaTarget\)/);
 assert.match(world,/this\.xrMediaControls\.visible=false/);
});
