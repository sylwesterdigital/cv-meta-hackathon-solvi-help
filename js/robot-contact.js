// Capsule contact must be local to the two avatars. Proximity alone, a
// passing robot, or a movement packet for somebody else cannot trigger Push.
export const ROBOT_CONTACT_DISTANCE=0.68;
export function approachingRobotContact(actor,target,next,{minimum=ROBOT_CONTACT_DISTANCE,vertical=1.55}={}){
 const ax=Number(actor?.x),az=Number(actor?.z),ay=Number(actor?.y)||0;
 const bx=Number(target?.x),bz=Number(target?.z),by=Number(target?.y)||0;
 const nx=Number(next?.x),nz=Number(next?.z);
 if(![ax,az,bx,bz,nx,nz].every(Number.isFinite))return false;
 if(Math.abs(ay-by)>vertical)return false; // capsules on different floors
 const before=Math.hypot(bx-ax,bz-az),after=Math.hypot(bx-nx,bz-nz);
 // Only the actual overlap band is contact. Approaching from two metres
 // away is not a push even if a larger animation/model AABB overlaps.
 if(before>minimum+.025||after>=before-.0005||after>minimum+.025)return false;
 const dx=nx-ax,dz=nz-az;
 return Math.hypot(dx,dz)>.001 && dx*(bx-ax)+dz*(bz-az)>0;
}
export function permittedRobotLocomotion(data,mode,now=0){
 if(!['walk','walkBackward','run','strafeLeft','strafeRight'].includes(mode))return true;
 // No other robot inherits the controlled avatar's intent or animation.
 const push=data.robotPushState;
 const physicallyPushed=Boolean(push&&now-push.at>=0&&now-push.at<420&&push.speed>.06);
 return Boolean(data.robotLocalMotion||data.robotRemoteMotion||data.robotGoal||data.robotMission||physicallyPushed);
}


// Automatic Push is a frontal, upper-body contact animation, not a response
// to nearby scenery. Every avatar is normalized to ~1.75m by hydrateRobot;
// callers can supply their scaled height. The 35-degree limit is measured
// relative to the actor's *facing*, never merely the direction of its walk.
export const PUSH_MAX_FACING_ANGLE=35;
export const PUSH_MIN_HEIGHT_FRACTION=.5;
const pushCosine=Math.cos(PUSH_MAX_FACING_ANGLE*Math.PI/180);
export function facingPushContact(actor,target,yaw,movement=null){
 const dx=Number(target?.x)-Number(actor?.x), dz=Number(target?.z)-Number(actor?.z);
 if(!Number.isFinite(dx)||!Number.isFinite(dz)||!Number.isFinite(yaw))return false;
 const distance=Math.hypot(dx,dz);
 if(distance<.005)return false;
 const fx=Math.sin(yaw),fz=Math.cos(yaw);
 if((dx*fx+dz*fz)/distance<pushCosine)return false;
 if(movement){
  const mx=Number(movement.x),mz=Number(movement.z),speed=Math.hypot(mx,mz);
  if(!Number.isFinite(speed)||speed<.001||((mx*fx+mz*fz)/speed)<pushCosine)return false;
 }
 return true;
}
export function sizeableFrontalPushContact(actor,bounds,yaw,movement,{robotHeight=1.75,contactReach=.39}={}){
 if(!actor||!bounds?.min||!bounds?.max||!Number.isFinite(robotHeight)||robotHeight<=0)return false;
 const b=bounds;
 if(![b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z,actor.x,actor.y,actor.z].every(Number.isFinite))return false;
 // A brick, even when pushed by Rapier, must not trigger full-body Pushing.
 if(b.max.y-b.min.y<=robotHeight*PUSH_MIN_HEIGHT_FRACTION)return false;
 // Exclude tall props on a separate floor and overhead objects.
 if(b.max.y<=actor.y+.10||b.min.y>=actor.y+robotHeight-.10)return false;
 // Nearest point on the obstacle surface, not its mesh pivot/centre. Works
 // for large walls/furniture whose pivot can be metres away from contact.
 const nearest={
  x:Math.max(b.min.x,Math.min(b.max.x,actor.x)),
  z:Math.max(b.min.z,Math.min(b.max.z,actor.z))
 };
 const distance=Math.hypot(nearest.x-actor.x,nearest.z-actor.z);
 if(distance<.005||distance>contactReach)return false;
 return facingPushContact(actor,nearest,yaw,movement);
}
