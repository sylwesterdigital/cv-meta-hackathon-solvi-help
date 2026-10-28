import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {physicsOptions,physicsTypes} from '../js/physics-options.js';
import {intent,stepRobotMotion,packetFor} from '../js/robot-net.js';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
test('physics properties sanitize mode, friction, bounce',()=>{
 assert.deepEqual(physicsOptions({mode:'dynamic',friction:1.8,restitution:.8}),{mode:'dynamic',friction:1.8,restitution:.8});
 assert.deepEqual(physicsOptions({mode:'bad',friction:999,restitution:-1}),{mode:'off',friction:2,restitution:0});
 assert.deepEqual(physicsTypes,['off','dynamic','static','kinematic']);
});
test('visible 3D model import and full-screen drop handling',()=>{
 const html=read('index.html'),editor=read('js/editor.js');
 for(const id of ['quickModelImport','importModelButton','sceneDropOverlay','sceneModelMaxSize'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(editor,/document\.addEventListener\('dragover'/);
 assert.match(editor,/document\.addEventListener\('drop'/);
 assert.match(editor,/this\.lastPointer=\{x:e\.clientX,y:e\.clientY\}/);
 assert.match(editor,/\.test\(f\.name\)/);
});
test('strafe speed can be adjusted independently of walking speed',()=>{
 const input={...intent(new Set(['ArrowLeft'])),s:1,q:3};
 let a={x:0,z:0,yaw:0,velocity:0,steer:0,lateral:0},b={...a};
 for(let i=0;i<50;i++){a=stepRobotMotion(a,{...input,q:.5},1/60);b=stepRobotMotion(b,input,1/60);}
 assert.ok(b.x>a.x*2,`${b.x} vs ${a.x}`);
 assert.equal(packetFor('robot001',input,{position:{x:0,y:0,z:0},rotation:{y:0}}).q,3);
});
test('world physics settings persisted and compact object properties',()=>{
 const server=read('backend/server.py'),studio=read('js/studio.js'),editor=read('js/editor.js');
 assert.match(server,/ALTER TABLE room_policies ADD COLUMN physics/);
 assert.match(server,/Invalid physics mode/);
 assert.match(studio,/worldPhysicsEnabled/);
 assert.match(editor,/physics:.*physicsOptions/);
 assert.match(read('scripts/prepare_vendor.mjs'),/stageRapierBundle/);
 assert.match(read('scripts/rapier-vendor.mjs'),/rapier3d-compat/);
});
