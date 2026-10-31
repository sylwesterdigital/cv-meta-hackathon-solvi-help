import * as THREE from 'three';
// Every screen-space sketch is projected onto one fixed world-space plane.
// The plane is chosen once when drawing starts so the stroke never wanders
// in depth as the cursor moves, and the camera is locked until completion.
export function sketchPlane(camera,mode='screen',depth=4,elevation=0,anchor=null){
 const toward=new THREE.Vector3();camera.getWorldDirection(toward).normalize();
 const target=anchor?.clone?.()||camera.position.clone().addScaledVector(toward,Math.max(1,Math.min(30,Number(depth)||4)));
 if(mode==='floor')return new THREE.Plane(new THREE.Vector3(0,1,0),-Number(elevation||0));
 if(mode==='xy')return new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0,0,1),target);
 if(mode==='yz')return new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(1,0,0),target);
 return new THREE.Plane().setFromNormalAndCoplanarPoint(toward,target);
}
export function strokePoint(ray,plane){
 const result=new THREE.Vector3();return ray.intersectPlane(plane,result)?result:null;
}
export function appendStrokePoint(points,point,minDistance=.045,max=120){
 if(!point||!point.toArray||!Number.isFinite(point.x+point.y+point.z))return false;
 if(points.length&&new THREE.Vector3(...points.at(-1)).distanceTo(point)<minDistance)return false;
 if(points.length>=max){const reduced=points.filter((_,i)=>i%2===0||i===points.length-1);points.splice(0,points.length,...reduced);}
 points.push(point.toArray());return true;
}
