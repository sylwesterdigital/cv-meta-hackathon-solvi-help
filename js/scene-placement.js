import {groundIntersection} from './scene-placement-math.js';
import {chooseSmartPlacement} from './smart-placement-math.js';
import {infrastructureSegments} from './procedural-infrastructure.js';
import {infrastructureNavigationFootprints} from './robot-infrastructure-obstacles.js';
import * as THREE from 'three';
// A new object should be placed where the viewport CENTRE meets the ground,
// not at a fixed distance along a steep camera ray (which can sit below view).
export function centreGroundFromCamera(camera,orbitTarget=null,groundY=0){
 const direction=camera.getWorldDirection(new THREE.Vector3()).normalize();
 const point=groundIntersection(camera.position,direction,orbitTarget,groundY);
 return new THREE.Vector3(point.x,point.y,point.z);
}
export function positionNewOnGround(object,point){
 object.position.x=point.x;object.position.z=point.z;
 // Procedural furniture and objects can have different pivots. Use real mesh
 // bounds so the bottom, not the pivot, is at ground height.
 object.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(object);
 if(!box.isEmpty()&&Number.isFinite(box.min.y))object.position.y+=point.y-box.min.y;
 else object.position.y=point.y;
 object.updateMatrixWorld(true);
 return object;
}

const walkableFurniture=new Set(['groundPlot','cropBed','waterPatch','vegetationArea','shrub','grass','soil','footpath','road']);
const walkableInfrastructure=new Set(['footpath','road','curb']);
function worldBox(node){
 const box=new THREE.Box3().setFromObject(node);
 if(box.isEmpty()||!['x','y','z'].every(axis=>Number.isFinite(box.min[axis])&&Number.isFinite(box.max[axis])))return null;
 return {min:{x:box.min.x,y:box.min.y,z:box.min.z},max:{x:box.max.x,y:box.max.y,z:box.max.z}};
}

// Room walls are ONE editor object but many separately placed wall meshes.
// A whole-wall group bounding box would incorrectly mark the EMPTY room as
// obstructed. Keep individual physical surfaces, doors and roofs instead.
export function smartPlacementObstacles(items,exclude=null){
 const boxes=[];
 for(const object of items||[]){
  if(!object||object===exclude||!object.visible)continue;
  const kind=object.userData?.editorKind;
  if(['light','robot','points'].includes(kind))continue;
  const variant=object.userData?.furniture?.variant;
  if(kind==='furniture'&&walkableFurniture.has(variant))continue;
  if(kind==='furniture'&&variant==='infrastructure'&&walkableInfrastructure.has(object.userData?.furniture?.infraType))continue;
  object.updateMatrixWorld?.(true);
  if(kind==='furniture'&&variant==='infrastructure'){
   // Mesh batches are instanced for performance: a whole InstancedMesh AABB
   // spans every picket and can falsely fill an entire fenced-in yard. Use
   // the same short, transformed path footprints as robot navigation instead.
   const settings=object.userData.furniture;
   const scale=Math.max(Math.abs(object.scale.x),Math.abs(object.scale.z));
   const fp=infrastructureNavigationFootprints(infrastructureSegments(settings),(x,z)=>{
    const pt=new THREE.Vector3(x,0,z).applyMatrix4(object.matrixWorld);
    return {x:pt.x,z:pt.z};
   },{...settings,navigationWorldScale:scale});
   const height=Math.max(.12,Number(settings.infraHeight)||1.75);
   const bounds=worldBox(object);
   const minY=bounds?.min.y??object.position.y,maxY=bounds?.max.y??(object.position.y+height*Math.abs(object.scale.y));
   for(const seg of fp)boxes.push({min:{x:seg.minX,y:minY,z:seg.minZ},max:{x:seg.maxX,y:maxY,z:seg.maxZ}});
   if(!fp.length){const box=worldBox(object);if(box)boxes.push(box);}
  }else if(kind==='wall'){
   object.traverse(node=>{
    if(!node.isMesh||!node.visible||node.userData?.wallWindowButton||node.userData?.wallRoofPanel||node.userData?.wallRoofAccessory)return;
    const box=worldBox(node);if(box)boxes.push(box);
   });
  }else{
   const box=worldBox(object);if(box)boxes.push(box);
  }
 }
 return boxes;
}

/** Move a newly created item to a safe, visible floor position near a previous
 * addition. Return false instead of saving an overlapping or hidden object.
 * The caller is responsible for adding it to the multiplayer scene afterwards. */
export function positionNewSmartly(object,{camera,orbitTarget,items=[],anchor=null,groundY=0}={}){
 if(!object||!camera)return false;
 camera.updateMatrixWorld(true);
 const point=centreGroundFromCamera(camera,orbitTarget,groundY);
 // Normalize the bottom before measuring the geometry. Preserve world-space
 // XZ offsets for models/architectural primitives with non-centred pivots.
 positionNewOnGround(object,point);
 const initial=new THREE.Box3().setFromObject(object);
 if(initial.isEmpty())return false;
 const size=initial.getSize(new THREE.Vector3());
 if(![size.x,size.y,size.z].every(Number.isFinite))return false;
 // Planes and thin procedural surfaces have zero thickness along one axis.
 // Give those a small placement safety footprint rather than rejecting them.
 const centre=initial.getCenter(new THREE.Vector3());
 const offsetX=centre.x-object.position.x,offsetZ=centre.z-object.position.z;
 let anchorData=null;
 if(anchor&&anchor!==object&&items.includes(anchor)){
  const box=new THREE.Box3().setFromObject(anchor);
  if(!box.isEmpty()){
   const s=box.getSize(new THREE.Vector3()),p=box.getCenter(new THREE.Vector3());
   anchorData={x:p.x,z:p.z,radius:Math.hypot(s.x,s.z)*.5};
  }
 }
 const ndc=new THREE.Vector3(),forward=camera.getWorldDirection(new THREE.Vector3());
 const place=chooseSmartPlacement({camera:camera.position,centre:point,forward,
  footprint:{width:Math.max(.16,size.x),depth:Math.max(.16,size.z),height:Math.max(.12,size.y),groundY},anchor:anchorData,
  obstacles:smartPlacementObstacles(items,object),
  maxCameraDistance:Math.max(13,Math.min(20,camera.position.y*1.3)),
  project:p=>{ndc.set(p.x,p.y,p.z).project(camera);return {x:ndc.x,y:ndc.y,z:ndc.z};}});
 if(!place)return false;
 positionNewOnGround(object,{x:place.x-offsetX,y:groundY,z:place.z-offsetZ});
 return true;
}
