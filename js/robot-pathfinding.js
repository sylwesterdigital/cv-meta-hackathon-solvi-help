// Scene footprint planner shared by autonomous robot missions and the minimap.
// 8-connected A* on a 0.45m grid, with clearance for robot width and obstacle
// footprints. Each diagonal checks both adjacent cells to prevent corner cuts.
// All inputs and outputs are planar metres; no Three.js dependency.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function pathBlocked(x,z,obstacles=[],clearance=0.30){
 return obstacles.some(b=>x>=b.minX-clearance&&x<=b.maxX+clearance&&z>=b.minZ-clearance&&z<=b.maxZ+clearance);
}
export function planRobotPath(start,end,obstacles=[],options={}){
 if(![start?.x,start?.z,end?.x,end?.z].every(Number.isFinite))return null;
 const cell=clamp(Number(options.cell)||.45,.2,1),clearance=clamp(Number(options.clearance)||.30,.15,.9);
 const direct=Math.hypot(end.x-start.x,end.z-start.z);
 if(direct<.10)return [{x:end.x,z:end.z}];
 // The grid covers the route and a 5m detour on both sides, bounded for performance.
 const extra=clamp(direct*.35+2.4,3.5,8);
 const minX=Math.min(start.x,end.x)-extra,minZ=Math.min(start.z,end.z)-extra;
 const maxX=Math.max(start.x,end.x)+extra,maxZ=Math.max(start.z,end.z)+extra;
 const nx=Math.min(105,Math.ceil((maxX-minX)/cell)+1),nz=Math.min(105,Math.ceil((maxZ-minZ)/cell)+1);
 if(nx*nz>8500)return null;
 const index=(x,z)=>z*nx+x;
 const at=(x,z)=>({x:minX+x*cell,z:minZ+z*cell});
 const sx=clamp(Math.round((start.x-minX)/cell),0,nx-1),sz=clamp(Math.round((start.z-minZ)/cell),0,nz-1);
 const ex=clamp(Math.round((end.x-minX)/cell),0,nx-1),ez=clamp(Math.round((end.z-minZ)/cell),0,nz-1);
 const blocks=new Uint8Array(nx*nz);
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
  const p=at(x,z);blocks[index(x,z)]=pathBlocked(p.x,p.z,obstacles,clearance)?1:0;
 }
 // Allow initial position even if a geometry bounding box overlaps the robot.
 blocks[index(sx,sz)]=0;
 // Try the nearest free point around the destination, rather than colliding with furniture.
 let gx=ex,gz=ez;
 if(blocks[index(gx,gz)]){
  let best=Infinity;
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
   if(blocks[index(x,z)])continue;
   const d=(x-ex)**2+(z-ez)**2;
   if(d<best){gx=x;gz=z;best=d;}
  }
  if(best>Math.pow(3/cell,2))return null;
 }
 const startIndex=index(sx,sz),endIndex=index(gx,gz);
 const count=nx*nz,dist=new Float64Array(count).fill(Infinity),parents=new Int32Array(count).fill(-1),closed=new Uint8Array(count);
 // A small binary heap prevents scanning all visited cells at each expansion.
 const heap=[];
 const push=(node,priority)=>{let i=heap.length;heap.push({node,priority});while(i){const p=(i-1)>>1;if(heap[p].priority<=priority)break;heap[i]=heap[p];i=p;}heap[i]={node,priority};};
 const pop=()=>{const root=heap[0],last=heap.pop();if(heap.length){let i=0;while(2*i+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].priority<heap[child].priority)child++;if(last.priority<=heap[child].priority)break;heap[i]=heap[child];i=child;}heap[i]=last;}return root;};
 const h=(x,z)=>Math.hypot(gx-x,gz-z);
 dist[startIndex]=0;push(startIndex,h(sx,sz));
 const moves=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
 let found=false;
 while(heap.length){const {node}=pop();if(closed[node])continue;closed[node]=1;if(node===endIndex){found=true;break;}
  const x=node%nx,z=Math.floor(node/nx);
  for(const [dx,dz] of moves){const xx=x+dx,zz=z+dz;if(xx<0||xx>=nx||zz<0||zz>=nz)continue;
   const j=index(xx,zz);if(blocks[j]||closed[j])continue;
   if(dx&&dz&&(blocks[index(xx,z)]||blocks[index(x,zz)]))continue;
   const next=dist[node]+Math.hypot(dx,dz);if(next>=dist[j])continue;
   dist[j]=next;parents[j]=node;push(j,next+h(xx,zz));
  }
 }
 if(!found)return null;
 const cells=[];for(let node=endIndex;node!==startIndex&&node>=0;node=parents[node])cells.push(node);
 cells.reverse();
 const nodes=[{x:start.x,z:start.z},...cells.map(j=>at(j%nx,Math.floor(j/nx)))];
 // Compress a straight run into its final point, retaining turns and obstacle clearance.
 const result=[];
 for(let i=1;i<nodes.length;i++){
  const p=nodes[i],prev=nodes[i-1],next=nodes[i+1];
  if(next&&Math.abs((p.x-prev.x)*(next.z-p.z)-(p.z-prev.z)*(next.x-p.x))<1e-5)continue;
  result.push(p);
 }
 const final={x:end.x,z:end.z};
 // A* operates on grid centres. Snapping the final centre directly to an exact
 // target without checking the intervening segment can cut an obstacle corner.
 const tail=result.at(-1)||start;
 const segmentClear=(a,b)=>{
   const distance=Math.hypot(b.x-a.x,b.z-a.z);
   for(let i=1,n=Math.max(1,Math.ceil(distance/(cell*.17)));i<=n;i++){
     const f=i/n;
     if(pathBlocked(a.x+(b.x-a.x)*f,a.z+(b.z-a.z)*f,obstacles,clearance))return false;
   }
   return true;
 };
 if(!pathBlocked(final.x,final.z,obstacles,clearance)&&Math.hypot(tail.x-final.x,tail.z-final.z)<cell*1.9&&segmentClear(tail,final))result[result.length-1]=final;
 // Verify all compressed line segments against the true (non-grid) footprints.
 // A path that grazes geometry is a failed plan, not evidence of arrival.
 let previous=start;
 for(const waypoint of result){if(!segmentClear(previous,waypoint))return null;previous=waypoint;}
 return result;
}

// Choose a safe stand-off position by checking the *entire navigable route* to
// several sides of a target. A single nearest-edge goal often lies behind
// another robot or a couch: that is not proof that the target is unreachable.
export function planRobotApproach(start,bounds,obstacles=[],options={}){
 if(![start?.x,start?.z,bounds?.minX,bounds?.maxX,bounds?.minZ,bounds?.maxZ].every(Number.isFinite))return null;
 const cx=(bounds.minX+bounds.maxX)/2,cz=(bounds.minZ+bounds.maxZ)/2;
 const hx=Math.max(.18,(bounds.maxX-bounds.minX)/2),hz=Math.max(.18,(bounds.maxZ-bounds.minZ)/2);
 const initialAngle=Math.atan2(start.z-cz,start.x-cx);
 const directions=[initialAngle,...Array.from({length:16},(_,i)=>i*Math.PI/8)];
 const clearance=Number(options.clearance)||.30;
 let best=null,attempted=0,free=0;
 for(const gap of [.70,1.05,1.50,2.20]){
  for(const angle of directions){
   const ux=Math.cos(angle),uz=Math.sin(angle);
   const extent=Math.min(hx/Math.max(Math.abs(ux),1e-5),hz/Math.max(Math.abs(uz),1e-5));
   const point={x:cx+ux*(extent+gap),z:cz+uz*(extent+gap)};
   attempted++;
   if(pathBlocked(point.x,point.z,obstacles,clearance))continue;
   free++;
   const path=planRobotPath(start,point,obstacles);
   if(!path?.length||Math.hypot(path.at(-1).x-point.x,path.at(-1).z-point.z)>.14)continue;
   // Choose shortest actual A* path, not the closest straight-line destination.
   let length=0,previous=start;
   for(const p of path){length+=Math.hypot(p.x-previous.x,p.z-previous.z);previous=p;}
   const score=length+gap*.08;
   if(!best||score<best.score)best={point,waypoints:path,score,attempted,free};
  }
  // A useful reachable near-target candidate is preferable to far-off guesses.
  if(best)break;
 }
 return best?{...best,attempted,free}:null;
}

// When all sides of a target are obstructed, try a safe *partial* trip.
// This never declares arrival. First probe 95% along the straight-line direction,
// then smaller fractions and lateral offsets to avoid other robots/furniture.
// Progress is a geometrical fraction along the original direction, not a
// promise that the path length matches direct distance.
export function planRobotPartialApproach(start,bounds,obstacles=[],options={}){
 if(![start?.x,start?.z,bounds?.minX,bounds?.maxX,bounds?.minZ,bounds?.maxZ].every(Number.isFinite))return null;
 const cx=(bounds.minX+bounds.maxX)/2,cz=(bounds.minZ+bounds.maxZ)/2;
 const dx=cx-start.x,dz=cz-start.z,length=Math.hypot(dx,dz);
 if(length<1.8)return null;
 const ux=dx/length,uz=dz/length,clearance=Number(options.clearance)||.3;
 let best=null;
 for(const fraction of [.95,.92,.88,.84,.80,.75,.68,.60]){
  for(const offset of [0,.40,-.40,.8,-.8,1.3,-1.3]){
   const point={x:start.x+dx*fraction-uz*offset,z:start.z+dz*fraction+ux*offset};
   if(pathBlocked(point.x,point.z,obstacles,clearance))continue;
   const path=planRobotPath(start,point,obstacles,options);
   if(!path?.length||Math.hypot(path.at(-1).x-point.x,path.at(-1).z-point.z)>.14)continue;
   const remaining=Math.hypot(cx-point.x,cz-point.z);
   const candidate={point,waypoints:path,progress:fraction,remainingMeters:remaining};
   if(!best||candidate.progress>best.progress||(candidate.progress===best.progress&&candidate.remainingMeters<best.remainingMeters))best=candidate;
  }
  if(best)break;
 }
 return best;
}
