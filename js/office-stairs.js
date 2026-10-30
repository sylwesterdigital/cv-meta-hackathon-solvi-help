import * as THREE from 'three';
import {sanitiseStairs,stairSegments} from './office-stairs-math.js';
export {sanitiseStairs,stairSegments} from './office-stairs-math.js';
export function rebuildOfficeStairs(group,params={}){
 const s=sanitiseStairs(params);
 for(const child of [...group.children]){group.remove(child);child.geometry?.dispose();child.material?.dispose?.();}
 group.userData.stairs=s;
 for(const spec of stairSegments(s)){
  // Each tread is a separate mesh and collider; floating leaves the area below open.
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(spec.depth,spec.height,spec.width),new THREE.MeshStandardMaterial({color:s.color,roughness:.8,transparent:s.opacity<1,opacity:s.opacity}));
  mesh.position.set(spec.x,spec.y,spec.z);mesh.rotation.y=spec.yaw;mesh.userData.stairTread=true;
  mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
 }
 return group;
}
export function makeOfficeStairs(params={}){const group=new THREE.Group();group.userData.editorKind='stairs';group.name='Office stairs';return rebuildOfficeStairs(group,params);}
