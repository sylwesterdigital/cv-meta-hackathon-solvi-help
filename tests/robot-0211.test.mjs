import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {intent,stepRobotMotion,packetFor} from '../js/robot-net.js';
import {MotionController} from '../js/animations.js';

const read=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const start=(velocity=0,yaw=0)=>({x:0,z:0,yaw,velocity});
function frames(state,keys,n=60){const input={...intent(new Set(keys)),s:1};for(let i=0;i<n;i++)state=stepRobotMotion(state,input,1/60);return state;}

test('Forward left faces/travels left, forward right faces/travels right',()=>{
  const left=frames(start(),['ArrowUp','ArrowLeft']);
  const right=frames(start(),['ArrowUp','ArrowRight']);
  assert.ok(left.yaw>.1&&left.x>.01&&left.z>.01,left);
  assert.ok(right.yaw<-.1&&right.x<-.01&&right.z>.01,right);
  assert.ok(Math.abs(left.yaw+right.yaw)<1e-10);
});

test('Down reverses position, never rotates avatar by 180 degrees',()=>{
  const s=start(0,.7),after=frames(s,['ArrowDown'],120);
  assert.ok(after.velocity<-.5&&after.z<-.1,after);
  assert.equal(after.yaw,s.yaw);
  const front={x:Math.sin(after.yaw),z:Math.cos(after.yaw)};
  const movement={x:after.x-s.x,z:after.z-s.z};
  assert.ok(front.x*movement.x+front.z*movement.z<0,'translation is behind facing direction');
});

test('Left always turns facing LEFT, right always RIGHT, including in reverse',()=>{
  const reverseState=start(-1.2);
  const backLeft=frames(reverseState,['ArrowDown','ArrowLeft'],45);
  const backRight=frames(reverseState,['ArrowDown','ArrowRight'],45);
  assert.ok(backLeft.yaw>.1&&backRight.yaw<-.1,{backLeft,backRight});
  assert.ok(backLeft.velocity<0&&backRight.velocity<0);
  assert.ok(Math.abs(backLeft.yaw+backRight.yaw)<1e-10);
});

test('At rest left/right do not pivot in place; reverse brakes progressively',()=>{
  for(const keys of [['ArrowLeft','ArrowRight'],['ArrowLeft']]){
    const r=frames(start(),keys,90);assert.equal(r.yaw,0);assert.equal(r.velocity,0);if(keys.length===2)assert.equal(r.x,0);else assert.ok(r.x<-.05);
  }
  const previous=start(1.4,1.1);
  const b=stepRobotMotion(previous,{f:-1,t:0,r:0,b:1,s:1},1/60);
  assert.ok(b.velocity>0&&b.velocity<previous.velocity);
  assert.equal(b.yaw,previous.yaw);
});

test('Input packets stay compact and contain only signed intent and corrections',()=>{
  const packet=packetFor('robot-id',{...intent(new Set(['ArrowDown','ArrowLeft'])),s:1},
    {position:{x:1,y:0,z:-2},rotation:{y:.2}});
  assert.deepEqual([packet.f,packet.t,packet.b],[-1,1,1]);
  assert.equal(packet.yaw,.2);
  assert.ok(!('geometry' in packet)&&!('animation' in packet));
});

class FakeAction {
  constructor(clip){this.clip=clip;this.time=0;this.scale=1;this.lastLoop=null;}
  reset(){this.time=0;return this;}
  setEffectiveWeight(){return this;}
  setEffectiveTimeScale(x){this.scale=x;return this;}
  play(){return this;}
  getClip(){return this.clip;}
  setLoop(mode){this.lastLoop=mode;return this;}
  crossFadeFrom(other,fade,warp){this.warp=warp;return this;}
  stop(){return this;}
}
class FakeMixer{constructor(){this.items=new Map();}clipAction(clip){if(!this.items.has(clip.name))this.items.set(clip.name,new FakeAction(clip));return this.items.get(clip.name);}update(){} }

test('Backward uses forward walk clip with negative playhead, then forward restores +1',()=>{
  const three={AnimationMixer:FakeMixer,LoopOnce:10,LoopRepeat:20};
  const robot=new MotionController(three,{},[
    {name:'Idle',duration:2},
    {name:'Walking',duration:1.6},
    {name:'Walk Backward',duration:1.2}
  ]);
  const walking=robot.actions.get('walk');
  const alternate=robot.actions.get('walkBackward');
  assert.notEqual(walking,alternate);
  robot.play('walk',0);assert.equal(walking.scale,1);
  robot.play('walkBackward');assert.equal(robot.current,walking,'reuse SAME forward-walk animation');
  assert.equal(walking.scale,-1,'negative timeScale runs keyframes in reverse');
  assert.ok(walking.time>1.5&&walking.time<1.6,'start near the end of the clip');
  robot.play('walk');assert.equal(walking.scale,1);assert.equal(walking.time,0);
});

test('Legacy visual correction does not alter robot root yaw or reverse heading',()=>{
  const source=read('js/robots.js'),editor=read('js/editor.js');
  assert.match(source,/avatarVisual\.rotation\.y=Math\.PI/);
  assert.match(source,/avatarVisual\.add\(model\)/);
  assert.match(editor,/this\.selected\.userData\.robotGoal=null/);
  assert.match(editor,/if\(packet\.m&&\(packet\.f\|\|packet\.t\)\)robot\.userData\.robotGoal=null/);
  assert.doesNotMatch(editor,/rotation\.y\s*(?:\+=|=)\s*Math\.PI/);
});
