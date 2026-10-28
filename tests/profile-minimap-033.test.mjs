import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('minimap is before settings and supports camera, object map and floating controls',()=>{
 const h=read('index.html'),m=read('js/minimap.js'),main=read('js/main.js'),css=read('styles.css');
 assert.ok(h.indexOf('id="minimapButton"')<h.indexOf('id="settingsButton"'));
 for(const name of ['minimapPanel','minimapDrag','minimapMinimize','minimapClose','minimapCanvas','minimapReset']) assert.ok(h.includes('id="'+name+'"'),name);
 assert.match(main,/initMinimap\(world\)/);
 assert.match(m,/world\.robotEditor\?\.items/);
 assert.match(m,/world\.camera\.getWorldDirection/);
 assert.match(m,/setPointerCapture/);
 assert.match(css,/#minimapPanel|\.minimap-panel/);
});
test('profile camera uses a visible two-step still capture and video-only GIF path',()=>{
 const s=read('js/studio.js'),h=read('index.html'),api=read('backend/server.py');
 for(const id of ['profilePhotoBadge','profileCameraPreview','profileCameraControls','profileCameraCancel','takeAvatarPhoto','recordIntro','introPreview','profileLogout'])assert.ok(h.includes('id="'+id+'"'),id);
 assert.match(s,/profilePhotoArmed/);
 assert.match(s,/drawImage\(video/);
 assert.match(s,/video:\{width:\{ideal:640\}/);
 assert.match(s,/audio:false/);
 assert.match(s,/recordIntroGif/);
 assert.match(s,/new MediaRecorder\(profileCameraStream/);
 assert.match(s,/15000/);
 assert.match(api,/\'-t\',\'15\'/);
 assert.doesNotMatch(api,/\'-t\',\'1\.5\'/);
 assert.match(api,/UPDATE users SET intro=/);
});
test('logout clears stored client state, revokes token server-side',()=>{
 const s=read('js/studio.js'),api=read('backend/server.py'),tests=read('backend/test_api.py');
 assert.match(s,/localStorage\.removeItem\('solvi-profile'\)/);
 assert.match(s,/sessionStorage\.removeItem\('solvi-tab'\)/);
 assert.match(s,/solvi:session-lost/);
 assert.match(s,/window\.location\.reload\(\)/);
 assert.match(api,/@app\.post\('\/api\/logout'\)/);
 assert.match(api,/token_hash=\?,tab_until=0/);
 assert.match(tests,/logout invalidates browser session token/);
});
test('Orbit button no longer forces pointer-lock and duplicate importer is suppressed',()=>{
 const world=read('js/world.js'),h=read('index.html'),css=read('styles.css');
 assert.match(world,/fly\.onclick=event=>/);
 assert.match(world,/setCameraFollowMode\('free'\)/);
 assert.match(world,/THREE\.TOUCH\.ROTATE/);
 assert.match(h,/id="quickModelImport"[^>]*hidden/);
 assert.match(css,/#quickModelImport\{display:none!important\}/);
});
