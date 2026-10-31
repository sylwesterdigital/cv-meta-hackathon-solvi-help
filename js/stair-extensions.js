// Validated parametric additions to office stairs. This file intentionally has no DOM/Three dependency.
const limit=(x,min,max,def)=>Number.isFinite(Number(x))?Math.max(min,Math.min(max,Number(x))):def;
const hex=(v,f)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:f;
const variants=new Set(['standard','advanced','escalator','walkway','lift']);
export const STAIR_VARIANTS=[...variants];
export function cleanStairExtras(raw={}){
 const rail=raw.rail||{},roof=raw.roof||{},supports=raw.supports||{},transport=raw.transport||{},lift=raw.lift||{};
 const variant=variants.has(raw.variant)?raw.variant:'standard';
 const choice=(val,options,fallback)=>options.includes(val)?val:fallback;
 const surface=raw.surface||{};
 return {
  variant,
  surface:{texture:choice(surface.texture,['none','concrete','bricks','plaster','tiles','metal'],'none'),color:hex(surface.color,hex(raw.color,'#c6d1dc')),
   opacity:limit(surface.opacity,.08,1,limit(raw.opacity,.08,1,1)),material:choice(surface.material,['matte','metal','glass'],'matte')},
  rail:{enabled:typeof rail.enabled==='boolean'?rail.enabled:(variant==='escalator'||variant==='advanced'),side:choice(rail.side,['both','left','right'],'both'),height:limit(rail.height,.35,2,1),width:limit(rail.width,.02,.25,.06),
   rods:Math.round(limit(rail.rods,1,5,2)),every:Math.round(limit(rail.every,1,8,2)),color:hex(rail.color,'#738b9b'),opacity:limit(rail.opacity,.15,1,1),material:choice(rail.material,['metal','wood','glass'],'metal'),texture:choice(rail.texture,['none','concrete','bricks','plaster','metal'],'none')},
  roof:{enabled:roof.enabled===true,height:limit(roof.height,1.75,5,2.5),thickness:limit(roof.thickness,.03,.4,.12),walls:roof.walls===true,
   color:hex(roof.color,'#b7c9d7'),opacity:limit(roof.opacity,.1,1,1),texture:choice(roof.texture,['none','concrete','bricks','plaster','metal'],'none')},
  supports:{enabled:supports.enabled===true,side:choice(supports.side,['both','left','right','center'],'both'),every:Math.round(limit(supports.every,1,16,4)),
   width:limit(supports.width,.04,.65,.12),color:hex(supports.color,'#8a939b'),opacity:limit(supports.opacity,.1,1,1),texture:choice(supports.texture,['none','concrete','bricks','plaster','metal'],'none')},
  transport:{speed:limit(transport.speed,.05,2.5,.5),direction:transport.direction===-1?-1:1,enabled:transport.enabled!==false},
  lift:{levels:Math.round(limit(lift.levels,2,12,2)),levelHeight:limit(lift.levelHeight,1.8,8,3),target:Math.round(limit(lift.target,0,11,1)),cabinHeight:limit(lift.cabinHeight,1.8,4,2.4),currentHeight:limit(lift.currentHeight,0,96,0)}
 };
}
export function projectPath(points,x,z){
 if(!Array.isArray(points)||points.length<2)return null;
 let best=null,total=0;const parts=[];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.01)continue;
  parts.push({a,dx,dz,length,start:total});total+=length;
 }
 for(const p of parts){const t=Math.max(0,Math.min(1,((x-p.a[0])*p.dx+(z-p.a[1])*p.dz)/(p.length*p.length))),px=p.a[0]+p.dx*t,pz=p.a[1]+p.dz*t;
  const distance=Math.hypot(x-px,z-pz);if(!best||distance<best.distance)best={distance,along:p.start+p.length*t,total,dx:p.dx/p.length,dz:p.dz/p.length};
 }
 return best;
}
export function pathAt(points,along){
 if(!Array.isArray(points)||points.length<2)return null;
 let left=along;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<.01)continue;
  if(left<=l||i===points.length-1){const t=Math.max(0,Math.min(1,left/l));return {x:a[0]+dx*t,z:a[1]+dz*t};}left-=l;
 }
 return {x:points.at(-1)[0],z:points.at(-1)[1]};
}
export function liftTargetHeight(lift,target){const l=cleanStairExtras({lift}).lift;return Math.max(0,Math.min(l.levels-1,Math.round(Number(target)||0)))*l.levelHeight;}

// Runtime lift travel and conveyor velocity never invalidate mesh/collider topology.
export function stairGeometryKey(raw={}){
 const data=JSON.parse(JSON.stringify(raw||{}));
 if(data.lift){delete data.lift.currentHeight;delete data.lift.target;}
 if(data.transport)delete data.transport;
 return JSON.stringify(data);
}
