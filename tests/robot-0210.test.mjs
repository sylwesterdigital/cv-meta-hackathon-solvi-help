import test from 'node:test';
import assert from 'node:assert/strict';
import {intent,stepRobotMotion,packetFor} from '../js/robot-net.js';
import {nextDuplicateName} from '../js/edit-history.js';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
function stepFrames(state,input,frames=60,dt=1/60){
 let result=state;for(let i=0;i<frames;i++)result=stepRobotMotion(result,input,dt);
 return result;
}
test('Left and right do not move or spin a robot at rest',()=>{
 const origin={x:0,z:0,yaw:0,velocity:0};
 for(const key of ['ArrowLeft','ArrowRight']){
  const result=stepFrames(origin,{...intent(new Set([key])),s:1});
  assert.deepEqual({x:result.x,z:result.z,yaw:result.yaw,velocity:result.velocity},origin);
 }
});
test('Up drives heading-forward; steering curves while moving, without strafing',()=>{
 const forward={...intent(new Set(['ArrowUp'])),s:1};
 const a=stepFrames({x:0,z:0,yaw:0,velocity:0},forward,60);
 assert.ok(a.z>.1 && Math.abs(a.x)<1e-9 && a.yaw===0);
 const left=stepFrames(a,{...intent(new Set(['ArrowUp','ArrowLeft'])),s:1},30);
 const right=stepFrames(a,{...intent(new Set(['ArrowUp','ArrowRight'])),s:1},30);
 assert.ok(left.yaw<0 && left.x<0);
 assert.ok(right.yaw>0 && right.x>0);
});
test('Down first brakes, then reverses without 180-degree snap',()=>{
 const start={x:0,z:0,yaw:.8,velocity:1.2};
 const back={...intent(new Set(['ArrowDown'])),s:1};
 const first=stepRobotMotion(start,back,1/60);
 assert.ok(first.velocity>0 && first.velocity<start.velocity);
 const result=stepFrames(first,back,70);
 assert.ok(result.velocity<-.1);assert.equal(result.yaw,start.yaw);
});
test('Steering responsiveness changes smoothly with speed',()=>{
 const input={...intent(new Set(['ArrowUp','ArrowRight'])),s:1};
 const slow=stepRobotMotion({x:0,z:0,yaw:0,velocity:.2},input,1/60);
 const fast=stepRobotMotion({x:0,z:0,yaw:0,velocity:1.1},input,1/60);
 assert.ok(fast.yaw>slow.yaw && slow.yaw>0);
});
test('Releasing throttle coasts briefly then stops; no standing rotation',()=>{
 const coast={f:0,t:-1,r:0,b:0,s:1};
 const state=stepFrames({x:0,z:0,yaw:0,velocity:1.2},coast,45);
 assert.ok(Math.abs(state.velocity)<.001);
 const last=stepFrames(state,coast,45);
 assert.equal(last.yaw,state.yaw);
});
test('Compact packet supports signed reverse without geometry payload',()=>{
 const packet=packetFor('robot123',{...intent(new Set(['ArrowDown','ArrowLeft'])),s:1},{position:{x:0,y:0,z:0},rotation:{y:0}});
 assert.equal(packet.f,-1);assert.equal(packet.b,1);assert.equal(packet.t,-1);
 assert.ok(JSON.stringify(packet).length<155);
});
test('Clones use sequential suffixes, never copy copy copy',()=>{
 assert.equal(nextDuplicateName('New cube',['New cube']),'New cube copy1');
 assert.equal(nextDuplicateName('New cube copy1',['New cube','New cube copy1']),'New cube copy2');
 assert.equal(nextDuplicateName('New cube copy copy2',['New cube copy3','New cube copy1']),'New cube copy4');
 assert.equal(nextDuplicateName('Robot',['Robot copy','Robot copy1']),'Robot copy2');
});
test('Numeric + and - camera framing; robot arrows exclude camera while selected',()=>{
 const world=read('js/world.js'),editor=read('js/editor.js');
 assert.match(world,/zoomOnSelectedObject\(direction\)/);
 assert.match(world,/this\.controls\.target\.copy\(center\)/);
 assert.match(editor,/e\.code==='NumpadAdd'/);
 assert.match(editor,/e\.code==='NumpadSubtract'/);
 assert.match(world,/robot&&this\.robotEditor\.canEdit\(robot\)&&e\.code\.startsWith\('Arrow'\)/);
});
