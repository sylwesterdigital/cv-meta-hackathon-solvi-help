// Seat choice is evaluated in the object's local frame, then transformed to
// world coordinates. A chair back must not be mistaken for its sitting surface.
import * as THREE from 'three';
function sittingClip(names=[]){const name=names.find(n=>/^(?:sit|sitting|sitting idle|sit idle|sit down)(?:__\d+)?$/i.test(String(n).trim()));return name?'clip:'+name:null;}

const SURFACES=new Set(['furniture','cube','cylinder','plane','surface','model']);
export function seatPlan(target,robotPosition,occupiedSlots=[]){
 if(!target||!SURFACES.has(target.userData?.editorKind)||!robotPosition||target.userData?.storage)return null;
 target.updateWorldMatrix?.(true,true);
 const bounds=new THREE.Box3().setFromObject(target);if(bounds.isEmpty())return null;
 const size=bounds.getSize(new THREE.Vector3());
 if(Math.min(size.x,size.z)<.42||!Number.isFinite(size.y))return null;
 const furniture=target.userData.editorKind==='furniture'?target.userData.furniture:null;
 if(furniture&& !['chair','officeChair','armchair','sofa','stool','bed','table','sunbed','deckChair'].includes(furniture.variant))return null;
 const face=target.getWorldQuaternion(new THREE.Quaternion());
 // No seats on steeply pitched surfaces.
 const vertical=new THREE.Vector3(0,1,0).applyQuaternion(face);
 if(vertical.y<.87)return null;
 const local=target.worldToLocal(robotPosition.clone());
 const localBounds=new THREE.Box3();
 // Geometry is defined in the object's original local coordinate system.
 target.traverse?.(part=>{
  if(!part.geometry?.boundingBox&&part.geometry?.computeBoundingBox)part.geometry.computeBoundingBox();
  if(!part.geometry?.boundingBox)return;
  const matrix=new THREE.Matrix4().copy(target.matrixWorld).invert().multiply(part.matrixWorld);
  localBounds.union(part.geometry.boundingBox.clone().applyMatrix4(matrix));
 });
 if(localBounds.isEmpty())return null;
 const xMid=(localBounds.min.x+localBounds.max.x)/2,zMid=(localBounds.min.z+localBounds.max.z)/2;
 const width=localBounds.max.x-localBounds.min.x,depth=localBounds.max.z-localBounds.min.z;
 if(width<.38||depth<.38)return null;
 let localX=xMid,localZ=zMid,angle=0;
 if(furniture){
  const seatY=Number(furniture.seatHeight);
  const top=['sunbed','deckChair'].includes(furniture.variant)?(Number(furniture.height)||.4)+.07:Number.isFinite(seatY)?seatY:
    furniture.variant==='bed'?Number(furniture.height)||.50:Number(furniture.height)||.5;
  // Furniture geometry typically has a back at +Z, so sit towards its -Z edge.
  // A chair's armrest and wheels belong to its outer bounds, not the sitting surface.
  // Place one-seat furniture at the exact centre of the cushion regardless of approach angle.
  localX=0;
  localZ=['sunbed','deckChair','bed','table'].includes(furniture.variant)?zMid:-(Number(furniture.depth)||depth)*.06;
  let seatSlot=0;
  if(furniture.variant==='sofa'){
   const count=Math.max(1,Math.min(4,Math.round(Number(furniture.seats)||2)));
   const cushionWidth=Number(furniture.width)||width;
   const slots=Array.from({length:count},(_,i)=>({index:i,x:-cushionWidth*.5+cushionWidth*(i+.5)/count}));
   const available=slots.filter(s=>!occupiedSlots.includes(s.index));
   if(!available.length)return null;
   available.sort((a,b)=>Math.abs(a.x-local.x)-Math.abs(b.x-local.x));
   seatSlot=available[0].index;localX=available[0].x;
  }else if(occupiedSlots.length)return null;

  angle=Math.PI;
  const spot=target.localToWorld(new THREE.Vector3(localX,top,localZ));
  const forward=new THREE.Vector3(0,0,-1).applyQuaternion(face);
  const yaw=Math.atan2(forward.x,forward.z);
  const distance=Math.hypot(spot.x-robotPosition.x,spot.z-robotPosition.z);
  return Number.isFinite(spot.y)&&distance<2.1&&spot.y-robotPosition.y>.20&&spot.y-robotPosition.y<1.35?{spot,yaw,height:spot.y,targetId:target.userData.editorId,seatSlot,reclined:['sunbed','deckChair'].includes(furniture.variant),reclineDeg:Number(furniture.reclineDeg)||0}:null;
 }
 // General flat shapes: choose the edge nearest to the avatar, not always +Z.
 const edges=[{d:Math.abs(local.x-localBounds.min.x),x:localBounds.min.x+.23,z:zMid,yaw:-Math.PI/2},
  {d:Math.abs(local.x-localBounds.max.x),x:localBounds.max.x-.23,z:zMid,yaw:Math.PI/2},
  {d:Math.abs(local.z-localBounds.min.z),x:xMid,z:localBounds.min.z+.23,yaw:Math.PI},
  {d:Math.abs(local.z-localBounds.max.z),x:xMid,z:localBounds.max.z-.23,yaw:0}].sort((a,b)=>a.d-b.d);
 const edge=edges[0];localX=edge.x;localZ=edge.z;angle=edge.yaw;
 // Test the actual visible surface rather than trusting an encompassing AABB
 // (e.g. open boxes, irregular models or ring-shaped mesh bounds).
 const origin=target.localToWorld(new THREE.Vector3(localX,localBounds.max.y+1,localZ));
 const ray=new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0),0,Math.max(2,size.y+2));
 const hits=ray.intersectObject(target,true).filter(hit=>{
  if(!hit.face||!hit.object?.isMesh)return false;
  const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  return normal.y>=.85;
 });
 if(!hits.length)return null;
 const spot=hits[0].point;
 const worldFace=new THREE.Vector3(Math.sin(angle),0,Math.cos(angle)).applyQuaternion(face);
 const distance=Math.hypot(spot.x-robotPosition.x,spot.z-robotPosition.z);
 return distance<2.1&&spot.y-robotPosition.y>.20&&spot.y-robotPosition.y<1.35?{spot,yaw:Math.atan2(worldFace.x,worldFace.z),height:spot.y,targetId:target.userData.editorId}:null;
}
export function takeSeat(robot,target,editor){
 if(!robot||!target||!editor?.canEdit?.(robot))return false;
 const occupying=(editor.items||[]).filter(other=>other!==robot&&other.userData?.robotSeated&&other.userData.robotSeatedTarget===target.userData.editorId);
 const slots=occupying.map(other=>Number.isInteger(other.userData.robotSeatState?.slot)?other.userData.robotSeatState.slot:other.userData.robotSeatSlot??0);
 const plan=seatPlan(target,robot.position,slots);if(!plan)return false;
 // Anchor the avatar in front of the visible seat, not in empty space.
 robot.position.x=plan.spot.x;robot.position.z=plan.spot.z;
 robot.rotation.y=plan.yaw;robot.userData.robotSeated=true;
 const clip=sittingClip(robot.userData.robotAvailableActions);
 const recline=plan.reclined;const lying=(robot.userData.robotAvailableActions||[]).find(n=>/^(?:lying|lie down|reclining|lay down)(?:__\d+)?$/i.test(String(n)));
 robot.userData.robotSitPose=recline?(lying?'clip':'reclined'):(clip?'clip':'procedural');
 robot.userData.robotReclineAngle=recline?THREE.MathUtils.degToRad(Math.max(0,85-plan.reclineDeg)):0;
 robot.userData.robotMode=recline?(lying?'clip:'+lying:'idle'):(clip||'idle');robot.userData.robotPlaying=null;
 robot.userData.robotSeatedTarget=plan.targetId;
 target.updateWorldMatrix?.(true,false);
 robot.userData.robotSeatSlot=plan.seatSlot??0;
 robot.userData.robotSeatState={targetId:plan.targetId,local:target.worldToLocal(robot.position.clone()).toArray(),yawRelative:robot.rotation.y-new THREE.Euler().setFromQuaternion(target.getWorldQuaternion(new THREE.Quaternion()),'YXZ').y,slot:plan.seatSlot??0};
 robot.userData.robotSeatTargetPose=[target.position.x,target.position.y,target.position.z,target.quaternion.x,target.quaternion.y,target.quaternion.z,target.quaternion.w,target.scale.x,target.scale.y,target.scale.z];
 editor.physics?.applyEditedPose?.(robot);
 editor.queueSave?.(robot);
 return true;
}
// Stable seat anchors in furniture-local coordinates. The editor applies these
// after Rapier each frame so translated/rotated/dynamically pushed furniture and
// its occupants are visually and physically synchronised without parent reparenting.
export function followFurnitureSeats(editor){
 if(!editor?.items)return 0;
 let updated=0;
 for(const bot of editor.items){
  if(bot.userData?.editorKind!=='robot'||!bot.userData.robotSeated)continue;
  const seat=bot.userData.robotSeatState;
  const target=editor.items.find(item=>item.userData?.editorId===bot.userData.robotSeatedTarget);
  if(!target){standUp(bot,editor);continue;}
  if(!seat||seat.targetId!==target.userData.editorId||!Array.isArray(seat.local)||seat.local.length!==3)continue;
  target.updateWorldMatrix?.(true,false);
  const pose=[target.position.x,target.position.y,target.position.z,target.quaternion.x,target.quaternion.y,target.quaternion.z,target.quaternion.w,target.scale.x,target.scale.y,target.scale.z];
  const previous=bot.userData.robotSeatTargetPose;
  bot.userData.robotSeatTargetPose=pose;
  const furnitureMoved=Array.isArray(previous)&&pose.some((n,i)=>Math.abs(n-previous[i])>1e-5);
  const worldPosition=target.localToWorld(new THREE.Vector3(...seat.local));
  const yaw=new THREE.Euler().setFromQuaternion(target.getWorldQuaternion(new THREE.Quaternion()),'YXZ').y+seat.yawRelative;
  const moved=bot.position.distanceToSquared(worldPosition)>0.000001||Math.abs(Math.atan2(Math.sin(bot.rotation.y-yaw),Math.cos(bot.rotation.y-yaw)))>.0001;
  if(target.userData.furniture?.seatMoveMode!=='follow'&&furnitureMoved){standUp(bot,editor);continue;}
  if(!moved)continue;
  bot.position.copy(worldPosition);bot.rotation.y=yaw;
  if(editor.physics?.owns?.(bot)!==false)editor.physics?.applyEditedPose?.(bot);
  if(furnitureMoved&&editor.canEdit?.(bot))editor.queueSave?.(bot);
  updated++;
 }
 return updated;
}
// Convert the robot's facing into a ray through the seat's local footprint.
// The exit distance accounts for rotation/scale and adds capsule clearance.
// Keep world Y and yaw unchanged; Rapier/grounding own the vertical position.
// Use the seat's own -Z front, not the avatar's animated heading, which may
// rotate when a Sit animation starts. The entire chair/sofa footprint plus
// capsule radius must be cleared before the seated pose is released.
export function standClearancePosition(robot,target,margin=.72){
 if(!robot||!target)return null;
 target.updateWorldMatrix?.(true,true);
 const footprint=new THREE.Box3();
 target.traverse?.(part=>{
  if(!part.geometry?.boundingBox)part.geometry?.computeBoundingBox?.();
  if(!part.geometry?.boundingBox)return;
  const matrix=new THREE.Matrix4().copy(target.matrixWorld).invert().multiply(part.matrixWorld);
  footprint.union(part.geometry.boundingBox.clone().applyMatrix4(matrix));
 });
 if(footprint.isEmpty())return null;
 const current=target.worldToLocal(robot.position.clone());
 const scale=target.getWorldScale(new THREE.Vector3());
 const clearance=margin/Math.max(.01,Math.abs(scale.z));
 const exit=(target.localToWorld||((p)=>p)).call(target,new THREE.Vector3(
  Math.max(footprint.min.x,Math.min(footprint.max.x,current.x)),
  current.y,footprint.min.z-clearance));
 return new THREE.Vector3(exit.x,robot.position.y,exit.z);
}
// Probe real geometry under the new standing position, excluding the seat
// itself. Prefer the nearest upward-facing floor and preserve upper storeys.
export function floorSupportY(editor,position,excluded=null){
 if(!position||!editor?.items||typeof THREE.Raycaster!=='function')return null;
 const origin=new THREE.Vector3(position.x,position.y+1.2,position.z),direction=new THREE.Vector3(0,-1,0);
 const ray=new THREE.Raycaster(origin,direction,0,4.2);
 const solids=[];
 for(const item of editor.items){
  if(item===excluded||item.userData?.editorKind==='robot'||item.userData?.editorKind==='media')continue;
  if(item.userData?.editorKind==='wall'||item.userData?.editorKind==='stairs'||item.userData?.editorKind==='furniture'&&['groundPlot','cropBed','waterPatch','vegetationArea'].includes(item.userData.furniture?.variant))solids.push(item);
 }
 if(editor.world?.floor)solids.push(editor.world.floor);
 const hits=ray.intersectObjects(solids,true);
 for(const hit of hits){
  if(hit.object?.userData?.wallGlass||hit.object?.userData?.wallWindowButton||hit.object?.userData?.wallRoofPanel)continue;
  const normal=hit.face?.normal?.clone().transformDirection(hit.object.matrixWorld);
  if(normal&&normal.y<.65)continue;
  if(hit.point.y<=position.y+.75&&hit.point.y>=position.y-2.9)return hit.point.y;
 }
 return null;
}
export function restoreSeatedRobots(editor){
 if(!editor?.items)return 0;
 let restored=0;
 for(const robot of editor.items){
  if(robot.userData?.editorKind!=='robot')continue;
  const seat=robot.userData.robotSeatState;
  if(!robot.userData.robotSeated||!seat?.targetId||!Array.isArray(seat.local)||seat.local.length!==3)continue;
  const target=editor.items.find(item=>item.userData?.editorId===seat.targetId);
  if(!target){robot.userData.robotSeated=false;robot.userData.robotSeatState=null;robot.userData.robotSeatedTarget=null;continue;}
  target.updateWorldMatrix?.(true,false);
  robot.position.copy(target.localToWorld(new THREE.Vector3(...seat.local)));
  robot.rotation.y=new THREE.Euler().setFromQuaternion(target.getWorldQuaternion(new THREE.Quaternion()),'YXZ').y+(Number(seat.yawRelative)||0);
  robot.userData.robotSeatedTarget=seat.targetId;
  robot.userData.robotSeatSlot=seat.slot??0;
  const names=robot.userData.robotAvailableActions||[];
  const clip=sittingClip(names);
  const variant=target.userData.furniture?.variant;
  const reclined=['sunbed','deckChair'].includes(variant);
  robot.userData.robotSitPose=clip?'clip':reclined?'reclined':'procedural';
  robot.userData.robotMode=clip||'idle';robot.userData.robotPlaying=null;
  robot.userData.robotSeatTargetPose=[target.position.x,target.position.y,target.position.z,target.quaternion.x,target.quaternion.y,target.quaternion.z,target.quaternion.w,target.scale.x,target.scale.y,target.scale.z];
  editor.physics?.applyEditedPose?.(robot);restored++;
 }
 return restored;
}
export function repairLoadedRobotElevation(editor){
 if(!editor?.items)return 0;
 let recovered=0;
 for(const bot of editor.items){
  if(bot.userData?.editorKind!=='robot'||bot.userData.robotSeated||bot.userData.robotLadderRide||bot.userData.liftRide)continue;
  const support=floorSupportY(editor,bot.position);
  if(support===null||!Number.isFinite(support))continue;
  const difference=support-bot.position.y;
  if(difference>.09&&difference<1.35){
   bot.position.y=support+.035;
   bot.userData.physicsAirborne=false;bot.userData.robotFallActive=false;bot.userData.robotJumpActive=false;
   bot.userData.robotReaction=null;bot.userData.robotMode='idle';bot.userData.robotPlaying=null;
   editor.physics?.applyEditedPose?.(bot);recovered++;
  }
 }
 return recovered;
}
export function standUp(robot,editor){
 if(!robot?.userData?.robotSeated)return false;
 const target=editor?.items?.find(o=>o.userData.editorId===robot.userData.robotSeatedTarget);
 const clearPosition=standClearancePosition(robot,target);
 if(clearPosition){robot.position.x=clearPosition.x;robot.position.z=clearPosition.z;}
 const support=floorSupportY(editor,robot.position,target);
 if(support!==null)robot.position.y=support+.035;
 else if(editor?.world?.floor&&!editor?.physics?.enabled){
  const y=Number(editor.world.floor.position?.y)||0;
  robot.position.y=y;
 }
 // Correct the simulated capsule as soon as the robot leaves the seat.
 if(clearPosition||editor?.physics?.enabled||editor?.world?.floor)editor?.physics?.applyEditedPose?.(robot);
 robot.userData.robotSeated=false;robot.userData.robotSitPose=null;robot.userData.robotReclineAngle=0;robot.userData.robotSeatState=null;robot.userData.robotSeatSlot=null;robot.userData.robotSeatTargetPose=null;
 robot.userData.robotSeatedTarget=null;robot.userData.robotMode='idle';
 robot.userData.robotPlaying=null;
 // The aligned yaw is intentionally retained when standing up.
 editor?.queueSave?.(robot);return true;
}
