import * as THREE from 'three';

// Carry state is transient: never serialize a hand attachment or a temporary collider removal.
export const PICKABLE_KINDS=new Set(['cube','sphere','cylinder','plane','torus','curve','surface','text','points','model','furniture']);
export function canBePickable(kind){return PICKABLE_KINDS.has(kind);}
export function pickUpClip(names=[],name){
 const aliases=name==='pickUp'?['picking up','pick up','pickup']:name==='liftCarry'?['lifting','holding','carrying']:['throw','throwing','throw object'];
 for(const alias of aliases){const match=names.find(n=>String(n).split('__')[0].trim().toLowerCase().replace(/[_-]/g,' ')===alias);if(match)return 'clip:'+match;}
 return null;
}
// Avatar-specific defaults; release delay is a percentage of the authored Throw clip.
export const DEFAULT_THROW_SETTINGS=Object.freeze({angle:12,height:0,direction:0,delay:55,pickupDelay:55,pickupSpeed:1,throwSpeed:1,force:3.1});
export function cleanThrowSettings(raw={}){
 const bound=(key,min,max)=>{
  const value=Number(raw?.[key]);
  return Number.isFinite(value)&&value>=min&&value<=max?value:DEFAULT_THROW_SETTINGS[key];
 };
 return {angle:bound('angle',-20,65),height:bound('height',-.35,.65),direction:bound('direction',-90,90),delay:bound('delay',5,95),pickupDelay:bound('pickupDelay',5,95),pickupSpeed:bound('pickupSpeed',.5,3),throwSpeed:bound('throwSpeed',.5,3),force:bound('force',1.2,10)};
}
function handBoneScore(name){
 const n=String(name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 if(/left/.test(n)||/(?:metacarpal|hand|wrist|palm|finger|index|middle|ring|thumb)l$/.test(n))return -1;
 if(!/(?:right|(^|_)r(?:hand|palm|wrist|middle|index|ring|thumb|finger))/.test(n)&&!/(?:handr|wristr|palmr|middlemetacarpalr|indexmetacarpalr|ringmetacarpalr)$/.test(n))return -1;
 // Middle metacarpal is anatomically at the centre of the palm. The first
 // middle-finger joint is next-best when the rig does not expose metacarpals.
 if(/middle.*metacarpal|metacarpal.*middle/.test(n))return 100;
 if(/(?:right|r)palm|palmr$/.test(n))return 96;
 if(/index.*metacarpal|metacarpal.*index/.test(n))return 91;
 if(/ring.*metacarpal|metacarpal.*ring/.test(n))return 86;
 if(/(?:right|r)handmiddle1$|(?:right|r)middle1$/.test(n))return 84;
 if(/(?:right|r)handindex1$|(?:right|r)index1$/.test(n))return 78;
 if(/(?:right|r)handring1$|(?:right|r)ring1$/.test(n))return 75;
 if(/(?:righthand|handr)$/.test(n))return 55;
 if(/(?:rightwrist|wristr)$/.test(n))return 25;
 return -1;
}
export function findRightHand(robot){
 const model=robot.children.find(c=>c.userData.robotVisual);
 let best=null,rank=-1;
 model?.traverse(bone=>{
  if(!bone.isBone)return;
  const score=handBoneScore(bone.name);
  if(score>rank){rank=score;best=bone;}
 });
 return rank>=0?best:null;
}
export function pickableTarget(robot,items,{maxReach=1.65}={}){
 if(!robot)return null;
 const forward=new THREE.Vector3(Math.sin(robot.rotation.y),0,Math.cos(robot.rotation.y));
 let best=null,bestScore=Infinity;
 for(const object of items){
  if(!object||object===robot||object.userData?.temporaryCarryTest||!canBePickable(object.userData?.editorKind)||object.userData.pickable!==true||object.userData.carriedBy||(object.userData.editorKind==='model'&&object.userData.modelReady!==true))continue;
  const bounds=new THREE.Box3().setFromObject(object);if(bounds.isEmpty())continue;
  const size=bounds.getSize(new THREE.Vector3());
  if(Math.max(size.x,size.y,size.z)>1.55||Math.max(size.x,size.y,size.z)<.03)continue;
  const centre=bounds.getCenter(new THREE.Vector3());
  const dx=centre.x-robot.position.x,dz=centre.z-robot.position.z;
  const horizontal=Math.hypot(dx,dz);
  if(horizontal>maxReach+Math.min(.3,Math.hypot(size.x,size.z)*.25)||horizontal<.04)continue;
  const ahead=(dx*forward.x+dz*forward.z)/horizontal;
  if(ahead<.43||bounds.max.y<robot.position.y-.35||bounds.min.y>robot.position.y+1.4)continue;
  const score=horizontal+(1-ahead)*.8;
  if(score<bestScore){best=object;bestScore=score;}
 }
 return best;
}
export function throwImpulse(yaw,force=3.1,elevation=12){
 const strength=Math.max(1.2,Math.min(10,Number.isFinite(Number(force))?Number(force):3.1));
 // A short, predominantly horizontal hand-height arc, not a lobbed snowball.
 const pitch=Math.max(-20,Math.min(65,Number(elevation)||0))*Math.PI/180;
 return {x:Math.sin(yaw)*strength*Math.cos(pitch),y:strength*Math.sin(pitch),z:Math.cos(yaw)*strength*Math.cos(pitch)};
}
// Use exactly the launch velocity that is converted to mass-scaled Rapier impulse.
// The optional segmentCheck stops the guide at the first physics obstacle.
export function predictThrowPath(start,yaw,settings={},segmentCheck=null){
 if(!start||![start.x,start.y,start.z,yaw].every(Number.isFinite))return [];
 const cfg=cleanThrowSettings(settings);
 const velocity=throwImpulse(yaw,cfg.force,cfg.angle);
 const points=[new THREE.Vector3(start.x,start.y,start.z)];
 const dt=.075,gravity=9.81;
 for(let i=1;i<=34;i++){
  const t=i*dt;
  const next=new THREE.Vector3(start.x+velocity.x*t,start.y+velocity.y*t-.5*gravity*t*t,start.z+velocity.z*t);
  const previous=points[points.length-1];
  if(segmentCheck){const hit=segmentCheck(previous,next);if(hit&&[hit.x,hit.y,hit.z].every(Number.isFinite)){points.push(new THREE.Vector3(hit.x,hit.y,hit.z));break;}}
  if(next.y<=0){const fraction=Math.max(0,Math.min(1,previous.y/(previous.y-next.y||1)));
   points.push(new THREE.Vector3(previous.x+(next.x-previous.x)*fraction,0,previous.z+(next.z-previous.z)*fraction));break;}
  points.push(next);
 }
 return points;
}
function finiteVector(vec){return vec&&Number.isFinite(vec.x)&&Number.isFinite(vec.y)&&Number.isFinite(vec.z);}
function gripPoint(robot){
 robot.updateWorldMatrix(true,true);
 const hand=findRightHand(robot);
 const point=new THREE.Vector3();
 if(hand){hand.getWorldPosition(point);if(finiteVector(point))return point;}
 // Fallback rig: right palm roughly 0.35m from centre and 1.2m above feet.
 return new THREE.Vector3(.35,1.2,.25).applyAxisAngle(new THREE.Vector3(0,1,0),robot.rotation.y).add(robot.position);
}
export class ObjectCarry{
 constructor(editor){this.editor=editor;this.trajectoryEnabled=false;this.trajectoryLine=null;this.trajectoryEnd=null;this.trajectoryClock=0;}
 eligible(robot){return robot?.userData?.editorKind==='robot'&&this.editor.canEdit(robot)&&!robot.userData.robotLadderRide&&!robot.userData.robotJumpActive&&!robot.userData.robotOneShot&&!robot.userData.robotCarry;}
 pickup(robot,remote=false,targetId=null){
  if(!remote&&!this.eligible(robot))return false;
  const target=targetId?this.editor.items.find(o=>o.userData.editorId===targetId):pickableTarget(robot,this.editor.items);
  if(!target||!canBePickable(target.userData.editorKind)||!target.userData.pickable||target.userData.carriedBy)return false;
  if(!remote&&(!this.editor.canEdit(target)||!this.editor.physics.owns(target)||!this.editor.physics.enabled)){this.editor.toast('Pickup needs object permission and room Physics enabled');return false;}
  // One-shot Lifting reaches for the object, then ordinary Idle/Walk/Run resumes.
  const clip=pickUpClip(robot.userData.robotAvailableActions,'liftCarry');
  const settings=cleanThrowSettings(robot.userData.robotThrowSettings);
  const duration=Math.max(.2,Math.min(4,(robot.userData.robotAnimator?.clipDuration(clip)||.65)/settings.pickupSpeed));
  target.userData.carryOrigin={position:target.position.clone(),rotation:target.rotation?.clone?.()};
  robot.userData.robotCarry={objectId:target.userData.editorId,stage:'pickup',elapsed:0,duration,attachAt:duration*settings.pickupDelay/100,attached:false,settings,remote};
  robot.userData.robotPlaying=null;
  if(!remote)window.solviRoomSocket?.send({type:'object-carry',action:'pickup',id:robot.userData.editorId,target:target.userData.editorId});
  return true;
 }
 // Local-only, disposable snowball for calibrating grip and Throw without
 // finding an existing Pickable object. It is never saved or broadcast.
 testSphere(robot){
  if(!this.eligible(robot))return false;
  if(!this.editor.physics.enabled){this.editor.toast?.('Enable room Physics to test a throw');return false;}
  const sphere=new THREE.Mesh(new THREE.SphereGeometry(.55,16,12),new THREE.MeshStandardMaterial({color:'#c8e9ff',roughness:.68}));
  sphere.name='Temporary throw sphere';sphere.scale.setScalar(.18);
  sphere.raycast=()=>{}; // Test helper cannot be selected or transformed.
  sphere.userData={editorKind:'sphere',editorId:`carry-test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`,pickable:true,temporaryCarryTest:true,physics:{mode:'dynamic'},ownerId:window.solviAPI?.auth()?.profile?.id||null};
  sphere.position.copy(gripPoint(robot));
  this.editor.items.push(sphere);
  this.editor.world.scene.add(sphere);
  const state={objectId:sphere.userData.editorId,stage:'hold',elapsed:0,duration:0,attached:false,remote:false,test:true};
  robot.userData.robotCarry=state;
  if(!this.attach(robot,sphere,state)){
   robot.userData.robotCarry=null;this.disposeTestSphere(sphere);return false;
  }
  robot.userData.robotPlaying=null;
  return true;
 }
 disposeTestSphere(object){
  this.editor.physics.remove(object.userData.editorId);
  const index=this.editor.items.indexOf(object);
  if(index>=0)this.editor.items.splice(index,1);
  object.parent?.remove(object);
  object.geometry?.dispose?.();object.material?.dispose?.();
 }
 throw(robot,remote=false,remotePosition=null){
  const state=robot?.userData?.robotCarry;
  if(!state||state.stage==='throw')return false;
  const target=this.editor.items.find(o=>o.userData.editorId===state.objectId);
  if(!target)return false;
  // If pickup animation has not reached the hand yet, attach before throwing.
  if(!state.attached)this.attach(robot,target,state);
  const clip=pickUpClip(robot.userData.robotAvailableActions,'throwObject');
  state.stage='throw';state.elapsed=0;state.settings=cleanThrowSettings(robot.userData.robotThrowSettings);
  state.duration=Math.max(.2,Math.min(4,(robot.userData.robotAnimator?.clipDuration(clip)||.9)/state.settings.throwSpeed));
  state.releaseAt=state.duration*state.settings.delay/100;
  state.released=false;
  // Keep the object attached throughout the arm swing. The owner publishes
  // the throw only when it is actually released; remote packets already denote
  // that release moment and therefore detach without a second network delay.
  if(remote)this.release(robot,target,state,true,remotePosition);
  robot.userData.robotPlaying=null;
  return true;
 }
 attach(robot,obj,state){
  if(obj.userData.carriedBy&&obj.userData.carriedBy!==robot.userData.editorId)return false;
  obj.userData.carriedBy=robot.userData.editorId;
  const box=new THREE.Box3().setFromObject(obj);
  const centre=box.getCenter(new THREE.Vector3());
  state.pivotOffset=centre.sub(obj.position);
  state.attached=true;
  this.editor.physics.remove(obj.userData.editorId); // No collider blocking the holder's capsule.
  this.updateGrip(robot,obj,state);
  return true;
 }
 updateGrip(robot,obj,state){
  const point=gripPoint(robot);if(!finiteVector(point))return;
  // Place the geometric centre in the palm while retaining the original scene parent.
  obj.position.copy(point.sub(state.pivotOffset||new THREE.Vector3()));
  obj.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),robot.rotation.y);
 }
 release(robot,obj,state,remote=false,remotePosition=null){
  if(state.released)return;
  if(!state.attached&&!this.attach(robot,obj,state))return;
  if(!finiteVector(robot.position)||!Number.isFinite(robot.rotation.y))return;
  const hand=gripPoint(robot);
  const settings=state.settings||cleanThrowSettings(robot.userData.robotThrowSettings);
  const yaw=robot.rotation.y+settings.direction*Math.PI/180;
  const forward=Math.sin(yaw),side=Math.cos(yaw);
  // Release at the animated palm's current world height. A floor-height
  // safety bound prevents badly authored or missing bones from launching at
  // the robot's knees. The height adjustment is relative to the palm.
  const position=remotePosition&&finiteVector(remotePosition)?remotePosition:
   new THREE.Vector3(hand.x+forward*.12,Math.max(robot.position.y+.8,hand.y+settings.height),hand.z+side*.12).sub(state.pivotOffset||new THREE.Vector3());
  if(!finiteVector(position))return;
  state.released=true;
  obj.position.copy(position);
  // Remove attachment state before reintroducing the rigid body.
  delete obj.userData.carriedBy;
  delete obj.userData.carryOrigin;
  obj.userData.physics={...obj.userData.physics,mode:'dynamic'};
  this.editor.physics.sync(obj);
  const impulse=throwImpulse(yaw,settings.force,settings.angle);
  if(!remote){
   const body=this.editor.physics.bodies.get(obj.userData.editorId);
   if(body){
    // Momentum from the hand: reset any stale velocity, then multiply the
    // desired gentle launch speed by mass for consistent throws.
    body.setLinvel?.({x:0,y:0,z:0},true);
    body.setAngvel?.({x:0,y:0,z:0},true);
    const mass=typeof body.mass==='function'?Number(body.mass()):1;
    const factor=Number.isFinite(mass)&&mass>0?Math.min(100,mass):1;
    body.applyImpulse?.({x:impulse.x*factor,y:impulse.y*factor,z:impulse.z*factor},true);
   }
   if(!obj.userData.temporaryCarryTest){
    this.editor.queueSave(obj);
    window.solviRoomSocket?.send({type:'object-carry',action:'throw',id:robot.userData.editorId,target:obj.userData.editorId,x:obj.position.x,y:obj.position.y,z:obj.position.z});
   }
  }
 }
 toggleTrajectory(enabled){
  this.trajectoryEnabled=Boolean(enabled);
  if(!this.trajectoryEnabled)this.hideTrajectory();
 }
 hideTrajectory(){if(this.trajectoryLine)this.trajectoryLine.visible=false;if(this.trajectoryEnd)this.trajectoryEnd.visible=false;}
 clearTrajectory(){
  this.trajectoryLine?.parent?.remove(this.trajectoryLine);
  this.trajectoryEnd?.parent?.remove(this.trajectoryEnd);
  this.trajectoryLine?.geometry?.dispose();this.trajectoryLine?.material?.dispose();
  this.trajectoryEnd?.geometry?.dispose();this.trajectoryEnd?.material?.dispose();
  this.trajectoryLine=null;this.trajectoryEnd=null;
 }
 collisionOnSegment(robot,start,end){
  const physics=this.editor.physics,R=physics?.runtime,world=physics?.world;
  if(!physics?.enabled||!world||typeof R?.Ray!=='function')return null;
  const dx=end.x-start.x,dy=end.y-start.y,dz=end.z-start.z;
  const length=Math.hypot(dx,dy,dz);
  if(!Number.isFinite(length)||length<.0001)return null;
  try{
   const ray=new R.Ray({x:start.x,y:start.y,z:start.z},{x:dx/length,y:dy/length,z:dz/length});
   const excluded=physics.colliders?.get(robot.userData.editorId);
   const hit=world.castRay(ray,length,true,undefined,undefined,excluded);
   const distance=hit?.timeOfImpact;
   if(!Number.isFinite(distance)||distance<.015||distance>length)return null;
   return {x:start.x+dx*distance/length,y:start.y+dy*distance/length,z:start.z+dz*distance/length};
  }catch{return null;}
 }
 trajectoryOrigin(robot,cfg){
  const hand=gripPoint(robot);
  const yaw=robot.rotation.y+cfg.direction*Math.PI/180;
  const pivot=robot.userData.robotCarry?.pivotOffset;
  const origin=new THREE.Vector3(hand.x+Math.sin(yaw)*.12,Math.max(robot.position.y+.8,hand.y+cfg.height),hand.z+Math.cos(yaw)*.12);
  // A predicted launch uses the held object's geometric centre; test sphere
  // or a default hand-sized prop has a negligible pivot offset.
  if(pivot&&finiteVector(pivot))origin.sub(pivot);
  return origin;
 }
 updateTrajectory(dt){
  if(!this.trajectoryEnabled){this.hideTrajectory();return;}
  const robot=this.editor.selected;
  if(!robot||robot.userData?.editorKind!=='robot'||!robot.parent||!finiteVector(robot.position)||!Number.isFinite(robot.rotation.y)){this.hideTrajectory();return;}
  this.trajectoryClock+=Math.max(0,Math.min(.12,Number(dt)||0));
  if(this.trajectoryClock<.12&&this.trajectoryLine?.visible)return;
  this.trajectoryClock=0;
  const cfg=cleanThrowSettings(robot.userData.robotThrowSettings);
  const yaw=robot.rotation.y+cfg.direction*Math.PI/180;
  const origin=this.trajectoryOrigin(robot,cfg);
  const points=predictThrowPath(origin,yaw,cfg,(a,b)=>this.collisionOnSegment(robot,a,b));
  if(points.length<2){this.hideTrajectory();return;}
  if(!this.trajectoryLine){
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(35*3),3));
   this.trajectoryLine=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#ffe38b',depthTest:false,transparent:true,opacity:.94}));
   this.trajectoryLine.frustumCulled=false;this.trajectoryLine.renderOrder=992;
   this.trajectoryLine.userData.throwPreview=true;
   this.trajectoryEnd=new THREE.Mesh(new THREE.SphereGeometry(.055,8,6),new THREE.MeshBasicMaterial({color:'#ffc96e',depthTest:false}));
   this.trajectoryEnd.renderOrder=993;this.trajectoryEnd.userData.throwPreview=true;
  }
  const scene=this.editor.world.scene;
  if(this.trajectoryLine.parent!==scene)scene.add(this.trajectoryLine);
  if(this.trajectoryEnd.parent!==scene)scene.add(this.trajectoryEnd);
  const attr=this.trajectoryLine.geometry.getAttribute('position');
  for(let i=0;i<points.length;i++){const p=points[i];attr.setXYZ(i,p.x,p.y,p.z);}
  attr.needsUpdate=true;this.trajectoryLine.geometry.setDrawRange(0,points.length);
  this.trajectoryEnd.position.copy(points[points.length-1]);
  this.trajectoryLine.visible=true;this.trajectoryEnd.visible=true;
 }
 tick(dt){
  this.updateTrajectory(dt);
  for(const robot of this.editor.items){const state=robot.userData?.robotCarry;if(!state)continue;
   const obj=this.editor.items.find(o=>o.userData.editorId===state.objectId);
   if(!obj||!robot.parent){if(obj?.userData.temporaryCarryTest)this.disposeTestSphere(obj);else if(obj)delete obj.userData.carriedBy;robot.userData.robotCarry=null;continue;}
   state.elapsed+=Math.min(Math.max(Number(dt)||0,0),.12);
   if(state.stage==='pickup'){
    if(!state.attached&&state.elapsed>=(state.attachAt??state.duration*.5))this.attach(robot,obj,state);
    if(state.elapsed>=state.duration){if(!state.attached)this.attach(robot,obj,state);state.stage='hold';robot.userData.robotPlaying=null;}
   }else if(state.stage==='throw'){
    if(!state.released&&state.elapsed>=state.releaseAt)this.release(robot,obj,state,state.remote);
    if(state.elapsed>=state.duration){
     if(!state.released)this.release(robot,obj,state,state.remote);
     robot.userData.robotCarry=null;robot.userData.robotPlaying=null;
    }
   }
   if(state.attached&&!state.released)this.updateGrip(robot,obj,state);
  }
  // Temporary test spheres fall under real physics and are removed after a short trial.
  for(const obj of [...this.editor.items]){
   if(!obj.userData?.temporaryCarryTest||obj.userData.carriedBy)continue;
   obj.userData.testLife=(obj.userData.testLife||0)+Math.min(Math.max(Number(dt)||0,0),.12);
   if(obj.userData.testLife>=12)this.disposeTestSphere(obj);
  }
  // Do not leave an invisible collider after a robot is removed or the carrier is lost.
  for(const obj of [...this.editor.items]){
   if(!obj.userData?.carriedBy)continue;
   const actor=this.editor.items.find(bot=>bot.userData?.editorId===obj.userData.carriedBy);
   if(actor?.userData?.robotCarry?.objectId===obj.userData.editorId)continue;
   if(obj.userData.temporaryCarryTest){this.disposeTestSphere(obj);continue;}
   delete obj.userData.carriedBy;
   delete obj.userData.carryOrigin;
   obj.userData.physics={...obj.userData.physics,mode:'dynamic'};
   this.editor.physics.sync(obj);
  }
 }
 remotePacket(packet){
  const robot=this.editor.items.find(o=>o.userData.editorId===packet.id&&o.userData.editorKind==='robot');
  if(!robot)return;
  if(packet.action==='pickup')this.pickup(robot,true,packet.target);
  else if(packet.action==='throw'){
   const state=robot.userData.robotCarry;
   if(!state||state.objectId!==packet.target)return;
   if(![packet.x,packet.y,packet.z].every(n=>typeof n==='number'&&Number.isFinite(n)))return;
   this.throw(robot,true,new THREE.Vector3(packet.x,packet.y,packet.z));
  }
 }
}
