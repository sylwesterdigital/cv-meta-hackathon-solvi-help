// SOLVI v0.2.173 — deterministic, bounded outdoor paths, roads, fences and hedges.
// All generated components are children of ONE persistent furniture entity.
import * as THREE from 'three';

export const INFRASTRUCTURE_VARIANTS=['road','footpath','curb','fence','hedge','pathWall'];
export const INFRASTRUCTURE_NUMERIC={
 infraWidth:[7.2,.15,30],infraHeight:[1.75,.08,8],infraThickness:[.14,.02,1],
 infraLanes:[2,1,6],infraPostSpacing:[2,.4,8],infraPicketWidth:[.14,.025,.8],
 infraGap:[.09,0,.8],infraLightSpacing:[12,3,50],infraLightHeight:[5,1.8,12],
 infraMarkingWidth:[.095,.025,.4],infraDashLength:[2.2,.25,8],infraDashGap:[3.5,.25,14],
 infraCurbHeight:[.16,.035,.5],infraSidewalkWidth:[1.25,.35,5],
 infraHedgeDensity:[.7,.15,1],infraSeed:[17,0,999999]
};
export const INFRASTRUCTURE_DEFAULT_POINTS=[[-3,0],[3,0]];
const hex=(v,d)=>typeof v==='string'&&/^#[\da-f]{6}$/i.test(v)?v:d;
const bool=(v,d=false)=>v===undefined?d:v===true;
export function cleanInfrastructurePoints(value){
 if(!Array.isArray(value))return INFRASTRUCTURE_DEFAULT_POINTS.map(v=>v.slice());
 const result=[];
 for(const p of value.slice(0,80)){
  if(!Array.isArray(p)||p.length!==2||p.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>300))continue;
  if(result.length&&Math.hypot(p[0]-result.at(-1)[0],p[1]-result.at(-1)[1])<.09)continue;
  result.push([p[0],p[1]]);
 }
 return result.length>=2?result:INFRASTRUCTURE_DEFAULT_POINTS.map(v=>v.slice());
}
export function cleanInfrastructure(raw={}){
 const p={};
 p.infraType=['road','footpath','curb','fence','hedge','pathWall'].includes(raw.infraType)?raw.infraType:'road';
 p.infraStyle=['plank','mesh','rods','solid'].includes(raw.infraStyle)?raw.infraStyle:'plank';
 p.infraSurface=['asphalt','concrete','gravel','pavers','earth'].includes(raw.infraSurface)?raw.infraSurface:'asphalt';
 p.infraTraffic=raw.infraTraffic==='oneway'?'oneway':'twoway';
 p.infraColour=hex(raw.infraColour,'#62696e');
 p.infraMarkingColour=hex(raw.infraMarkingColour,'#ebeadc');
 p.infraHedgeColour=hex(raw.infraHedgeColour,'#497e43');
 p.infraPoints=cleanInfrastructurePoints(raw.infraPoints);
 for(const [key,[def,min,max]] of Object.entries(INFRASTRUCTURE_NUMERIC)){
  const value=Number(raw[key]);let n=raw[key]!==undefined&&Number.isFinite(value)?Math.max(min,Math.min(max,value)):def;
  if(key==='infraLanes'||key==='infraSeed')n=Math.round(n);
  p[key]=n;
 }
 for(const key of ['infraSmooth','infraClose','infraMarkings','infraStreetlights','infraCurbs','infraSidewalks','infraLampsOn'])
  p[key]=bool(raw[key],key==='infraMarkings'||key==='infraLampsOn');
 return p;
}
export function infrastructurePath(config){
 const p=cleanInfrastructure(config);
 let pts=p.infraPoints.map(a=>a.slice());
 if(p.infraSmooth&&pts.length>2){
  const smooth=[];
  for(let i=0;i<pts.length-1;i++){
   const a=pts[i],b=pts[i+1];smooth.push(a.map((v,k)=>v*.75+b[k]*.25),a.map((v,k)=>v*.25+b[k]*.75));
  }
  pts=[pts[0],...smooth,pts.at(-1)];
 }
 if(p.infraClose&&pts.length>2)pts.push(pts[0].slice());
 return pts;
}
export function infrastructureSegments(config){
 const pts=infrastructurePath(config),segments=[];
 for(let i=1;i<pts.length;i++){
  const [x0,z0]=pts[i-1],[x1,z1]=pts[i];
  const length=Math.hypot(x1-x0,z1-z0);
  if(length<.08)continue;
  segments.push({x:(x0+x1)/2,z:(z0+z1)/2,length,yaw:-Math.atan2(z1-z0,x1-x0),start:[x0,z0],end:[x1,z1]});
 }
 return segments.slice(0,160);
}
function standard(color,options={}){return new THREE.MeshStandardMaterial({color,roughness:options.roughness??.83,metalness:options.metalness??0,flatShading:options.flatShading??false,side:THREE.DoubleSide});}
function colourHash(x,z,seed){return (Math.sin(x*12.9898+z*78.233+seed*17.23)*43758.5453)%1;}
function surfaceMaterial(p){
 const color=new THREE.Color(p.infraColour);
 if(p.infraSurface==='asphalt')color.set('#363a3f').lerp(color,.28);
 if(p.infraSurface==='gravel')color.set('#77746b').lerp(color,.32);
 if(p.infraSurface==='concrete')color.set('#92918b').lerp(color,.36);
 if(p.infraSurface==='pavers')color.set('#848784').lerp(color,.4);
 if(p.infraSurface==='earth')color.set('#816849').lerp(color,.4);
 const mat=standard(color);
 // Lightweight deterministic asphalt/concrete grain. No downloads or third-party shader deps.
 if(typeof document!=='undefined'&&document.createElement){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const context=canvas.getContext?.('2d');
  if(context){context.fillStyle='#a9a9a9';context.fillRect(0,0,128,128);
   for(let i=0;i<1900;i++){const x=(i*83+17)%128,z=(i*47+101)%128;
    const shade=Math.round(128+colourHash(x,z,p.infraSeed)*32);
    context.fillStyle=`rgb(${shade},${shade},${shade})`;context.fillRect(x,z,1+(i%3===0?1:0),1);}
   if(p.infraSurface==='pavers'){context.strokeStyle='#747474';context.lineWidth=2;
    for(let y=0;y<128;y+=32){context.beginPath();context.moveTo(0,y);context.lineTo(128,y);context.stroke();
     for(let x=(y%64===0?0:16);x<128;x+=32){context.beginPath();context.moveTo(x,y);context.lineTo(x,y+32);context.stroke();}}}
   const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(1,1);mat.map=tex;
  }
 }
 return mat;
}
function createBox(parts,w,h,d,x,y,z,yaw,mat,collider=true){
 const part=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.01,w),Math.max(.01,h),Math.max(.01,d)),mat);
 part.position.set(x,y,z);part.rotation.y=yaw;part.castShadow=collider;part.receiveShadow=true;part.userData.furniturePart=collider;
 parts.push(part);return part;
}
function addBatch(parts,geometry,material,items){
 if(!items.length)return;
 const mesh=new THREE.InstancedMesh(geometry,material,items.length),mat=new THREE.Matrix4(),rot=new THREE.Quaternion(),scale=new THREE.Vector3(),pos=new THREE.Vector3();
 for(let i=0;i<items.length;i++){
  const it=items[i];pos.set(it.x,it.y,it.z);rot.setFromAxisAngle(new THREE.Vector3(0,1,0),it.yaw||0);scale.set(it.sx||1,it.sy||1,it.sz||1);
  mat.compose(pos,rot,scale);mesh.setMatrixAt(i,mat);
 }
 mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=false;mesh.receiveShadow=true;mesh.userData.furniturePart=false;parts.push(mesh);
}
function along(seg,t,offset=0){
 // Local +X is the path direction, local +Z the transverse side.
 const c=Math.cos(seg.yaw),sn=Math.sin(seg.yaw);
 return [seg.x+c*t+sn*offset,seg.z-sn*t+c*offset];
}
function addRoad(seg,p,parts,batches,materials){
 const roadWidth=p.infraType==='footpath'?p.infraWidth:p.infraType==='curb'?Math.max(.12,p.infraWidth*.12):p.infraWidth;
 const roadThick=p.infraType==='curb'?p.infraCurbHeight:Math.max(.065,p.infraThickness);
 createBox(parts,seg.length,roadThick,roadWidth,seg.x,roadThick*.5+.006,seg.z,seg.yaw,materials.surface,true);
 if(p.infraType==='curb')return;
 const sideOffset=roadWidth/2;
 if(p.infraCurbs&&p.infraType==='road')for(const sign of [-1,1]){
  const [x,z]=along(seg,0,sign*(sideOffset+.075));
  createBox(parts,seg.length,p.infraCurbHeight,.15,x,p.infraCurbHeight/2, z,seg.yaw,materials.concrete,true);
 }
 if(p.infraSidewalks&&p.infraType==='road')for(const sign of [-1,1]){
  const [x,z]=along(seg,0,sign*(sideOffset+p.infraSidewalkWidth/2+.15));
  createBox(parts,seg.length,.13,p.infraSidewalkWidth,x,.065,z,seg.yaw,materials.concrete,true);
 }
 if(!p.infraMarkings||p.infraType!=='road')return;
 const y=roadThick+.008;
 // Solid outer lines and optional painted arrows are intentionally small raised surfaces.
 for(const side of [-1,1]){
  const [x,z]=along(seg,0,side*(sideOffset-.17));
  createBox(parts,seg.length,.007,p.infraMarkingWidth,x,y,z,seg.yaw,materials.edge,false);
 }
 // Distinct painted directional arrows make one-way roads visually recognizable.
 if(seg.length>3){
  const arrowCount=p.infraTraffic==='oneway'?1:Math.min(2,p.infraLanes);
  for(let n=0;n<arrowCount;n++){
   const sideOffset=p.infraTraffic==='oneway'?0:(n===0?-roadWidth*.25:roadWidth*.25);
   const sign=p.infraTraffic==='oneway'||n===0?1:-1;
   const at=along(seg,0,sideOffset);
   createBox(parts,.75,.007,p.infraMarkingWidth,at[0],y,at[1],seg.yaw,materials.marking,false);
   const tip=along(seg,sign*.52,sideOffset);
   for(const dir of [-1,1])createBox(parts,.35,.007,p.infraMarkingWidth,tip[0]-Math.cos(seg.yaw)*sign*.11,y,tip[1]+dir*.09,seg.yaw+dir*.65,materials.marking,false);
  }
 }
 const laneWidth=roadWidth/p.infraLanes;
 for(let lane=1;lane<p.infraLanes;lane++){
  const off=-sideOffset+laneWidth*lane;
  const divider=p.infraTraffic==='twoway'&&p.infraLanes>1&&lane===Math.floor(p.infraLanes/2);
  const material=divider?materials.centre:materials.marking;
  for(let t=-seg.length/2;t<seg.length/2&&batches.stripes.length<650;t+=p.infraDashLength+p.infraDashGap){
   const remain=Math.min(p.infraDashLength,seg.length/2-t);if(remain<=.05)continue;
   const [x,z]=along(seg,t+remain*.5,off);
   batches.stripes.push({x,y,z,yaw:seg.yaw,sx:remain,sy:1,sz:p.infraMarkingWidth,color:material});
  }
 }
}
function addFence(seg,p,parts,batches,materials){
 const h=p.infraHeight,spacing=p.infraPostSpacing,thick=p.infraThickness;
 if(p.infraType==='pathWall'){
  createBox(parts,seg.length,h,Math.max(.08,thick),seg.x,h*.5,seg.z,seg.yaw,materials.frame,true);
  return;
 }
 const count=Math.max(1,Math.min(90,Math.ceil(seg.length/spacing)));const step=seg.length/count;
 for(let i=0;i<=count;i++){
  const [x,z]=along(seg,-seg.length/2+i*step);
  batches.posts.push({x,y:h*.5,z,yaw:seg.yaw,sx:p.infraType==='hedge'?1:thick*1.6,sy:h,sz:p.infraType==='hedge'?1:thick*1.6});
 }
 if(p.infraType==='hedge'){
  createBox(parts,seg.length,Math.max(.24,h*.38),Math.min(1.6,Math.max(.16,p.infraWidth*.33)),seg.x,h*.22,seg.z,seg.yaw,materials.leaf,true);
  const pieces=Math.min(100,Math.max(2,Math.round(seg.length*2.3*p.infraHedgeDensity)));
  for(let i=0;i<pieces;i++){
   const t=-seg.length/2+(i+.5)*seg.length/pieces;
   const [x,z]=along(seg,t,(Math.sin(i*1.91+p.infraSeed)*.15));
   const radius=Math.min(2,Math.max(.22,p.infraWidth*.38));
   batches.leaves.push({x,y:h*(.55+.1*Math.sin(i+p.infraSeed)),z,yaw:seg.y,sx:radius,sy:h*.55,sz:radius*.8});
  }
  return;
 }
 if(p.infraStyle==='plank'){
  const step=Math.max(.06,p.infraPicketWidth+p.infraGap);
  for(let t=-seg.length/2+step*.5;t<seg.length/2&&batches.pickets.length<1100;t+=step){
   const [x,z]=along(seg,t);
   batches.pickets.push({x,y:h*.5,z,yaw:seg.y,sx:p.infraPicketWidth,sy:h,sz:Math.max(.025,thick*.75)});
  }
 }else if(p.infraStyle==='rods'){
  for(let t=-seg.length/2;t<=seg.length/2&&batches.rods.length<1100;t+=Math.max(.08,p.infraGap+.09)){
   const [x,z]=along(seg,t);
   batches.rods.push({x,y:h*.5,z,yaw:seg.y,sx:.04,sy:h,sz:.04});
  }
 }else if(p.infraStyle==='mesh'){
  const pitch=.25;const across=Math.min(24,Math.ceil(h/pitch));
  for(let j=0;j<=across&&batches.meshWires.length<900;j++){
   const y=.05+j*h/across;
   batches.meshWires.push({x:seg.x,y,z:seg.z,yaw:seg.y,sx:seg.length,sy:.015,sz:.014});
  }
  const alongCount=Math.min(90,Math.ceil(seg.length/pitch));
  for(let i=0;i<=alongCount&&batches.meshWires.length<900;i++){
   const [x,z]=along(seg,-seg.length/2+seg.length*i/alongCount);
   batches.meshWires.push({x,y:h*.5,z,yaw:seg.yaw,sx:.015,sy:h,sz:.014});
  }
 }
 if(p.infraStyle!=='mesh')for(const height of [h*.27,h*.77])createBox(parts,seg.length,thick*.42,thick*.8,seg.x,height,seg.z,seg.yaw,materials.frame,true);
}
export function infrastructureParts(raw){
 const p=cleanInfrastructure(raw),parts=[],segments=infrastructureSegments(p);
 const materials={surface:surfaceMaterial(p),frame:standard(p.infraColour,{metalness:p.infraStyle==='rods'||p.infraStyle==='mesh'?.52:0}),concrete:standard('#9b9992'),marking:standard(p.infraMarkingColour),centre:standard('#e9be4b'),edge:standard('#dfdfd2'),leaf:standard(p.infraHedgeColour,{flatShading:true})};
 const batches={posts:[],pickets:[],rods:[],meshWires:[],leaves:[],stripes:[],lampPosts:[],lampHeads:[]};
 for(const seg of segments){
  if(['road','footpath','curb'].includes(p.infraType))addRoad(seg,p,parts,batches,materials);
  else addFence(seg,p,parts,batches,materials);
 }
 if(p.infraType==='road'&&p.infraStreetlights){
  const sampled=[];
  for(const seg of segments){
   const count=Math.min(24,Math.ceil(seg.length/p.infraLightSpacing));
   for(let i=0;i<=count&&sampled.length<90;i++){
    const t=-seg.length/2+i*seg.length/Math.max(1,count);
    for(const side of [-1,1]){
     const [x,z]=along(seg,t,side*(p.infraWidth/2+(p.infraSidewalks?p.infraSidewalkWidth+.3:.6)));
     if(sampled.some(pt=>Math.hypot(pt[0]-x,pt[1]-z)<p.infraLightSpacing*.4))continue;
     sampled.push([x,z]);batches.lampPosts.push({x,y:p.infraLightHeight*.5,z,sx:.075,sy:p.infraLightHeight,sz:.075});
     batches.lampHeads.push({x,y:p.infraLightHeight+.04,z,sx:.42,sy:.095,sz:.28});
    }
   }
  }
  if(p.infraLampsOn){
   // A strict local-light budget protects WebXR; all the other lanterns remain emissive.
   const budget=Math.min(3,batches.lampHeads.length);
   for(let i=0;i<budget;i++){
    const it=batches.lampHeads[Math.floor((i+.5)*batches.lampHeads.length/budget)];
    const light=new THREE.PointLight('#ffe7b9',1.4,12,2);light.position.set(it.x,it.y,it.z);light.userData.furniturePart=false;parts.push(light);
   }
  }
 }
 const postMat=p.infraType==='hedge'?standard('#5a5e3e'):materials.frame;
 addBatch(parts,new THREE.BoxGeometry(1,1,1),postMat,batches.posts);
 addBatch(parts,new THREE.BoxGeometry(1,1,1),materials.frame,batches.pickets);
 addBatch(parts,new THREE.CylinderGeometry(.5,.5,1,5),materials.frame,batches.rods);
 addBatch(parts,new THREE.BoxGeometry(1,1,1),materials.frame,batches.meshWires);
 addBatch(parts,new THREE.IcosahedronGeometry(1,0),materials.leaf,batches.leaves);
 const yellow=batches.stripes.filter(it=>it.color===materials.centre),white=batches.stripes.filter(it=>it.color!==materials.centre);
 addBatch(parts,new THREE.BoxGeometry(1,.006,1),materials.marking,white);
 addBatch(parts,new THREE.BoxGeometry(1,.006,1),materials.centre,yellow);
 addBatch(parts,new THREE.CylinderGeometry(.5,.6,1,6),materials.frame,batches.lampPosts);
 addBatch(parts,new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:'#fff0c4',emissive:p.infraLampsOn?'#ffe4a1':'#171b1f',emissiveIntensity:p.infraLampsOn?1.15:0}),batches.lampHeads);
 return parts;
}
