const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const presets=['plaster','concrete','bricks','glass','wood','marble','granite'];
export function sanitiseWall(raw={}){
 const original=Array.isArray(raw.points)?raw.points:[];
 const sampled=original.length>80?Array.from({length:80},(_,i)=>original[Math.round(i*(original.length-1)/79)]):original;
 const points=sampled.filter(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(Number(n))&&Math.abs(Number(n))<=500)).map(p=>[+Number(p[0]).toFixed(3),+Number(p[1]).toFixed(3)]);
 const unique=[];for(const p of points)if(!unique.length||Math.hypot(unique.at(-1)[0]-p[0],unique.at(-1)[1]-p[1])>.05)unique.push(p);
 const num=(name,f,a,b)=>Number.isFinite(Number(raw[name]))?clamp(Number(raw[name]),a,b):f;
 const texture=[...presets,'custom'].includes(raw.texture)?raw.texture:'plaster';
 const textureMediaId=typeof raw.textureMediaId==='string'&&/^[0-9a-f-]{36}$/i.test(raw.textureMediaId)?raw.textureMediaId:'';
 const color=typeof raw.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(raw.color)?raw.color:'#c6d1dc';
 const windowRaw=raw.windows&&typeof raw.windows==='object'?raw.windows:{};
 const ceilingRaw=raw.ceiling&&typeof raw.ceiling==='object'?raw.ceiling:{};
 const bool=(v)=>v===true;
 const numeric=(v,def,min,max)=>Number.isFinite(Number(v))&&v!==null&&v!==''?clamp(Number(v),min,max):def;
 const triplet=(value,limit)=>Array.from({length:3},(_,i)=>numeric(Array.isArray(value)?value[i]:null,0,-limit,limit));
 const arrayRaw=raw.array&&typeof raw.array==='object'?raw.array:{};
 const array={enabled:bool(arrayRaw.enabled)&&raw.closed===true,count:Math.round(numeric(arrayRaw.count,2,1,16)),
  axis:['x','y','z'].includes(arrayRaw.axis)?arrayRaw.axis:'y',direction:arrayRaw.direction===-1?-1:1,
  gap:numeric(arrayRaw.gap,0.15,0,20),rotation:triplet(arrayRaw.rotation,45),scale:triplet(arrayRaw.scale,.25)};
 const hex=(v,f)=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v)?v:f;
 const validTexture=(v,f)=>['plaster','concrete','bricks','glass','wood','marble','granite'].includes(v)?v:f;
 const windows={enabled:bool(windowRaw.enabled),openable:windowRaw.openable!==false,
  minWidth:clamp(Number(windowRaw.minWidth)||2.5,1.2,15),minHeight:clamp(Number(windowRaw.minHeight)||2.2,1,10),
  widthRatio:clamp(Number(windowRaw.widthRatio)||.36,.15,.7),heightRatio:clamp(Number(windowRaw.heightRatio)||.42,.2,.75),
  color:hex(windowRaw.color,'#b6ecfc'),opacity:clamp(Number(windowRaw.opacity)||.42,.08,.85),
  openIds:Array.isArray(windowRaw.openIds)?windowRaw.openIds.filter(v=>Number.isInteger(v)&&v>=0&&v<16384).slice(0,640):[]};
 const ceiling={enabled:bool(ceilingRaw.enabled),thickness:clamp(Number(ceilingRaw.thickness)||.16,.05,.6),
  texture:validTexture(ceilingRaw.texture,'plaster'),color:hex(ceilingRaw.color,'#e1e7eb'),
  autoLiftOpenings:ceilingRaw.autoLiftOpenings!==false};
 return {array,windows,ceiling,textureScale:numeric(raw.textureScale,1,.25,5),textureDistortion:numeric(raw.textureDistortion,.38,0,2),textureContrast:numeric(raw.textureContrast,1,.2,3),points:unique,closed:raw.closed===true,width:num('width',.16,.05,1.5),height:num('height',2.8,.3,10),texture,textureMediaId,color,opacity:num('opacity',texture==='glass'?.4:1,.08,1),smooth:raw.smooth!==false};
}
// The first room is the authored outline. Other array elements are generated at render time.
// Rotation (degrees) and scale (additive per copy) are relative to the base room.
export function wallArrayTransforms(settings){
 const s=sanitiseWall(settings);
 const minX=Math.min(...s.points.map(p=>p[0]),0),maxX=Math.max(...s.points.map(p=>p[0]),0);
 const minZ=Math.min(...s.points.map(p=>p[1]),0),maxZ=Math.max(...s.points.map(p=>p[1]),0);
 const dimensions={x:Math.max(.1,maxX-minX),y:s.height,z:Math.max(.1,maxZ-minZ)};
 const count=s.closed&&s.array.enabled?s.array.count:1;
 return Array.from({length:count},(_,index)=>{
  const axis=s.array.axis,offset=[0,0,0];offset[{x:0,y:1,z:2}[axis]]=index===0?0:index*s.array.direction*(dimensions[axis]+s.array.gap);
  return {index,offset,rotation:s.array.rotation.map(deg=>deg*index*Math.PI/180),
   scale:s.array.scale.map(v=>Math.max(.2,Math.min(5,1+v*index))),pivot:[(minX+maxX)/2,0,(minZ+maxZ)/2]};
 });
}
export function simplifyWallPoints(points,tolerance=.13){
 if(points.length<3)return points.slice();const sqTol=tolerance*tolerance;
 const distanceSq=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;if(l<1e-8)return (p[0]-a[0])**2+(p[1]-a[1])**2;const t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l,0,1);return (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;};
 const result=new Set([0,points.length-1]);const recur=(a,b)=>{let index=-1,max=sqTol;for(let i=a+1;i<b;i++){const d=distanceSq(points[i],points[a],points[b]);if(d>max){max=d;index=i;}}if(index>=0){result.add(index);recur(a,index);recur(index,b);}};recur(0,points.length-1);return [...result].sort((a,b)=>a-b).map(i=>points[i]);
}
export function wallSegments(settings){const s=sanitiseWall(settings),segments=[];for(let i=1;i<s.points.length+(s.closed&&s.points.length>=3?1:0);i++){const a=s.points[i-1],b=s.points[i%s.points.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.05)continue;segments.push({x:(a[0]+b[0])/2,z:(a[1]+b[1])/2,length,yaw:Math.atan2(-dz,dx)});}return segments;}
export function wallWorldToLocal(points){const origin=points[0]||{x:0,z:0};return {origin,points:points.map(p=>[+(p.x-origin.x).toFixed(3),+(p.z-origin.z).toFixed(3)])};}

// Shared floor constraints: angle quantisation is relative to the previous fixed node.
export function snapWallPoint(point,anchor=null,{grid=true,step=.5,angle=45}={}){
 const increment=Number(step)>0?Number(step):.5;
 let x=point.x,z=point.z;
 if(grid){x=Math.round(x/increment)*increment;z=Math.round(z/increment)*increment;}
 if(anchor && angle>0){
  const dx=x-anchor.x,dz=z-anchor.z,len=Math.hypot(dx,dz);
  if(len>1e-4){const unit=Number(angle)*Math.PI/180,dir=Math.round(Math.atan2(dz,dx)/unit)*unit;
   const distance=grid?Math.max(increment,Math.round(len/increment)*increment):len;
   x=anchor.x+Math.cos(dir)*distance;z=anchor.z+Math.sin(dir)*distance;
  }
 }
 return {x:+x.toFixed(4),z:+z.toFixed(4)};
}
// Chaikin corner-cutting gives visibly curved freehand geometry, not merely fewer nodes.
export function smoothWallPoints(points,tolerance=.18){
 if(points.length<3)return points.slice();
 const base=simplifyWallPoints(points,Math.max(.04,tolerance));
 if(base.length<3)return base;
 let result=base;
 for(let iteration=0;iteration<2;iteration++){
  const next=[result[0]];
  for(let i=1;i<result.length;i++){
   const a=result[i-1],b=result[i];
   next.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25]);
   next.push([a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]);
  }
  next.push(result.at(-1));result=next;
 }
 if(result.length>80)result=Array.from({length:80},(_,i)=>result[Math.round(i*(result.length-1)/79)]);
 return result;
}

// Window openings are distributed by *segment length*, never overlapping corners.
export function wallWindowLayout(length,height,windows){
 if(!windows?.enabled||length<windows.minWidth||height<windows.minHeight)return [];
 const count=Math.min(8,Math.max(1,Math.floor(length/windows.minWidth)));
 const cell=length/count;
 const width=Math.min(cell*.72,Math.max(.45,cell*windows.widthRatio));
 const openingHeight=Math.min(height*.73,Math.max(.45,height*windows.heightRatio));
 const bottom=Math.max(.20,(height-openingHeight)*.54);
 return Array.from({length:count},(_,i)=>({x:-length/2+cell*(i+.5),width,height:openingHeight,bottom}));
}
export function pointWithinPolygon([px,py],points){
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const [xi,yi]=points[i], [xj,yj]=points[j];
  if((yi>py)!==(yj>py)&&px<(xj-xi)*(py-yi)/(yj-yi)+xi)inside=!inside;
 }
 return inside;
}
// In-plane, axis-aligned opening; a lift outside the polygon never cuts the ceiling.
