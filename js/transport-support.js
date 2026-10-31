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
