import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planRobotTravelRoute,pathBlocked} from '../js/robot-pathfinding.js';
import {roomFurnishingSequence} from '../js/robot-room-furnishing.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const vegetationSource=read('js/procedural-vegetation.js').replace(/^import .*;\s*$/gm,'').replace(/export (const|function|class) /g,'$1 ');
const vegetation=new Function('THREE',vegetationSource+'\nreturn {cleanVegetation,scatterVegetationPositions};')({});
const natureSource=read('js/robot-nature-navigation.js').replace(/^import .*;\s*$/gm,'').replace(/export (const|function|class) /g,'$1 ');
const nav=new Function('scatterVegetationPositions','cleanVegetation',natureSource+'\nreturn {WALKABLE_NATURE_AREAS,natureNavigationFootprints};')(vegetation.scatterVegetationPositions,vegetation.cleanVegetation);
const plot={variant:'vegetationArea',scatterMode:'forest',scatterCount:30,scatterSpacing:2.2,plotPoints:[[-12,-8],[12,-8],[12,8],[-12,8]],plotSeed:22};
test('grass plot is walkable and not turned into one giant rectangle by navigation',()=>{
 assert.deepEqual(nav.natureNavigationFootprints({variant:'groundPlot'},()=>({x:0,z:0})),[]);
 assert.deepEqual(nav.natureNavigationFootprints({variant:'cropBed'},()=>({x:0,z:0})),[]);
 assert.equal(nav.natureNavigationFootprints({variant:'waterPatch'}),null,'water is not silently granted traverse rights');
 assert.ok(read('js/editor.js').includes('WALKABLE_NATURE_AREAS.includes(o.userData.furniture?.variant)'));
});
test('forest route uses real small individual tree trunks, not the full planted area',()=>{
 const obstacles=nav.natureNavigationFootprints(plot,(x,z)=>({x,z}),{name:'Forest / orchard patch',id:'forest'});
 assert.ok(obstacles.length>=8&&obstacles.length<=30);
 assert.ok(obstacles.every(o=>o.kind==='tree-trunk'&&o.maxX-o.minX<1.4));
 const start={x:-15,z:0},end={x:15,z:0};
 const path=planRobotTravelRoute(start,end,obstacles);
 assert.ok(path?.length,'must find a path across the grass amongst trunks');
 assert.ok(Math.hypot(path.at(-1).x-end.x,path.at(-1).z-end.z)<.12);
 let previous=start;
 for(const point of path){
  const n=Math.max(1,Math.ceil(Math.hypot(point.x-previous.x,point.z-previous.z)/.08));
  for(let i=1;i<=n;i++){
   const f=i/n;
   assert.equal(pathBlocked(previous.x+(point.x-previous.x)*f,previous.z+(point.z-previous.z)*f,obstacles,.295),false);
  }
  previous=point;
 }
});
test('forest and terrain patches remain reserved against house placement',()=>{
 const editor=read('js/editor.js'),site=read('js/robot-worksite.js');
 assert.match(editor,/options\.forConstruction/);
 assert.match(editor,/kind:'nature-reserved'/);
 assert.match(editor,/this\.navigationObstacles\(robot,\{forConstruction:true\}\)/);
 assert.match(site,/options\.navigationObstacles/);
});
test('an existing broad agent furnishing objective is a local executable goal',()=>{
 const sequence=roomFurnishingSequence('Adding to theempty houses furnitures');
 assert.deepEqual(sequence,['bed','table']);
 assert.deepEqual(roomFurnishingSequence('please add furniture to these empty houses'),['bed','table']);
 assert.deepEqual(roomFurnishingSequence('do not add furniture to the houses'),[]);
 const autonomy=read('js/robot-autonomy.js');
 assert.match(autonomy,/\(houseGoal\(run\.order\.goal\)\|\|roomFurnishingSequence\(run\.order\.goal\)\.length>0\)/);
 assert.match(autonomy,/if\(plan\.action==='enter_room'\)/);
 assert.match(autonomy,/planRobotRoomEntry\?\.\(bot\)/);
});
test('room entry is always a reachable route, not teleporting into a closed wall',()=>{
 const editor=read('js/editor.js');
 assert.match(editor,/planRobotRoomEntry\(robot\)/);
 assert.match(editor,/o\.userData\.wall\?\.closed===true/);
 assert.match(editor,/planRobotTravelRoute\(start,target,obstacles\)/);
 assert.match(editor,/enclosedRoomFootprint\(pts/);
 assert.match(editor,/if\(!route\?\.length/);
 const complete=planRobotTravelRoute({x:-5,z:0},{x:2,z:0},[
  {minX:-.3,maxX:.3,minZ:-10,maxZ:-.6,kind:'wall'},
  {minX:-.3,maxX:.3,minZ:.6,maxZ:10,kind:'wall'}]);
 assert.ok(complete?.length,'the route can pass through a real 1.2m door opening');
 assert.equal(planRobotTravelRoute({x:-5,z:0},{x:2,z:0},[
  {minX:-.3,maxX:.3,minZ:-1000,maxZ:1000,kind:'wall'}]),null,'a fully closed barrier cannot be crossed');
});

test('new navigation module is mapped into the browser and original diagnostic bubbles do not fake speech',()=>{
 const html=read('index.html'),comic=read('js/robot-comic-bubbles.js');
 assert.match(html,/robot-nature-navigation\.js\?v=0\.2\.241/);
 assert.match(comic,/if\(\/\^AUTONOMY/);
});
test('real room-entry method seeks a same-floor door, and refuses a blocked or read-only room',()=>{
 const editorText=read('js/editor.js');
 const source=editorText.slice(editorText.indexOf(' planRobotRoomEntry(robot){'),editorText.indexOf(' createRobotRoomFurniture(robot,variant,options={}){'));
 assert.ok(source.includes('route=planRobotTravelRoute'));
 class Vector3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}}
 const enclosed=(_pts,corners)=>corners.every(p=>p[0]>.3&&p[0]<5.7&&p[1]>.3&&p[1]<5.7);
 const length=(start,route)=>{let n=0,last=start;for(const point of route){n+=Math.hypot(point.x-last.x,point.z-last.z);last=point;}return n;};
 const fn=new Function('THREE','planRobotTravelRoute','pathBlocked','enclosedRoomFootprint','plannedRouteLength',
  `return ({${source}}).planRobotRoomEntry;`)({Vector3},planRobotTravelRoute,pathBlocked,enclosed,length);
 const robot={position:{x:-5,y:0,z:3},userData:{editorKind:'robot'}};
 const wall={visible:true,position:{distanceToSquared:()=>25},userData:{editorKind:'wall',editorId:'wall',wall:{closed:true,array:{enabled:false},points:[[0,0],[6,0],[6,6],[0,6]]}},
  updateMatrixWorld(){},localToWorld(p){return p;}};
 const doorway=[{minX:-.25,maxX:.25,minZ:-10,maxZ:2.35,kind:'wall'},
  {minX:-.25,maxX:.25,minZ:3.65,maxZ:10,kind:'wall'}];
 const context={items:[robot,wall],canEdit:()=>true,navigationObstacles:()=>doorway};
 const plan=fn.call(context,robot);
 assert.ok(plan?.roomId==='wall'&&plan.meters>6,'must plan physically through the doorway');
 assert.equal(fn.call({...context,canEdit:o=>o===robot},robot),null,'cannot choose read-only room');
 const blocked={...context,navigationObstacles:()=>[{minX:-.25,maxX:.25,minZ:-1000,maxZ:1000,kind:'wall'}]};
 assert.equal(fn.call(blocked,robot),null,'never invent a route through a sealed wall');
});
