import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {throwHitRegion,finiteImpactPoint} from '../js/throw-impact.js';

const source=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');

test('actual contact height classifies head and body on a target model',()=>{
 const bounds={min:{y:1},max:{y:3}};
 assert.equal(throwHitRegion(bounds,{y:2.82}),'head');
 assert.equal(throwHitRegion(bounds,{y:2.1}),'body');
 assert.equal(throwHitRegion(bounds,{y:Infinity}),'body');
 assert.equal(finiteImpactPoint({x:0,y:1.5,z:2}),true);
 assert.equal(finiteImpactPoint({x:NaN,y:1.5,z:2}),false);
});

test('per-object hand follow is saved and checked in full and atomic server scene APIs',()=>{
 const editor=source('js/editor.js'),html=source('index.html'),backend=source('backend/server.py'),archive=source('backend/realm_archives.py');
 assert.match(html,/id="objectFollowHandRotation"/);
 assert.match(editor,/followHandRotation:canBePickable\(/);
 assert.match(editor,/entry\.followHandRotation!==false/g);
 assert.match(editor,/objectFollowHandRotation.*addEventListener\('change'/);
 assert.match(backend,/if 'followHandRotation' in o and/);
 assert.match(backend,/if 'followHandRotation' in obj and/);
 assert.match(backend,/'pickable','followHandRotation','transformLocked'/);
 assert.match(archive,/'pickable','followHandRotation'/);
});

test('carry updates from animated hand quaternion and opt-out restores original object orientation',()=>{
 class Q{
  constructor(x=0,y=0,z=0,w=1){Object.assign(this,{x,y,z,w});}
  clone(){return new Q(this.x,this.y,this.z,this.w);}
  copy(q){Object.assign(this,{x:q.x,y:q.y,z:q.z,w:q.w});return this;}
  lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w;}
  normalize(){const m=Math.sqrt(this.lengthSq());this.x/=m;this.y/=m;this.z/=m;this.w/=m;return this;}
  invert(){this.x=-this.x;this.y=-this.y;this.z=-this.z;return this;}
  multiply(q){const a=this;const x=a.x,y=a.y,z=a.z,w=a.w;
   this.x=w*q.x+x*q.w+y*q.z-z*q.y;this.y=w*q.y-x*q.z+y*q.w+z*q.x;
   this.z=w*q.z+x*q.y-y*q.x+z*q.w;this.w=w*q.w-x*q.x-y*q.y-z*q.z;return this;}
  setFromAxisAngle(axis,angle){const half=angle/2;this.x=axis.x*Math.sin(half);this.y=axis.y*Math.sin(half);this.z=axis.z*Math.sin(half);this.w=Math.cos(half);return this;}
 }
 class V{
  constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
  clone(){return new V(this.x,this.y,this.z);}copy(v){Object.assign(this,{x:v.x,y:v.y,z:v.z});return this;}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
  sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
  divide(v){this.x/=v.x;this.y/=v.y;this.z/=v.z;return this;}
  applyQuaternion(q){const p=new Q(this.x,this.y,this.z,0),v=q.clone().multiply(p).multiply(q.clone().invert());
   this.x=v.x;this.y=v.y;this.z=v.z;return this;}
 }
 class Box{setFromObject(obj){this.obj=obj;return this;}getCenter(v){return v.copy(this.obj.position);}}
 const THREE={Quaternion:Q,Vector3:V,Box3:Box};
 const code=source('js/object-carry.js').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
 const {ObjectCarry}=new Function('THREE',`${code}\nreturn {ObjectCarry};`)(THREE);
 const bone={isBone:true,name:'RightHandMiddleMetacarpal',orientation:new Q(),getWorldQuaternion(q){return q.copy(this.orientation);},getWorldPosition(v){return v.copy(new V(.3,1.2,.2));}};
 const robot={position:new V(),rotation:{y:0},children:[{userData:{robotVisual:true},traverse(fn){fn(bone);}}],updateWorldMatrix(){},getWorldQuaternion(q){return q;},userData:{editorId:'robot-1111'}};
 const parent={getWorldQuaternion(q){return q;},getWorldScale(v){return v.copy(new V(1,1,1));}};
 const obj={position:new V(0,0,1),quaternion:new Q(),parent,userData:{editorId:'object-2222',followHandRotation:true},
  worldToLocal(v){return v.sub(this.position);},localToWorld(v){return v.applyQuaternion(this.quaternion).add(this.position);},
  getWorldQuaternion(q){return q.copy(this.quaternion);},getWorldPosition(v){return v.copy(this.position);},updateWorldMatrix(){}};
 const editor={physics:{remove(){}},items:[robot,obj]};
 const carry=new ObjectCarry(editor);const state={};carry.attach(robot,obj,state);
 bone.orientation.setFromAxisAngle(new V(0,1,0),Math.PI/2);carry.updateGrip(robot,obj,state);
 assert.ok(Math.abs(obj.quaternion.y-Math.SQRT1_2)<1e-4,'follow mode turns with the palm');
 obj.userData.followHandRotation=false;carry.updateGrip(robot,obj,state);
 assert.ok(Math.abs(obj.quaternion.y)<1e-4,'opt out retains original world rotation');
});

test('Rapier collision start triggers one impact at its actual contact and correct hit clip',()=>{
 class V{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}}
 class Box{setFromObject(){this.min={x:-1,y:0,z:-1};this.max={x:1,y:2,z:1};return this;}}
 const code=source('js/scene-physics.js').replace(/^import .*;\s*$/gm,'').replace('export class ScenePhysics','class ScenePhysics');
 const Physics=new Function('THREE','throwHitRegion','triggerSceneModelHit','tickSceneModelHit',`${code}\nreturn ScenePhysics;`)({Vector3:V,Box3:Box},throwHitRegion,()=>true,()=>{});
 const messages=[],effects=[];globalThis.window={solviRoomSocket:{send(packet){messages.push(packet);}}};
 const sourceObject={userData:{editorId:'source-111111',editorKind:'cube',impactProbeUntil:performance.now()+1000,temporaryCarryTest:false}};
 const target={userData:{editorId:'victim-222222',editorKind:'robot',robotAnimator:{actions:new Map([['hitHead',{}]]),clipDuration:()=>.6}},position:new V()};
 const physics=new Physics({items:[sourceObject,target],world:{},canEdit:()=>true});
 physics.owns=()=>true;physics.enabled=true;
 physics.impactEffects={emit(p){effects.push(p);}};
 physics.bodies=new Map([['source-111111',{handle:1}],['victim-222222',{handle:2}]]);
 physics.beforeStepImpactSpeed=new Map([['source-111111',5.5]]);
 const first={parent:()=>({handle:1})},second={parent:()=>({handle:2})};
 physics.world={getCollider(h){return h===11?first:h===22?second:null;},contactPair(a,b,fn){fn({numSolverContacts:()=>1,solverContactPoint:()=>({x:0,y:1.82,z:0})});}};
 physics.eventQueue={drainCollisionEvents(callback){callback(11,22,true);callback(11,22,true);callback(11,22,false);}};
 physics.handleProjectileCollisions();
 assert.equal(effects.length,1);assert.equal(effects[0].y,1.82);
 assert.equal(target.userData.robotReaction.clip,'hitHead');
 assert.equal(messages.length,1);assert.equal(messages[0].type,'throw-hit');
 assert.equal(messages[0].head,true);
});

test('impact spark is a disposable temporary effect with future emitter hooks',()=>{
 const src=source('js/impact-effects.js');
 assert.match(src,/register\(name,emitter\)/);
 assert.match(src,/LineSegments/);
 assert.match(src,/this\.dispose\(effect\)/);
 assert.match(src,/this\.active\.length>24/);
 assert.doesNotMatch(src,/queueSave|solviRoomSocket|scene-changed/);
});

test('multiplayer relays only recent authorised throw hits and checks quaternion at release',()=>{
 const backend=source('backend/server.py'),client=source('js/live.js'),carry=source('js/object-carry.js');
 assert.match(backend,/active_throws=\{\}/);
 assert.match(backend,/time\.monotonic\(\)-recent\[0\]>12/);
 assert.match(backend,/target in recent\[1\]/);
 assert.match(backend,/may_edit\(uid,projectile,room_policy\(room_id\),ws_admin_enabled\(\)\)/);
 assert.match(backend,/if q is not None:/);
 assert.match(client,/m\.type==='throw-hit'/);
 assert.match(carry,/q:\[obj\.quaternion\.x,obj\.quaternion\.y,obj\.quaternion\.z,obj\.quaternion\.w\]/);
});

test('imported GLTF and FBX model clips can play authored reaction and stop',()=>{
 const sourceCode=source('js/scene-models.js');
 assert.match(sourceCode,/g\.scene\.animations=g\.animations\|\|\[\]/);
 assert.match(sourceCode,/group\.userData\.sceneHitAnimator=clips\.length\?new THREE\.AnimationMixer\(model\):null/);
 assert.match(sourceCode,/clipBase\(c\.name\)===name/);
 assert.match(sourceCode,/action\.reset\(\)\.setLoop\(THREE\.LoopOnce,1\)/);
 assert.match(sourceCode,/group\.userData\.sceneHitAction\.stop\(\)/);
});
