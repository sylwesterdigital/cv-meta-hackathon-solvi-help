import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chooseSmartPlacement,placementBoxesOverlap,placementLineBlocked} from '../js/smart-placement-math.js';

const box=(x1,y1,z1,x2,y2,z2)=>({min:{x:x1,y:y1,z:z1},max:{x:x2,y:y2,z:z2}});
const screen=({x,y,z})=>({x:x/6,y:(y-.6)/4,z:0});
const plan=(extra={})=>chooseSmartPlacement({
 camera:{x:0,y:1.7,z:5},centre:{x:0,z:0},forward:{x:0,z:-1},
 footprint:{width:.75,depth:.6,height:1,groundY:0},
 project:screen,maxCameraDistance:12,...extra
});

 test('empty interior: candidate stays in the central camera view and near the operator',()=>{
  const p=plan();assert.ok(p);assert.ok(Math.abs(p.x)<3.5);assert.ok(p.z<5&&p.z>-7);
 });
 test('two consecutive furniture additions favour previous placement without overlapping it',()=>{
  const first=plan();
  const firstBox=box(first.x-.375,0,first.z-.3,first.x+.375,1,first.z+.3);
  const second=plan({anchor:{x:first.x,z:first.z,radius:.5},obstacles:[firstBox]});
  assert.ok(second);assert.ok(Math.hypot(second.x-first.x,second.z-first.z)<3.3);
  assert.ok(!placementBoxesOverlap(box(second.x-.375,0,second.z-.3,second.x+.375,1,second.z+.3),firstBox));
 });
 test('wall between operator and placement blocks rear candidates',()=>{
  const wall=box(-5,0,1,5,3,1.2);
  const placed=plan({obstacles:[wall],anchor:{x:0,z:0,radius:.5}});
  assert.ok(placed,'must find a safe near-side position');
  assert.ok(placed.z>1.3,`place in front of wall, not at ${JSON.stringify(placed)}`);
  assert.equal(placementLineBlocked({x:0,y:1.7,z:5},{x:placed.x,y:.5,z:placed.z},wall),false);
 });
 test('small room: choose inside walls, near last chair, without intersecting room boundaries',()=>{
  const walls=[box(-2.5,0,-2.5,-2.37,2.6,2.5),box(2.37,0,-2.5,2.5,2.6,2.5),box(-2.5,0,-2.5,2.5,2.6,-2.37),box(-2.5,0,2.37,2.5,2.6,2.5)];
  const prior=box(-.9,0,-.4,-.15,.8,.4);
  const placed=plan({camera:{x:0,y:1.7,z:1.5},centre:{x:0,z:0},
   anchor:{x:-.5,z:0,radius:.5},obstacles:[...walls,prior],maxCameraDistance:5});
  assert.ok(placed,`no interior position`);
  assert.ok(Math.abs(placed.x)<2.1&&Math.abs(placed.z)<2.1,JSON.stringify(placed));
  const after=box(placed.x-.375,0,placed.z-.3,placed.x+.375,1,placed.z+.3);
  assert.ok([...walls,prior].every(b=>!placementBoxesOverlap(after,b)));
 });
 test('a room wall group must be tested as individual wall pieces (door gap is allowed)',()=>{
  const wallPieces=[box(-4,0,.5,-.85,2.5,.65),box(.85,0,.5,4,2.5,.65)];
  assert.ok(!placementLineBlocked({x:0,y:1.7,z:5},{x:0,y:.5,z:0},wallPieces[0]));
  const p=plan({obstacles:wallPieces});assert.ok(p);
  assert.ok(!wallPieces.some(w=>placementLineBlocked({x:0,y:1.7,z:5},{x:p.x,y:.5,z:p.z},w)));
 });
 test('nothing is created if the camera view has no safe placement',()=>{
  assert.equal(plan({project:()=>({x:2,y:2,z:0})}),null);
  assert.equal(plan({obstacles:[box(-40,-10,-40,40,20,40)]}),null);
 });
 test('obstacle heights are respected: low furniture below sightline cannot hide distant objects',()=>{
  assert.equal(placementLineBlocked({x:0,y:4,z:4},{x:0,y:1,z:-2},box(-1,0,1,1,.25,2)),false);
  assert.equal(placementLineBlocked({x:0,y:2,z:4},{x:0,y:.5,z:-2},box(-1,0,1,1,3,2)),true);
  assert.equal(placementBoxesOverlap(box(-.5,0,-.5,.5,.9,.5),box(-.4,1.5,-.4,.4,2,.4)),false);
 });
 test('planner never mutates input objects or their previous position',()=>{
  const anchor={x:1,z:-1,radius:.7},wall=box(3,0,1,3.3,3,5),old=JSON.stringify([anchor,wall]);
  plan({anchor,obstacles:[wall]});assert.equal(JSON.stringify([anchor,wall]),old);
 });
 test('editor uses smart placement only before local publication, persists safe additions and undoes rejected presets',()=>{
  const source=readFileSync(new URL('../js/editor.js',import.meta.url),'utf8');
  const module=readFileSync(new URL('../js/scene-placement.js',import.meta.url),'utf8');
  const a=source.slice(source.indexOf(' add(kind,showGallery'),source.indexOf(' planRobotBuildSite('));
  const p=source.slice(source.indexOf(' addFromPreset(saved){'),source.indexOf(' select(obj){',source.indexOf(' addFromPreset(saved){')));
  assert.ok(a.indexOf('placeSmartNewObject(object)')<a.indexOf('this.items.push(object)'));
  assert.ok(a.includes('return null; // Never publish'));
  assert.ok(p.indexOf('placeSmartNewObject(obj)')<p.indexOf('this.queueSave(obj)'));
  assert.match(p,/this\.physics\.remove\(obj\.userData\.editorId\)/);
  assert.match(module,/kind==='wall'/);assert.match(module,/object\.traverse\(node=>/);
  assert.match(module,/worldBox\(node\)/);assert.match(module,/walkableInfrastructure/);
  assert.match(module,/infrastructureNavigationFootprints\(infrastructureSegments\(settings\)/);
  assert.match(module,/Math\.max\(\.12,size\.y\)/);
  assert.match(source,/this\.lastSmartPlacement=null;/);
 });
