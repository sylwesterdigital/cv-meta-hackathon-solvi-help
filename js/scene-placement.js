import {groundIntersection} from './scene-placement-math.js';
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
