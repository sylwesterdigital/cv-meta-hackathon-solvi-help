import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const code=read('js/procedural-vegetation.js').replace(/^import .*;\s*$/gm,'').replace(/export (const|function|class) /g,'$1 ');
class Vector3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}clone(){return new Vector3(this.x,this.y,this.z);}add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}multiplyScalar(n){this.x*=n;this.y*=n;this.z*=n;return this;}length(){return Math.hypot(this.x,this.y,this.z);}normalize(){return this.multiplyScalar(1/this.length());}toArray(){return [this.x,this.y,this.z];}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}setScalar(n){return this.set(n,n,n);}}
class Quaternion{setFromUnitVectors(){return this;}setFromAxisAngle(){return this;}}
class Matrix4{compose(pos,q,s){this.v=[...pos.toArray(),s.x,s.y,s.z];return this;}}
class Geometry{constructor(...args){this.args=args;this.attrs={};}setAttribute(n,v){this.attrs[n]=v;return this;}translate(){return this;}computeVertexNormals(){return this;}}
class Material{constructor(o={}){this.opts=o;this.userData={};}}
class Mesh{constructor(g,m){this.geometry=g;this.material=m;this.userData={};this.position={set(){}};this.rotation={};this.quaternion=new Quaternion();}}
class InstancedMesh extends Mesh{constructor(g,m,c){super(g,m);this.count=c;this.matrices=[];this.instanceMatrix={needsUpdate:false};}setMatrixAt(i,m){this.matrices[i]=[...m.v];}}
class Color{constructor(c){this.c=c;this.r=this.g=this.b=.5;}clone(){return new Color(this.c);}multiplyScalar(s){this.r*=s;this.g*=s;this.b*=s;return this;}}
const THREE={Vector3,Quaternion,Matrix4,Mesh,InstancedMesh,MeshStandardMaterial:Material,ShaderMaterial:Material,Color,Shape:class{constructor(points){this.points=points;}},Vector2:class{constructor(x,z){this.x=x;this.y=z;}},Float32BufferAttribute:class{constructor(a,n){this.array=a;this.count=n;}},DoubleSide:2};
for(const kind of ['CylinderGeometry','ConeGeometry','IcosahedronGeometry','ShapeGeometry','PlaneGeometry','BufferGeometry'])THREE[kind]=class extends Geometry{};
const v=new Function('THREE',code+'\nreturn {VEGETATION_TYPES,cleanVegetation,scatterVegetationPositions,polygonContains,vegetationParts};')(THREE);
const ring=[[-8,-6],[8,-6],[8,6],[-8,6]];
test('orchards produce ordered, inside-polygon rows and seeded stable placements',()=>{
 const cfg={variant:'vegetationArea',scatterMode:'orchard',plotPoints:ring,scatterCount:35,scatterSpacing:2,scatterJitter:0,plotSeed:91};
 const p=v.scatterVegetationPositions(cfg);
 assert.ok(p.length>0&&p.length<=35);assert.deepEqual(p,v.scatterVegetationPositions(cfg));
 assert.ok(p.every(q=>q.kind==='tree'&&v.polygonContains(ring,q.x,q.z)));
 assert.ok(new Set(p.map(q=>q.z.toFixed(3))).size>=2);
});
test('forest, thicket and brushwood scatter differently and never escape the polygon',()=>{
 for(const mode of ['forest','thicket','brushwood']){
  const cfg={variant:'vegetationArea',scatterMode:mode,plotPoints:ring,scatterCount:65,plotSeed:44,scatterSpacing:1.25};
  const p=v.scatterVegetationPositions(cfg);
  assert.ok(p.length>5&&p.length<=65,mode);assert.ok(p.every(q=>v.polygonContains(ring,q.x,q.z)),mode);
  assert.deepEqual(p,v.scatterVegetationPositions(cfg));
  if(mode==='brushwood')assert.ok(p.every(q=>q.kind==='shrub'));
  if(mode==='thicket')assert.ok(p.some(q=>q.kind==='shrub'));
 }
});
test('shrub has low-growing seeded foliage and bounded parts',()=>{
 const p=v.cleanVegetation({variant:'shrub',shrubLeaves:900,shrubHeight:.62,shrubRadius:.85,shrubShape:'hedge'});
 assert.equal(p.shrubLeaves,48);
 const a=v.vegetationParts(p),b=v.vegetationParts(p);
 assert.ok(a.length<=19&&a.some(q=>q instanceof InstancedMesh));
 assert.deepEqual(a.filter(q=>q instanceof InstancedMesh).map(q=>q.matrices),b.filter(q=>q instanceof InstancedMesh).map(q=>q.matrices));
});
test('large vegetation patch emits bounded instanced draw batches and no individual colliders',()=>{
 const parts=v.vegetationParts({variant:'vegetationArea',plotPoints:[[-20,-20],[20,-20],[20,20],[-20,20]],scatterCount:400,scatterSpacing:1,scatterMode:'thicket',grassDensity:.1});
 assert.ok(parts.length<=12,`found ${parts.length} draw meshes`);
 assert.ok(parts.filter(q=>q instanceof InstancedMesh).length>=2);
 for(const q of parts.filter(q=>q instanceof InstancedMesh)){assert.ok(q.count<=2200);assert.equal(q.userData.furniturePart,false);}
});
test('Nature editor and backend support arrays, shrubs, redraw, and saved presets',()=>{
 const editor=read('js/editor.js'),server=read('backend/server.py'),preset=read('js/object-preset-data.js'),draw=read('js/vegetation-drawing.js');
 for(const variant of ['vegetationArea','shrub']){assert.ok(editor.includes(`'${variant}'`));assert.ok(server.includes(`'${variant}'`));assert.ok(preset.includes(`'${variant}'`));}
 for(const field of ['scatterCount','scatterSpacing','scatterMode','scatterCluster','shrubLeaves','shrubHeight']){assert.ok(editor.includes(`'${field}'`));assert.ok(server.includes(`'${field}'`));}
 assert.match(draw,/scatterMode:d\.scatterMode/);
});
