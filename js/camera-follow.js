/** Pure camera geometry helpers; Three.js and the renderer stay in world.js. */
export const CAMERA_FOLLOW_MODES=Object.freeze(['free','chase','chase-smart','orbit']);
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
// Follow distance is a local visual preference: never sent through the room socket.
export const CHASE_MIN_DISTANCE=1.8;
export const CHASE_MAX_DISTANCE=35;
export function clampChaseDistance(distance, fallback=5){
  const d=Number(distance);
  return Math.min(CHASE_MAX_DISTANCE,Math.max(CHASE_MIN_DISTANCE,Number.isFinite(d)&&d>0?d:fallback));
}
export function zoomChaseDistance(distance,wheelDelta){
  // Exponential dolly works predictably for trackpad pixels and mouse-wheel notches.
  const delta=Math.max(-240,Math.min(240,Number(wheelDelta)||0));
  return clampChaseDistance(clampChaseDistance(distance)*Math.exp(delta*.0015));
}
export function chaseOffset(distance){
  const d=clampChaseDistance(distance);
  return {x:0,y:Math.max(1.1,Math.min(6,d*.24)),z:-d};
}
export function smoothFactor(dt,response){
  return 1-Math.exp(-Math.max(0,dt)*Math.max(0,response));
}

/** Hold the orbit azimuth during minor turns, follow larger headings smoothly. */
export function wrapAngle(a){return Math.atan2(Math.sin(a),Math.cos(a));}
export function chaseSmartStep(previous,heading,thresholdDeg=35,dt=1/60,engaged=false){
 const error=wrapAngle(heading-previous);
 const threshold=Math.max(5,Math.min(120,Number(thresholdDeg)||35))*Math.PI/180;
 const following=engaged?Math.abs(error)>.025:Math.abs(error)>threshold;
 return {yaw:following?wrapAngle(previous+error*smoothFactor(dt,3.2)):previous,engaged:following};
}
export function chaseSmartYaw(previous,heading,thresholdDeg=35,dt=1/60){return chaseSmartStep(previous,heading,thresholdDeg,dt).yaw;}

