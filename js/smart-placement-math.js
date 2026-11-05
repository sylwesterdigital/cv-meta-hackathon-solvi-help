// Browser-independent planner for a new scene object's initial, ground-level pose.
// Candidate coordinates are world-space X/Z centres of the object's actual bounds.
// No scene mutations, network calls, random sampling or physics stepping occur here.
const finite=(n)=>typeof n==='number'&&Number.isFinite(n);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

export function placementBoxesOverlap(a,b,margin=.10){
 return a.min.x < b.max.x+margin && a.max.x > b.min.x-margin &&
        a.min.z < b.max.z+margin && a.max.z > b.min.z-margin &&
        a.min.y < b.max.y-.015 && a.max.y > b.min.y+.015;
}

// True when an obstacle's actual 3D bounds are between the camera and a
// prospective object's centre. Checking height avoids shadows from obstacles
// which are below the sight line (or walls on other storeys).
export function placementLineBlocked(from,to,box){
 let near=0,far=.985;
 for(const axis of ['x','y','z']){
  const delta=to[axis]-from[axis],min=box.min[axis],max=box.max[axis];
  if(Math.abs(delta)<1e-10){if(from[axis]<min||from[axis]>max)return false;continue;}
  let a=(min-from[axis])/delta,b=(max-from[axis])/delta;
  if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);
  if(near>far)return false;
 }
 return far>=0&&near<=.985;
}

function addRing(candidates,center,radius,steps=16){
 if(!center||![center.x,center.z].every(finite))return;
 if(radius===0){candidates.push({x:center.x,z:center.z});return;}
 for(let i=0;i<steps;i++){
  const a=i*2*Math.PI/steps;
  candidates.push({x:center.x+Math.cos(a)*radius,z:center.z+Math.sin(a)*radius});
 }
}

/**
 * @param {object} options
 * camera: {x,y,z}; centre: the camera's ground intersection; forward: XZ gaze
 * footprint: {width,depth,height,groundY}; anchor: recently added object
 * obstacles: visible, solid, per-mesh world AABBs (see scene-placement.js)
 * project: world point -> camera NDC {x,y,z}, with z in [-1,1]
 * @returns {{x,z}|null} an unobstructed world AABB centre; never guesses if unsafe
 */
export function chooseSmartPlacement({camera,centre,forward,footprint,anchor=null,obstacles=[],project,maxCameraDistance=13}={}){
 if(!camera||!centre||!footprint||typeof project!=='function'||
    ![camera.x,camera.y,camera.z,centre.x,centre.z,footprint.width,footprint.depth,footprint.height].every(finite)||
    footprint.width<=0||footprint.depth<=0||footprint.height<=0)return null;
 const groundY=finite(footprint.groundY)?footprint.groundY:0;
 const maxDist=Math.max(5,Math.min(30,maxCameraDistance));
 const c={x:centre.x,z:centre.z},candidates=[];
 const d=distance(camera,c);
 const focus=d>maxDist?{x:camera.x+(c.x-camera.x)*maxDist/d,z:camera.z+(c.z-camera.z)*maxDist/d}:c;
 // Keep additions close to the last object, with enough space for BOTH bounds.
 if(anchor&&[anchor.x,anchor.z].every(finite)){
  const anchorRadius=Math.max(.05,Number(anchor.radius)||.35);
  const gap=Math.hypot(footprint.width,footprint.depth)/2+anchorRadius+.26;
  for(const r of [gap,gap+.48,gap+1.05,gap+1.8,gap+2.8])addRing(candidates,anchor,r,20);
 }
 // Sample the middle of the current screen, not an arbitrary 40-metre horizon.
 for(const radius of [0,.5,1,1.6,2.3,3.1,4.2,5.4])addRing(candidates,focus,radius,16);
 // In a small room, the floor visible below/near the camera can be considerably
 // closer than its centre ray; sample gaze-forward distances as a second option.
 let fx=forward?.x??(focus.x-camera.x),fz=forward?.z??(focus.z-camera.z);
 const fl=Math.hypot(fx,fz);
 if(fl>.001){fx/=fl;fz/=fl;
  for(const r of [1.5,2.4,3.5,4.8,6.5,8.5,11]){
   const base={x:camera.x+fx*r,z:camera.z+fz*r};
   for(const off of [-2.4,-1.4,-.65,0,.65,1.4,2.4])candidates.push({x:base.x-fz*off,z:base.z+fx*off});
  }
 }
 const halfW=footprint.width/2,halfD=footprint.depth/2;
 const height=footprint.height;
 const safeObstacles=obstacles.filter(b=>b?.min&&b?.max&&['x','y','z'].every(k=>finite(b.min[k])&&finite(b.max[k])));
 let best=null,bestScore=Infinity;
 for(const candidate of candidates){
  const dist=distance(camera,candidate);
  if(dist>maxDist||dist<.6||!finite(dist))continue;
  const box={min:{x:candidate.x-halfW,y:groundY,z:candidate.z-halfD},max:{x:candidate.x+halfW,y:groundY+height,z:candidate.z+halfD}};
  if(safeObstacles.some(obstacle=>placementBoxesOverlap(box,obstacle)))continue;
  const target={x:candidate.x,y:groundY+Math.max(.08,Math.min(height*.50,1.3)),z:candidate.z};
  const ndc=project(target);
  if(!ndc||![ndc.x,ndc.y,ndc.z].every(finite)||ndc.z<=-1||ndc.z>=1||Math.abs(ndc.x)>.88||Math.abs(ndc.y)>.84)continue;
  // Reject anything hidden behind solid furnishings, room walls or a closed door.
  if(safeObstacles.some(obstacle=>placementLineBlocked(camera,target,obstacle)))continue;
  const screenScore=ndc.x*ndc.x+ndc.y*ndc.y;
  const anchorScore=anchor&&[anchor.x,anchor.z].every(finite)?Math.min(12,distance(candidate,anchor)):0;
  const focusScore=Math.min(10,distance(candidate,focus));
  const score=3.8*screenScore+.32*anchorScore+.12*focusScore+.075*dist;
  if(score<bestScore){best=candidate;bestScore=score;}
 }
 return best;
}


// Candidate points are on *real support surfaces*, not at the room's ground
// level. This makes a visible tabletop an available location for a can even if
// its supporting table occupies the entire ground footprint underneath it.
function polygonContains(p,polygon,margin=0){
 if(!Array.isArray(polygon)||polygon.length<3)return false;
 let sign=0;
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length];
  const cross=(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
  const edge=Math.hypot(b.x-a.x,b.z-a.z);
  if(!edge)return false;
  if(Math.abs(cross)<=margin*edge)return false;
  const side=Math.sign(cross);
  if(sign&&side!==sign)return false;
  sign=side;
 }
 return true;
}

/** Check every corner of the item's world-axis-aligned footprint against the
 * surface polygon. This is conservative for rotated tables and round tops. */
export function placementFitsSurface(x,z,width,depth,polygon,edgeMargin=.018){
 const w=width*.5+edgeMargin,d=depth*.5+edgeMargin;
 return [[x-w,z-d],[x+w,z-d],[x+w,z+d],[x-w,z+d]]
  .every(([px,pz])=>polygonContains({x:px,z:pz},polygon));
}

/** Choose a visible, unoccupied horizontal supporting surface.
 * Supports have {id,kind,topY,polygon}; `kind` is tabletop or floor.
 * Non-support furniture continues to block collisions and sightlines.
 * All operations are deterministic and read-only. */
export function chooseSurfacePlacement({camera,footprint,supports=[],obstacles=[],project,
 anchor=null,maxCameraDistance=16,allowTabletop=false}={}){
 if(!camera||!footprint||typeof project!=='function'||
    ![camera.x,camera.y,camera.z,footprint.width,footprint.depth,footprint.height].every(finite))return null;
 const safeObstacles=obstacles.filter(b=>b?.min&&b?.max&&['x','y','z'].every(k=>finite(b.min[k])&&finite(b.max[k])));
 const width=Math.max(.06,footprint.width),depth=Math.max(.06,footprint.depth),height=Math.max(.02,footprint.height);
 let best=null,bestScore=Infinity;
 for(const support of supports.slice(0,160)){
  if(!support||!['floor','tabletop'].includes(support.kind)||
     (support.kind==='tabletop'&&!allowTabletop)||!finite(support.topY)||
     support.topY>camera.y-.14||!Array.isArray(support.polygon)||support.polygon.length<3)continue;
  const xs=support.polygon.map(p=>p.x),zs=support.polygon.map(p=>p.z);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  if(![minX,maxX,minZ,maxZ].every(finite))continue;
  // Big floor slabs should be sampled at a sensible density; tables need
  // tighter sampling to find space between previously placed cups and cans.
  const steps=support.kind==='tabletop'?10:12;
  const surfaceObstacles=safeObstacles.filter(b=>b.sourceId!==support.id);
  for(let ix=0;ix<steps;ix++)for(let iz=0;iz<steps;iz++){
   const x=minX+(ix+.5)*(maxX-minX)/steps,z=minZ+(iz+.5)*(maxZ-minZ)/steps;
   if(!placementFitsSurface(x,z,width,depth,support.polygon))continue;
   const dist=Math.hypot(camera.x-x,camera.z-z);
   if(dist>.6+maxCameraDistance||dist<.35)continue;
   const baseY=support.topY+.009;
   const volume={min:{x:x-width/2,y:baseY,z:z-depth/2},max:{x:x+width/2,y:baseY+height,z:z+depth/2}};
   if(surfaceObstacles.some(b=>placementBoxesOverlap(volume,b,.035)))continue;
   const target={x,y:baseY+Math.min(height*.5,.55),z};
   const ndc=project(target);
   if(!ndc||![ndc.x,ndc.y,ndc.z].every(finite)||ndc.z<=-1||ndc.z>=1||
      Math.abs(ndc.x)>.94||Math.abs(ndc.y)>.91)continue;
   if(surfaceObstacles.some(b=>placementLineBlocked(camera,target,b)))continue;
   const screenScore=ndc.x*ndc.x+ndc.y*ndc.y;
   const nearAnchor=anchor&&[anchor.x,anchor.z].every(finite)?
    Math.min(8,Math.hypot(anchor.x-x,anchor.z-z)) : 0;
   const sameLevel=anchor&&finite(anchor.y)&&Math.abs(anchor.y-baseY)<.35;
   const score=4.8*screenScore+.11*dist+(sameLevel?.14:.30)*nearAnchor+
    (support.kind==='tabletop'&&!allowTabletop?100:0);
   if(score<bestScore){best={x,z,groundY:baseY,supportId:support.id,kind:support.kind};bestScore=score;}
  }
 }
 return best;
}
