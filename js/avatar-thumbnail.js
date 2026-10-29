import * as THREE from 'three';
import {renderModelThumbnail} from './preview-renderer.js';

export const AVATAR_THUMB_WIDTH=416;
export const AVATAR_THUMB_HEIGHT=544;

// Fit a whole humanoid in a portrait viewport, with a natural slight 3/4 perspective.
// The camera used to assume landscape and crop a 176x142 render into a tall tile.
export function avatarFramingDistance(width,height,depth,verticalFov=32,aspect=AVATAR_THUMB_WIDTH/AVATAR_THUMB_HEIGHT){
 const v=Math.tan(verticalFov*Math.PI/360);
 const h=v*aspect;
 return Math.max(height/(2*v),width/(2*h),0.1)*1.24+depth*.7;
}
export function renderAvatarPortrait(model){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#17283a');
 const bounds=new THREE.Box3().setFromObject(model);
 if(bounds.isEmpty())throw new Error('Model has no visible geometry');
 const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 model.position.sub(center);scene.add(model);
 scene.add(new THREE.HemisphereLight(0xe8f4ff,0x485b6b,3.0));
 const key=new THREE.DirectionalLight(0xffffff,3.0);key.position.set(-2,5,6);scene.add(key);
 const fill=new THREE.DirectionalLight(0x9edaff,1.35);fill.position.set(4,2,-3);scene.add(fill);
 const camera=new THREE.PerspectiveCamera(32,AVATAR_THUMB_WIDTH/AVATAR_THUMB_HEIGHT,.01,100000);
 const distance=avatarFramingDistance(size.x,size.y,size.z);
 camera.position.set(distance*.22,distance*.09,distance);camera.lookAt(0,0,0);
 return renderModelThumbnail(scene,camera,AVATAR_THUMB_WIDTH,AVATAR_THUMB_HEIGHT,{type:'image/webp',quality:.92});
}
export function disposeAvatarPreview(model){
 // GLTFLoader makes a fresh scene for each gallery preview. Dispose its GPU
 // allocations once the JPEG/WebP has been captured; never dispose live world models.
 const geometries=new Set(),materials=new Set(),textures=new Set();
 model.traverse(node=>{
  if(node.geometry)geometries.add(node.geometry);
  for(const m of (Array.isArray(node.material)?node.material:[node.material]))if(m)materials.add(m);
 });
 for(const material of materials){
  for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
  material.dispose();
 }
 for(const texture of textures)texture.dispose();
 for(const geometry of geometries)geometry.dispose();
}
