// Ephemeral, server-relayed robot navigation poses. A remote renderer follows
// recent authoritative snapshots; it never reruns the owner's A* mission.
// Buffered interpolation preserves the actual detour geometry across clients.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const MODES=new Set(['idle','walk','run','wave','lift','conveyor']);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const deltaAngle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

export function robotPosePacket(robot,seq,mode){
 const {position:p,rotation:r}=robot;
 return {type:'robot-motion',id:robot.userData.editorId,seq,
  position:[+p.x.toFixed(3),+p.y.toFixed(3),+p.z.toFixed(3)],
  rotation:[0,+r.y.toFixed(4),0],mode:MODES.has(mode)?mode:'idle'};
}
export function validatedPose(packet){
 const p=packet?.position,r=packet?.rotation;
 if(!Array.isArray(p)||p.length!==3||!p.every(finite)||!Array.isArray(r)||r.length!==3||!r.every(finite)||
    p.some(n=>Math.abs(n)>1000000)||r.some(n=>Math.abs(n)>1000000)||!MODES.has(packet.mode))return null;
 const seq=packet.seq===undefined?0:packet.seq;
 if(!Number.isSafeInteger(seq)||seq<0||seq>2147483647)return null;
 return {x:p[0],y:p[1],z:p[2],yaw:r[1],mode:packet.mode,seq};
}
// Appending is immutable so state may be tested separately from the renderer.
export function appendRobotPose(stream,packet,now,current){
 const pose=validatedPose(packet);
 if(!pose||!finite(now))return stream;
 const previous=stream?.frames?.at(-1);
 if(stream&&packet.by===stream.by&&pose.seq&&stream.seq&&pose.seq<=stream.seq&&now-stream.received<=1700)return stream;
 // A reconnect, new controller or delayed/absent stream starts fresh.
 const restart=!previous||now-stream.received>1700||packet.by!==stream.by;
 const frames=restart?[]:[...stream.frames];
 if(!frames.length&&current&&[current.x,current.y,current.z,current.yaw].every(finite)){
  // Joining an already-moving robot may be metres away from the last saved
  // checkpoint. Never animate a fictitious line across a fence to catch up.
  const error=Math.hypot(current.x-pose.x,current.z-pose.z);
  if(error<2.2)frames.push({...current,mode:'idle',seq:0,at:now-145});
 }
 frames.push({...pose,at:now});
 return {frames:frames.slice(-7),received:now,seq:pose.seq,by:packet.by};
}
export function sampleRobotPose(stream,now,delay=145){
 if(!stream?.frames?.length||!finite(now))return null;
 const frames=stream.frames,t=now-clamp(delay,80,300);
 let a=frames[0],b=a;
 for(let i=1;i<frames.length;i++){
  b=frames[i];
  if(b.at>=t)break;
  a=b;
 }
 const end=frames.at(-1);
 if(t>=end.at){a=end;b=end;}
 const alpha=a===b?1:clamp((t-a.at)/Math.max(1,b.at-a.at),0,1);
 const x=a.x+(b.x-a.x)*alpha,y=a.y+(b.y-a.y)*alpha,z=a.z+(b.z-a.z)*alpha;
 const yaw=a.yaw+deltaAngle(b.yaw,a.yaw)*alpha;
 const stale=now-stream.received>1200;
 // At the idle endpoint, stop walking even if the preceding pose was 'walk'.
 const mode=stale?'idle':(a===b?b.mode:alpha>=.99?b.mode:
   (a.mode==='walk'||a.mode==='run'?a.mode:b.mode));
 const distance=Math.hypot(b.x-a.x,b.z-a.z);
 const moving=!stale&&((mode==='walk'||mode==='run')&&
   (distance>.003||now-stream.received<700));
 return {x,y,z,yaw,mode,moving,stale};
}
