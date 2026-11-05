// Physical, not name-based navigation for long procedural fences/walls/hedges.
// Routes must see the same continuous path as the generated colliders. Split
// long lines into bounded short AABBs so a diagonal fence does not block the
// entire rectangle between its opposite endpoints.
export function infrastructureNavigationFootprints(segments=[],toWorld=(x,z)=>({x,z}),config={},identity={}){
 const type=config.infraType;
 if(!['fence','pathWall','hedge'].includes(type))return [];
 const total=segments.reduce((sum,s)=>sum+Math.max(0,Number(s.length)||0),0);
 // 512 budget per object. Coarser footprints are conservative, never omitted.
 const spacing=Math.max(1.1,total/512);
 const thickness=Math.max(.12,
   type==='hedge'?Math.min(1.6,Math.max(.16,(Number(config.infraWidth)||1)*.33)):
   type==='pathWall'?Number(config.infraThickness)||.14:
   (Number(config.infraThickness)||.14)*1.6);
 const radius=thickness*.5*Math.max(.01,Number(config.navigationWorldScale)||1)+.045,items=[];
 for(const segment of segments){
  const a=segment.start,b=segment.end;
  if(!Array.isArray(a)||!Array.isArray(b))continue;
  const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.08)continue;
  const steps=Math.max(1,Math.ceil(len/spacing));
  for(let i=0;i<steps;i++){
   const t0=i/steps,t1=(i+1)/steps;
   const p=toWorld(a[0]+(b[0]-a[0])*t0,a[1]+(b[1]-a[1])*t0);
   const q=toWorld(a[0]+(b[0]-a[0])*t1,a[1]+(b[1]-a[1])*t1);
   if(![p?.x,p?.z,q?.x,q?.z].every(Number.isFinite))continue;
   items.push({minX:Math.min(p.x,q.x)-radius,maxX:Math.max(p.x,q.x)+radius,
    minZ:Math.min(p.z,q.z)-radius,maxZ:Math.max(p.z,q.z)+radius,
    name:identity.name||'Infrastructure',kind:type,id:identity.id});
  }
 }
 return items;
}
