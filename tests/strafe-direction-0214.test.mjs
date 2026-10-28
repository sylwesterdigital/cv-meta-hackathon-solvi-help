import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {intent,stepRobotMotion,packetFor} from '../js/robot-net.js';
const initial=(yaw=0)=>({x:0,z:0,yaw,velocity:0,steer:0,lateral:0});
const run=(keys,yaw=0)=>{const input={...intent(new Set(keys)),s:1};let s=initial(yaw);for(let i=0;i<100;i++)s=stepRobotMotion(s,input,1/60);return s;};
// Original avatar visual is rotated 180 degrees. At yaw=0 left is +X.
test('idle left goes to visible left; right to visible right; avatar faces forward',()=>{
 const l=run(['ArrowLeft']);const r=run(['ArrowRight']);
 assert.ok(l.x>.9&&r.x<-.9,{l,r});
 assert.equal(l.yaw,0);assert.equal(r.yaw,0);
 assert.equal(l.z,0);assert.equal(r.z,0);
 assert.ok(l.lateral>0&&r.lateral<0);
});
test('with a rotated avatar, lateral movement matches its visual local left/right',()=>{
 const yaw=Math.PI/3,l=run(['ArrowLeft'],yaw),r=run(['ArrowRight'],yaw);
 const leftAxis={x:Math.cos(yaw),z:-Math.sin(yaw)};
 assert.ok(l.x*leftAxis.x+l.z*leftAxis.z>0.9,{l});
 assert.ok(r.x*leftAxis.x+r.z*leftAxis.z<-.9,{r});
 assert.equal(l.yaw,yaw);assert.equal(r.yaw,yaw);
});
test('forward steering remains correctly signed, with compact unchanged packets',()=>{
 const left=run(['ArrowUp','ArrowLeft']);const right=run(['ArrowUp','ArrowRight']);
 assert.ok(left.yaw>0&&right.yaw<0,{left,right});
 const shape={position:{x:0,y:0,z:0},rotation:{y:0}};
 assert.equal(packetFor('a',intent(new Set(['ArrowLeft'])),shape).t,1);
 assert.equal(packetFor('a',intent(new Set(['ArrowRight'])),shape).t,-1);
});
test('both local and remote robot animations name the visually correct strafe',()=>{
 const editor=readFileSync(new URL('../js/editor.js',import.meta.url),'utf8');
 assert.match(editor,/motion\.lateral>0\?'strafeLeft':'strafeRight'/);
 assert.match(editor,/next\.lateral>0\?'strafeLeft':'strafeRight'/);
});
