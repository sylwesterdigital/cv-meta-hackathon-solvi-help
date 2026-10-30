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
