// Predictable robot controls: compact key-change packets, local acceleration,
// signed forward/reverse velocity, avatar-calibrated steering in both gears.
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const approach=(value,target,step)=>value<target?Math.min(value+step,target):Math.max(value-step,target);
export function intent(keys){
 const f=Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown'));
 // Actual avatar meshes use the opposite steering sense from the generic
 // yaw convention. Map user LEFT to positive yaw and RIGHT to negative yaw
 // here, once, so local movement and WebSocket packets share this calibration.
 const t=Number(keys.has('ArrowLeft'))-Number(keys.has('ArrowRight'));
 const r=keys.has('ShiftLeft')||keys.has('ShiftRight')?1:0;
 return {f,t,r,b:f<0?1:0};
}
export function active(i){return Boolean(i&&(i.f||i.t));}
export function signedAngle(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
export function stepRobotMotion(state,input,dt){
 const time=clamp(Number(dt)||0,0,.065);
 const speedFactor=clamp(Number(input?.s)||1,.35,3);
 const target=(Number(input?.f)||0)*(input?.r?2.8:1.2)*speedFactor;
 const oldVelocity=Number(state.velocity)||0;
 // Braking and reversal take place before accelerating in the opposite direction.
 const braking=oldVelocity*target<0||Math.abs(target)<.001;
 const velocity=approach(oldVelocity,target,(braking?6.8:4.2)*speedFactor*time);
 // No turning while stationary; more speed gives stronger, smoothly limited steering.
 const steerTarget=clamp(Number(input?.t)||0,-1,1);
 // Steering wheel inertia: no instant angular jumps on key press/release.
 const isStrafing=Math.abs(velocity)<.025&&Math.abs(Number(input?.f)||0)<.001;
 const steer=approach(Number(state.steer)||0,isStrafing?0:steerTarget,time*(steerTarget?6:8));
 // Smooth side-step when stationary: keep the avatar looking forward.
 // The default GLB is visually turned 180 degrees relative to the root's
 // +Z movement convention. Its visible LEFT is +X at yaw=0; unlike turn
 // input, lateral input must therefore have the SAME sign as ArrowLeft.
 // Keep this mapping shared by local prediction and remote replay.
 const strafeFactor=clamp(Number(input?.q)||1.8,.5,4);
 const lateralTarget=isStrafing?steerTarget*.85*speedFactor*strafeFactor:0;
 const lateral=approach(Number(state.lateral)||0,lateralTarget,(lateralTarget?4.4:6.2)*speedFactor*time);
 const steerStrength=clamp(Math.abs(velocity)/(.9*speedFactor),0,1);
 const angularRate=(.55+.95*steerStrength)*steerStrength;
 // The input sign is calibrated to match the on-screen avatar steering:
 // left raises yaw, right lowers it. Reversing only flips translation;
 // it must NOT flip the heading or turn the avatar around by 180 degrees.
 const yaw=Number(state.yaw||0)+steer*angularRate*time;
 return {x:(Number(state.x)||0)+(Math.sin(yaw)*velocity+Math.cos(yaw)*lateral)*time,
  z:(Number(state.z)||0)+(Math.cos(yaw)*velocity-Math.sin(yaw)*lateral)*time,yaw,velocity,steer,lateral};
}
// Convenience wrapper for older client consumers; stateful simulation uses stepRobotMotion.
export function stepIntent(x,z,yaw,input,dt){return stepRobotMotion({x,z,yaw,velocity:Number(input?.v)||0},input,dt);}
export function packetFor(id,i,object,final=false){return {type:'robot-input',id,f:i.f,t:i.t,r:i.r,b:i.b||0,m:final?0:1,
  x:+object.position.x.toFixed(2),z:+object.position.z.toFixed(2),y:+object.position.y.toFixed(2),yaw:+object.rotation.y.toFixed(3),s:+(i.s||1).toFixed(2),q:+(i.q||1.8).toFixed(2),j:i.j?1:0};}

// Integrate the same input on every client and blend *one-off residual errors*.
// Unlike chasing a fixed packet position every frame, this never drags a moving
// avatar backwards between network packets.
export function makeRemoteCorrection(current,packet){
 const dx=packet.x-current.x,dz=packet.z-current.z,dyaw=signedAngle(packet.yaw,current.yaw);
 return {dx,dz,dyaw};
}
export function applyRemoteCorrection(state,correction,dt){
 const time=clamp(Number(dt)||0,0,.08),distance=Math.hypot(correction.dx,correction.dz);
 if(distance>8){return {x:state.x+correction.dx,z:state.z+correction.dz,yaw:state.yaw+correction.dyaw,
  residual:{dx:0,dz:0,dyaw:0},done:true,teleport:true};}
 const alpha=1-Math.exp(-time*8);
 const gain=distance>0?Math.min(alpha,Math.min(3*time/distance,1)):alpha;
 const xAdjust=correction.dx*gain,zAdjust=correction.dz*gain,yawAdjust=correction.dyaw*alpha;
 const residual={dx:correction.dx-xAdjust,dz:correction.dz-zAdjust,dyaw:correction.dyaw-yawAdjust};
 return {x:state.x+xAdjust,z:state.z+zAdjust,yaw:state.yaw+yawAdjust,residual,
  done:Math.hypot(residual.dx,residual.dz)<.008&&Math.abs(residual.dyaw)<.008,teleport:false};
}
