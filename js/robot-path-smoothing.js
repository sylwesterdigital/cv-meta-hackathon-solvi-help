// Optional route cleanup AFTER SOLVI's checked A* planner. First remove grid
// zigzags using a true line-of-sight/string-pull pass. Only then round genuine
// obstacle-detour corners. Neither step is permitted to enter an inflated
// scene footprint. The original A* route is retained on any unsafe candidate.
import {pathBlocked} from './robot-pathfinding.js';

const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Continuous segment-vs-expanded-AABB check: unlike a sparse sampled ray,
// this cannot accidentally jump over a thin wall or a corner at any speed.
export function robotSegmentClear(a,b,obstacles=[],clearance=.30){
 if(!finite(a)||!finite(b))return false;
 const dx=b.x-a.x,dz=b.z-a.z;
 for(const o of obstacles){
  if(![o.minX,o.maxX,o.minZ,o.maxZ].every(Number.isFinite))continue;
  let lo=0,hi=1;
  for(const [origin,delta,min,max] of [[a.x,dx,o.minX-clearance,o.maxX+clearance],[a.z,dz,o.minZ-clearance,o.maxZ+clearance]]){
   if(Math.abs(delta)<1e-10){if(origin<min||origin>max){lo=2;break;}continue;}
   const t1=(min-origin)/delta,t2=(max-origin)/delta;
   lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));
   if(lo>hi)break;
  }
  if(lo<=hi)return false;
 }
 return true;
}

// Greedily connect each retained point to the farthest visible later point.
// The A* output remains authoritative; this NEVER modifies its final target.
export function shortcutRobotWaypoints(start,waypoints,obstacles=[],options={}){
 if(!finite(start)||!Array.isArray(waypoints)||waypoints.some(p=>!finite(p))||waypoints.length<2||waypoints.length>220)return waypoints;
 const clearance=clamp(Number(options.clearance)||.30,.2,.65);
 // A* supports a short 'escape' from an obstacle's clearance pad. Do not
 // shortcut that exceptional departure without the planner's escape rules.
 if(pathBlocked(start.x,start.z,obstacles,clearance))return waypoints;
 const points=[{x:start.x,z:start.z},...waypoints.map(p=>({x:p.x,z:p.z}))];
 const output=[];let i=0;
 while(i<points.length-1){
  let target=i+1;
  // Limit worst-case work on very long routes while still removing all small
  // alternating A* grid bends. Longer straight runs are joined in chunks.
  const end=Math.min(points.length-1,i+64);
  for(let j=end;j>i+1;j--){if(robotSegmentClear(points[i],points[j],obstacles,clearance)){target=j;break;}}
  if(!robotSegmentClear(points[i],points[target],obstacles,clearance))return waypoints;
  output.push(points[target]);i=target;
 }
 return output.length<waypoints.length?output:waypoints;
}

export function smoothRobotWaypoints(start,waypoints,obstacles=[],options={}){
 if(!finite(start)||!Array.isArray(waypoints)||waypoints.some(p=>!finite(p))||waypoints.length<2||waypoints.length>220)return waypoints;
 const clearance=clamp(Number(options.clearance)||.30,.2,.65);
 const radius=clamp(Number(options.radius)||.34,.08,.65);
 const resolution=clamp(Number(options.resolution)||.095,.06,.16);
 const simplified=shortcutRobotWaypoints(start,waypoints,obstacles,{clearance});
 const source=[{x:start.x,z:start.z},...simplified.map(p=>({x:p.x,z:p.z}))];
 // A clear straight line needs exactly ONE waypoint, not rounded zigzags.
 if(source.length<=2)return simplified;
 const clear=(a,b)=>robotSegmentClear(a,b,obstacles,clearance);
 const rounded=[];let changed=0;
 for(let i=1;i<source.length-1;i++){
  const prev=source[i-1],corner=source[i],next=source[i+1];
  const before=dist(prev,corner),after=dist(corner,next);
  if(before<.2||after<.2){rounded.push(corner);continue;}
  const inX=(corner.x-prev.x)/before,inZ=(corner.z-prev.z)/before;
  const outX=(next.x-corner.x)/after,outZ=(next.z-corner.z)/after;
  const dot=clamp(inX*outX+inZ*outZ,-1,1);
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
  const lead=rounded.at(-1)||source[0];
  if(!clear(lead,entry)||curve.slice(1).some((p,j)=>!clear(curve[j],p))){rounded.push(corner);continue;}
  rounded.push(...curve);changed++;
 }
 if(!changed)return simplified;
 rounded.push(source.at(-1));
 let previous=source[0];
 for(const point of rounded){if(!clear(previous,point))return simplified;previous=point;}
 if(rounded.length>850)return simplified;
 return rounded;
}

// Keep required reconnaissance bends exactly, but remove all redundant A*
// zigzags BETWEEN them. Movement progress still reaches each checkpoint at
// its original world coordinates so its camera observation can be triggered.
export function smoothRobotWaypointsWithCheckpoints(start,waypoints,obstacles=[],checkpoints=[],options={}){
 if(!finite(start)||!Array.isArray(waypoints)||!Array.isArray(checkpoints)||!checkpoints.length)
  return smoothRobotWaypoints(start,waypoints,obstacles,options);
 const result=[];let from=0,origin=start;
 for(const checkpoint of checkpoints){
  const index=waypoints.findIndex((point,i)=>i>=from&&finite(point)&&dist(point,checkpoint)<.15);
  if(index<from)return waypoints; // Reject any inconsistent checkpoint plan.
  const section=waypoints.slice(from,index+1);
  result.push(...smoothRobotWaypoints(origin,section,obstacles,options));
  origin=waypoints[index];from=index+1;
 }
 if(from<waypoints.length)result.push(...smoothRobotWaypoints(origin,waypoints.slice(from),obstacles,options));
 return result.length&&dist(result.at(-1),waypoints.at(-1))<1e-6?result:waypoints;
}
