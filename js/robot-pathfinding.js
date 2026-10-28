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
 if(!pathBlocked(final.x,final.z,obstacles,clearance)&&Math.hypot(result.at(-1)?.x-final.x||0,result.at(-1)?.z-final.z||0)<cell*1.9)result[result.length-1]=final;
 return result;
}
