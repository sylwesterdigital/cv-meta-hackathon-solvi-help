// Bounded, planar capsule separation. Motion is rejected rather than teleported through obstacles.
export function robotPushVector(actorNext,target,minimum=0.68,maxStep=.14){
 const dx=target.x-actorNext.x,dz=target.z-actorNext.z;
 const distance=Math.hypot(dx,dz);
 if(distance>=minimum)return null;
 const radius=Math.max(0,Math.min(maxStep,minimum-distance+.015));
 if(radius<.001)return null;
 const normal=distance>.001?{x:dx/distance,z:dz/distance}:{x:1,z:0};
 return {x:normal.x*radius,z:normal.z*radius,speed:radius};
}
export function pushedWalkState(positionDelta,yaw,dt){
 const speed=Math.hypot(positionDelta.x,positionDelta.z)/Math.max(.016,dt);
 const forward=positionDelta.x*Math.sin(yaw)+positionDelta.z*Math.cos(yaw);
 const lateral=positionDelta.x*Math.cos(yaw)-positionDelta.z*Math.sin(yaw);
 const kind=speed<.06?'idle':Math.abs(lateral)>Math.abs(forward)*1.15?(lateral>0?'strafeRight':'strafeLeft'):forward<0?'walkBackward':'walk';
 return {kind,rate:Math.max(.9,Math.min(2.3,speed/1.2)),speed};
}
