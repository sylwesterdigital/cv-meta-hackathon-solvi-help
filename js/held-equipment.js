// Persistent multiplayer equipment pose. Held items have scene identity and
// storage.type='held'; unlike a transient ObjectCarry pickup, no extra socket
// message or per-frame scene write is needed. Every client evaluates the same
// holder + rig-bone relation after avatar animation.
import * as THREE from 'three';
import {findRightHand} from './object-carry.js';

export const HANDS=Object.freeze(['right','left']);
export const PORTABLE_TOOL_VARIANTS=Object.freeze(['shovel','axe','rake','stick','broom','mop','saw']);
export function isToolObject(obj){return obj?.userData?.inventory?.category==='tool'||PORTABLE_TOOL_VARIANTS.includes(obj?.userData?.furniture?.variant);}
export function nearestHandBone(robot,hand='right'){
 if(hand==='right')return findRightHand(robot);
 const visual=robot?.children?.find(c=>c.userData?.robotVisual);
 let best=null,score=-1;
 visual?.traverse?.(bone=>{
  if(!bone.isBone)return;
  const name=String(bone.name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(!(/left|handl$|wristl$|palml$/.test(name)))return;
  const rank=/middle.*metacarpal|metacarpal.*middle/.test(name)?100:/palm/.test(name)?96:/hand/.test(name)?75:/wrist/.test(name)?40:5;
  if(rank>score){best=bone;score=rank;}
 });
 return best;
}
export function heldHandPose(robot,hand='right'){
 robot.updateWorldMatrix?.(true,true);
 const bone=nearestHandBone(robot,hand);
 if(bone){const p=bone.getWorldPosition(new THREE.Vector3()),q=bone.getWorldQuaternion(new THREE.Quaternion());
  if([p.x,p.y,p.z,q.x,q.y,q.z,q.w].every(Number.isFinite))return {position:p,rotation:q};}
 const side=hand==='left'?-1:1;
 const q=robot.getWorldQuaternion?.(new THREE.Quaternion())||new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),robot.rotation?.y||0);
 const p=new THREE.Vector3(.33*side,1.19,.21).applyQuaternion(q).add(robot.getWorldPosition?.(new THREE.Vector3())||robot.position);
 return {position:p,rotation:q};
}
export function updateHeldPose(robot,item,hand='right'){
 if(!robot||!item||!HANDS.includes(hand))return false;
 const grip=heldHandPose(robot,hand);
 const cfg=item.userData?.furniture;
 // For procedural tools, grip around the handle, not the tip of the blade.
 const tool=isToolObject(item);
 const gripLocal=tool?new THREE.Vector3(0,cfg?.variant==='saw'?(cfg.handleLength||1.1)*.20:(cfg?.handleLength||1.1)*.53,0):null;
 // Attach to the animated hand while retaining the original scene parent.
 // Tools are oriented from their built-in Y-axis handle; non-tools stay upright.
 const rotation=tool?new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,hand==='left'?.22:-.22)):new THREE.Quaternion();
 const worldRotation=grip.rotation.clone().multiply(rotation);
 const parentQuat=item.parent?.getWorldQuaternion?.(new THREE.Quaternion())||new THREE.Quaternion();
 item.quaternion.copy(parentQuat.invert().multiply(worldRotation));
 const offset=gripLocal||(()=>{const localBox=new THREE.Box3().setFromObject(item);const worldCenter=localBox.getCenter(new THREE.Vector3());return item.worldToLocal(worldCenter);})();
 item.updateWorldMatrix?.(true,true);
 const currentGrip=item.localToWorld(offset.clone());
 const difference=grip.position.clone().sub(currentGrip);
 if(item.parent){const q=item.parent.getWorldQuaternion(new THREE.Quaternion()).invert();difference.applyQuaternion(q);const scale=item.parent.getWorldScale(new THREE.Vector3());if(scale.x&&scale.y&&scale.z)difference.divide(scale);}
 item.position.add(difference);
 item.updateWorldMatrix?.(true,true);
 item.visible=true;
 return true;
}
