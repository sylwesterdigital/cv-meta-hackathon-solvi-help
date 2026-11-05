import {groundIntersection} from './scene-placement-math.js';
import {chooseSmartPlacement,chooseSurfacePlacement} from './smart-placement-math.js';
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

// Furniture that actually has a horizontal top can receive small props.
// Other furniture (sofa cushions, chairs, wall cabinets' inner shelves) is
// intentionally excluded, since an AABB alone cannot guarantee a support top.
const tabletopVariants=new Set(['table','stool','cabinet']);
const smallSurfaceProps=new Set(['plate','mug','glass','bowl','bottle','can','flowerpot','box',
 'keyboard','trackpad','mouse','printer','laptop','miniComputer']);
export function permitsTabletopPlacement(object,size){
 if(!object||!size||size.x>.85||size.z>.85||size.y>.8)return false;
 const kind=object.userData?.editorKind;
 return kind==='furniture'?smallSurfaceProps.has(object.userData.furniture?.variant):
  ['cube','sphere','cylinder','torus'].includes(kind);
}

function supportOutline(object,width,depth,localY,shape='rectangle',radius=0){
 const count=shape==='rectangle'?4:24,pts=[];
 for(let i=0;i<count;i++){
  let x,z;
  if(count===4){const corner=[[-1,-1],[1,-1],[1,1],[-1,1]][i];x=corner[0]*width/2;z=corner[1]*depth/2;}
  else {const a=i*2*Math.PI/count;x=Math.cos(a)*radius;z=Math.sin(a)*radius;}
  const pt=object.localToWorld(new THREE.Vector3(x,localY,z));pts.push({x:pt.x,z:pt.z});
 }
 return pts;
}

/** Horizontal tops including actual table surfaces and raised floor slabs.
 * A broad, low cube floor must never make the entire room 'occupied'.
 * Ids tie a support surface to its own obstacle so a tabletop is not allowed
 * to occlude itself in the camera visibility check. */
export function smartPlacementSupports(items,exclude=null){
 const result=[];
 for(let index=0;index<(items||[]).length;index++){
  const object=items[index];
  if(!object||object===exclude||!object.visible)continue;
  const kind=object.userData?.editorKind,settings=object.userData?.furniture;
  const table=kind==='furniture'&&tabletopVariants.has(settings?.variant);
  const isPrimitiveFloor=['cube','plane'].includes(kind);
  if(!table&&!isPrimitiveFloor)continue;
  object.updateMatrixWorld?.(true);
  const box=worldBox(object);if(!box)continue;
  const width=box.max.x-box.min.x,depth=box.max.z-box.min.z,height=box.max.y-box.min.y;
  // A floor needs a meaningful walkable area and be nearly flat; wall and
  // column primitives remain collision blockers, not supports.
  if(isPrimitiveFloor&&(width<1.2||depth<1.2||height>.42))continue;
  // Do not interpret a tilted panel as a horizontal desk or floor.
  const axis=new THREE.Vector3(0,kind==='plane'?0:1,kind==='plane'?1:0).transformDirection(object.matrixWorld);
  if(Math.abs(axis.y)<.97)continue;
  let polygon;
  if(table){
   const isRound=['round','polygon'].includes(settings.topShape)&&['table','stool'].includes(settings.variant);
   polygon=supportOutline(object,settings.width,settings.depth,settings.height,
    isRound?'circle':'rectangle',settings.topRadius);
  }else{
   const geo=object.geometry;
   geo?.computeBoundingBox?.();
   const local=geo?.boundingBox;
   if(!local)continue;
   if(kind==='plane'){
    polygon=[[local.min.x,local.min.y],[local.max.x,local.min.y],
     [local.max.x,local.max.y],[local.min.x,local.max.y]].map(([x,y])=>{
      const pt=object.localToWorld(new THREE.Vector3(x,y,0));return {x:pt.x,z:pt.z};
     });
   }else polygon=supportOutline(object,local.max.x-local.min.x,local.max.z-local.min.z,
     local.max.y,'rectangle');
  }
  const id=object.userData?.editorId||`placement-support-${index}`;
  result.push({id,kind:table?'tabletop':'floor',topY:box.max.y,polygon});
 }
 return result;
}

// Room walls are ONE editor object but many separately placed wall meshes.
// A whole-wall group bounding box would incorrectly mark the EMPTY room as
// obstructed. Keep individual physical surfaces, doors and roofs instead.
export function smartPlacementObstacles(items,exclude=null){
 const boxes=[];
 for(const [index,object] of (items||[]).entries()){
  const sourceId=object?.userData?.editorId||`placement-support-${index}`;
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
   for(const seg of fp)boxes.push({sourceId,min:{x:seg.minX,y:minY,z:seg.minZ},max:{x:seg.maxX,y:maxY,z:seg.maxZ}});
   if(!fp.length){const box=worldBox(object);if(box)boxes.push({...box,sourceId});}
  }else if(kind==='wall'){
   object.traverse(node=>{
    if(!node.isMesh||!node.visible||node.userData?.wallWindowButton||node.userData?.wallRoofPanel||node.userData?.wallRoofAccessory)return;
    const box=worldBox(node);if(box)boxes.push({...box,sourceId});
   });
  }else{
   const box=worldBox(object);if(box)boxes.push({...box,sourceId});
  }
 }
 return boxes;
}

/** Move a newly created item to a safe, visible support or floor position near a previous
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
 const footprint={width:Math.max(.12,size.x),depth:Math.max(.12,size.z),height:Math.max(.12,size.y),groundY};
 const obstacles=smartPlacementObstacles(items,object),supports=smartPlacementSupports(items,object);
 const project=p=>{ndc.set(p.x,p.y,p.z).project(camera);return {x:ndc.x,y:ndc.y,z:ndc.z};};
 const eligible=permitsTabletopPlacement(object,size);
 const anchorPosition=anchorData?{...anchorData,y:new THREE.Box3().setFromObject(anchor).min.y}:null;
 // First use a visible tabletop for cups, cans, bottles, laptop, keyboard and
 // other small props. Floor slabs are valid supports for ANY object size.
 // If a previously constructed house has a wide cube floor, its physical AABB
 // no longer makes every placement point inside the home look blocked.
 const options={camera:camera.position,footprint,obstacles,project,anchor:anchorPosition,maxCameraDistance:15};
 // Small objects prefer a visible table rather than an empty floor patch.
 const tabletop=eligible?chooseSurfacePlacement({...options,
  supports:supports.filter(s=>s.kind==='tabletop'),allowTabletop:true}):null;
 const surface=tabletop||chooseSurfacePlacement({...options,
  supports:supports.filter(s=>s.kind==='floor')});
 const place=surface||chooseSmartPlacement({camera:camera.position,centre:point,forward,
  footprint,anchor:anchorData,obstacles,
  maxCameraDistance:Math.max(13,Math.min(20,camera.position.y*1.3)),project});
 if(!place)return false;
 positionNewOnGround(object,{x:place.x-offsetX,y:surface?.groundY??groundY,z:place.z-offsetZ});
 return true;
}
