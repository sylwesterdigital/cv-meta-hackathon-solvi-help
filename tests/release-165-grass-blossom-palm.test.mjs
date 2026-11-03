import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const source=read('js/procedural-vegetation.js');
const modules=source.replace(/^import .*;\s*$/gm,'').replace(/export (const|function|class) /g,'$1 ');
class Vector3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}clone(){return new Vector3(this.x,this.y,this.z);}add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;}length(){return Math.hypot(this.x,this.y,this.z);}normalize(){return this.multiplyScalar(1/this.length());}toArray(){return [this.x,this.y,this.z];}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}setScalar(v){return this.set(v,v,v);}}
class Quaternion{setFromUnitVectors(){return this;}setFromAxisAngle(){return this;}}
class Matrix4{compose(pos,q,s){this.v=[...pos.toArray(),s.x,s.y,s.z];return this;}}
class Geometry{constructor(...args){this.args=args;this.attrs={};}setAttribute(name,data){this.attrs[name]=data;return this;}translate(){return this;}computeVertexNormals(){return this;}dispose(){}}
class Material{constructor(opts={}){this.opts=opts;this.userData={};}}
class Mesh{constructor(geometry,material){this.geometry=geometry;this.material=material;this.userData={};this.position={set(){}};this.rotation={};this.quaternion=new Quaternion();}}
class InstancedMesh extends Mesh{constructor(g,m,c){super(g,m);this.count=c;this.transforms=[];this.instanceMatrix={needsUpdate:false};}setMatrixAt(i,m){this.transforms[i]=[...m.v];}}
class Color{constructor(c){this.c=c;this.r=this.g=this.b=.5;}clone(){return new Color(this.c);}multiplyScalar(s){this.r*=s;this.g*=s;this.b*=s;return this;}}
const THREE={Vector3,Quaternion,Matrix4,Mesh,InstancedMesh,MeshStandardMaterial:Material,ShaderMaterial:Material,Color,Shape:class{constructor(points){this.points=points;}},Vector2:class{constructor(x,z){this.x=x;this.y=z;}},Float32BufferAttribute:class{constructor(a,n){this.array=a;this.count=n;}},DoubleSide:2};
for(const type of ['CylinderGeometry','ConeGeometry','IcosahedronGeometry','ShapeGeometry','PlaneGeometry','BufferGeometry'])THREE[type]=class extends Geometry{};
const v=new Function('THREE',modules+'\nreturn {cleanVegetation,vegetationParts,VEGETATION_NUMERIC};')(THREE);
test('new blossom and palm tree variants persist, with bounded geometry',()=>{
 for(const style of ['blossom','palm']){
  const cfg=v.cleanVegetation({variant:'tree',treeStyle:style,fruitType:style==='palm'?'coconut':'none',palmFronds:12,treeSeed:21});
  assert.equal(cfg.treeStyle,style);
  const meshes=v.vegetationParts(cfg);
  assert.ok(meshes.length>=4&&meshes.length<42);
  assert.ok(meshes.some(m=>m instanceof InstancedMesh)||style==='palm');
  assert.ok(meshes.some(m=>m.userData.furniturePart));
 }
});
test('seeded blossom/palm geometry remains stable, blossom/coconut have independent instances',()=>{
 for(const [style,fruit] of [['blossom','none'],['palm','coconut']]){
  const p={variant:'tree',treeStyle:style,fruitType:fruit,treeSeed:123};
  const a=v.vegetationParts(p),b=v.vegetationParts(p);
  assert.deepEqual(a.filter(q=>q instanceof InstancedMesh).map(q=>q.transforms),b.filter(q=>q instanceof InstancedMesh).map(q=>q.transforms));
  assert.ok(a.filter(q=>q instanceof InstancedMesh).length>=1);
 }
});
test('ground shader uses smooth multi-scale noise instead of blocky dark tiles',()=>{
 const parts=v.vegetationParts({variant:'groundPlot',groundCover:'mixed',grassDensity:.7});
 const shader=parts[0].material.opts.fragmentShader;
 assert.match(shader,/float noise\(/);assert.match(shader,/colorspace_fragment/);assert.match(shader,/tonemapping_fragment/);
 assert.ok(!shader.includes('floor(vWorld*2.6)'));
});
test('animated blades deform on GPU and retain a strict instance budget',()=>{
 const parts=v.vegetationParts({variant:'groundPlot',groundCover:'grass',grassDensity:1,plotPoints:[[-8,-8],[8,-8],[8,8],[-8,8]],windStrength:.85});
 const blades=parts.find(m=>m instanceof InstancedMesh);
 assert.ok(blades&&blades.count>400&&blades.count<=2200);
 assert.ok(typeof blades.material.onBeforeCompile==='function');
 const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>'};
 blades.material.onBeforeCompile(shader);
 assert.match(shader.vertexShader,/uWindTime/);assert.match(shader.vertexShader,/instanceMatrix\[3\]/);
 assert.ok(typeof blades.onBeforeRender==='function');
 blades.onBeforeRender();assert.ok(shader.uniforms.uWindTime.value>=0);
});
test('new keys pass through frontend editor and backend schema',()=>{
 const editor=read('js/editor.js'),server=read('backend/server.py'),primitive=read('js/primitive-properties.js');
 for(const name of ['leafSize','windStrength','windSpeed','grassWidth','trunkWobble','blossomDensity','palmFronds','blossomColor']){
  assert.ok(editor.includes(name),name+' UI');assert.ok(server.includes(name),name+' API');
 }
 assert.match(editor,/numeric edits are previewed|Numeric edits are previewed/);
 assert.match(primitive,/wood/);assert.match(editor,/Palm \/ coconut/);
});
