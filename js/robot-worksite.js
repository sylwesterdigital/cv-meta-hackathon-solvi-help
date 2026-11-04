// v0.2.189: worksite discovery from the real 3D scene obstacle footprint.
// Site is only a *candidate*. The controller must walk there and re-check before Add.
import {planRobotPath,plannedPathLength,pathBlocked} from './robot-pathfinding.js';
const finite=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.z);
export function footprintClear(site,size,obstacles=[],margin=.6){
 if(!finite(site)||!Number.isFinite(size?.width)||!Number.isFinite(size?.depth))return false;
 if(size.width<=0||size.depth<=0)return false;
 const hx=size.width/2+margin,hz=size.depth/2+margin;
 return !obstacles.some(b=>b.minX<site.x+hx&&b.maxX>site.x-hx&&b.minZ<site.z+hz&&b.maxZ>site.z-hz);
}
export function findRobotWorksite(robot,obstacles=[],size={},options={}){
 if(!finite(robot)||!size||!Number.isFinite(size.width)||!Number.isFinite(size.depth))return null;
 const width=Math.max(.3,Math.min(9,size.width)),depth=Math.max(.3,Math.min(9,size.depth));
 const minRadius=Math.max(3.8,Math.hypot(width,depth)/2+2.2);
 const radii=[minRadius,minRadius+3.5,minRadius+7,minRadius+12,minRadius+19,minRadius+27].filter(v=>v<=40);
 const heading=Number(options.yaw)||0;
 const headings=[0,Math.PI/2,-Math.PI/2,Math.PI,Math.PI/4,-Math.PI/4,3*Math.PI/4,-3*Math.PI/4];
 let best=null;
 for(const radius of radii){
  for(let i=0;i<headings.length;i++){
   const angle=heading+headings[i],site={x:robot.x+Math.sin(angle)*radius,z:robot.z+Math.cos(angle)*radius};
   // Keep generated objects inside the editable workspace and away from its boundary.
   if(Math.abs(site.x)>490||Math.abs(site.z)>490||!footprintClear(site,{width,depth},obstacles,.7))continue;
   const dx=robot.x-site.x,dz=robot.z-site.z,d=Math.hypot(dx,dz)||1;
   const ux=dx/d,uz=dz/d;
   // Approach from one of four sides; the work position is outside the footprint.
   const sides=[{x:Math.sign(ux||1),z:0},{x:0,z:Math.sign(uz||1)},
    {x:-Math.sign(ux||1),z:0},{x:0,z:-Math.sign(uz||1)}];
   for(const side of sides){
    const staging={x:site.x+side.x*(width/2+1.25),z:site.z+side.z*(depth/2+1.25)};
    if(pathBlocked(staging.x,staging.z,obstacles,.45))continue;
    const route=planRobotPath(robot,staging,obstacles);
    if(!route?.length||Math.hypot(route.at(-1).x-staging.x,route.at(-1).z-staging.z)>.18)continue;
    const meters=plannedPathLength(robot,route);
    if(meters>90)continue;
    const score=meters+radius*.08+i*.005;
    if(!best||score<best.score)best={site,staging,route,meters:+meters.toFixed(2),score};
   }
  }
  if(best)break; // Prefer local reachable land; do not scan across the whole scene needlessly.
 }
 return best;
}
