import * as THREE from 'three';
import {sanitiseWall,wallSegments} from './office-wall-math.js';
export {sanitiseWall,simplifyWallPoints,smoothWallPoints,snapWallPoint,wallSegments,wallWorldToLocal} from './office-wall-math.js';

export function wallPresetTexture(name){
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
 ctx.fillStyle=name==='bricks'?'#bc876b':name==='concrete'?'#a0a5ab':'#e0e4de';ctx.fillRect(0,0,256,256);
 if(name==='bricks'){ctx.strokeStyle='#61554c';ctx.lineWidth=5;for(let row=0;row<8;row++){ctx.beginPath();ctx.moveTo(0,row*32);ctx.lineTo(256,row*32);ctx.stroke();for(let col=0;col<5;col++){const x=col*64+(row%2?32:0);ctx.beginPath();ctx.moveTo(x,row*32);ctx.lineTo(x,(row+1)*32);ctx.stroke();}}}
 else if(name==='concrete'){for(let i=0;i<250;i++){const x=(i*83)%256,y=(i*157)%256;ctx.fillStyle=i%3?'#969ca2':'#abb0b3';ctx.fillRect(x,y,2+i%4,2+i%3);}}
 else {ctx.fillStyle='#d5dad6';for(let i=0;i<30;i++)ctx.fillRect((i*41)%256,(i*71)%256,60,1);}
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1,1);return texture;
}
function loadCustomWallTexture(group,id){
 if(!id||!window.solviAPI?.mediaBlobInfo)return;
 const previous=group.userData.wallTextureSource;
 if(previous?.id===id)return;
 const state={id,token:Symbol('wall-texture')};group.userData.wallTextureSource=state;
 window.solviAPI.mediaBlobInfo(id).then(info=>{
  if(group.userData.wallTextureSource!==state){URL.revokeObjectURL(info.url);return;}
  new THREE.TextureLoader().load(info.url,tex=>{
   URL.revokeObjectURL(info.url);
   if(group.userData.wallTextureSource!==state){tex.dispose();return;}
   tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
   state.texture=tex;
   for(const child of group.children){if(child.userData.wallSegment){child.material.map=tex;child.material.needsUpdate=true;}}
  },undefined,()=>URL.revokeObjectURL(info.url));
 }).catch(()=>{});
}
export function rebuildOfficeWall(group,settings){
 const s=sanitiseWall(settings);
 const prior=group.userData.wallTextureSource;
 const retain=prior&&s.texture==='custom'&&s.textureMediaId===prior.id;
 for(const child of [...group.children]){group.remove(child);child.geometry?.dispose();if(child.material?.map&&child.material.map!==prior?.texture)child.material.map.dispose();child.material?.dispose?.();}
 if(prior&&!retain){prior.texture?.dispose();group.userData.wallTextureSource=null;}
 group.userData.wall=s;
 for(const seg of wallSegments(s)){
  const tex=s.texture==='glass'||s.texture==='custom'?(retain?prior.texture||null:null):wallPresetTexture(s.texture);
  const glass=s.texture==='glass';
  const material=new THREE.MeshPhysicalMaterial({color:s.color,map:tex,roughness:glass?.12:.82,metalness:0,transparent:s.opacity<1||glass,opacity:s.opacity,transmission:glass?.76:0,ior:1.45,thickness:glass?s.width:0,depthWrite:s.opacity>.98&&!glass,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(seg.length,s.height,s.width),material);mesh.position.set(seg.x,s.height/2,seg.z);mesh.rotation.y=seg.yaw;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.wallSegment=true;group.add(mesh);
 }
 if(s.texture==='custom'&&s.textureMediaId&&!retain)loadCustomWallTexture(group,s.textureMediaId);
 return group;
}
export function makeOfficeWall(settings={}){const group=new THREE.Group();group.userData.editorKind='wall';group.name='Office wall';group.userData.wall=sanitiseWall(settings);rebuildOfficeWall(group,group.userData.wall);return group;}
