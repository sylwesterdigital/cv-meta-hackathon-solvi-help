import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {intent,stepRobotMotion,packetFor} from '../js/robot-net.js';
import {MotionController} from '../js/animations.js';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const simulate=keys=>{let state={x:0,z:0,yaw:0,velocity:0,steer:0,lateral:0};const input={...intent(new Set(keys)),s:1};for(let i=0;i<100;i++)state=stepRobotMotion(state,input,1/60);return state;};
test('idle left and right strafe sideways, preserve world heading',()=>{
 const left=simulate(['ArrowLeft']),right=simulate(['ArrowRight']);
 assert.ok(left.x>.9&&right.x<-.9,{left,right});
 assert.equal(left.yaw,0);assert.equal(right.yaw,0);
 assert.equal(left.velocity,0);assert.equal(right.velocity,0);
 assert.ok(Math.abs(left.z)<1e-8&&Math.abs(right.z)<1e-8);
});
test('releasing strafe smoothly brakes to rest',()=>{
 let state=simulate(['ArrowLeft']);let last=state.x;
 state=stepRobotMotion(state,{f:0,t:0,s:1},1/60);
 assert.ok(state.x>last&&state.lateral>0,'inertia should persist in the corrected left direction for a frame');
 for(let i=0;i<60;i++)state=stepRobotMotion(state,{f:0,t:0,s:1},1/60);
 assert.ok(Math.abs(state.lateral)<1e-7);
 assert.equal(state.yaw,0);
});
test('live robot input stays compact when side-stepping',()=>{
 const input={...intent(new Set(['ArrowLeft'])),s:1};
 const payload=packetFor('robot001',input,{position:{x:0,y:0,z:0},rotation:{y:0}});
 assert.equal(payload.f,0);assert.equal(payload.t,1);assert.equal(payload.m,1);
 assert.ok(JSON.stringify(payload).length<160);
});
test('room settings persist policy per room and guard robot movement',()=>{
 const backend=read('backend/server.py');
 for(const token of ["CREATE TABLE IF NOT EXISTS room_policies", "@app.get('/api/room/settings')", "@app.put('/api/room/settings')", 'def may_edit(',"not may_edit(uid,controlled,room_policy(room_id))"])
   assert.ok(backend.includes(token),token);
 const live=read('js/live.js');assert.ok(live.includes('room-policy'));assert.ok(live.includes('object-edit'));
});
test('editing indicators are room-scoped and carry verified actor names',()=>{
 const backend=read('backend/server.py'),editor=read('js/editor.js');
 assert.match(backend,/publish\(\{'type':'object-edit'.*'name':name/);
 assert.match(editor,/showRemoteEdit\(packet\)/);
 assert.match(editor,/broadcastEdit\(active\)/);
});
test('world tools, message and chat mode placement, avatar actions and rename inputs',()=>{
 const html=read('index.html'),css=read('styles.css'),studio=read('js/studio.js'),editor=read('js/editor.js');
 for(const id of ['worldSettingsButton','worldSettingsDrawer','worldObjectsPolicy','worldRobotsPolicy','objectNameInput','robotActionSelect','chatModeButton','messagesToggleButton','exportChatSettingsJson','openAdminSettings'])
   assert.ok(html.includes(`id="${id}"`),id);
 assert.ok(html.indexOf('id="messagesToggleButton"')<html.indexOf('id="settingsButton"'));
 assert.ok(html.includes('id="realmGalleryButton"')); // Accessible, collapsible mobile navigation
 assert.match(css,/#chatModeButton\.bottom-chat-mode/);
 assert.match(studio,/solvi-window-/);
 assert.match(studio,/window\.solviSaveWindow/);
 assert.match(editor,/scene-item-delete/);
 assert.match(editor,/refreshRobotActions\(obj\)/);
});
test('model-specific glTF animation clips appear in robot actions',()=>{
 const robot=read('js/robots.js'),anim=read('js/animations.js');
 assert.match(robot,/robotAvailableActions=group.userData.robotAnimator.clipNames/);
 assert.match(anim,/this.actions.set\('clip:'\+clip.name/);
 assert.match(robot,/solvi:robot-model-ready/);
});
