import {projectPath,pathAt} from './stair-extensions.js';
// Pure support and synchronisation helpers shared by scene and headset transport.
export function conveyorSupport(local,top,width,{jumping=false,margin=.11}={}){
 if(jumping||!local||![local.x,local.y,local.z,top,width].every(Number.isFinite))return false;
 return width>.3&&Math.abs(local.y-top)<.38;
}
export function xrCabinSupport(local,footprint,cabinHeight){
 if(!local||!footprint||![local.x,local.y,local.z,footprint.width,footprint.depth,cabinHeight].every(Number.isFinite))return false;
 // The tracked eye is above the feet, unlike robot foot-origin positions.
 return Math.abs(local.x)<footprint.width/2-.13&&Math.abs(local.z)<footprint.depth/2-.13&&
  local.y>.45&&local.y<cabinHeight+.45;
}
// Displacement on one actual conveyor tread. Both robot feet and XR standing
// surfaces use this calculation; the eye's height must never be treated as a foot.
export function conveyorStep(local,config,segments,dt){
 if(!local||!Array.isArray(segments)||!segments.length||!config||!Number.isFinite(dt)||dt<=0)return null;
 const path=config.points||[],projected=projectPath(path,local.x,local.z);
 if(!projected||projected.distance>config.width/2-.11)return null;
 const index=Math.min(segments.length-1,Math.max(0,Math.floor(projected.along/Math.max(.001,projected.total)*segments.length)));
 const top=segments[index].top;
 if(!conveyorSupport(local,top,config.width))return null;
 const speed=Math.min(2.5,Math.max(.05,config.transport?.speed||.5));
 const along=Math.max(0,Math.min(projected.total,projected.along+Math.min(.05,dt)*speed*(config.transport?.direction===-1?-1:1)));
 const next=pathAt(path,along),previous=pathAt(path,projected.along);
 if(!next||!previous)return null;
 const nextIndex=Math.min(segments.length-1,Math.max(0,Math.floor(along/Math.max(.001,projected.total)*segments.length)));
 return {x:next.x-previous.x,y:segments[nextIndex].top-local.y,z:next.z-previous.z};
}
// Eye height is controlled by the user and must not be assumed to be 1.6 m.
// The XR reference space tracks the user's virtual standing-surface elevation.
export function xrConveyorFoot(head,standingY){
 if(!head||![head.x,head.y,head.z,standingY].every(Number.isFinite))return null;
 if(head.y-standingY<.35||head.y-standingY>2.8)return null;
 return {x:head.x,y:standingY,z:head.z};
}
// Common wall-clock phase keeps visual markers aligned on separate clients,
// without emitting per-frame scene edits or updating physics geometry.
export function conveyorPhase(speed,direction,now=Date.now()){
 if(!Number.isFinite(speed)||speed<=0||!Number.isFinite(now))return 0;
 const phase=now/1000*speed*(direction===-1?-1:1);
 return ((phase%1)+1)%1;
}

// Only the owning client can carry and publish the robot's new pose. The
// contact is refreshed every transport tick, before character gravity runs.
export function supportedConveyorRobot(object,editor){
 const ride=object?.userData?.conveyorRide;
 if(!ride||object.userData.robotJumpActive||Number.isFinite(object.userData.jumpVel)&&object.userData.jumpVel>0)return null;
 return editor?.items?.find(item=>item.userData.editorId===ride.id&&
  ['walkway','escalator'].includes(item.userData.stairs?.variant)&&
  item.userData.stairs.transport?.enabled!==false)||null;
}
