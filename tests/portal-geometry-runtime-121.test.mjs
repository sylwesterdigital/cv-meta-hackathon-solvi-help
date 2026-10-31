import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cleanPortal} from '../js/portal-core.js';

// Geometry-build smoke test with a minimal Three.js interface. This executes
// rebuildPortal for every shape and mode: the previous build disappeared because
// it invoked nonexistent THREE.Shape.containsPoint during sparkle generation.
function mockThree(){
 class Color{
  constructor(value='#ffffff'){this.value=value;}
  copy(color){this.value=color.value;return this;}
  clone(){return new Color(this.value);}
  lerp(){return this;}
  set(v){this.value=v;return this;}
  setHSL(){return this;}
  multiplyScalar(){return this;}
  getHex(){return 0x4499dd;}
 }
 class Vector2{constructor(x=0,y=0){this.x=x;this.y=y;}}
 class Vector3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}}
 class Object3D{
  constructor(){this.children=[];this.userData={};this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}};this.rotation={x:0,y:0,z:0};this.scale={setScalar(){}};}
  add(o){if(o.parent)o.parent.remove(o);o.parent=this;this.children.push(o);}
  remove(o){this.children=this.children.filter(child=>child!==o);o.parent=null;}
  traverse(fn){fn(this);for(const o of this.children)o.traverse(fn);}
 }
 class Group extends Object3D{}
 class Mesh extends Object3D{constructor(geometry,material){super();this.geometry=geometry;this.material=material;this.isMesh=true;}}
 class Points extends Mesh{}
 class Geometry{constructor(...args){this.args=args;}clone(){return new this.constructor(...this.args);}translate(){return this;}dispose(){}}
 class BufferGeometry extends Geometry{setAttribute(){}}
 class Float32BufferAttribute{constructor(array,itemSize){this.array=array;this.itemSize=itemSize;}}
 class Material{constructor(args={}){Object.assign(this,args);if(args.color!==undefined)this.color=new Color(args.color);if(args.emissive!==undefined)this.emissive=new Color(args.emissive);}dispose(){}clone(){return new this.constructor({...this});}}
 class Shape{
  constructor(points=[]){this.points=[...points];this.holes=[];}
  moveTo(x,y){this.points.push(new Vector2(x,y));return this;}
  lineTo(x,y){this.points.push(new Vector2(x,y));return this;}
  closePath(){return this;}
  getPoints(){return [...this.points];}
  getSpacedPoints(){return [...this.points];}
  clone(){const shape=new Shape(this.points);shape.holes=[...this.holes];return shape;}
 }
 return {Color,Vector2,Vector3,Group,Mesh,Points,Shape,Path:Shape,BufferGeometry,Float32BufferAttribute,
  MeshStandardMaterial:Material,MeshBasicMaterial:Material,ShaderMaterial:Material,
  ExtrudeGeometry:class extends Geometry{},BoxGeometry:class extends Geometry{},ShapeGeometry:class extends Geometry{},
  SphereGeometry:class extends Geometry{},PlaneGeometry:class extends Geometry{},TubeGeometry:class extends Geometry{},
  RingGeometry:class extends Geometry{},CylinderGeometry:class extends Geometry{},
  CatmullRomCurve3:class{constructor(points,closed){this.points=points;this.closed=closed;}},
  DoubleSide:2,AdditiveBlending:2};
}
function moduleFor(THREE){
 const source=fs.readFileSync(new URL('../js/portal-geometry.js',import.meta.url),'utf8')
  .replace(/^import .*;\s*$/gm,'')
  .replaceAll('export function ','function ');
 const evaluate=new Function('THREE','cleanPortal','wallPresetTexture','performance','console',`${source}\nreturn {makePortal,rebuildPortal,portalPulse};`);
 return evaluate(THREE,cleanPortal,()=>null,{now:()=>1000},{error:()=>{}});
}

test('all 5 saved portal shapes render in all 4 FX modes without throwing or disappearing',()=>{
 const THREE=mockThree();const {makePortal,portalPulse}=moduleFor(THREE);
 for(const shape of ['square','rounded','triangle','field','orb']){
  for(const effect of ['rainbow','mystery','glow','pulse']){
   for(const role of ['entry','exit']){
    const portal=makePortal({shape,effect,role,partner:'aaaaaaaa',openingWidth:2.1,openingHeight:3.2,height:3.6,width:2.7});
    assert.ok(portal.children.length>=3,`${shape}/${effect}/${role}: missing renderables`);
    assert.ok(portal.children.some(x=>x.userData.portalFrame),`${shape}/${effect}/${role}: missing solid frame`);
    assert.ok(portal.children.some(x=>x.userData.portalInner),`${shape}/${effect}/${role}: missing animated aperture`);
    assert.ok(portal.children.some(x=>x.userData.portalParticles),`${shape}/${effect}/${role}: missing particles`);
    assert.equal(portal.userData.portalRenderError,false,`${shape}/${effect}/${role}: fell back to plain geometry`);
    assert.doesNotThrow(()=>portalPulse(portal,.5),`${shape}/${effect}/${role}: animation error`);
   }
  }
 }
});

test('changing portal shape and effect preserves the existing gate on construction failure',()=>{
 const THREE=mockThree();const {makePortal,rebuildPortal}=moduleFor(THREE);
 const portal=makePortal({shape:'square',effect:'rainbow'});
 const existing=[...portal.children];
 THREE.ExtrudeGeometry=class{constructor(){throw Error('failed GPU/geometry rebuild');}};
 assert.doesNotThrow(()=>rebuildPortal(portal,{shape:'triangle',effect:'mystery'}));
 assert.deepEqual(portal.children,existing,'the old gate must remain visible');
 assert.equal(portal.userData.portal.shape,'square','the old saved configuration must stay valid');
 assert.equal(portal.userData.portalRenderError,true);
});

test('portal creation falls back to visible solid geometry when optional mesh generation fails',()=>{
 const THREE=mockThree();const {makePortal}=moduleFor(THREE);
 THREE.ShapeGeometry=class{constructor(){throw Error('not supported');}};
 const portal=makePortal({shape:'rounded',effect:'glow'});
 assert.ok(portal.children.length>=3);
 assert.ok(portal.children.every(x=>x.userData.portalFrame));
 assert.equal(portal.userData.portal.role,'entry');
});
