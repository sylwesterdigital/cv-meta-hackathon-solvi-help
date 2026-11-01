import * as THREE from 'three';

// Opt-in surfaces only. Avoid triggering climbing on robots, lights, portals,
// media, or stairs, which have their own interactions and traversal rules.
export const CLIMBABLE_KINDS=Object.freeze(['cube','sphere','cylinder','plane','torus','curve','surface','text','model','wall']);
export function canBeClimbable(kind){return CLIMBABLE_KINDS.includes(kind);}

// Use the ACTUAL render mesh as the mounting target, not the object's AABB.
// This is important for trees, which often have foliage much wider than the
// trunk, and for walls with openings. The AABB is used only as a height limit.
export function climbSurfaceProximity(object,robot){
 if(!object?.userData?.climbable||!canBeClimbable(object.userData.editorKind)||!robot?.position)return null;
 object.updateWorldMatrix(true,true);
 const bounds=new THREE.Box3().setFromObject(object);
 if(bounds.isEmpty()||bounds.max.y-bounds.min.y<.85)return null;
 const origin=robot.position.clone().add(new THREE.Vector3(0,.78,0));
 const yaw=Number(robot.rotation?.y)||0;
 const direction=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
 const ray=new THREE.Raycaster(origin,direction,0,1.25);
 for(const hit of ray.intersectObject(object,true)){
  if(!hit.object?.isMesh||!hit.face?.normal||!Number.isFinite(hit.distance)||hit.distance>.98)continue;
  const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  // Reject horizontal/underside faces, and surfaces the avatar is not facing.
  if(Math.abs(normal.y)>.62)continue;
  normal.y=0;normal.normalize();
  if(normal.lengthSq()<.1||normal.dot(direction)>-.38)continue;
  const stand=hit.point.clone().addScaledVector(normal,.43);
  stand.y=robot.position.y;
  const local=object.worldToLocal(stand.clone());
  const bottom=object.worldToLocal(new THREE.Vector3(stand.x,bounds.min.y,stand.z)).y;
  const top=object.worldToLocal(new THREE.Vector3(stand.x,bounds.max.y,stand.z)).y;
  if(!Number.isFinite(top-bottom)||top-bottom<.85||local.y<bottom-.35||local.y>top+.18)continue;
  return {id:object.userData.editorId,kind:'surface',x:local.x,z:local.z,y:Math.max(bottom,Math.min(top,local.y)),bottomY:bottom,topY:top,
   normal:{x:normal.x,z:normal.z},yaw:Math.atan2(normal.x,normal.z)};
 }
 return null;
}
