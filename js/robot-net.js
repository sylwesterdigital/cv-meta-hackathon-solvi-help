// Quantised movement intent, not repeated transforms or GLB/animation states.
export function intent(keys){
 const forward=Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown'));
 const turn=Number(keys.has('ArrowLeft'))-Number(keys.has('ArrowRight'));
 const run=keys.has('ShiftLeft')||keys.has('ShiftRight');
 return {f:forward,t:turn,r:run?1:0};
}
export function active(i){return Boolean(i&&(i.f||i.t));}
export function signedAngle(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
export function stepIntent(x,z,yaw,i,dt){
 const time=Math.max(0,Math.min(.065,Number(dt)||0));
 const nextYaw=yaw+(i.t||0)*1.9*time;
 const speed=(i.r?2.8:1.2)*(i.f||0);
 return {x:x+Math.sin(nextYaw)*speed*time,z:z+Math.cos(nextYaw)*speed*time,yaw:nextYaw};
}
export function packetFor(id,i,object,final=false){return {type:'robot-input',id,f:i.f,t:i.t,r:i.r,m:final?0:1,
  x:+object.position.x.toFixed(2),z:+object.position.z.toFixed(2),y:+object.position.y.toFixed(2),yaw:+object.rotation.y.toFixed(3)};}
