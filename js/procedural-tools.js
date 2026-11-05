// v0.2.193 Lightweight editable tool silhouettes: no imported meshes or runtime assets.
import * as THREE from 'three';
export const TOOL_TYPES=Object.freeze(['shovel','axe','rake','stick','broom','mop','saw']);
export const TOOL_NUMERIC={handleLength:[1.1,.18,3],handleRadius:[.025,.007,.09],headWidth:[.22,.035,.85],headDepth:[.14,.012,.45]};
export function buildTool(p,{box,cylinder,add}){
 const metal=new THREE.MeshStandardMaterial({color:p.metalColor,metalness:.7,roughness:.38});
 const bristles=new THREE.MeshStandardMaterial({color:p.fabricColor,roughness:.95});
 const handle=p.handleLength,r=p.handleRadius,headW=p.headWidth,headD=p.headDepth;
 // Handles are separate cylinders and stay independently collidable/pickable.
 if(p.variant==='saw'){
  const grip=box(handle*.28,r*3,r*3,-handle*.35,handle*.20,0);
  grip.userData.toolHandle=true;
  const blade=box(handle*.7,Math.max(.045,headW*.27),Math.max(.008,r*.44),handle*.12,handle*.20,0,metal);
  blade.userData.toolBlade=true;
  for(let i=0;i<9;i++){
   const tooth=box(handle*.045,.018,.012,-handle*.2+i*handle*.07,handle*.20-headW*.15,0,metal);tooth.userData.toolTooth=true;
  }
  return;
 }
 cylinder(r,handle,0,handle/2,0);
 if(p.variant==='stick')return;
 if(p.variant==='shovel'){
  box(headW,headD*1.65,Math.max(.018,r*.7),0,handle+headD*.32,0,metal);
  const point=add(new THREE.ConeGeometry(headW*.38,headD*.5,4),0,handle+headD*1.22,0,metal);point.rotation.z=Math.PI;
 }else if(p.variant==='axe'){
  box(headW,headD,Math.max(.035,r*2.5),headW*.22,handle-headD*.5,0,metal);
  const edge=box(.024,headD*1.08,Math.max(.042,r*3),headW*.75,handle-headD*.5,0,metal);edge.userData.toolBlade=true;
 }else if(p.variant==='rake'){
  box(headW,.045,.055,0,handle+.015,0,metal);
  const count=Math.max(3,Math.floor(headW/.052));for(let i=0;i<count;i++)cylinder(.009,headD,-headW/2+(i+.5)*headW/count,handle-headD/2,0,metal,6);
 }else if(p.variant==='broom'){
  box(headW,.07,headD,0,.085,0);
  box(headW,.115,headD*.98,0,.19,0,bristles);
  // A broom head sits near the floor; handle still reaches its full length.
 }else if(p.variant==='mop'){
  box(headW,.042,headD,0,.06,0,metal);
  for(let i=0;i<11;i++){
   const x=-headW*.45+i*headW*.09;
   const strand=cylinder(.011,.13,x,.095,0,bristles,5);strand.userData.mopFibre=true;
  }
 }
}
