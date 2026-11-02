import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sanitiseWall,wallSegments,wallWindowLayout,pointWithinPolygon,wallArrayTransforms} from '../js/office-wall-math.js';
import {stepRobotMotion,packetFor} from '../js/robot-net.js';
const source=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('window dimensions scale with segments and only appear on eligible walls',()=>{
 const base=sanitiseWall({points:[[0,0],[6,0]],height:3,windows:{enabled:true,minWidth:2.5,minHeight:2.2,widthRatio:.4,heightRatio:.5}});
 assert.equal(wallWindowLayout(2,3,base.windows).length,0);
 assert.equal(wallWindowLayout(3,2,base.windows).length,0);
 const one=wallWindowLayout(3,3,base.windows),two=wallWindowLayout(6,3,base.windows);
 assert.equal(one.length,1);assert.equal(two.length,2);
 assert.ok(two.every(x=>x.width>0&&x.height>0&&x.bottom>.15));
 assert.ok(two[0].x+two[0].width/2<two[1].x-two[1].width/2);
});
test('window state and ceiling configuration round-trip; old walls stay valid',()=>{
 const raw={points:[[0,0],[8,0],[8,6],[0,6]],closed:true,height:3,
  windows:{enabled:true,openable:true,openIds:[0,3],minWidth:2.5,widthRatio:.33,heightRatio:.45},
  ceiling:{enabled:true,texture:'concrete',color:'#aabbcc',thickness:.18,autoLiftOpenings:true}};
 const wall=sanitiseWall(raw);assert.deepEqual(sanitiseWall(wall),wall);
 assert.deepEqual(wall.windows.openIds,[0,3]);assert.equal(wall.ceiling.texture,'concrete');
 const legacy=sanitiseWall({points:[[0,0],[1,0]]});
 assert.equal(legacy.windows.enabled,false);assert.equal(legacy.ceiling.enabled,false);
 assert.equal(pointWithinPolygon([2,2],raw.points),true);
 assert.equal(pointWithinPolygon([20,2],raw.points),false);
});
test('building code creates physical window gaps, openable panes, and lift-punched ceilings',()=>{
 const walls=source('js/office-walls.js'),physics=source('js/scene-physics.js'),editor=source('js/editor.js'),world=source('js/world.js');
 assert.match(walls,/const openings=wallWindowLayout/);
 assert.match(walls,/add\(left-cursor,s\.height,s\.width/);
 assert.match(walls,/s\.windows\.openIds\.includes/);
 assert.match(walls,/wallWindowButton=true/);
 assert.match(walls,/shape\.holes\.push\(path\)/);
 assert.match(walls,/const ceiling=new THREE\.Mesh\(geom/);
 assert.match(physics,/segment\.userData\.wallCeiling/);
 assert.match(physics,/R\.ColliderDesc\.trimesh\(verts,indices\)/);
 assert.match(editor,/activateWindowButton\(button\)/);
 assert.match(editor,/lastLiftCeilingCheck/);
 assert.match(editor,/this\.physics\.remove\(wall\.userData\.editorId\);this\.physics\.sync\(wall\)/);
 assert.match(world,/hitWindowButton/);
});
test('run multiplier varies physical run velocity, not walk or animation speed',()=>{
 const state={x:0,z:0,yaw:0,velocity:0};
 const walk=stepRobotMotion(state,{f:1,r:0,s:1,runMultiplier:5},1);
 const sprint=stepRobotMotion(state,{f:1,r:1,s:1,runMultiplier:5},1);
 const regular=stepRobotMotion(state,{f:1,r:1,s:1,runMultiplier:2},1);
 assert.equal(walk.velocity,sprint.velocity); // first frame acceleration-limited
 const terminal=(m)=>{let s=state;for(let i=0;i<180;i++)s=stepRobotMotion(s,{f:1,r:1,s:1,runMultiplier:m},1/60);return s.velocity;};
 assert.ok(terminal(5)>terminal(2));
 const packet=packetFor('aaaaaaaa',{f:1,r:1,runMultiplier:4.2},{position:{x:0,y:0,z:0},rotation:{y:0}});
 assert.equal(packet.runMultiplier,4.2);
 const server=source('backend/server.py');assert.match(server,/run_multiplier=float\(msg\.get\('runMultiplier'/);
});
test('compact borderless switcher and persistent backend schema are included',()=>{
 const css=source('styles.css'),html=source('index.html'),backend=source('backend/server.py');
 assert.match(css,/#controlSwitcher\.control-switcher\{background:transparent!important;border:0!important/);
 assert.match(css,/\.robot-face-choice small\{position:absolute!important;top:2px/);
 for(const id of ['wallWindowsEnabled','wallWindowsWidthRatio','wallRoofEnabled','wallRoofAutoLift','robotRunMultiplier'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(backend,/if 'windows' in wall:/);assert.match(backend,/if 'ceiling' in wall:/);
});

test('wall geometry runs with real wall settings, splits masonry and adds climbable top ceiling with lift holes',()=>{
 class V3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}clone(){return new V3(this.x,this.y,this.z);}}
 class Shape{constructor(){this.points=[];this.holes=[];}moveTo(x,y){this.points.push([x,y]);return this;}lineTo(x,y){this.points.push([x,y]);return this;}closePath(){return this;}}
 class Obj{constructor(){this.children=[];this.userData={};this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}};this.rotation={x:0,y:0,z:0};}
  add(child){this.children.push(child);child.parent=this;}remove(child){this.children.splice(this.children.indexOf(child),1);}
  traverse(fn){fn(this);for(const child of this.children)child.traverse(fn);}
  updateWorldMatrix(){}worldToLocal(p){return p;}}
 class Mesh extends Obj{constructor(geometry,material){super();this.geometry=geometry;this.material=material;}}
 class BoxGeometry{constructor(width,height,depth){this.parameters={width,height,depth};}dispose(){}}
 class ExtrudeGeometry{constructor(shape){this.shape=shape;}rotateX(){return this;}dispose(){}}
 class SphereGeometry{dispose(){}}
 class Material{constructor(settings={}){Object.assign(this,settings);}dispose(){}}
 const THREE={Shape,Path:Shape,Group:Obj,Mesh,BoxGeometry,ExtrudeGeometry,SphereGeometry,
  MeshPhysicalMaterial:Material,MeshStandardMaterial:Material,MeshBasicMaterial:Material,Vector3:V3,DoubleSide:2,
  CanvasTexture:class{constructor(){this.repeat={set(){}};}dispose(){}},SRGBColorSpace:'srgb',RepeatWrapping:1};
 const ctx={fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
 const document={createElement:()=>({width:256,height:256,getContext:()=>ctx})};
 const geometrySource=source('js/office-walls.js').replace(/^import .*;\s*$/gm,'').replace(/^export \{.*;\s*$/gm,'').replaceAll('export function ','function ');
 const render=new Function('THREE','sanitiseWall','wallSegments','wallWindowLayout','pointWithinPolygon','document','window',geometrySource+'\nreturn rebuildOfficeWall;')(THREE,sanitiseWall,
  // Single, 6m long segment: 2 windows expected.
  ()=>[{x:3,z:0,yaw:0,length:6}],wallWindowLayout,pointWithinPolygon,document,{});
 const group=new Obj();const settings={points:[[0,0],[6,0],[6,5],[0,5]],closed:true,height:3,
  windows:{enabled:true,minWidth:2.5,minHeight:2.2,openIds:[1]},ceiling:{enabled:true}};
 render(group,settings);
 const masonry=group.children.filter(c=>c.userData.wallSegment&&!c.userData.wallGlass);
 const glass=group.children.filter(c=>c.userData.wallGlass);
 const ceiling=group.children.filter(c=>c.userData.wallCeiling);
 assert.equal(glass.length,2);assert.ok(masonry.length>=6);assert.equal(ceiling.length,1);
 assert.equal(glass[0].userData.wallSegment,true);assert.equal(glass[1].userData.wallSegment,false);
 assert.equal(group.children.filter(c=>c.userData.wallWindowButton).length,4);
 const lift={userData:{stairs:{variant:'lift',width:1.6}},getWorldPosition:()=>new V3(3,0,2.5),localToWorld:p=>new V3(p.x+3,p.y,p.z+2.5)};
 render(group,settings,[lift]);
 assert.equal(group.children.find(c=>c.userData.wallCeiling).geometry.shape.holes.length,1);
});

// v0.2.140 — room array runtime and compact robot switcher checks.
const base={points:[[0,0],[6,0],[6,4],[0,4]],closed:true,height:3,windows:{enabled:true,minWidth:2.5},ceiling:{enabled:true}};
test('Room Array keeps legacy rooms unchanged and validates axis/direction/count/step offsets',()=>{
 const old=sanitiseWall(base);assert.equal(old.array.enabled,false);assert.equal(wallArrayTransforms(old).length,1);
 const wall=sanitiseWall({...base,array:{enabled:true,count:3,axis:'y',direction:1,gap:.2,rotation:[0,10,0],scale:[0,.1,0]}});
 assert.deepEqual(sanitiseWall(wall),wall);const copies=wallArrayTransforms(wall);
 assert.equal(copies.length,3);assert.deepEqual(copies.map(c=>c.offset[1]),[0,3.2,6.4]);
 assert.ok(Math.abs(copies[2].rotation[1]-Math.PI/9)<1e-9);
 assert.deepEqual(copies[2].scale,[1,1.2,1]);
 const reverse=wallArrayTransforms({...wall,array:{...wall.array,axis:'z',direction:-1,gap:1}});
 assert.deepEqual(reverse.map(c=>c.offset[2]),[0,-5,-10]);
 assert.equal(wallArrayTransforms({...wall,closed:false}).length,1);
 assert.equal(sanitiseWall({...base,array:{enabled:true,count:100,rotation:[Infinity,999,5],scale:[-99,.03,0],axis:'other'}}).array.count,16);
});

test('transparent controls use real white symbols with no baked opaque SVG backdrop',()=>{
 for(const icon of ['portrait-minus.svg','portrait-plus.svg']){
  const svg=source('assets/ui-icons/'+icon);
  assert.doesNotMatch(svg,/<rect\b/);assert.match(svg,/stroke="#ffffff"/);
 }
 const css=source('styles.css');
 assert.match(css,/\.robot-face-size-actions button:hover,[\s\S]*background-color:transparent!important/);
 assert.match(css,/\.robot-face-choice\[aria-pressed="true"\].*box-shadow:inset/);
 assert.match(css,/\.robot-face-choice\[aria-pressed="true"\] small\{color:/);
});

test('closed-room Array controls are connected across editor, schema, geometry and physics',()=>{
 const html=source('index.html'),editor=source('js/editor.js'),physics=source('js/scene-physics.js'),geometry=source('js/office-walls.js'),server=source('backend/server.py');
 for(const id of ['wallArrayOptions','wallArrayEnabled','wallArrayCount','wallArrayAxis','wallArrayDirection','wallArrayGap','wallArrayRotateX','wallArrayRotateY','wallArrayRotateZ','wallArrayScaleX','wallArrayScaleY','wallArrayScaleZ']){
  assert.match(html,new RegExp(`id="${id}"`));assert.ok(editor.includes(id),`${id} missing editor`);
 }
 assert.match(geometry,/wallArrayTransforms\(s\)\.slice\(1\)/);
 assert.match(geometry,/copy\.index\*1024\+localId/);
 assert.match(physics,/segment\.scale\.x/);
 assert.match(physics,/segment\.quaternion\.x/);
 assert.match(server,/if 'array' in wall:/);
});

test('Room Array actually duplicates closed room walls, windows and ceilings; copy window state independent',()=>{
 class V3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}clone(){return new V3(this.x,this.y,this.z);}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}}
 class Q{constructor(x=0,y=0,z=0,w=1){this.x=x;this.y=y;this.z=z;this.w=w;}setFromEuler(e){this.x=e.x;this.y=e.y;this.z=e.z;return this;}}
 class E{constructor(x,y,z){Object.assign(this,{x,y,z});}}
 class M4{constructor(){this.t=new V3();this.s=new V3(1,1,1);this.q=new Q();}makeTranslation(x,y,z){this.t.set(x,y,z);return this;}compose(t,q,s){this.t=t.clone();this.q=q;this.s=s.clone();return this;}multiply(m){this.t.x+=m.t.x*this.s.x;this.t.y+=m.t.y*this.s.y;this.t.z+=m.t.z*this.s.z;this.s.x*=m.s.x;this.s.y*=m.s.y;this.s.z*=m.s.z;this.q=m.q;return this;}clone(){return new M4().compose(this.t,this.q,this.s);}decompose(p,q,s){p.set(this.t.x,this.t.y,this.t.z);s.set(this.s.x,this.s.y,this.s.z);Object.assign(q,this.q);}}
 class Color{constructor(v){this.v=v;}set(v){this.v=v;}}
 class Shape{constructor(){this.holes=[];this.points=[];}moveTo(...p){this.points.push(p);return this;}lineTo(...p){this.points.push(p);return this;}closePath(){return this;}}
 class Obj{constructor(){this.children=[];this.userData={};this.position=new V3();this.rotation={x:0,y:0,z:0};this.quaternion=new Q();this.scale=new V3(1,1,1);this.matrix=new M4();}add(c){this.children.push(c);c.parent=this;}remove(c){this.children.splice(this.children.indexOf(c),1);}traverse(fn){fn(this);for(const c of this.children)c.traverse(fn);}updateMatrix(){this.matrix=new M4().compose(this.position,this.quaternion,this.scale);}updateWorldMatrix(){}worldToLocal(p){return p;} }
 class Mesh extends Obj{constructor(geometry,material){super();this.geometry=geometry;this.material=material;}clone(){const c=new Mesh(this.geometry,this.material);c.userData={...this.userData};c.position=this.position.clone();c.rotation={...this.rotation};return c;}}
 class Box{constructor(width,height,depth){this.parameters={width,height,depth};}clone(){return new Box(...Object.values(this.parameters));}dispose(){}}
 class Extrude{constructor(shape){this.shape=shape;}rotateX(){return this;}clone(){return new Extrude(this.shape);}dispose(){}}
 class Sphere{clone(){return new Sphere();}dispose(){}}
 class Material{constructor(o={}){Object.assign(this,o);this.color=new Color(o.color);}clone(){return new Material({...this,color:this.color.v});}dispose(){}}
 const THREE={Vector3:V3,Quaternion:Q,Euler:E,Matrix4:M4,Group:Obj,Mesh,BoxGeometry:Box,ExtrudeGeometry:Extrude,SphereGeometry:Sphere,
  Shape,Path:Shape,MeshPhysicalMaterial:Material,MeshStandardMaterial:Material,MeshBasicMaterial:Material,DoubleSide:2,
  CanvasTexture:class{constructor(){this.repeat={set(){}};}dispose(){}},SRGBColorSpace:'sRGB',RepeatWrapping:1};
 const ctx={fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};const document={createElement:()=>({getContext:()=>ctx})};
 const code=source('js/office-walls.js').replace(/^import .*;\s*$/gm,'').replace(/^export \{.*;\s*$/gm,'').replaceAll('export function ','function ');
 const rebuild=new Function('THREE','sanitiseWall','wallSegments','wallWindowLayout','pointWithinPolygon','wallArrayTransforms','document','window',code+'\nreturn rebuildOfficeWall;')
  (THREE,sanitiseWall,wallSegments,wallWindowLayout,pointWithinPolygon,wallArrayTransforms,document,{});
 const group=new Obj();
 rebuild(group,{...base,array:{enabled:true,count:3,axis:'y',direction:1,gap:.2},windows:{...base.windows,openIds:[1024]}});
 const rooms=group.children.filter(c=>c.userData.wallCeiling);
 assert.equal(rooms.length,3);assert.deepEqual(rooms.map(c=>c.position.y),[2.84,6.04,9.24]);
 const glass=group.children.filter(c=>c.userData.wallGlass);
 const perRoom=glass.length/3;assert.ok(perRoom>=4);
 assert.equal(glass.filter(c=>c.userData.wallSegment===false).length,1);
 assert.equal(glass.filter(c=>c.userData.windowId===1024)[0].userData.wallSegment,false);
 assert.equal(glass.filter(c=>c.userData.windowId===0)[0].userData.wallSegment,true);
 const before=group.children.length;
 rebuild(group,{...base,array:{enabled:false}});assert.equal(group.children.length,before/3);
});

test('basic furniture builds seven distinct, finite, per-part mesh presets and configurable polygon table',()=>{
 const code=source('js/primitive-properties.js');
 const section=code.slice(code.indexOf('// Basic furniture is built'))
  .replaceAll('export const ','const ').replaceAll('export function ','function ');
 class Node{
  constructor(){this.children=[];this.userData={};this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}};this.scale={x:1,y:1,z:1,set(){}};}
  add(child){this.children.push(child);}remove(child){this.children.splice(this.children.indexOf(child),1);}
 }
 class Mesh extends Node{constructor(geometry,material){super();this.geometry=geometry;this.material=material;}}
 class Geometry{constructor(...args){this.args=args;this.type=this.constructor.name;this.parameters={width:args[0],height:args[1],depth:args[2],radiusTop:args[0],radiusBottom:args[1]};}dispose(){}}
 class BoxGeometry extends Geometry{}
 class CylinderGeometry extends Geometry{}
 class MeshStandardMaterial{constructor(config){Object.assign(this,config);}dispose(){}}
 const THREE={Group:Node,Mesh,BoxGeometry,CylinderGeometry,MeshStandardMaterial};
 const equipmentSource=source('js/procedural-equipment.js').replace(/^import .*;\s*$/gm,'').replace(/export (const|function|class) /g,'$1 ');
 const {EQUIPMENT_TYPES,EQUIPMENT_NUMERIC,buildEquipment}=new Function('THREE',equipmentSource+'\nreturn {EQUIPMENT_TYPES,EQUIPMENT_NUMERIC,buildEquipment};')(THREE);
 const {sanitiseFurniture,makeFurniture,rebuildFurniture}=new Function('THREE','wallPresetTexture','EQUIPMENT_TYPES','EQUIPMENT_NUMERIC','buildEquipment',section+'\nreturn {sanitiseFurniture,makeFurniture,rebuildFurniture};')(THREE,()=>null,EQUIPMENT_TYPES,EQUIPMENT_NUMERIC,buildEquipment);
 for(const kind of ['table','chair','stool','armchair','sofa','bed','cabinet']){
  const group=makeFurniture({variant:kind});
  assert.equal(group.userData.editorKind,'furniture');assert.equal(group.userData.furniture.variant,kind);
  assert.ok(group.children.length>=2,kind);
  assert.ok(group.children.every(child=>child.userData.furniturePart));
  assert.ok(group.children.every(child=>Number.isFinite(child.position.x+child.position.y+child.position.z)));
  rebuildFurniture(group,{variant:kind,width:1.7,color:'#123456'});
  assert.equal(group.userData.furniture.width,1.7);
 }
 const hex=makeFurniture({variant:'table',topShape:'polygon',corners:6,topRadius:1.05,legStyle:'four'});
 assert.equal(hex.children[0].geometry.type,'CylinderGeometry');
 assert.equal(hex.children[0].geometry.args[0],1.05,'polygon tabletop uses the user radius');
 const round=makeFurniture({variant:'table',topShape:'round',topRadius:.65});
 assert.equal(round.children[0].geometry.args[3],48,'round tabletop has 48 radial sides');
 assert.equal(hex.children.length,7,'polygon corners receive matching legs');
 const bed=makeFurniture({variant:'bed',legStyle:'none',headboard:false});
 assert.equal(bed.children.length,2,'mattress on floor, without feet or headboard');
 const shelves=makeFurniture({variant:'cabinet',shelves:7});
 assert.equal(shelves.children.length,12,'top, bottom, two sides, back and seven shelves');
 assert.equal(sanitiseFurniture({variant:'table',width:Infinity,corners:-5}).width,1.4);
 assert.equal(sanitiseFurniture({variant:'table',corners:-5}).corners,3);
});

test('furniture editor, backend, archives, collider assembly and selected portrait framing are integrated',()=>{
 const editor=source('js/editor.js'),server=source('backend/server.py'),archive=source('backend/realm_archives.py'),physics=source('js/scene-physics.js'),css=source('styles.css'),html=source('index.html');
 assert.match(editor,/\['Basic furnitures',\['table','chair','stool','armchair','sofa','bed','cabinet'\]\]/);
 assert.match(editor,/furniture:o\.userData\.editorKind==='furniture'/);
 assert.match(editor,/rebuildFurniture\(o,entry\.furniture\|\|\{\}\)/);
 assert.match(editor,/renderFurnitureControls\(obj\)/);
 assert.match(editor,/this\.add\('furniture',true,undefined,true,k\)/);
 assert.match(html,/id="furniturePropertiesFields"/);
 assert.match(server,/def valid_basic_furniture\(value\):/);
 assert.match(server,/if obj\['kind'\]=='furniture' and not valid_basic_furniture/);
 assert.match(archive,/KINDS=.*'furniture'/);
 assert.match(physics,/segment\.userData\.furniturePart/);
 assert.match(physics,/kind==='furniture'\?JSON\.stringify\(object\.userData\.furniture\)/);
 assert.match(css,/robot-face-choice\[aria-pressed="true"\]::after/);
 assert.match(css,/#ladderProperties \.ladder-fields,#furnitureProperties \.furniture-properties-fields/);
});
