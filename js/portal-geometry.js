import * as THREE from 'three';
import {cleanPortal} from './portal-core.js';
import {wallPresetTexture} from './office-walls.js';
const textures=new Map();
function frameTexture(name){if(name==='none')return null;if(!textures.has(name))textures.set(name,wallPresetTexture(name==='metal'?'concrete':name==='tiles'?'plaster':name));return textures.get(name);}
function slab(group,x,y,z,w,h,d,mat,tag='portalFrame'){
 const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
 m.position.set(x,y,z);m.userData[tag]=true;m.castShadow=true;m.receiveShadow=true;group.add(m);return m;
}
export function rebuildPortal(group,raw){
 const c=cleanPortal(raw);
 // Independent top/bottom/side slabs leave a real traversable opening.
 for(const child of [...group.children]){group.remove(child);child.geometry?.dispose?.();if(child.material&&!child.userData?.sharedMaterial)child.material.dispose?.();}
 group.userData.portal=c;
 const frame=new THREE.MeshStandardMaterial({color:c.color,roughness:.65,metalness:.12,transparent:c.opacity<1,opacity:c.opacity,map:frameTexture(c.texture),side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
 const w=c.width,h=c.height,d=c.depth,ow=Math.min(c.openingWidth,w-.2),oh=Math.min(c.openingHeight,h-.12),side=(w-ow)/2;
 slab(group,-w/2+side/2,h/2,0,side,h,d,frame);
 slab(group,w/2-side/2,h/2,0,side,h,d,frame);
 slab(group,0,oh+(h-oh)/2,0,ow,h-oh,d,frame);
 const glow=new THREE.MeshBasicMaterial({color:'#54d6ff',transparent:true,opacity:.17,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 // Thin strips are intentionally offset in Z from the structural frame.
 for(const x of [-ow/2,ow/2])slab(group,x,oh/2,-d/2-.013,.025,oh,.024,glow,'portalGlow');
 slab(group,0,oh,-d/2-.013,ow,.025,.024,glow,'portalGlow');
 if(c.role==='entry'&&c.mode==='button'){
  const key=new THREE.Mesh(new THREE.CylinderGeometry(.095,.095,.07,16),new THREE.MeshStandardMaterial({color:'#dd3c5f',emissive:'#8d1f40',emissiveIntensity:.45}));
  key.rotation.x=Math.PI/2;key.position.set(w/2+.18,1.12,-d/2-.065);key.userData.portalButton=true;key.name='Activate portal';group.add(key);
 }
 return group;
}
export function makePortal(config={}){const group=new THREE.Group();group.userData.editorKind='portal';group.name=config.role==='exit'?'Portal Exit':'Portal Entry';return rebuildPortal(group,config);}
export function portalPulse(group,amount){
 const wave=.35+.65*Math.abs(Math.sin(performance.now()*.011));
 group.traverse(part=>{if(part.userData.portalGlow&&part.material){part.material.opacity=Math.min(.72,.17+Math.max(0,amount)*.52*wave);}});
}
