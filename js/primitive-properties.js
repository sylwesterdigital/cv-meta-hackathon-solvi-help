import * as THREE from 'three';
import {wallPresetTexture} from './office-walls.js';
import {EQUIPMENT_TYPES,EQUIPMENT_NUMERIC,buildEquipment} from './procedural-equipment.js';

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
export const BASIC_PROP_TYPES=['plate','mug','glass','bowl','bottle','can','flowerpot','box'];
export const FURNITURE_TYPES=['table','chair','stool','bed','armchair','sofa','cabinet',...BASIC_PROP_TYPES,...EQUIPMENT_TYPES];
export const FURNITURE_NUMERIC={
 width:[1.2,.06,8],depth:[.75,.06,4],height:[.76,.025,4],
 topThickness:[.07,.025,.3],topRadius:[.55,.15,4],legRadius:[.04,.025,.3],
 corners:[4,3,8],seatHeight:[.46,.25,.9],backHeight:[.5,.2,1.3],
 shelves:[3,0,16],seats:[2,1,4],cushionThickness:[.14,.05,.35],
 wallThickness:[.025,.005,.15],neckRadius:[.065,.01,.5],neckHeight:[.12,.02,.6],
 rimHeight:[.018,.005,.1],...EQUIPMENT_NUMERIC,textureScale:[1,.25,5],textureDistortion:[.38,0,2],textureContrast:[1,.2,3]
};
const furniturePreset={
 table:{width:1.4,depth:.8,height:.75,legStyle:'four'},
 stool:{width:.42,depth:.42,height:.48,legStyle:'four'},
 chair:{width:.52,depth:.55,height:.94,seatHeight:.46,backHeight:.46,legStyle:'four'},
 armchair:{width:.88,depth:.85,height:1.02,seatHeight:.43,backHeight:.59,legStyle:'four'},
 sofa:{width:1.85,depth:.86,height:1.02,seatHeight:.44,backHeight:.58,legStyle:'four',seats:2},
 bed:{width:1.5,depth:2.05,height:.52,seatHeight:.42,legStyle:'four'},
 cabinet:{width:1.05,depth:.4,height:1.8,shelves:3,legStyle:'none'},
 plate:{width:.28,depth:.28,height:.035,legStyle:'none'},
 mug:{width:.09,depth:.09,height:.105,legStyle:'none'},
 glass:{width:.075,depth:.075,height:.14,legStyle:'none'},
 bowl:{width:.19,depth:.19,height:.085,legStyle:'none'},
 bottle:{width:.085,depth:.085,height:.27,legStyle:'none'},
 can:{width:.066,depth:.066,height:.12,legStyle:'none'},
 flowerpot:{width:.22,depth:.22,height:.23,legStyle:'none'},
 box:{width:.35,depth:.3,height:.28,legStyle:'none'},
 tv:{width:1.21,depth:.12,height:.73,legStyle:'none'},monitor:{width:.61,depth:.13,height:.42,legStyle:'none'},
 miniComputer:{width:.2,depth:.2,height:.08,legStyle:'none'},bin:{width:.35,depth:.35,height:.5,legStyle:'none'},backpack:{width:.35,depth:.2,height:.45,legStyle:'none'},
 sunbed:{width:.8,depth:1.95,height:.31,legStyle:'none'},deckChair:{width:.64,depth:1.72,height:.42,legStyle:'none'},
 beachUmbrella:{width:2.4,depth:2.4,height:2.15,legStyle:'none'}
};
export function sanitiseFurniture(raw={}){
 const variant=FURNITURE_TYPES.includes(raw.variant)?raw.variant:'table';
 const defaults=furniturePreset[variant],result={variant};
 for(const [key,[def,min,max]] of Object.entries(FURNITURE_NUMERIC)){
  const source=raw[key]??defaults[key]??def;
  const value=Number(source);
  result[key]=['corners','shelves','seats','canopySegments'].includes(key)?Math.round(Math.max(min,Math.min(max,Number.isFinite(value)?value:(defaults[key]??def)))):Math.max(min,Math.min(max,Number.isFinite(value)?value:(defaults[key]??def)));
 }
 if(variant==='sofa'&&raw.width===undefined)result.width=result.seats*.82+.22;
 result.topShape=['rectangle','polygon','round'].includes(raw.topShape)?raw.topShape:'rectangle';
 result.legStyle=['four','three','single','casters','none'].includes(raw.legStyle)?raw.legStyle:defaults.legStyle;
 result.handle=raw.handle!==false;result.cap=raw.cap!==false;result.soil=raw.soil===true;result.openTop=raw.openTop!==false;
 result.aspect=['16:9','21:9','4:3'].includes(raw.aspect)?raw.aspect:'16:9';
 result.mount=['wall','center','feet','none'].includes(raw.mount)?raw.mount:(variant==='tv'?'feet':'center');
 result.powered=raw.powered!==false;result.curved=raw.curved===true;result.binShape=raw.binShape==='square'?'square':'round';
 result.lid=raw.lid===true;result.straps=raw.straps!==false;result.frontPocket=raw.frontPocket===true;
 result.backpackStyle=raw.backpackStyle==='bag'?'bag':'box';
 result.channels=Array.isArray(raw.channels)?raw.channels.slice(0,12).filter(c=>c&&typeof c==='object'&&typeof c.url==='string'&&/^https:\/\//.test(c.url)&&/\.(?:m3u8|mp4|webm)(?:$|[?#])/i.test(c.url)).map(c=>({title:String(c.title||'Channel').slice(0,65),url:c.url.slice(0,1500)})):[];
 result.mediaId=typeof raw.mediaId==='string'&&/^[a-zA-Z0-9_-]{0,100}$/.test(raw.mediaId)?raw.mediaId:'';
 result.pairedDisplayId=typeof raw.pairedDisplayId==='string'&&/^[a-zA-Z0-9_-]{0,100}$/.test(raw.pairedDisplayId)?raw.pairedDisplayId:'';
 result.headrest=raw.headrest===true;
 result.headboard=raw.headboard!==false;
 result.color=typeof raw.color==='string'&&/^#[0-9a-f]{6}$/i.test(raw.color)?raw.color:'#9b8068';
 result.fabricColor=typeof raw.fabricColor==='string'&&/^#[0-9a-f]{6}$/i.test(raw.fabricColor)?raw.fabricColor:'#64798e';
 result.texture=['none','plaster','concrete','bricks','metal','wood','marble','granite'].includes(raw.texture)?raw.texture:'none';
 return result;
}
export function rebuildFurniture(group,raw={}){
 const p=sanitiseFurniture(raw);const wood=new THREE.MeshStandardMaterial({color:p.color,roughness:.68});
 if(p.texture!=='none'){wood.map=wallPresetTexture(p.texture==='metal'?'concrete':p.texture,{scale:p.textureScale,distortion:p.textureDistortion,contrast:p.textureContrast});if(p.texture==='metal'){wood.metalness=.6;wood.roughness=.35;}}
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
 }else if(EQUIPMENT_TYPES.includes(p.variant)){
  buildEquipment(p,{add,box,cylinder,wood,fabric});
 }else if(p.variant==='box'){
  const t=Math.min(p.wallThickness,p.width*.24,p.height*.24,p.depth*.24);
  box(p.width,t,p.depth,0,t/2,0);
  for(const side of [-1,1]){
   box(t,p.height-t,p.depth,side*(p.width-t)/2,(p.height+t)/2,0);
   box(p.width-2*t,p.height-t,t,0,(p.height+t)/2,side*(p.depth-t)/2);
  }
  if(!p.openTop)box(p.width,t,p.depth,0,p.height-t/2,0);
 }else if(BASIC_PROP_TYPES.includes(p.variant)){
  const radius=p.width/2,t=Math.min(p.wallThickness,radius*.35,p.height*.3);
  const profile=[];const point=(x,y)=>profile.push(new THREE.Vector2(Math.max(0,x),Math.max(0,y)));
  if(p.variant==='plate'){
   point(0,0);point(radius*.69,0);point(radius*.82,p.height*.22);point(radius,p.height);point(Math.max(0,radius-t),p.height);
   point(Math.max(0,radius*.79-t),p.height*.23);point(0,p.height*.23);
  }else if(p.variant==='bowl'){
   point(0,0);point(radius*.38,0);point(radius*.62,p.height*.18);point(radius,p.height);
   point(radius-t,p.height);point(radius*.56,p.height*.25);point(0,t);
  }else if(p.variant==='bottle'){
   const neck=Math.min(p.neckRadius,radius*.72);const top=Math.min(p.height*.43,p.neckHeight);
   point(0,0);point(radius*.8,0);point(radius,p.height*.1);point(radius,p.height-top*1.45);
   point(neck,p.height-top*.8);point(neck,p.height);point(Math.max(.01,neck-t),p.height);
   point(Math.max(.01,neck-t),p.height-top);point(radius-t,p.height-top*1.6);point(radius-t,t);point(0,t);
  }else{
   const wide=p.variant==='flowerpot'?radius:radius*.92;
   point(0,0);point(radius*.75,0);point(radius*.82,p.height*.08);point(wide,p.height);
   point(Math.max(.01,wide-t),p.height);point(Math.max(.01,radius*.82-t),t);point(0,t);
  }
  const vessel=add(new THREE.LatheGeometry(profile,32),0,0,0);
  vessel.userData.furnitureHollow=true;
  if(['mug','can','flowerpot','glass'].includes(p.variant)){
   const lip=new THREE.Mesh(new THREE.TorusGeometry(radius*.96,Math.max(.003,t*.26),6,32),wood);
   lip.rotation.x=Math.PI/2;lip.position.y=p.height;lip.userData.furniturePart=true;parts.push(lip);
  }
  if(p.variant==='mug'&&p.handle){
   const handle=add(new THREE.TorusGeometry(Math.max(.022,p.height*.31),Math.max(.006,t*.48),8,20,Math.PI*1.7),radius+.03,p.height*.53,0);
   handle.rotation.z=Math.PI/2;handle.userData.furnitureHandle=true;
  }
  if(p.variant==='bottle'&&p.cap)cylinder(Math.min(p.neckRadius,radius*.72)*1.05,.028,0,p.height+.014,0);
  if(p.variant==='flowerpot'&&p.soil)cylinder(radius*.72,.015,0,p.height*.85,0,new THREE.MeshStandardMaterial({color:'#50412e',roughness:1}),24);
  if(p.variant==='can'&&p.cap)cylinder(radius*.97,.008,0,p.height+.004,0,new THREE.MeshStandardMaterial({color:'#aeb8bc',metalness:.7,roughness:.35}),32);
 }
 // Build before changing the old object, so an unsupported geometry cannot erase it.
 const materials=new Set();for(const child of [...group.children]){group.remove(child);child.geometry?.dispose?.();if(child.material)materials.add(child.material);}for(const mat of materials){mat.map?.dispose?.();mat.dispose?.();}
 for(const part of parts)group.add(part);
 group.userData.furniture=p;group.userData.editorKind='furniture';
 return p;
}
export function makeFurniture(raw={}){const group=new THREE.Group();rebuildFurniture(group,raw);group.name='Furniture · '+group.userData.furniture.variant;return group;}
