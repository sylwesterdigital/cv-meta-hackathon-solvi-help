// Optional corner rounding AFTER SOLVI's collision-checked A* route is computed.
// This never gives the robot a new destination or changes the route planner.
// Curve samples and every resulting segment must clear the original obstacles.
import {pathBlocked} from './robot-pathfinding.js';

const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function smoothRobotWaypoints(start,waypoints,obstacles=[],options={}){
 if(!finite(start)||!Array.isArray(waypoints)||waypoints.some(p=>!finite(p))||waypoints.length<2||waypoints.length>220)return waypoints;
 const radius=clamp(Number(options.radius)||.34,.08,.65);
 const clearance=clamp(Number(options.clearance)||.30,.2,.65);
 const resolution=clamp(Number(options.resolution)||.095,.06,.16);
 const source=[{x:start.x,z:start.z},...waypoints.map(p=>({x:p.x,z:p.z}))];
 const clear=(a,b)=>{
  const samples=Math.max(1,Math.ceil(dist(a,b)/resolution));
  for(let i=0;i<=samples;i++){
   const p=lerp(a,b,i/samples);
   if(pathBlocked(p.x,p.z,obstacles,clearance))return false;
  }
  return true;
 };
 const rounded=[];
 let changed=0;
 for(let i=1;i<source.length-1;i++){
  const prev=source[i-1],corner=source[i],next=source[i+1];
  const before=dist(prev,corner),after=dist(corner,next);
  if(before<.2||after<.2){rounded.push(corner);continue;}
  const inX=(corner.x-prev.x)/before,inZ=(corner.z-prev.z)/before;
  const outX=(next.x-corner.x)/after,outZ=(next.z-corner.z)/after;
  const dot=clamp(inX*outX+inZ*outZ,-1,1);
  // Avoid needless samples on straight runs and smoothing U-turns.
  if(dot>.986||dot<-.84){rounded.push(corner);continue;}
  const trim=Math.min(radius,before*.30,after*.30);
  if(trim<.055){rounded.push(corner);continue;}
  const entry={x:corner.x-inX*trim,z:corner.z-inZ*trim};
  const exit={x:corner.x+outX*trim,z:corner.z+outZ*trim};
  const count=clamp(Math.ceil(trim*2/resolution),4,12);
  const curve=[entry];
  for(let j=1;j<=count;j++){
   const t=j/count,u=1-t;
   curve.push({x:u*u*entry.x+2*u*t*corner.x+t*t*exit.x,
               z:u*u*entry.z+2*u*t*corner.z+t*t*exit.z});
  }
  // The old straight legs were checked by A*. Rounding a corner is allowed
  // only if the entire NEW arc (and the lead-in) remains collision-free.
  const lead=rounded.at(-1)||source[0];
  if(!clear(lead,entry)||curve.slice(1).some((p,j)=>!clear(curve[j],p))){rounded.push(corner);continue;}
  rounded.push(...curve);changed++;
 }
 if(!changed)return waypoints;
 rounded.push(source.at(-1));
 // Recheck all new segments. An unsafe candidate returns the exact A* route,
 // never a shortened/partially validated path. The first original leg may
 // begin inside a clearance pad; if so, preserve that first leg unsmoothed.
 let previous=source[0];
 for(const point of rounded){
  if(!clear(previous,point))return waypoints;
  previous=point;
 }
 if(rounded.length>850)return waypoints;
 // Preserve the exact goal and keep all motion continuous, not teleportation.
 return rounded;
}
