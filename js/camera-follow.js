/** Pure camera geometry helpers; Three.js and the renderer stay in world.js. */
export const CAMERA_FOLLOW_MODES=Object.freeze(['free','chase','orbit']);
export function nextCameraMode(mode){
  const i=CAMERA_FOLLOW_MODES.indexOf(mode);
  return CAMERA_FOLLOW_MODES[(i+1)%CAMERA_FOLLOW_MODES.length];
}
export function followAnchor(robot,eyeHeight=1.38){
  return {x:robot.position.x,y:robot.position.y+eyeHeight,z:robot.position.z};
}
export function rotateByYaw(offset,yaw){
  const c=Math.cos(yaw),s=Math.sin(yaw);
  return {x:c*offset.x+s*offset.z,y:offset.y,z:-s*offset.x+c*offset.z};
}
export function localOrbitOffset(camera,anchor,yaw){
  const delta={x:camera.x-anchor.x,y:camera.y-anchor.y,z:camera.z-anchor.z};
  return rotateByYaw(delta,-yaw);
}
export function cameraFromLocalOffset(anchor,localOffset,yaw){
  const rotated=rotateByYaw(localOffset,yaw);
  return {x:anchor.x+rotated.x,y:anchor.y+rotated.y,z:anchor.z+rotated.z};
}
export function chaseOffset(distance){
  const d=Math.max(2.8,Math.min(18,Number(distance)||5));
  return {x:0,y:Math.max(1.25,Math.min(4,d*.24)),z:-d};
}
export function smoothFactor(dt,response){
  return 1-Math.exp(-Math.max(0,dt)*Math.max(0,response));
}
