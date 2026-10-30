import * as THREE from 'three';

// Parameter bounds prevent generating enormous meshes through a shared scene payload.
export const PRIMITIVE_FIELDS={
 cube:{width:[1,.05,30],height:[1,.05,30],depth:[1,.05,30],widthSegments:[1,1,32],heightSegments:[1,1,32],depthSegments:[1,1,32]},
 sphere:{radius:[.55,.05,20],widthSegments:[28,3,96],heightSegments:[18,2,64]},
 cylinder:{radiusTop:[.4,0,20],radiusBottom:[.4,0,20],height:[1.2,.05,30],radialSegments:[32,3,96],heightSegments:[1,1,32]},
 plane:{width:[1.7,.05,30],height:[1.7,.05,30],widthSegments:[1,1,32],heightSegments:[1,1,32]},
 torus:{radius:[.52,.05,20],tube:[.17,.01,10],radialSegments:[15,3,96],tubularSegments:[40,3,128]},
};
export function sanitisePrimitive(kind,input={}){
 const fields=PRIMITIVE_FIELDS[kind];if(!fields)return null;
 const result={};
 for(const [key,[defaultValue,min,max]] of Object.entries(fields)){
  const value=Number(input?.[key]);const valid=Number.isFinite(value)?value:defaultValue;
  result[key]=key.endsWith('Segments')?Math.round(Math.max(min,Math.min(max,valid))):Math.max(min,Math.min(max,valid));
 }
 return result;
}
export function buildPrimitive(kind,values){
 const p=sanitisePrimitive(kind,values);if(!p)return null;
 if(kind==='cube')return new THREE.BoxGeometry(p.width,p.height,p.depth,p.widthSegments,p.heightSegments,p.depthSegments);
 if(kind==='sphere')return new THREE.SphereGeometry(p.radius,p.widthSegments,p.heightSegments);
 if(kind==='cylinder')return new THREE.CylinderGeometry(p.radiusTop,p.radiusBottom,p.height,p.radialSegments,p.heightSegments);
 if(kind==='plane')return new THREE.PlaneGeometry(p.width,p.height,p.widthSegments,p.heightSegments);
 if(kind==='torus')return new THREE.TorusGeometry(p.radius,p.tube,p.radialSegments,p.tubularSegments);
 return null;
}
