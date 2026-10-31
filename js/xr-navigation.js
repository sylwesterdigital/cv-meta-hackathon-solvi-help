// Pure, testable helpers for XR teleportation.
export function teleportOffset(current,destination,{vertical=false}={}){
 if(!current||!destination||![current.x,current.z,destination.x,destination.z].every(Number.isFinite)||vertical&&![current.y,destination.y].every(Number.isFinite))
   throw new TypeError('Teleport requires valid world X/Z positions');
 return {x:current.x-destination.x,y:vertical?current.y-destination.y:0,z:current.z-destination.z};
}
export function validTeleport(x,z,limit=16){
 return Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x)<=limit&&Math.abs(z)<=limit;
}
export const XR_TELEPORT_DEFAULT_DISTANCE=5;
export function xrTeleportRange(value){
 const number=Number(value);
 return Number.isFinite(number)?Math.max(2,Math.min(20,number)):XR_TELEPORT_DEFAULT_DISTANCE;
}
// All hits are ordered front-to-back and represent real, solid, visible
// surfaces (not handles, UI, robots or media overlays). Never skip a wall to
// teleport onto a floor behind it. The controller ray length and the viewer's
// actual distance to the target are *both* bounded.
export function selectXRLanding(hits,{controller,head,maxDistance=XR_TELEPORT_DEFAULT_DISTANCE,worldLimit=100,standingY=0,maxDrop=2.2,minUp=.55}={}){
 if(!Array.isArray(hits)||!controller||!head)return null;
 const range=xrTeleportRange(maxDistance);
 for(const hit of hits){
  const point=hit?.point;
  if(!point||![point.x,point.y,point.z,hit.distance,hit.normalY].every(Number.isFinite))continue;
  // The first solid face blocks further ray hits, even if it is not walkable.
  if(hit.distance>range+1e-4)return null;
  if(hit.walkable===false||hit.normalY<minUp)return null;
  if(!validTeleport(point.x,point.z,worldLimit))return null;
  if(Math.hypot(point.x-head.x,point.y-head.y,point.z-head.z)>range+.0001)return null;
  if(Number.isFinite(standingY)&&point.y<standingY-maxDrop)return null;
  return hit;
 }
 return null;
}
// A room-scale headset retains its real tracking height on elevated floors.
// Only the virtual standing surface changes, not the physical eye offset.
export function surfaceTeleportDestination(head,landing,standingY=0){
 if(!head||!landing||![head.x,head.y,head.z,landing.x,landing.y,landing.z,standingY].every(Number.isFinite))throw new TypeError('Invalid XR surface landing');
 return {x:landing.x,y:head.y+(landing.y-standingY),z:landing.z};
}
