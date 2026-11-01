// Stairways are directional destinations, not ordinary objects to approach
// from any face. points[0] is the low landing; stairSegments() raises tread
// height along points toward points.at(-1). No Three.js/browser dependency.
import {planRobotPath,pathBlocked,plannedPathLength} from './robot-pathfinding.js';

export function lowStairEntranceCandidates(stairs={}){
 const points=stairs?.points;
 if(!Array.isArray(points)||points.length<2)return [];
 const first=points[0];
 if(!Array.isArray(first)||first.length!==2||!first.every(Number.isFinite))return [];
 let dx=0,dz=0,length=0;
 for(let i=1;i<points.length;i++){
  const point=points[i];
  if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite))continue;
  dx=point[0]-first[0];dz=point[1]-first[1];length=Math.hypot(dx,dz);
  if(length>.10)break;
 }
 if(length<=.10)return [];
 const forward={x:dx/length,z:dz/length};
 const side={x:-forward.z,z:forward.x};
 const width=Math.max(.4,Math.min(4,Number(stairs.width)||1.1));
 const candidates=[];
 // The near step can occupy the first half-tread. Stand CLEAR of that
 // footprint, in the flat ground at the foot of the staircase.
 for(const distance of [.85,1.15,1.65,2.25]){
  for(const fraction of [0,-.22,.22]){
   const lateral=width*fraction;
   candidates.push({x:first[0]-forward.x*distance+side.x*lateral,
     z:first[1]-forward.z*distance+side.z*lateral,
     distance,lateral});
  }
 }
 return candidates;
}

export function planRobotLowStairApproach(start,stairs,obstacles=[],project=(p)=>p){
 const candidates=lowStairEntranceCandidates(stairs);
 let best=null;
 for(const candidate of candidates){
  const transformed=project(candidate);
  const point={x:transformed?.x,z:transformed?.z};
  if(![point.x,point.z].every(Number.isFinite)||pathBlocked(point.x,point.z,obstacles,.30))continue;
  const waypoints=planRobotPath(start,point,obstacles);
  if(!waypoints?.length||Math.hypot(waypoints.at(-1).x-point.x,waypoints.at(-1).z-point.z)>.14)continue;
  const length=plannedPathLength(start,waypoints);
  const score=length+candidate.distance*.05+Math.abs(candidate.lateral)*.10;
  if(!best||score<best.score)best={point,waypoints,score,entry:'low',distance:candidate.distance};
 }
 return best;
}
