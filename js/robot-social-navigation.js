// Robot-to-robot visits are not general object inspections. A spot outside a
// window is not an arrival if masonry or glazing separates the two avatars.
// Scene geometry is the source of physical truth; the Meta model is not a path planner.
import {pathBlocked,planRobotTravelRoute,plannedPathLength} from './robot-pathfinding.js';
const finite=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.z);
export function socialLineClear(from,to,staticObstacles=[],clearance=.045){
 if(!finite(from)||!finite(to))return false;
 const distance=Math.hypot(from.x-to.x,from.z-to.z);
 // Both ends and each intermediate crossing must be traversable at avatar height.
 const steps=Math.max(1,Math.ceil(distance/.065));
 for(let k=0;k<=steps;k++){
  const t=k/steps;
  if(pathBlocked(from.x+(to.x-from.x)*t,from.z+(to.z-from.z)*t,staticObstacles,clearance))return false;
 }
 return true;
}
export function canMeetRobot(from,to,staticObstacles=[],{minimum=.70,maximum=1.95}={}){
 const distance=Math.hypot(from.x-to.x,from.z-to.z);
 return Number.isFinite(distance)&&distance>=minimum&&distance<=maximum&&socialLineClear(from,to,staticObstacles);
}
export function planRobotMeeting(start,target,staticObstacles=[],options={}){
 if(!finite(start)||!finite(target))return null;
 // A moving avatar is not a permanent navmesh obstacle: only stationary
 // scene geometry is used for planning. Runtime checks still avoid collisions.
 const solid=staticObstacles.filter(o=>o.kind!=='robot');
 if(canMeetRobot(start,target,solid))return {point:{...start},waypoints:[],score:0,alreadyNear:true};
 const initial=Math.atan2(start.z-target.z,start.x-target.x);
 const directions=[initial,...Array.from({length:16},(_,i)=>initial+(i+1)*Math.PI/8)];
 let best=null,attempted=0,free=0;
 // Include the centre of small rooms, not just outer corners of a building.
 for(const radius of [1.12,1.45,1.8]){
  for(const angle of directions){
   const point={x:target.x+Math.cos(angle)*radius,z:target.z+Math.sin(angle)*radius};attempted++;
   if(pathBlocked(point.x,point.z,solid,.30)||!socialLineClear(point,target,solid))continue;
   free++;
   const waypoints=planRobotTravelRoute(start,point,solid,options);
   if(!waypoints?.length||Math.hypot(waypoints.at(-1).x-point.x,waypoints.at(-1).z-point.z)>.14)continue;
   const length=plannedPathLength(start,waypoints);
   // Prefer physically shorter route, not the closest straight-line spot
   // outside the wall. Each destination has clear final contact with target.
   const score=length+radius*.06;
   if(!best||score<best.score)best={point,waypoints,score,attempted,free};
  }
  if(best)break;
 }
 return best?{...best,attempted,free}:null;
}
// Geometry changes are read from the scene periodically. Only actually
// obstructed remaining steps require another route; no raw navmesh cache.
export function remainingRouteBlocked(from,goal,rest=[],obstacles=[]){
 if(!finite(from)||!finite(goal))return true;
 let previous=from;
 for(const next of [goal,...rest]){
  if(!finite(next))return true;
  const distance=Math.hypot(next.x-previous.x,next.z-previous.z);
  for(let i=1,n=Math.max(1,Math.ceil(distance/.12));i<=n;i++){
   const t=i/n;
   if(pathBlocked(previous.x+(next.x-previous.x)*t,previous.z+(next.z-previous.z)*t,obstacles,.27))return true;
  }
  previous=next;
 }
 return false;
}
