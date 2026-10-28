import test from 'node:test';
import assert from 'node:assert/strict';
import {intent,packetFor,stepRobotMotion} from '../js/robot-net.js';
import {readFileSync} from 'node:fs';

const start=()=>({x:0,z:0,yaw:0,velocity:0,steer:0});
const advance=(keys,count=90,state=start())=>{
  const i={...intent(new Set(keys)),s:1};
  for(let n=0;n<count;n++)state=stepRobotMotion(state,i,1/60);
  return {state,input:i};
};

test('key mapping is calibrated: left positive, right negative and packets preserve the sign',()=>{
  const left=intent(new Set(['ArrowUp','ArrowLeft']));
  const right=intent(new Set(['ArrowUp','ArrowRight']));
  assert.equal(left.t,1);
  assert.equal(right.t,-1);
  const shape={position:{x:1,y:0,z:2},rotation:{y:0}};
  assert.equal(packetFor('robot',left,shape).t,1);
  assert.equal(packetFor('robot',right,shape).t,-1);
});

test('forward steering follows the corrected key mapping with smooth yaw',()=>{
  const l=advance(['ArrowUp','ArrowLeft']).state;
  const r=advance(['ArrowUp','ArrowRight']).state;
  assert.ok(l.yaw>.2 && l.x>.1 && l.z>0,{l});
  assert.ok(r.yaw<-.2 && r.x<-.1 && r.z>0,{r});
  assert.ok(Math.abs(l.yaw+r.yaw)<1e-9);
});

test('backwards keeps facing and steers left/right without 180 rotation',()=>{
  const backward=advance(['ArrowDown'],90).state;
  assert.equal(backward.yaw,0);
  assert.ok(backward.z<0 && backward.velocity<0);
  const l=advance(['ArrowDown','ArrowLeft']).state;
  const r=advance(['ArrowDown','ArrowRight']).state;
  assert.ok(l.yaw>.2 && r.yaw<-.2);
  assert.ok(l.velocity<0 && r.velocity<0);
});

test('turning input does not rotate robot until it is moving',()=>{
  const l=advance(['ArrowLeft']).state;
  const r=advance(['ArrowRight']).state;
  assert.equal(l.yaw,0);assert.equal(r.yaw,0);
  assert.ok(l.x<-.1);assert.ok(r.x>.1);assert.equal(l.z,0);assert.equal(r.z,0);
});

test('editor keyboard and remote predicted motion consume same signed intent',()=>{
  const editor=readFileSync(new URL('../js/editor.js',import.meta.url),'utf8');
  assert.match(editor,/intent\(this\.robotKeys\)/);
  assert.match(editor,/stepRobotMotion\(/);
  assert.match(editor,/this\.remoteInput\.set\(packet\.id,\{f:packet\.f,t:packet\.t/);
});
