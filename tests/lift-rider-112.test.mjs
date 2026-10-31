import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canCarryLiftRider,inLiftFootprint} from '../js/lift-rider.js';
import {moveTransportRider} from '../js/transport-rider.js';
import {liftHeightAt,motionSnapshot} from '../js/lift-sync.js';
const source=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const footprint={width:3,depth:3.75};
test('Cabin passengers remain attached on both upward and remotely initiated downward runs',()=>{
 const start=1793450000000,levelHeight=3,levels=5;
 const up=motionSnapshot(0,4,2,start);
 let cabin=liftHeightAt(up,levelHeight,levels,start+6000);
 assert.equal(cabin,12);
 const robot={position:{x:.2,y:cabin+.14,z:.4},userData:{editorKind:'robot'}};
 const body={p:{x:.2,y:cabin+.14,z:.4},translation(){return this.p;},setTranslation(p){this.p=p;},setNextKinematicTranslation(p){this.p=p;}};
 const down=motionSnapshot(12,0,2,start+12000);
 for(let i=1;i<=12;i++){
  const next=liftHeightAt(down,levelHeight,levels,start+12000+i*500);
  const before={x:robot.position.x,y:robot.position.y-cabin,z:robot.position.z};
  assert.equal(canCarryLiftRider(before,footprint,{attached:true,offset:.14}),true,'support at each step '+i);
  const delta=next-cabin,n=Math.ceil(Math.abs(delta)/.2);
  for(let j=0;j<n;j++)assert.equal(moveTransportRider(robot,body,{x:0,y:delta/n,z:0}),true);
  cabin=next;
  assert.ok(Math.abs(robot.position.y-cabin-.14)<1e-8,'robot rides without falling '+i);
  assert.equal(body.p.y,robot.position.y);
 }
 assert.equal(cabin,0);
});
test('Walking through an open lift doorway and actively jumping release support',()=>{
 assert.equal(inLiftFootprint({x:0,z:0},footprint),true);
 assert.equal(canCarryLiftRider({x:2,z:0,y:.14},footprint,{attached:true,offset:.14}),false);
 assert.equal(canCarryLiftRider({x:0,z:0,y:.14},footprint,{attached:true,jumping:true,offset:.14}),false);
 assert.equal(canCarryLiftRider({x:0,z:0,y:1.7},footprint,{attached:true,offset:.14}),false);
 assert.equal(canCarryLiftRider({x:0,z:0,y:.14},footprint,{attached:false}),true);
 assert.equal(canCarryLiftRider({x:0,z:0,y:1.7},footprint,{attached:false}),false);
});
test('Lift transport runs before character physics and never skips passenger solely because airborne',()=>{
 const editor=source('js/editor.js'),transport=source('js/stair-transport.js'),physics=source('js/scene-physics.js');
 const order=editor.indexOf('tickStairTransport(this,dt);'),phys=editor.indexOf('this.physics.tick(dt);');
 assert.ok(order>0&&phys>order,'lift rides ahead of gravity');
 assert.match(transport,/const before=device.matrixWorld.clone\(\).invert\(\)/);
 assert.match(transport,/canCarryLiftRider\(oldLocal,dim/);
 assert.match(transport,/if\(variant!=='lift'&&item.userData.editorKind==='robot'&&item.userData.physicsAirborne\)continue/);
 assert.match(physics,/const support=supportedLiftRobot\(object,this.editor\)/);
 assert.match(physics,/if\(support\)\{/);
 assert.match(physics,/state.verticalSpeed=0;state.grounded=true/);
 assert.match(physics,/body.setTranslation\(next,true\);body.setNextKinematicTranslation\(next\)/);
});
test('Remote lift packet cannot teleport empty cabin away from its passenger',()=>{
 const editor=source('js/editor.js');
 const method=editor.split('  applyRemoteLiftMotion(packet){')[1].split('\n  events(){')[0];
 assert.ok(!method.includes('device.position.y=runtime.baseY+runtime.height'));
 assert.match(method,/next transport tick/);
 assert.match(editor,/\|\|bot.userData.liftRide\)continue/);
 assert.match(editor,/if\(!robot.userData.liftRide\)robot.userData.liftRemoteTargetY=y/);
});
