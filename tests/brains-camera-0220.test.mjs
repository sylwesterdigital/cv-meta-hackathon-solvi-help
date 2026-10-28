import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stepRobotMotion,packetFor} from '../js/robot-net.js';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('turning speed changes yaw independently of movement and strafe speed',()=>{
 let slow={x:0,z:0,yaw:0,velocity:1.2},fast={...slow};
 for(let i=0;i<60;i++){
  slow=stepRobotMotion(slow,{f:1,t:1,s:1,q:1.8,u:.25},1/60);
  fast=stepRobotMotion(fast,{f:1,t:1,s:1,q:1.8,u:3},1/60);
 }
 assert.ok(fast.yaw>slow.yaw*4,{slow:slow.yaw,fast:fast.yaw});
 const packet=packetFor('myrobot-0220',{f:1,t:1,r:0,s:1,q:1.8,u:2.5},{position:{x:0,y:0,z:0},rotation:{y:0}});
 assert.equal(packet.u,2.5);
});
test('camera modes include V shortcut, independent follow distances',()=>{
 const w=read('js/world.js'),ui=read('index.html');
 assert.match(w,/e.code==='KeyV'/);
 assert.match(w,/solvi-orbit-distance/);
 assert.match(w,/setOrbitDistance/);
 assert.match(ui,/id="robotTurnSpeed"/);
 assert.match(ui,/id="robotBrainsPanel"/);
 assert.match(ui,/id="diagnosticsPanel"/);
});
test('robot identities are replicated via room scene and checked by backend',()=>{
 const editor=read('js/editor.js'),server=read('backend/server.py');
 assert.match(editor,/turnSpeed:o.userData.editorKind/);
 assert.match(editor,/brain:o.userData.editorKind/);
 assert.match(server,/robot_memories/);
 assert.match(server,/speaker_override/);
 assert.match(server,/def robot_react/);
 assert.match(server,/def ai_vision/);
 assert.match(server,/def ai_usage/);
 assert.match(server,/def admin_authorized/);
});
