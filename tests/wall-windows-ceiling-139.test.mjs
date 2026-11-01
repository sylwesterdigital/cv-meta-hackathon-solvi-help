import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sanitiseWall,wallWindowLayout,pointWithinPolygon} from '../js/office-wall-math.js';
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
