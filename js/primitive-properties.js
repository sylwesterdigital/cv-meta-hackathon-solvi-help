import * as THREE from 'three';
import {wallPresetTexture} from './office-walls.js';

// Parameter bounds prevent generating enormous meshes through a shared scene payload.
export const PRIMITIVE_FIELDS={
 cube:{width:[1,.05,30],height:[1,.05,30],depth:[1,.05,30],widthSegments:[1,1,32],heightSegments:[1,1,32],depthSegments:[1,1,32]},
 sphere:{radius:[.55,.05,20],widthSegments:[28,3,96],heightSegments:[18,2,64]},
 cylinder:{radiusTop:[.4,0,20],radiusBottom:[.4,0,20],height:[1.2,.05,30],radialSegments:[32,3,96],heightSegments:[1,1,32]},
 plane:{width:[1.7,.05,30],height:[1.7,.05,30],widthSegments:[1,1,32],heightSegments:[1,1,32]},
 torus:{radius:[.52,.05,20],tube:[.17,.01,10],radialSegments:[15,3,96],tubularSegments:[40,3,128]},
};
export function sanitisePrimitive(kind,input={}){
 const fields=PRIMITIVE_FIELDS[kind];if(!fields)return null;
 const result={};
 for(const [key,[defaultValue,min,max]] of Object.entries(fields)){
  const value=Number(input?.[key]);const valid=Number.isFinite(value)?value:defaultValue;
  result[key]=key.endsWith('Segments')?Math.round(Math.max(min,Math.min(max,valid))):Math.max(min,Math.min(max,valid));
 }
 return result;
}
export function buildPrimitive(kind,values){
 const p=sanitisePrimitive(kind,values);if(!p)return null;
 if(kind==='cube')return new THREE.BoxGeometry(p.width,p.height,p.depth,p.widthSegments,p.heightSegments,p.depthSegments);
 if(kind==='sphere')return new THREE.SphereGeometry(p.radius,p.widthSegments,p.heightSegments);
 if(kind==='cylinder')return new THREE.CylinderGeometry(p.radiusTop,p.radiusBottom,p.height,p.radialSegments,p.heightSegments);
 if(kind==='plane')return new THREE.PlaneGeometry(p.width,p.height,p.widthSegments,p.heightSegments);
 if(kind==='torus')return new THREE.TorusGeometry(p.radius,p.tube,p.radialSegments,p.tubularSegments);
 return null;
}


// Basic furniture is built from individually collidable, editable primitive parts.
// Keeping it here avoids a new module and preserves the deployment watcher's file budget.
export const FURNITURE_TYPES=['table','chair','stool','bed','armchair','sofa','cabinet'];
export const FURNITURE_NUMERIC={
 width:[1.2,.35,8],depth:[.75,.3,4],height:[.76,.2,4],
 topThickness:[.07,.025,.3],topRadius:[.55,.15,4],legRadius:[.04,.025,.3],
 corners:[4,3,8],seatHeight:[.46,.25,.9],backHeight:[.5,.2,1.3],
 shelves:[3,0,16],seats:[2,1,4],cushionThickness:[.14,.05,.35]
};
const furniturePreset={
 table:{width:1.4,depth:.8,height:.75,legStyle:'four'},
 stool:{width:.42,depth:.42,height:.48,legStyle:'four'},
 chair:{width:.52,depth:.55,height:.94,seatHeight:.46,backHeight:.46,legStyle:'four'},
 armchair:{width:.88,depth:.85,height:1.02,seatHeight:.43,backHeight:.59,legStyle:'four'},
 sofa:{width:1.85,depth:.86,height:1.02,seatHeight:.44,backHeight:.58,legStyle:'four',seats:2},
 bed:{width:1.5,depth:2.05,height:.52,seatHeight:.42,legStyle:'four'},
 cabinet:{width:1.05,depth:.4,height:1.8,shelves:3,legStyle:'none'}
};
export function sanitiseFurniture(raw={}){
 const variant=FURNITURE_TYPES.includes(raw.variant)?raw.variant:'table';
 const defaults=furniturePreset[variant],result={variant};
 for(const [key,[def,min,max]] of Object.entries(FURNITURE_NUMERIC)){
  const source=raw[key]??defaults[key]??def;
  const value=Number(source);
  result[key]=['corners','shelves','seats'].includes(key)?Math.round(Math.max(min,Math.min(max,Number.isFinite(value)?value:(defaults[key]??def)))):Math.max(min,Math.min(max,Number.isFinite(value)?value:(defaults[key]??def)));
 }
 if(variant==='sofa'&&raw.width===undefined)result.width=result.seats*.82+.22;
 result.topShape=['rectangle','polygon','round'].includes(raw.topShape)?raw.topShape:'rectangle';
 result.legStyle=['four','three','single','casters','none'].includes(raw.legStyle)?raw.legStyle:defaults.legStyle;
 result.headrest=raw.headrest===true;
 result.headboard=raw.headboard!==false;
 result.color=typeof raw.color==='string'&&/^#[0-9a-f]{6}$/i.test(raw.color)?raw.color:'#9b8068';
 result.fabricColor=typeof raw.fabricColor==='string'&&/^#[0-9a-f]{6}$/i.test(raw.fabricColor)?raw.fabricColor:'#64798e';
 result.texture=['none','plaster','concrete','bricks','metal'].includes(raw.texture)?raw.texture:'none';
 return result;
}
export function rebuildFurniture(group,raw={}){
 const p=sanitiseFurniture(raw);const wood=new THREE.MeshStandardMaterial({color:p.color,roughness:.68});
 if(p.texture!=='none'){wood.map=wallPresetTexture(p.texture==='metal'?'concrete':p.texture);if(p.texture==='metal'){wood.metalness=.6;wood.roughness=.35;}}
 const fabric=new THREE.MeshStandardMaterial({color:p.fabricColor,roughness:.9});
 const parts=[];
 const add=(geometry,x,y,z,mat=wood)=>{const part=new THREE.Mesh(geometry,mat);part.position.set(x,y,z);part.userData.furniturePart=true;part.castShadow=true;part.receiveShadow=true;parts.push(part);return part;};
 const box=(w,h,d,x,y,z,mat)=>add(new THREE.BoxGeometry(w,h,d),x,y,z,mat);
 const cylinder=(radius,height,x,y,z,mat=wood,sides=16)=>add(new THREE.CylinderGeometry(radius,radius,height,sides),x,y,z,mat);
 const legs=(height,style=p.legStyle,width=p.width,depth=p.depth)=>{
  if(style==='none'||height<=.03)return;
  if(style==='single'){cylinder(Math.min(.13,width*.22),height,0,height/2,0);cylinder(Math.min(width,depth)*.29,.055,0,.028,0);return;}
  const polygon=p.topShape==='polygon'&&['table','stool'].includes(p.variant);
  const circular=p.topShape!=='rectangle'&&['table','stool'].includes(p.variant);
  const count=style==='three'?3:polygon?p.corners:4;
  for(let i=0;i<count;i++){
   const ang=(polygon?0:Math.PI*.25)+i*Math.PI*2/count;
   const x=(circular?p.topRadius*.76:width*.38*Math.SQRT2)*Math.cos(ang),z=(circular?p.topRadius*.76:depth*.38*Math.SQRT2)*Math.sin(ang);
   cylinder(p.legRadius,Math.max(.04,height-(style==='casters'?.09:0)),x,height/2+(style==='casters'?.04:0),z);
   if(style==='casters')cylinder(p.legRadius*1.3,.08,x,.04,z,fabric,12);
  }
 };
 if(p.variant==='table'||p.variant==='stool'){
  const topY=p.height-p.topThickness/2;
  if(p.topShape!=='rectangle'){const sides=p.topShape==='round'?48:p.corners;add(new THREE.CylinderGeometry(p.topRadius,p.topRadius,p.topThickness,sides),0,topY,0);}
  else box(p.width,p.topThickness,p.depth,0,topY,0);
  legs(p.height-p.topThickness);
 }else if(['chair','armchair','sofa'].includes(p.variant)){
  const arm=p.variant!=='chair',seatY=p.seatHeight;
  box(p.width,.09,p.depth,0,seatY-.055,0);
  box(p.width-(arm?.16:.04),p.cushionThickness,p.depth*.73,0,seatY+p.cushionThickness/2,-p.depth*.06,fabric);
  box(p.width,Math.max(.2,p.backHeight),.13,0,seatY+p.backHeight/2,p.depth*.5-.065,arm?fabric:wood);
  if(arm){for(const side of [-1,1])box(.14,.25,p.depth*.85,side*(p.width/2-.07),seatY+.13,0,fabric);}
  if(p.headrest){box(p.width*.78,.19,.18,0,seatY+p.backHeight+.085,p.depth*.5-.09,fabric);}
  if(p.variant==='sofa')for(let i=1;i<p.seats;i++)box(.035,p.cushionThickness*.8,p.depth*.71,-p.width/2+i*p.width/p.seats,seatY+p.cushionThickness/2,-p.depth*.06,wood);
  legs(Math.max(.08,seatY-.1));
 }else if(p.variant==='bed'){
  const mattressHeight=p.cushionThickness*1.45,baseY=p.legStyle==='none'?.16:p.height;
  box(p.width,.16,p.depth,0,baseY-.08,0);
  box(p.width*.97,mattressHeight,p.depth*.96,0,baseY+mattressHeight/2,0,fabric);
  if(p.headboard)box(p.width,.65,.12,0,baseY+.20,p.depth/2-.03);
  legs(p.legStyle==='none'?0:Math.max(0,p.height-.24));
 }else if(p.variant==='cabinet'){
  const t=Math.min(.06,p.width*.08,p.depth*.12);
  for(const side of [-1,1])box(t,p.height,p.depth,side*(p.width-t)/2,p.height/2,0);
  box(p.width,t,p.depth,0,t/2,0);box(p.width,t,p.depth,0,p.height-t/2,0);
  box(p.width-2*t,p.height-2*t,t,0,p.height/2,p.depth/2-t/2);
  for(let i=1;i<=p.shelves;i++)box(p.width-2*t,t,p.depth-t,0,t+(p.height-2*t)*i/(p.shelves+1),-t/2);
 }
 // Build before changing the old object, so an unsupported geometry cannot erase it.
 const materials=new Set();for(const child of [...group.children]){group.remove(child);child.geometry?.dispose?.();if(child.material)materials.add(child.material);}for(const mat of materials){mat.map?.dispose?.();mat.dispose?.();}
 for(const part of parts)group.add(part);
 group.userData.furniture=p;group.userData.editorKind='furniture';
 return p;
}
export function makeFurniture(raw={}){const group=new THREE.Group();rebuildFurniture(group,raw);group.name='Furniture · '+group.userData.furniture.variant;return group;}
