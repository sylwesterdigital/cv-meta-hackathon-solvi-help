// Deterministic, engine-independent character state for Rapier kinematic controllers.
export const CHARACTER = Object.freeze({radius:.29,halfHeight:.61,centerY:.90,gravity:9.81,terminal:19,jumpSpeed:5.7,maxStep:.28,snapDistance:.20,slopeDegrees:48});
export function characterMotion(previous, desired, dt, jumping=false, config=CHARACTER){
  const time=Math.max(0,Math.min(.065,Number(dt)||0));
  const speedY=jumping?config.jumpSpeed:Math.max(-config.terminal,(Number(previous?.verticalSpeed)||0)-config.gravity*time);
  return {x:(Number(desired.x)||0)-(Number(previous.x)||0),y:speedY*time,
    z:(Number(desired.z)||0)-(Number(previous.z)||0),verticalSpeed:speedY};
}
export function resolveCharacterMotion(previous,computed,grounded,verticalSpeed){
  const movement={x:Number(computed?.x)||0,y:Number(computed?.y)||0,z:Number(computed?.z)||0};
  return {x:previous.x+movement.x,y:previous.y+movement.y,z:previous.z+movement.z,
    verticalSpeed:grounded&&verticalSpeed<0?0:movement.y<0&&movement.y>-0.00001?0:verticalSpeed,
    grounded:Boolean(grounded)};
}
export function easedRemotePose(pose,target,dt){
 const alpha=1-Math.exp(-Math.max(0,Math.min(.08,Number(dt)||0))*13);
 const lerp=(x,y)=>Number(x)+((Number(y)||0)-Number(x))*alpha;
 return {x:lerp(pose.x,target.x),y:lerp(pose.y,target.y),z:lerp(pose.z,target.z)};
}
