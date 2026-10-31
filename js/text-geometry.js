import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import {cleanText} from './text-parameters.js';
const fontCache=new Map();
function fontFor(name){
 if(!fontCache.has(name))fontCache.set(name,new FontLoader().loadAsync('./vendor/three/fonts/'+name+'_regular.typeface.json').catch(error=>{fontCache.delete(name);throw error;}));
 return fontCache.get(name);
}
// Canvas fallback allows text to be visible while the bundled typeface loads.
function fallbackText(obj,p){
 const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');
 ctx.clearRect(0,0,1024,256);ctx.fillStyle='#ffffff';ctx.font='bold 150px '+(p.font==='optimer'?'serif':p.font==='gentilis'?'Georgia':'sans-serif');
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p.content||' ',512,135,1000);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
 const previous=obj.geometry,oldMaterial=obj.material,color=obj.material?.color?.clone?.()||new THREE.Color('#f2f5ff');
 obj.geometry=new THREE.PlaneGeometry(Math.max(.1,p.size*3.7),p.size);
 obj.material=new THREE.MeshBasicMaterial({map:texture,color,transparent:true,side:THREE.DoubleSide});
 previous?.dispose();oldMaterial?.map?.dispose?.();oldMaterial?.dispose?.();
}
export function makeEditableText(){
 const obj=new THREE.Mesh(new THREE.PlaneGeometry(2,.5),new THREE.MeshStandardMaterial({color:'#f2f5ff',roughness:.75,side:THREE.DoubleSide}));
 obj.userData.text=cleanText();rebuildText(obj,obj.userData.text);return obj;
}
export function rebuildText(obj,settings,onComplete){
 const p=cleanText(settings);obj.userData.text=p;const serial=(obj.userData.textBuildSerial||0)+1;obj.userData.textBuildSerial=serial;
 fallbackText(obj,p);
 fontFor(p.font).then(font=>{
  if(obj.userData.textBuildSerial!==serial)return;
  const geometry=new TextGeometry(p.content||' ',{font,size:p.size,depth:Math.max(.0001,p.extrude),curveSegments:6,steps:1,bevelEnabled:p.bevel>0&&p.extrude>0,bevelThickness:Math.min(p.bevel,p.extrude/2),bevelSize:p.bevel,bevelSegments:2});
  geometry.computeBoundingBox();const box=geometry.boundingBox;if(box)geometry.translate(-(box.min.x+box.max.x)/2,-(box.min.y+box.max.y)/2,-(box.min.z+box.max.z)/2);
  const prev=obj.geometry,material=obj.material,color=material?.color?.clone?.()||new THREE.Color('#f2f5ff');
  obj.geometry=geometry;obj.material=new THREE.MeshStandardMaterial({color,roughness:.72,metalness:.03,side:THREE.DoubleSide});
  prev?.dispose();material?.map?.dispose?.();material?.dispose?.();onComplete?.();
 }).catch(error=>{console.warn('Text typeface not loaded:',error);});
 return p;
}
