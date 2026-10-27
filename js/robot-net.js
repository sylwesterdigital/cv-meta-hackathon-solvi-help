// Movement intent: 1 event when a key changes, occasional correction snapshots, never geometry.
export function intent(keys){
 const forward=Number(keys.has('ArrowUp'))+Number(keys.has('ArrowDown'));
 const strafe=Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft'));
 const run=keys.has('ShiftLeft')||keys.has('ShiftRight');
 return {f:Math.min(1,forward),t:strafe,r:run?1:0,b:keys.has('ArrowDown')?1:0};
}
export function active(i){return Boolean(i&&(i.f||i.t));}
export function signedAngle(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
export function stepIntent(x,z,yaw,i,dt){
 const time=Math.max(0,Math.min(.065,Number(dt)||0));
 const speed=(i.r?2.8:1.2)*Math.max(.35,Math.min(3,Number(i.s)||1));
 const f=Number(i.f)||0,t=Number(i.t)||0;
 const factor=Math.hypot(f,t)||1;
 return {x:x+(Math.sin(yaw)*f+Math.cos(yaw)*t)/factor*speed*time,z:z+(Math.cos(yaw)*f-Math.sin(yaw)*t)/factor*speed*time,yaw};
}
export function packetFor(id,i,object,final=false){return {type:'robot-input',id,f:i.f,t:i.t,r:i.r,b:i.b||0,m:final?0:1,
  x:+object.position.x.toFixed(2),z:+object.position.z.toFixed(2),y:+object.position.y.toFixed(2),yaw:+object.rotation.y.toFixed(3),s:+(i.s||1).toFixed(2),j:i.j?1:0};}
