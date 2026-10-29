import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';

const glb=new GLTFLoader(),fbx=new FBXLoader(),draco=new DRACOLoader();
draco.setDecoderPath('./vendor/three/draco/');glb.setDRACOLoader(draco);glb.setMeshoptDecoder(MeshoptDecoder);
// GLB models with BasisU / KTX2 compressed textures need renderer support.
let configuredRenderer=null;export function configureSceneModelRenderer(renderer){
 if(configuredRenderer===renderer)return;
 const ktx=new KTX2Loader();ktx.setTranscoderPath('./vendor/three/basis/');ktx.detectSupport(renderer);glb.setKTX2Loader(ktx);configuredRenderer=renderer;
}
const downloads=new Map();
export const isSceneModelURL=url=>typeof url==='string'&&/^\/api\/scene\/models\/[0-9a-f]{32}\.(glb|fbx)$/.test(url);
export function loadSceneAsset(url){
 if(!isSceneModelURL(url))return Promise.reject(Error('Invalid model URL'));
 if(!downloads.has(url))downloads.set(url,(url.endsWith('.fbx')?fbx.loadAsync(url):glb.loadAsync(url).then(g=>g.scene)).catch(e=>{downloads.delete(url);throw e;}));
 return downloads.get(url);
}
export async function hydrateSceneModel(group){
 const url=group.userData.modelUrl;if(!isSceneModelURL(url))return;
 const ticket=group.userData.modelTicket=(group.userData.modelTicket||0)+1;
 try{
  const source=await loadSceneAsset(url);
  if(ticket!==group.userData.modelTicket||!group.parent)return;
  const model=cloneSkeleton(source),bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
  if(size.lengthSq()>0){const c=bounds.getCenter(new THREE.Vector3());const factor=2/Math.max(size.x,size.y,size.z,.0001);model.scale.multiplyScalar(factor);model.position.set(-c.x*factor,(-bounds.min.y)*factor,-c.z*factor);}
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  group.children.filter(o=>o.userData.sceneModelVisual||o.userData.sceneModelPlaceholder).forEach(o=>{group.remove(o);if(o.userData.sceneModelPlaceholder){o.geometry?.dispose();o.material?.dispose();}});
  model.userData.sceneModelVisual=true;group.add(model);
  group.userData.modelReady=true;group.userData.modelError=null;
  window.solviEditor?.physics.sync(group);
 }catch(error){if(ticket===group.userData.modelTicket){group.userData.modelError=error.message;console.warn('Scene asset load failed',url,error);}}
}
export function makeSceneModel(){
 const group=new THREE.Group();const fallback=new THREE.Mesh(new THREE.BoxGeometry(.8,.8,.8),new THREE.MeshBasicMaterial({color:0x8dcbd6,wireframe:true}));
 fallback.userData.sceneModelPlaceholder=true;group.add(fallback);return group;
}
export function invalidateSceneModel(group){
 group.userData.modelTicket=(group.userData.modelTicket||0)+1;group.userData.modelReady=false;window.solviEditor?.physics.remove(group.userData.editorId);
 for(const child of [...group.children]){group.remove(child);if(child.userData.sceneModelPlaceholder){child.geometry?.dispose();child.material?.dispose();}}
}
