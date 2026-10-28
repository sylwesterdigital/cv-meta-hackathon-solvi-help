import * as THREE from 'three';
import {physicsOptions} from './physics-options.js';
import {CHARACTER,characterMotion,resolveCharacterMotion,easedRemotePose} from './character-physics.js';

// Bodies live for the lifetime of the scene object; movement never re-creates a GLB.
export class ScenePhysics{
 constructor(editor){
  this.editor=editor;this.enabled=false;this.runtime=null;this.world=null;this.bodies=new Map();
  this.colliders=new Map();this.settings=new Map();this.characters=new Map();this.characterController=null;
  this.accumulator=0;this.lastBroadcast=new Map();this.lastSave=new Map();this.lastActivity=new Map();
  this.remoteTargets=new Map();this.localSequence=new Map();this.remoteSequence=new Map();this.loading=null;
 }
 async setEnabled(enabled){
  if(!enabled){this.enabled=false;this.clear();return;}
  if(this.enabled&&this.world)return;
  if(this.loading)return this.loading;
  this.loading=(async()=>{
   try{
    if(!this.runtime){const module=await import('../vendor/rapier/rapier.mjs');
     this.runtime=module.default?.World?module.default:module;
     if(typeof this.runtime.init==='function')await this.runtime.init();
     else if(typeof module.default==='function')await module.default();
    }
    this.clear();const R=this.runtime;this.world=new R.World({x:0,y:-9.81,z:0});
    this.world.createCollider(R.ColliderDesc.cuboid(100,.12,100).setTranslation(0,-.12,0));
    this.characterController=this.world.createCharacterController(.012);
    this.characterController.enableAutostep(CHARACTER.maxStep,.13,false);
    this.characterController.enableSnapToGround(CHARACTER.snapDistance);
    this.characterController.setMaxSlopeClimbAngle(CHARACTER.slopeDegrees*Math.PI/180);
    this.characterController.setMinSlopeSlideAngle(CHARACTER.slopeDegrees*Math.PI/180);
    this.characterController.setApplyImpulsesToDynamicBodies(true);
    this.enabled=true;
    for(const object of this.editor.items)this.sync(object);
   }catch(error){this.enabled=false;this.clear();throw error;}
   finally{this.loading=null;}
  })();return this.loading;
 }
 clear(){
  this.bodies.clear();this.colliders.clear();this.settings.clear();this.characters.clear();
  this.remoteTargets.clear();this.lastBroadcast.clear();this.lastSave.clear();this.lastActivity.clear();
  this.remoteSequence.clear();this.localSequence.clear();
  if(this.world){this.world.free();this.world=null;}
  this.characterController=null;this.accumulator=0;
  for(const object of this.editor.items||[]){if(object.userData.editorKind==='robot'){
   object.userData.physicsCharacterActive=false;object.userData.physicsAirborne=false;
  }}
 }
 remove(id){
  const body=this.bodies.get(id);
  if(body&&this.world)this.world.removeRigidBody(body);
  for(const map of [this.bodies,this.colliders,this.settings,this.characters,this.remoteTargets,this.lastBroadcast,this.lastSave,this.lastActivity,this.remoteSequence,this.localSequence])map.delete(id);
 }
 owns(object){const id=window.solviAPI?.auth()?.profile?.id;return !object.userData.ownerId||object.userData.ownerId===id;}
 // Build a real world-space surface mesh in rigid-body local coordinates; the body supplies translation and rotation.
 // Static only: dynamic triangle meshes are unstable and not supported by this control.
 triangleMeshShape(object){
  const positions=[],indices=[],R=this.runtime;
  object.updateWorldMatrix(true,true);
  const origin=object.getWorldPosition(new THREE.Vector3());
  const inverse=object.getWorldQuaternion(new THREE.Quaternion()).invert();
  const vertex=new THREE.Vector3();let triangles=0,overflow=false;
  object.traverse(mesh=>{
   if(!mesh.isMesh||mesh.userData.lightMarker||!mesh.geometry||overflow)return;
   const geom=mesh.geometry,attribute=geom.getAttribute('position');if(!attribute)return;
   const index=geom.getIndex(),count=index?index.count:attribute.count;
   // Imported assets may contain multiple draw groups and unindexed triangles. Budget the entire collider.
   const triCount=Math.floor(count/3);if(triangles+triCount>50000){overflow=true;return;}
   const first=positions.length/3;
   for(let j=0;j<attribute.count;j++){
    vertex.fromBufferAttribute(attribute,j).applyMatrix4(mesh.matrixWorld).sub(origin).applyQuaternion(inverse);
    if(!Number.isFinite(vertex.x+vertex.y+vertex.z)){overflow=true;return;}
    positions.push(vertex.x,vertex.y,vertex.z);
   }
   for(let i=0;i<triCount*3;i++)indices.push(first+(index?index.getX(i):i));
   triangles+=triCount;
  });
  if(overflow||triangles===0){object.userData.colliderStatus=overflow?'Trimesh exceeds 50,000 triangles; using bounding box':'No mesh triangles; using bounding box';return null;}
  object.userData.colliderStatus=`Trimesh: ${triangles} triangles`;
  return R.ColliderDesc.trimesh(new Float32Array(positions),new Uint32Array(indices));
 }
 // Use bounds centered relative to the rigid body's origin; imported meshes have arbitrary pivots.
 colliderShape(object){
  const R=this.runtime;
  if(object.userData.editorKind==='sphere')return R.ColliderDesc.ball(Math.max(.055,.55*Math.max(Math.abs(object.scale.x),Math.abs(object.scale.y),Math.abs(object.scale.z))));
  object.updateWorldMatrix(true,true);
  const bounds=new THREE.Box3().setFromObject(object);const size=bounds.getSize(new THREE.Vector3());
  const center=bounds.getCenter(new THREE.Vector3());
  // Box is conservative for rotated and irregular meshes; all scene assets remain collidable.
  const offset=center.sub(object.getWorldPosition(new THREE.Vector3()));
  const inverseWorldRotation=object.getWorldQuaternion(new THREE.Quaternion()).invert();offset.applyQuaternion(inverseWorldRotation);
  return R.ColliderDesc.cuboid(Math.max(.025,size.x/2),Math.max(.025,size.y/2),Math.max(.025,size.z/2)).setTranslation(offset.x,offset.y,offset.z);
 }
 sync(object){
  if(!this.enabled||!this.world||!object)return;
  const id=object.userData.editorId;if(!id)return;
  const kind=object.userData.editorKind;
  // Collider geometry cannot be measured until the imported GLB/FBX visual is loaded.
  if(kind==='model'&&!object.userData.modelReady){this.remove(id);return;}
  if(kind==='light'){this.remove(id);return;}
  const isRobot=kind==='robot',opts=physicsOptions(object.userData.physics);
  if(!isRobot&&opts.mode==='off'){this.remove(id);return;}
  const owner=this.owns(object);
  const type=isRobot?'avatar':opts.mode==='dynamic'&&!owner?'remote-dynamic':opts.mode;
  const signature=`${kind}|${type}|${JSON.stringify(opts)}|${object.scale.toArray().join(',')}|${kind==='model'?(object.userData.modelUrl||'')+':'+Boolean(object.userData.modelReady):''}`;
  const existing=this.bodies.get(id);
  if(existing&&this.settings.get(id)===signature){
   // A remote object may be edited in place without allocating a new collider.
   if(!isRobot){
    if(type==='remote-dynamic'){
     this.remoteTargets.set(id,{position:{x:object.position.x,y:object.position.y,z:object.position.z},rotation:object.quaternion.toArray(),received:performance.now()});
    }else{existing.setTranslation(object.position,true);existing.setRotation(object.quaternion,true);}
   }
   return;
  }
  this.remove(id);
  const R=this.runtime;
  const descriptor=isRobot||type==='kinematic'||type==='remote-dynamic'?R.RigidBodyDesc.kinematicPositionBased():
    type==='dynamic'?R.RigidBodyDesc.dynamic():R.RigidBodyDesc.fixed();
  descriptor.setTranslation(object.position.x,object.position.y,object.position.z);
  descriptor.setRotation({x:object.quaternion.x,y:object.quaternion.y,z:object.quaternion.z,w:object.quaternion.w});
  if(isRobot){descriptor.lockRotations();}
  const body=this.world.createRigidBody(descriptor);
  const shape=isRobot?R.ColliderDesc.capsule(CHARACTER.halfHeight,CHARACTER.radius).setTranslation(0,CHARACTER.centerY,0):opts.mode==='static'&&opts.collider==='trimesh'?(this.triangleMeshShape(object)||this.colliderShape(object)):this.colliderShape(object);
  if(!isRobot)shape.setFriction(opts.friction).setRestitution(opts.restitution);
  else shape.setFriction(.85).setRestitution(0);
  let collider;
  try{collider=this.world.createCollider(shape,body);}catch(error){
   if(opts.collider!=='trimesh'||type!=='static')throw error;
   object.userData.colliderStatus='Trimesh creation failed; using bounding box: '+String(error?.message||error).slice(0,120);
   collider=this.world.createCollider(this.colliderShape(object).setFriction(opts.friction).setRestitution(opts.restitution),body);
  }
  this.bodies.set(id,body);this.colliders.set(id,collider);this.settings.set(id,signature);
  if(isRobot){
   this.characters.set(id,{verticalSpeed:0,grounded:object.position.y<=.08,previousJump:false});
   object.userData.physicsCharacterActive=true;
  }
 }
 applyRemoteState(packet){
  if(!this.enabled||!this.world||typeof packet?.id!=='string')return;
  const object=this.editor.items.find(item=>item.userData.editorId===packet.id);
  if(!object||object.userData.editorKind==='robot'||this.owns(object))return;
  if(!['dynamic','kinematic'].includes(object.userData.physics?.mode))return;
  const values=[packet.x,packet.y,packet.z,...(Array.isArray(packet.q)?packet.q:[])];
  if(values.length!==7||!values.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1000))return;
  const seq=Number(packet.seq)||0;
  if(seq&&seq<=(this.remoteSequence.get(packet.id)||0))return;
  this.remoteSequence.set(packet.id,seq);
  this.remoteTargets.set(packet.id,{position:{x:packet.x,y:packet.y,z:packet.z},rotation:packet.q,received:performance.now()});
 }
 driveRobot(object,dt){
  const id=object.userData.editorId,body=this.bodies.get(id),collider=this.colliders.get(id),state=this.characters.get(id);
  if(!body||!collider||!state)return;
  const p=body.translation(),desired={x:object.position.x,y:object.position.y,z:object.position.z};
  // A genuine teleport (e.g. user moving a robot between worlds) is explicit, not used for walking.
  if(Math.hypot(desired.x-p.x,desired.z-p.z)>4){body.setTranslation(desired,true);state.verticalSpeed=0;return;}
  const wantJump=Number.isFinite(object.userData.jumpVel)&&object.userData.jumpVel>0;
  const canJump=state.grounded||p.y<=.07;
  const jump=wantJump&&canJump;
  if(wantJump)delete object.userData.jumpVel; // one-shot; the rigid-body controller owns subsequent frames
  const delta=characterMotion({...p,verticalSpeed:state.verticalSpeed},desired,dt,jump);
  state.verticalSpeed=delta.verticalSpeed;
  this.characterController.computeColliderMovement(collider,{x:delta.x,y:delta.y,z:delta.z});
  const resolved=resolveCharacterMotion(p,this.characterController.computedMovement(),this.characterController.computedGrounded(),state.verticalSpeed);
  state.verticalSpeed=resolved.verticalSpeed;state.grounded=resolved.grounded;
  body.setNextKinematicTranslation({x:resolved.x,y:resolved.y,z:resolved.z});
  body.setNextKinematicRotation({x:object.quaternion.x,y:object.quaternion.y,z:object.quaternion.z,w:object.quaternion.w});
  object.position.set(resolved.x,resolved.y,resolved.z);
  object.userData.physicsAirborne=!state.grounded;
  if(state.grounded&&object.userData.robotMode==='jump'&&!jump){object.userData.robotMode='idle';object.userData.robotArrived=true;}
 }
 tick(dt){
  if(!this.enabled||!this.world)return;
  const step=Math.max(0,Math.min(.05,Number(dt)||0)),now=performance.now();
  // Kinematic avatars are evaluated AFTER local and remote movement intent for this frame.
  for(const object of this.editor.items){
   const id=object.userData.editorId,body=this.bodies.get(id);if(!body)continue;
   if(object.userData.editorKind==='robot'){this.driveRobot(object,step);continue;}
   if(this.editor.selected===object&&this.editor.world.editorDragging){
    body.setTranslation(object.position,true);body.setRotation(object.quaternion,true);
    if(body.isDynamic?.()){body.setLinvel({x:0,y:0,z:0},true);body.setAngvel({x:0,y:0,z:0},true);}
   }else if(object.userData.physics?.mode==='kinematic'){
    body.setNextKinematicTranslation(object.position);body.setNextKinematicRotation(object.quaternion);
   }else if(this.remoteTargets.has(id)){
    const target=this.remoteTargets.get(id),smoothed=easedRemotePose(body.translation(),target.position,step);
    body.setNextKinematicTranslation(smoothed);
    const rot=new THREE.Quaternion(...target.rotation);
    const q=new THREE.Quaternion(body.rotation().x,body.rotation().y,body.rotation().z,body.rotation().w).slerp(rot,1-Math.exp(-step*13));
    body.setNextKinematicRotation(q);
    object.position.set(smoothed.x,smoothed.y,smoothed.z);object.quaternion.copy(q);
   }
  }
  this.accumulator=Math.min(.10,this.accumulator+step);let n=0;
  while(this.accumulator>=1/60&&n++<6){this.world.timestep=1/60;this.world.step();this.accumulator-=1/60;}
  for(const object of this.editor.items){
   const id=object.userData.editorId,body=this.bodies.get(id);
   if(!body||object.userData.physics?.mode!=='dynamic'||object.userData.editorKind==='robot'||!this.owns(object))continue;
   if(this.editor.selected===object&&this.editor.world.editorDragging)continue;
   const p=body.translation(),q=body.rotation();object.position.set(p.x,p.y,p.z);object.quaternion.set(q.x,q.y,q.z,q.w);
   const awake=!body.isSleeping();const lastActive=this.lastActivity.get(id)||false;
   if(awake&&now-(this.lastBroadcast.get(id)||0)>220){
    this.lastBroadcast.set(id,now);
    window.solviRoomSocket?.send({type:'physics-state',id,x:+p.x.toFixed(3),y:+p.y.toFixed(3),z:+p.z.toFixed(3),q:[q.x,q.y,q.z,q.w].map(v=>+v.toFixed(4)),seq:(this.localSequence.get(id)||0)+1});
    this.localSequence.set(id,(this.localSequence.get(id)||0)+1);
   }
   if((awake&&now-(this.lastSave.get(id)||0)>3000)||(!awake&&lastActive)){
    this.lastSave.set(id,now);this.editor.queueSave(object);
   }
   this.lastActivity.set(id,awake);
  }
 }
}
