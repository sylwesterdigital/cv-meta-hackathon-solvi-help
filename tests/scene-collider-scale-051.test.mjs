import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../js/scene-physics.js',import.meta.url),'utf8');
function extract(start,end){const a=code.indexOf(start);assert.ok(a>=0);const b=code.indexOf(end,a);assert.ok(b>a);return code.slice(a+start.length,b);}
class V{
 constructor(x=0,y=0,z=0){this.set(x,y,z);}
 set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
 sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
 applyMatrix4(m){const [x,y,z]=m(this.x,this.y,this.z);return this.set(x,y,z);}
 applyQuaternion(q){const a=q.a||0,c=Math.cos(a),s=Math.sin(a),x=this.x,z=this.z;return this.set(x*c-z*s,this.y,x*s+z*c);}
}
class Box{
 constructor(){this.makeEmpty();}
 makeEmpty(){this.min=new V(Infinity,Infinity,Infinity);this.max=new V(-Infinity,-Infinity,-Infinity);return this;}
 copy(box){this.min=new V(box.min.x,box.min.y,box.min.z);this.max=new V(box.max.x,box.max.y,box.max.z);return this;}
 expandByPoint(v){for(const k of ['x','y','z']){this.min[k]=Math.min(this.min[k],v[k]);this.max[k]=Math.max(this.max[k],v[k]);}return this;}
 isEmpty(){return this.min.x>this.max.x;}
 setFromCenterAndSize(center,size){this.min=new V(center.x-size.x/2,center.y-size.y/2,center.z-size.z/2);this.max=new V(center.x+size.x/2,center.y+size.y/2,center.z+size.z/2);return this;}
 getSize(out){return out.set(this.max.x-this.min.x,this.max.y-this.min.y,this.max.z-this.min.z);}
 getCenter(out){return out.set((this.max.x+this.min.x)/2,(this.max.y+this.min.y)/2,(this.max.z+this.min.z)/2);}
}
const mockTHREE={Vector3:V,Box3:Box,Quaternion:class{constructor(a=0){this.a=a;}invert(){this.a=-this.a;return this;}}};
const method=extract(' colliderShape(object){','\n }\n sync(object)');
const colliderShape=new Function('THREE','return function colliderShape(object){'+method+'\n}')(mockTHREE);
const geom={boundingBox:new Box().setFromCenterAndSize(new V(),new V(2,1,.6))};
function makeObject(xScale,rotation=0){
 const obj={scale:{x:xScale,y:1,z:1},userData:{editorKind:'model'},getWorldPosition:()=>new V(),getWorldQuaternion:()=>new mockTHREE.Quaternion(rotation),updateWorldMatrix(){},traverse(fn){fn(this);},isMesh:true,geometry:geom};
 obj.matrixWorld=(x,y,z)=>{const a=rotation;return [x*xScale*Math.cos(a)-z*Math.sin(a),y,x*xScale*Math.sin(a)+z*Math.cos(a)];};
 return obj;
}
test('collider half-extents scale exactly with object scale, not prior model dimensions',()=>{
 const runtime={ColliderDesc:{cuboid:(x,y,z)=>({x,y,z,setTranslation(dx,dy,dz){this.offset=[dx,dy,dz];return this;}})}};
 const small=colliderShape.call({runtime},makeObject(1));const big=colliderShape.call({runtime},makeObject(3));
 assert.ok(Math.abs(small.x-1)<1e-8,small.x);
 assert.ok(Math.abs(big.x-3)<1e-8,big.x);
 assert.ok(Math.abs(big.y-.5)<1e-8,big.y);
 assert.ok(Math.abs(big.z-.3)<1e-8,big.z);
});
test('rotating an object does not inflate collider width or depth',()=>{
 const runtime={ColliderDesc:{cuboid:(x,y,z)=>({x,y,z,setTranslation(){return this;}})}};
 const rotated=colliderShape.call({runtime},makeObject(3,Math.PI/2));
 assert.ok(Math.abs(rotated.x-3)<1e-8,`rotation inflated collider x=${rotated.x}`);
 assert.ok(Math.abs(rotated.z-.3)<1e-8,`rotation inflated collider z=${rotated.z}`);
});
