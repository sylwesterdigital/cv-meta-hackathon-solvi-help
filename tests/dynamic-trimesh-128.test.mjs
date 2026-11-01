import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {physicsOptions} from '../js/physics-options.js';
const src=fs.readFileSync(new URL('../js/scene-physics.js',import.meta.url),'utf8');
const start=src.indexOf(' sync(object){');
const end=src.indexOf('\n }\n applyRemoteState(',start);
assert.ok(start>=0&&end>start,'ScenePhysics.sync must be present');
const sync=new Function('physicsOptions','stairGeometryKey','CHARACTER',`return function sync(object){${src.slice(start+' sync(object){'.length,end)}\n}`)(physicsOptions,()=>'',{halfHeight:.7,radius:.3,centerY:.9});
function makeTest(mode,collider='trimesh',{kind='cube',remote=false,throwOnCreate=false,throwOnShape=false,missingShape=false}={}){
 const created=[];
 const descriptor=(label)=>({label,setTranslation(){return this;},setRotation(){return this;},lockRotations(){return this;}});
 const colliderDesc=(label)=>({label,setFriction(){return this;},setRestitution(){return this;}});
 const R={RigidBodyDesc:{dynamic:()=>descriptor('dynamic'),fixed:()=>descriptor('static'),kinematicPositionBased:()=>descriptor('kinematic')},ColliderDesc:{capsule:()=>colliderDesc('capsule')}};
 const world={createRigidBody(d){created.push(['body',d.label]);return {wakeUp(){created.push(['awake'])}};},createCollider(d){created.push(['collider',d.label]);if(throwOnCreate&&d.label==='trimesh')throw Error('unsupported mesh topology');return d;}};
 const physics={enabled:true,world,runtime:R,bodies:new Map(),colliders:new Map(),settings:new Map(),remoteTargets:new Map(),characters:new Map(),owns:()=>!remote,remove(){},triangleMeshShape(){created.push(['triangles']);if(throwOnShape)throw Error('broken indices');return missingShape?null:colliderDesc('trimesh');},colliderShape(){created.push(['box geometry']);return colliderDesc('box');}};
 const object={userData:{editorId:'obj01',editorKind:kind,physics:{mode,collider}},position:{x:0,y:2,z:0},quaternion:{x:0,y:0,z:0,w:1,toArray:()=>[0,0,0,1]},scale:{toArray:()=>[1,1,1]},children:kind==='stairs'?[{userData:{stairTread:true}}]:[]};
 sync.call(physics,object);
 return {created,physics,object};
}

test('Dynamic + Trimesh attaches the exact trimesh descriptor to a dynamic Rapier body',()=>{
 const {created,object}=makeTest('dynamic');
 assert.deepEqual(created,[['body','dynamic'],['triangles'],['collider','trimesh'],['awake']]);
 assert.equal(object.userData.physics.collider,'trimesh');
});
test('Static, Kinematic and remote Dynamic preserve Trimesh selection',()=>{
 for(const [mode,remote,body] of [['static',false,'static'],['kinematic',false,'kinematic'],['dynamic',true,'kinematic']]){
  const {created}=makeTest(mode,'trimesh',{remote});
  assert.ok(created.some(c=>c[0]==='body'&&c[1]===body),mode);
  assert.ok(created.some(c=>c[0]==='collider'&&c[1]==='trimesh'),mode);
 }
});
test('Trimesh on compound objects respects the user selection rather than replacing it with segment boxes',()=>{
 const {created}=makeTest('dynamic','trimesh',{kind:'stairs'});
 assert.deepEqual(created.filter(c=>c[0]==='collider'),[['collider','trimesh']]);
});
test('Trimesh failure falls back to a box while keeping the user-selected physics mode',()=>{
 for(const option of [{throwOnCreate:true},{throwOnShape:true},{missingShape:true}]){
  const {created,object}=makeTest('dynamic','trimesh',option);
  assert.ok(created.some(c=>c[0]==='collider'&&c[1]==='box'));
  assert.equal(object.userData.physics.mode,'dynamic');
  assert.equal(object.userData.physics.collider,'trimesh');
 }
});
test('Box stays a valid collider for Dynamic, Static and Kinematic; Off allocates no body',()=>{
 for(const mode of ['dynamic','static','kinematic']){
  const {created}=makeTest(mode,'box');
  assert.deepEqual(created.filter(c=>c[0]==='collider'),[['collider','box']]);
  assert.ok(!created.some(c=>c[0]==='triangles'));
 }
 const {created}=makeTest('off','trimesh');
 assert.equal(created.length,0);
});
