import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {followAnchor,cameraFromLocalOffset} from '../js/camera-follow.js';

// Execute the production ladder-top method, rather than testing a copied
// approximation. A real Rapier 0.21 castRay hit has .timeOfImpact, not .toi.
function landingHarness(hitSequence,kind='ladder'){
 const source=readFileSync(new URL('../js/scene-physics.js',import.meta.url),'utf8');
 const start=source.indexOf(' landAtLadderTop(ladder,robot){');
 const end=source.indexOf('\n driveRobot(object,dt){',start);
 assert.ok(start>0&&end>start,'the production landing method must exist');
 const method=source.slice(start,end);
 class Vector3{
  constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
  addScaledVector(v,n){this.x+=v.x*n;this.y+=v.y*n;this.z+=v.z*n;return this;}
  lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z;}
 }
 const THREE={Vector3};
 const runtime={Ray:class{constructor(origin,dir){this.origin=origin;this.dir=dir;}}};
 const hits=[...hitSequence];
 const context={runtime,world:{castRay(ray){context.rays.push(ray);return hits.shift()??null;}},colliders:new Map(),rays:[]};
 const landing=new Function('THREE',`return class {${method}};`)(THREE);
 const physics=new landing();Object.assign(physics,context);
 const coords={x:0,y:kind==='surface'?1.95:1.95,z:.3};
 const robot={userData:{editorId:'robo1',robotMode:'climbLadder',robotLadderRide:kind==='surface'
  ?{kind:'surface',x:0,z:0,topY:2,normal:{x:0,z:1}}
  :{x:0,side:1}},position:{...coords,set(x,y,z){this.x=x;this.y=y;this.z=z;}}};
 const ladder={userData:{ladder:{height:2}},updateMatrixWorld(){},localToWorld(p){return p;}};
 return {physics,robot,ladder,coords};
}

test('Rapier 0.21 timeOfImpact lands a ladder avatar without poisoning the chase camera',()=>{
 const {physics,ladder,robot}=landingHarness([{timeOfImpact:.55}]);
 assert.equal(physics.landAtLadderTop(ladder,robot),true);
 assert.ok(Math.abs(robot.position.y-2.035)<1e-8);
 assert.equal(robot.userData.robotMode,'idle');
 const anchor=followAnchor(robot),camera=cameraFromLocalOffset(anchor,{x:0,y:1.2,z:-5},Math.PI);
 assert.ok(Object.values(camera).every(Number.isFinite),'a valid dismount must yield a finite camera pose');
});

test('Rapier 0.21 timeOfImpact lands a Climbable wall/tree avatar',()=>{
 const {physics,ladder,robot}=landingHarness([{timeOfImpact:.6}],'surface');
 assert.equal(physics.landAtLadderTop(ladder,robot),true);
 assert.ok(Math.abs(robot.position.y-2.035)<1e-8);
 assert.equal(robot.userData.robotMode,'idle');
});

test('obsolete .toi field or missing ray distance never changes the avatar location',()=>{
 for(const kind of ['ladder','surface']){
  for(const invalid of [{toi:.55},{timeOfImpact:NaN},{timeOfImpact:Infinity},{timeOfImpact:-1},{timeOfImpact:999}]){
   const {physics,ladder,robot,coords}=landingHarness(Array(3).fill(invalid),kind);
   assert.equal(physics.landAtLadderTop(ladder,robot),false,`${kind}: should reject ${JSON.stringify(invalid)}`);
   assert.deepEqual([robot.position.x,robot.position.y,robot.position.z],[coords.x,coords.y,coords.z]);
  }
 }
});

test('the production frame safeguard recovers a non-finite camera and disables follow',()=>{
 const src=readFileSync(new URL('../js/world.js',import.meta.url),'utf8');
 const start=src.indexOf('  repairCameraPose(){'),end=src.indexOf('  frame(){',start);
 assert.ok(start>0&&end>start);
 const CameraRecovery=new Function(`return class {${src.slice(start,end)}};`)();
 const recovery=new CameraRecovery();
 const vector=(x,y,z)=>({x,y,z,clone(){return vector(this.x,this.y,this.z);},copy(other){Object.assign(this,{x:other.x,y:other.y,z:other.z});return this;},set(x,y,z){Object.assign(this,{x,y,z});return this;}});
 const quat=(x,y,z,w)=>({x,y,z,w,clone(){return quat(this.x,this.y,this.z,this.w);},copy(other){Object.assign(this,{x:other.x,y:other.y,z:other.z,w:other.w});return this;},identity(){return this.copy(quat(0,0,0,1));}});
 let updateCount=0,zeroed=false;
 recovery.camera={position:vector(5,3,7),quaternion:quat(0,0,0,1)};
 recovery.controls={target:vector(0,1,0),update(){updateCount++;}};
 recovery.cameraVelocity={set(x,y,z){zeroed=x===0&&y===0&&z===0;}};
 recovery.cameraFollowMode='chase';recovery.followRobotId='robot';recovery.followOrbitOffset={x:1,y:0,z:1};
 assert.equal(recovery.repairCameraPose(),false);
 recovery.camera.position.x=Number.NaN;recovery.camera.quaternion.w=Number.NaN;
 recovery.controls.target.z=Infinity;
 const originalError=console.error;console.error=()=>{};
 try{assert.equal(recovery.repairCameraPose(),true);}finally{console.error=originalError;}
 assert.deepEqual([recovery.camera.position.x,recovery.camera.position.y,recovery.camera.position.z],[5,3,7]);
 assert.equal(recovery.camera.quaternion.w,1);
 assert.equal(recovery.controls.target.z,0);
 assert.equal(recovery.cameraFollowMode,'free');assert.ok(zeroed);assert.equal(updateCount,1);
 assert.match(src,/this\.repairCameraPose\(\);this\.updateVoiceRings\(dt\)/);
});
