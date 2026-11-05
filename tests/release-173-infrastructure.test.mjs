import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const code=read('js/procedural-infrastructure.js').replace(/^import .*;\s*$/gm,'').replace(/export (const|function|class) /g,'$1 ');
function mockThree(){
 class Obj{constructor(geo,mat){this.geometry=geo;this.material=mat;this.userData={};this.rotation={y:0};this.position={set:(x,y,z)=>{this.position.x=x;this.position.y=y;this.position.z=z;}};}}
 class Geometry{constructor(...args){this.args=args;this.type=this.constructor.name;}}
 class BufferGeometry extends Geometry{setAttribute(name,attr){(this.attributes??={})[name]=attr;return this;}setIndex(indices){this.indices=indices;return this;}computeVertexNormals(){return this;}}
 class Float32BufferAttribute{constructor(array,itemSize){this.array=array;this.itemSize=itemSize;}}
 class Mesh extends Obj{}
 class InstancedMesh extends Obj{constructor(geo,mat,n){super(geo,mat);this.count=n;this.instanceMatrix={};this.matrices=[];}setMatrixAt(i,m){this.matrices[i]=m;}}
 class Mat{constructor(p){Object.assign(this,p);}}
 class Vector3{constructor(x,y,z){Object.assign(this,{x,y,z});}set(x,y,z){Object.assign(this,{x,y,z});}}
 class Quaternion{setFromAxisAngle(){return this;}}
 class Matrix4{compose(){return this;}}
 class PointLight extends Obj{constructor(){super(null,null);}}
 class Color{constructor(value){this.value=value;}set(v){this.value=v;return this;}lerp(){return this;}}
 return {Mesh,InstancedMesh,MeshStandardMaterial:Mat,BufferGeometry,Float32BufferAttribute,BoxGeometry:Geometry,CylinderGeometry:Geometry,IcosahedronGeometry:Geometry,PointLight,Vector3,Quaternion,Matrix4,Color,DoubleSide:2,SRGBColorSpace:'srgb',RepeatWrapping:'repeat',CanvasTexture:class {}};
}
const THREE=mockThree();
const lib=new Function('THREE',`${code}\nreturn {INFRASTRUCTURE_VARIANTS,INFRASTRUCTURE_NUMERIC,cleanInfrastructure,cleanInfrastructurePoints,infrastructureSegments,infrastructurePath,continuousPathRibbon,infrastructureParts};`)(THREE);

test('all six outdoor infrastructure types and bounded numeric fields',()=>{
 assert.deepEqual(lib.INFRASTRUCTURE_VARIANTS,['road','footpath','curb','fence','hedge','pathWall']);
 const p=lib.cleanInfrastructure({infraType:'road',infraLanes:1000,infraWidth:999,infraLightSpacing:-2,infraPoints:[[0,0],[2,0],[NaN,5]]});
 assert.equal(p.infraLanes,6);assert.equal(p.infraWidth,30);assert.equal(p.infraLightSpacing,3);
 assert.deepEqual(p.infraPoints,[[0,0],[2,0]]);
 assert.equal(lib.cleanInfrastructure({infraType:'hacked'}).infraType,'road');
});

test('line/polyline geometry, closed paths and smoothing remain finite',()=>{
 const path=[[0,0],[6,0],[6,4]];
 const base=lib.infrastructureSegments({infraPoints:path});assert.equal(base.length,2);
 assert.equal(base[0].length,6);assert.equal(base[1].length,4);
 assert.equal(lib.infrastructureSegments({infraPoints:path,infraClose:true}).length,3);
 const curved=lib.infrastructurePath({infraPoints:path,infraSmooth:true});assert.ok(curved.length>path.length);
 assert.ok(lib.cleanInfrastructurePoints([[0,0],[0,0],[1,0],[2,0]]).length>=2);
});

test('roads and highways build lane markings and optional lamps with a bounded local-light budget',()=>{
 const road=lib.infrastructureParts({infraType:'road',infraPoints:[[0,0],[40,0]],infraLanes:4,infraWidth:16,infraMarkings:true,infraCurbs:true,infraStreetlights:true,infraLampsOn:true});
 assert.ok(road.length>6);
 assert.ok(road.some(x=>x.userData.furniturePart===true),'road surface and curbs are collision surfaces');
 assert.ok(road.some(x=>x instanceof THREE.InstancedMesh),'paint and lamps should be batched');
 assert.ok(road.filter(x=>x instanceof THREE.PointLight).length<=3,'WebXR lighting budget');
});

test('plank, mesh, rod fences, hedges, footpaths and walls generate persistent geometry',()=>{
 for(const [infraType,infraStyle] of [['fence','plank'],['fence','mesh'],['fence','rods'],['hedge','plank'],['footpath','plank'],['curb','plank'],['pathWall','solid']]){
  const parts=lib.infrastructureParts({infraType,infraStyle,infraPoints:[[0,0],[8,0],[8,5]]});
  assert.ok(parts.length>0,`${infraType} / ${infraStyle}`);
  if(['footpath','curb','pathWall'].includes(infraType))assert.ok(parts.some(x=>x.userData.furniturePart),`${infraType} must have collision`);
 }
});

test('editor wiring exposes all drawing modes, save and redraw without bypassing standard sync',()=>{
 const source=read('js/editor.js'),drawing=read('js/infrastructure-drawing.js');
 assert.match(source,/Outdoor infrastructure/);assert.match(source,/startInfrastructureDrawing/);
 assert.match(source,/infrastructurePointer/);assert.match(source,/infraMarkings/);assert.match(source,/infraStreetlights/);
 for(const mode of ['line','polyline','freehand'])assert.ok(source.includes("['"+mode+"','"));
 assert.match(drawing,/editor\.recordEdit/);assert.match(drawing,/editor\.queueSave/);assert.match(drawing,/mode:'static'/);
 assert.match(read('js/object-preset-data.js'),/INFRASTRUCTURE/);
});

test('backend validates bounded infrastructure geometry, fields and transport parameters',()=>{
 const backend=read('backend/server.py');
 for(const text of ["'infrastructure'","'infraPoints'","'infraLanes'","'infraTraffic'","'infraStreetlights'","'infraStyle'","'infraSurface'"])
  assert.ok(backend.includes(text),text);
 assert.match(backend,/not 2<=len\(points\)<=80/);
 assert.match(backend,/abs\(n\)>300/);
});

test('full furniture payload passes backend strict validator and rejects unsafe paths',()=>{
 const furnitureCode=read('js/primitive-properties.js').replace(/^import .*;\s*$/gm,'').replace(/export (const|function|class) /g,'$1 ');
 const factory=new Function('EQUIPMENT_TYPES','EQUIPMENT_NUMERIC','TOOL_TYPES','TOOL_NUMERIC','buildTool','cleanDeviceMode','VEGETATION_TYPES','VEGETATION_NUMERIC','INFRASTRUCTURE_NUMERIC','cleanInfrastructure','cleanVegetation',`${furnitureCode}\nreturn {sanitiseFurniture,FURNITURE_TYPES};`);
 const furniture=factory([],{},['shovel','axe','rake','stick','broom','mop','saw'],{handleLength:[1.1,.18,3],handleRadius:[.025,.007,.09],headWidth:[.22,.035,.85],headDepth:[.14,.012,.45]},()=>{},v=>v,[],{},lib.INFRASTRUCTURE_NUMERIC,lib.cleanInfrastructure,v=>v);
 assert.ok(furniture.FURNITURE_TYPES.includes('infrastructure'));
 const payload=furniture.sanitiseFurniture({variant:'infrastructure',infraType:'road',infraPoints:[[0,0],[40,0]],infraLanes:2});
 assert.ok(Object.keys(payload).length<=165);
 const py=`import ast,sys,math,re,json
s=open(sys.argv[1]).read();m=ast.parse(s)
f=next(n for n in m.body if isinstance(n,ast.FunctionDef) and n.name=='valid_basic_furniture')
ns={'math':math,'re':re,'valid_smart_channels':lambda x:True,'valid_smart_options':lambda x:True}
exec(compile(ast.fix_missing_locations(ast.Module(body=[f],type_ignores=[])),sys.argv[1],'exec'),ns)
v=json.loads(sys.stdin.read())
assert ns['valid_basic_furniture'](v),'Valid infrastructure payload rejected'
v['infraPoints']=[[5000,0],[1,2]]
assert not ns['valid_basic_furniture'](v),'Out-of-bounds path accepted'
print('validated')`;
 const result=spawnSync('python3',['-c',py,new URL('../backend/server.py',import.meta.url).pathname],{input:JSON.stringify(payload),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});

test('continuous road ribbon shares joined cross sections through bends without gaps',()=>{
 const path=[[0,0],[5,0],[5,4]];
 const ribbon=lib.continuousPathRibbon(path,7);
 assert.equal(ribbon.sectionCount,3);
 assert.equal(ribbon.vertices.length,3*4*3);
 assert.ok(ribbon.vertices.every(Number.isFinite));
 assert.equal(ribbon.indices.length,2*4*6+12);
 const centre=[ribbon.vertices[12],ribbon.vertices[14],ribbon.vertices[15],ribbon.vertices[17]];
 assert.ok(centre.every(Number.isFinite));
 const road=lib.infrastructureParts({infraType:'road',infraPoints:path,infraSmooth:false,infraMarkings:false});
 const joined=road.filter(part=>part.geometry instanceof THREE.BufferGeometry);
 assert.equal(joined.length,1,'exactly one connected surface mesh, not rectangular slabs');
 assert.ok(joined[0].userData.trimeshCollider,'the joined surface must support robots and XR');
});

test('closed road ribbons and smooth corners remain bounded and finite',()=>{
 const p=[[0,0],[6,0],[6,6],[0,6]];
 const settings={infraPoints:p,infraClose:true,infraSmooth:true};
 const path=lib.infrastructurePath(settings);
 assert.ok(path.length>p.length);
 assert.deepEqual(path[0],path.at(-1));
 const ribbon=lib.continuousPathRibbon(path,5);
 assert.ok(ribbon.vertices.every(Number.isFinite));
 assert.ok(ribbon.indices.every(i=>i>=0&&i<ribbon.vertices.length/3));
 assert.ok(path.length<=400);
});

test('road lanes are whole numbers and one property-window drawing replaces the independent popup',()=>{
 assert.equal(lib.cleanInfrastructure({infraLanes:2.03}).infraLanes,2);
 assert.equal(lib.cleanInfrastructure({infraLanes:5.8}).infraLanes,6);
 const editor=read('js/editor.js'),drawing=read('js/infrastructure-drawing.js');
 assert.match(editor,/infraLanes'/);
 assert.doesNotMatch(editor,/Texture \/ variation seed/);
 assert.match(editor,/infraDrawingMode/);
 assert.match(editor,/infraDrawingFinish/);
 assert.match(drawing,/id\('propertiesPanel'\)\.hidden=false/);
 assert.doesNotMatch(drawing,/infra-draw-panel|ensurePanel\(/);
 assert.match(drawing,/new THREE\.LineDashedMaterial/);
 assert.match(drawing,/updateGuide\(editor\)/);
 assert.doesNotMatch(drawing,/points\.push\(new THREE\.Vector3\(d\.cursor/);
 assert.match(drawing,/e\.target===id\('spatialDrawShield'\)/);
});
