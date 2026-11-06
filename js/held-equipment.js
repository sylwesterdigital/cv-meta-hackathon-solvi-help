// Persistent multiplayer equipment pose. Held items have scene identity and
// storage.type='held'; unlike a transient ObjectCarry pickup, no extra socket
// message or per-frame scene write is needed. Every client evaluates the same
// holder + rig-bone relation after avatar animation.
import * as THREE from 'three';
import {findRightHand} from './object-carry.js';

export const HANDS=Object.freeze(['right','left']);
// Bone targets are rig-independent aliases or a literal rig bone (rig:<name>).
// Each portable prop persists distinct left/right grip profiles in inventory.grip.
export const GRIP_BONES=Object.freeze(['auto','palm','hand','wrist','middleMetacarpal','indexMetacarpal','ringMetacarpal']);
export function defaultToolGrip(variant='stick',handleLength=1.1,hand='right'){
 const length=Number.isFinite(Number(handleLength))?Number(handleLength):1.1;
 const saw=variant==='saw';
 const anchor=saw?[-length*.35,length*.20,0]:[0,length*(variant==='axe'?.45:variant==='shovel'?.53:.53),0];
 // Prefer the actual skinned hand bone, not a finger joint (Mixamo rigs expose both).
 const tilt=variant==='saw'?-12:variant==='axe'?-24:variant==='rake'?-14:variant==='shovel'?-17:variant==='broom'?13:variant==='mop'?12:0;
 return {bone:'hand',followRotation:true,position:[0,0,0],rotation:[0,0,hand==='left'?-tilt:tilt],anchor};
}
export function cleanToolGripProfile(value={},variant='stick',handleLength=1.1,hand='right'){
 const defaults=defaultToolGrip(variant,handleLength,hand),input=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const bone=GRIP_BONES.includes(input.bone)||typeof input.bone==='string'&&/^rig:[A-Za-z0-9_.: -]{1,64}$/.test(input.bone)?input.bone:'auto';
 const array=(key,limit)=>Array.from({length:3},(_,i)=>{
  const number=Array.isArray(input[key])?input[key][i]:undefined;
  return typeof number==='number'&&Number.isFinite(number)?Math.max(-limit,Math.min(limit,number)):defaults[key][i];
 });
 return {bone,followRotation:input.followRotation!==false,position:array('position',2),rotation:array('rotation',720),anchor:array('anchor',3)};
}
export function toolGripProfile(item,hand='right'){
 const cfg=item?.userData?.furniture||{},grips=item?.userData?.inventory?.grip;
 return cleanToolGripProfile(grips?.[hand],cfg.variant,cfg.handleLength,hand);
}
export function toolRigBones(robot,hand='right'){
 const visual=robot?.children?.find(c=>c.userData?.robotVisual),bones=[];
 visual?.traverse?.(bone=>{if(bone.isBone&&boneMatchesHand(bone.name,hand))bones.push(bone.name);});
 return [...new Set(bones)].sort();
}
function boneMatchesHand(name,hand){
 const n=String(name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 return hand==='left'?/left|(?:hand|wrist|palm|metacarpal|finger|thumb|index|middle|ring)l(?:\d+)?$/.test(n):/right|(?:hand|wrist|palm|metacarpal|finger|thumb|index|middle|ring)r(?:\d+)?$/.test(n);
}
function gripBoneScore(name,target){
 const n=String(name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const scores={palm:/palm/,hand:/(?:righthand|lefthand|handr|handl)$/,wrist:/wrist/,middleMetacarpal:/middle.*metacarpal|metacarpal.*middle/,indexMetacarpal:/index.*metacarpal|metacarpal.*index/,ringMetacarpal:/ring.*metacarpal|metacarpal.*ring/};
 return scores[target]?.test(n)?100:0;
}

export const PORTABLE_TOOL_VARIANTS=Object.freeze(['shovel','axe','rake','stick','broom','mop','saw']);
export function isToolObject(obj){return obj?.userData?.inventory?.category==='tool'||PORTABLE_TOOL_VARIANTS.includes(obj?.userData?.furniture?.variant);}
export function nearestHandBone(robot,hand='right',target='auto'){
 const visual=robot?.children?.find(c=>c.userData?.robotVisual);
 if(target==='auto'&&hand==='right')return findRightHand(robot);
 let best=null,score=-1;
 visual?.traverse?.(bone=>{
  if(!bone.isBone||!boneMatchesHand(bone.name,hand))return;
  if(target.startsWith('rig:')){
   if(bone.name===target.slice(4)){best=bone;score=1000;}return;
  }
  const n=String(bone.name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const rank=target==='auto'?(/middle.*metacarpal|metacarpal.*middle/.test(n)?100:/palm/.test(n)?96:/hand/.test(n)?75:/wrist/.test(n)?40:5):gripBoneScore(bone.name,target);
  if(rank>score&&rank>0){best=bone;score=rank;}
 });
 // Custom bone unavailable after an avatar change: stay attached to the correct hand.
 if(!best&&target!=='auto')return nearestHandBone(robot,hand,'hand')||nearestHandBone(robot,hand,'auto');
 return best;
}
export function heldHandPose(robot,hand='right',boneTarget='auto'){
 robot.updateWorldMatrix?.(true,true);
 const bone=nearestHandBone(robot,hand,boneTarget);
 if(bone){const p=bone.getWorldPosition(new THREE.Vector3()),q=bone.getWorldQuaternion(new THREE.Quaternion());
  if([p.x,p.y,p.z,q.x,q.y,q.z,q.w].every(Number.isFinite))return {position:p,rotation:q};}
 const side=hand==='left'?-1:1;
 const q=robot.getWorldQuaternion?.(new THREE.Quaternion())||new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),robot.rotation?.y||0);
 const p=new THREE.Vector3(.33*side,1.19,.21).applyQuaternion(q).add(robot.getWorldPosition?.(new THREE.Vector3())||robot.position);
 return {position:p,rotation:q};
}
export function updateHeldPose(robot,item,hand='right'){
 if(!robot||!item||!HANDS.includes(hand))return false;
 const profile=toolGripProfile(item,hand);
 const grip=heldHandPose(robot,hand,profile.bone);
 const rootQuaternion=robot.getWorldQuaternion?.(new THREE.Quaternion())||grip.rotation;
 const follow=profile.followRotation?grip.rotation:rootQuaternion;
 const offset=new THREE.Vector3(...profile.position).applyQuaternion(follow);
 const target=grip.position.clone().add(offset);
 const radians=profile.rotation.map(value=>value*Math.PI/180);
 const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(radians[0],radians[1],radians[2],'XYZ'));
 const worldRotation=follow.clone().multiply(rotation);
 const parentQuat=item.parent?.getWorldQuaternion?.(new THREE.Quaternion())||new THREE.Quaternion();
 item.quaternion.copy(parentQuat.invert().multiply(worldRotation));
 item.updateWorldMatrix?.(true,true);
 const gripLocal=new THREE.Vector3(...profile.anchor);
 const currentGrip=item.localToWorld(gripLocal);
 const difference=target.sub(currentGrip);
 if(item.parent){
  const q=item.parent.getWorldQuaternion(new THREE.Quaternion()).invert();difference.applyQuaternion(q);
  const scale=item.parent.getWorldScale(new THREE.Vector3());
  if(scale.x&&scale.y&&scale.z)difference.divide(scale);
 }
 item.position.add(difference);item.updateWorldMatrix?.(true,true);item.visible=true;
 return true;
}
