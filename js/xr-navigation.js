// Pure, testable helpers for XR teleportation.
export function teleportOffset(current,destination,{vertical=false}={}){
 if(!current||!destination||![current.x,current.z,destination.x,destination.z].every(Number.isFinite)||vertical&&![current.y,destination.y].every(Number.isFinite))
   throw new TypeError('Teleport requires valid world X/Z positions');
 return {x:current.x-destination.x,y:vertical?current.y-destination.y:0,z:current.z-destination.z};
}
export function validTeleport(x,z,limit=16){
 return Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x)<=limit&&Math.abs(z)<=limit;
}
