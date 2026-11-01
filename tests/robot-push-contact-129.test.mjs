import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {facingPushContact,sizeableFrontalPushContact,approachingRobotContact,PUSH_MAX_FACING_ANGLE,PUSH_MIN_HEIGHT_FRACTION} from '../js/robot-contact.js';
import {robotPushVector,pushedWalkState} from '../js/robot-push.js';

const bounds=(xmin,ymin,zmin,xmax,ymax,zmax)=>({min:{x:xmin,y:ymin,z:zmin},max:{x:xmax,y:ymax,z:zmax}});
const actor={x:0,y:0,z:0};
const frontBox=bounds(-.5,0,.32,.5,1.8,.85);
const motion={x:0,z:.035};

// Execute the real ScenePhysics method without importing browser-only Three.js.
// Checks its dynamic-body restrictions and the actual animation state it writes.
const source=readFileSync(new URL('../js/scene-physics.js',import.meta.url),'utf8');
const first=source.indexOf(' noteDynamicPush(actor,delta,distance){');
const last=source.indexOf('\n // The character controller can report',first);
assert.ok(first>0&&last>first);
const method=new Function('THREE','sizeableFrontalPushContact',`return function noteDynamicPush(actor,delta,distance){${source.slice(first+' noteDynamicPush(actor,delta,distance){'.length,last).replace(/\n }\s*$/,'')}\n}`)(
 {Box3:class{setFromObject(target){return target.bounds;}}},sizeableFrontalPushContact);
function physicalScenario({box=frontBox,yaw=0,mode='dynamic',dynamic=true,owns=true,dir=motion,avatarScale=1,contact=true,contactOther=false}={}){
 const target={userData:{editorKind:'cube',editorId:'box-1',physics:{mode}},bounds:box};
 const robot={position:{...actor},rotation:{y:yaw},scale:{y:avatarScale},userData:{editorKind:'robot'}};
 const collider={handle:123};
 const physics={enabled:true,editor:{items:[robot,target]},bodies:new Map([['box-1',{isDynamic:()=>dynamic}]]),colliders:new Map([['box-1',collider]]),characterController:{
  numComputedCollisions:()=>contact?1:0,
  computedCollision:()=>({collider:{handle:contactOther?999:123}})
 },owns:()=>owns};
 const found=method.call(physics,robot,dir,Math.hypot(dir.x,dir.z));
 return {found,action:robot.userData.robotContactAction,robot};
}

test('small bricks and exactly half-height objects do not start Pushing for any avatar',()=>{
 assert.equal(PUSH_MIN_HEIGHT_FRACTION,.5);
 for(const h of [.05,.25,.60,.875]){
  const small=bounds(-.25,0,.31,.25,h,.85);
  assert.equal(sizeableFrontalPushContact(actor,small,0,motion,{robotHeight:1.75}),false,`height ${h}`);
  assert.equal(physicalScenario({box:small}).found,false);
 }
 assert.equal(physicalScenario({box:bounds(-.25,0,.31,.25,.9,.85)}).found,true);
});

test('Push requires frontal facing within 35 degrees, never a sideways 35–125 degree contact',()=>{
 assert.equal(PUSH_MAX_FACING_ANGLE,35);
 for(const deg of [0,25,34])assert.equal(physicalScenario({yaw:deg*Math.PI/180}).found,true,`angle ${deg}`);
 for(const deg of [40,65,90,125,160,180,-90])assert.equal(physicalScenario({yaw:deg*Math.PI/180}).found,false,`angle ${deg}`);
});

test('sideways/backward movement cannot trigger Push while avatar faces the furniture',()=>{
 for(const dir of [{x:1,z:0},{x:-1,z:0},{x:0,z:-.04},{x:0,z:0}]){
  assert.equal(physicalScenario({dir}).found,false,JSON.stringify(dir));
 }
 assert.equal(physicalScenario({dir:{x:.01,z:.04}}).found,true);
});

test('nearest object surface, not centre or pivot, determines frontal real contact',()=>{
 assert.equal(sizeableFrontalPushContact(actor,bounds(-20,0,.32,40,1.8,80),0,motion),true,'large furniture pivot may be far away');
 assert.equal(sizeableFrontalPushContact(actor,bounds(-20,0,2,40,1.8,80),0,motion),false,'large furniture too far away');
 assert.equal(sizeableFrontalPushContact(actor,bounds(-20,0,-80,40,1.8,-.32),0,motion),false,'obstacle behind actor');
 assert.equal(sizeableFrontalPushContact(actor,bounds(-20,2.1,.32,40,4,.8),0,motion),false,'overhead obstacle is not torso contact');
 assert.equal(sizeableFrontalPushContact(actor,bounds(-.5,-4,.32,.5,-.1,.8),0,motion),false,'object below floor');
});

test('only owned, actually dynamic physics targets can start an automatic Pushing animation',()=>{
 assert.equal(physicalScenario({mode:'static'}).found,false);
 assert.equal(physicalScenario({mode:'kinematic'}).found,false);
 assert.equal(physicalScenario({dynamic:false}).found,false);
 assert.equal(physicalScenario({owns:false}).found,false);
 const {found,action}=physicalScenario();
 assert.equal(found,true);
 assert.equal(action.kind,'push');
 assert.ok(action.until>0);
 assert.equal(action.source,'auto-object');
});

test('only a matching Rapier collision, not AABB proximity or a different collider, starts Pushing',()=>{
 assert.equal(physicalScenario({contact:false}).found,false);
 assert.equal(physicalScenario({contactOther:true}).found,false);
 assert.equal(physicalScenario({contact:true}).found,true);
});

test('turning sideways cancels a stale automatic object Push immediately',()=>{
 const {robot}=physicalScenario();
 assert.equal(robot.userData.robotContactAction.kind,'push');
 const target={userData:{editorKind:'cube',editorId:'box-1',physics:{mode:'dynamic'}},bounds:frontBox};
 const physics={enabled:true,editor:{items:[robot,target]},bodies:new Map([['box-1',{isDynamic:()=>true}]]),colliders:new Map([['box-1',{handle:123}]]),
  characterController:{numComputedCollisions:()=>1,computedCollision:()=>({collider:{handle:123}})},owns:()=>true};
 robot.rotation.y=Math.PI/2;
 assert.equal(method.call(physics,robot,motion,.035),false);
 assert.equal(robot.userData.robotContactAction,null);
});

test('scaled avatars use half of their own visual height as the push threshold',()=>{
 const obstacle=bounds(-.5,0,.32,.5,1.1,.8);
 assert.equal(physicalScenario({box:obstacle,avatarScale:1}).found,true);
 assert.equal(physicalScenario({box:obstacle,avatarScale:1.5}).found,false);
});

test('automatic avatar-on-avatar pushing also requires the actor to face and move toward the other robot',()=>{
 assert.equal(facingPushContact(actor,{x:0,z:.55},0,{x:0,z:.04}),true);
 assert.equal(facingPushContact(actor,{x:0,z:.55},Math.PI/2,{x:0,z:.04}),false);
 assert.equal(facingPushContact(actor,{x:0,z:.55},0,{x:.04,z:0}),false);
 assert.equal(facingPushContact(actor,{x:0,z:-.55},0,{x:0,z:-.04}),false);
 assert.match(source,/tryPushRobot\(actor,target,actorNext,dt,maxStep=\.14\)/);
 assert.match(source,/if\(!facingPushContact\(actor\.position,target\.position,actor\.rotation\.y/);
 assert.match(source,/if\(packet\.kind==='push'&&!facingPushContact\(/);
});


test('real automatic robot-on-robot action never starts when actor is sideways',()=>{
 const begin=source.indexOf(' tryPushRobot(actor,target,actorNext,dt,maxStep=.14){');
 const end=source.indexOf('\n // A short contact action',begin);
 assert.ok(begin>0&&end>begin);
 const methodBody=source.slice(begin+' tryPushRobot(actor,target,actorNext,dt,maxStep=.14){'.length,end).replace(/\n }\s*$/,'');
 const robotPush=new Function('approachingRobotContact','facingPushContact','robotPushVector','pushedWalkState','window',
  `return function tryPushRobot(actor,target,actorNext,dt,maxStep=.14){${methodBody}\n}`)(
   approachingRobotContact,facingPushContact,robotPushVector,pushedWalkState,{solviRoomSocket:{send(){}}});
 const actor={position:{x:0,y:0,z:0},rotation:{y:Math.PI/2},userData:{editorKind:'robot',editorId:'actor-1'}};
 const target={position:{x:0,y:0,z:.6},rotation:{y:0},userData:{editorKind:'robot',editorId:'target-1'}};
 let moved=0;
 const physics={enabled:true,world:{},owns:()=>true,bodies:new Map([['target-1',{setNextKinematicTranslation(){}}]]),colliders:new Map([['target-1',{}]]),
  characterController:{computeColliderMovement(){moved++;},computedMovement(){return {x:0,z:.05};}},
  editor:{robotActionSeq:0,world:{environment:{floorSize:100}},queueSave(){}}};
 assert.equal(robotPush.call(physics,actor,target,{x:0,z:.03},.02),false);
 assert.equal(moved,0,'a side-on robot must not even try to push the other capsule');
 assert.equal(actor.userData.robotContactAction,undefined);
 actor.rotation.y=0;
 assert.equal(robotPush.call(physics,actor,target,{x:0,z:.03},.02),true);
 assert.equal(moved,1);
 assert.equal(actor.userData.robotContactAction.kind,'push');
});
