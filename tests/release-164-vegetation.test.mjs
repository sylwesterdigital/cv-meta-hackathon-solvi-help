import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const moduleText=read('js/procedural-vegetation.js').replace(/^import .*;\s*$/gm,'').replace(/export (const|function|class) /g,'$1 ');
const load=THREE=>new Function('THREE',moduleText+'\nreturn {VEGETATION_TYPES,VEGETATION_NUMERIC,DEFAULT_PLOT,cleanPlotPoints,smoothClosedPlot,polygonContains,plotArea,cleanVegetation,vegetationParts};')(THREE);
class Vector3{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
 clone(){return new Vector3(this.x,this.y,this.z);}
 add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
 sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
 multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;}
 length(){return Math.hypot(this.x,this.y,this.z);}
 normalize(){return this.multiplyScalar(1/this.length());}
 toArray(){return [this.x,this.y,this.z];}
 set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
 setScalar(v){this.x=this.y=this.z=v;return this;}
}
class Quaternion{setFromUnitVectors(){return this;}setFromAxisAngle(){return this;}}
class Matrix4{compose(pos,q,s){this.value=[...pos.toArray(),s.x,s.y,s.z];return this;}}
class Geometry{constructor(...args){this.args=args;}dispose(){}translate(){return this;}setAttribute(){return this;}computeVertexNormals(){return this;}}
class Material{constructor(config={}){this.config=config;this.userData={};}dispose(){}}
class Mesh{
 constructor(geometry,material){this.geometry=geometry;this.material=material;this.position={set(x,y,z){this.x=x;this.y=y;this.z=z;}};this.rotation={};this.quaternion=new Quaternion();this.userData={};}
}
class InstancedMesh extends Mesh{constructor(geometry,material,count){super(geometry,material);this.count=count;this.matrices=[];this.instanceMatrix={needsUpdate:false};}setMatrixAt(i,matrix){this.matrices[i]=[...matrix.value];}}
const THREE={Vector3,Quaternion,Matrix4,Mesh,InstancedMesh,MeshStandardMaterial:Material,ShaderMaterial:Material,Color:class{constructor(s){this.value=s;}},Shape:class{constructor(pts){this.points=pts;}},Vector2:class{constructor(x,z){this.x=x;this.y=z;}},DoubleSide:2};
for(const type of ['CylinderGeometry','ConeGeometry','IcosahedronGeometry','ShapeGeometry','PlaneGeometry','BufferGeometry'])THREE[type]=class extends Geometry{};
const v=load(THREE);
test('vegetation geometry is deterministic, low poly and bounded for many trees',()=>{
 const p=v.cleanVegetation({variant:'tree',treeHeight:5,treeSeed:18,branchCount:6,leafClusters:8,fruitType:'apple'});
 const a=v.vegetationParts(p),b=v.vegetationParts(p);
 assert.ok(a.length<=40);assert.ok(a.some(m=>m instanceof InstancedMesh));
 assert.deepEqual(a.filter(m=>m instanceof InstancedMesh).map(m=>m.matrices),b.filter(m=>m instanceof InstancedMesh).map(m=>m.matrices));
 assert.ok(a.some(part=>part.userData.furniturePart),'tree trunks and branches retain colliders');
});
test('conifer tree uses compact layered canopy and no implicit forest allocation',()=>{
 const parts=v.vegetationParts({variant:'tree',treeStyle:'conifer',treeHeight:5,leafClusters:5});
 assert.ok(parts.length>=4&&parts.length<=10);assert.ok(parts.every(p=>p.geometry));
});
test('closed polygon repairs repeated end point, preserves valid coordinates and smooths boundedly',()=>{
 const points=v.cleanPlotPoints([[0,0],[4,0],[4,3],[0,3],[.02,.02]]);
 assert.equal(points.length,4);assert.equal(v.plotArea(points),12);
 assert.equal(v.smoothClosedPlot(points).length,8);
 assert.equal(v.polygonContains(points,2,2),true);assert.equal(v.polygonContains(points,7,7),false);
});
test('huge or malformed soil geometry inputs cannot generate unbounded scene objects',()=>{
 const params=v.cleanVegetation({variant:'groundPlot',grassDensity:900,plotPoints:Array.from({length:200},(_,i)=>[3000,i]),grassHeight:100});
 assert.equal(params.grassDensity,1);assert.equal(params.grassHeight,.7);
 assert.ok(params.plotPoints.length>=3&&params.plotPoints.length<=80);
 const parts=v.vegetationParts({...params,plotPoints:[[-6,-6],[6,-6],[6,6],[-6,6]]});
 const grass=parts.find(p=>p instanceof InstancedMesh);
 assert.ok(grass.count<=2200);assert.ok(parts[0].material instanceof Material);
});
test('crop beds use bounded instance counts and saved growth, rows and crops',()=>{
 const params=v.cleanVegetation({variant:'cropBed',cropRows:3,growthPercent:40,cropType:'lettuce'});
 const parts=v.vegetationParts(params),plants=parts.find(p=>p instanceof InstancedMesh);
 assert.ok(plants);assert.ok(plants.count<=180);assert.ok(plants.matrices.some(p=>p[3]===.4));
});
test('the add menu, inspector and renderer share the same persisted vegetation variants',()=>{
 const editor=read('js/editor.js'),furniture=read('js/primitive-properties.js'),html=read('index.html');
 for(const kind of v.VEGETATION_TYPES){assert.ok(editor.includes(kind));assert.ok(furniture.includes('VEGETATION_TYPES'));}
 assert.match(editor,/startVegetationPlot/);assert.match(html,/id="vegetationDrawPanel"/);
 assert.match(html,/procedural-vegetation\.js\?v=0\.2\.166/);
 assert.match(html,/vegetation-drawing\.js\?v=0\.2\.166/);
});
test('backend validates new bounded plant settings and stores nature presets',()=>{
 const server=read('backend/server.py'),preset=read('js/object-preset-data.js'),gallery=read('js/object-presets.js');
 for(const key of ['plotPoints','growthPercent','soilPreset','treeHeight','leafColor'])assert.ok(server.includes("'"+key+"'"));
 assert.match(server,/category='Nature'/);assert.match(preset,/NATURE\.has/);assert.match(gallery,/'Nature'/);
 assert.match(server,/len\(value\)>120/);
});
