import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chooseSurfacePlacement,placementFitsSurface,placementBoxesOverlap} from '../js/smart-placement-math.js';

const box=(x1,y1,z1,x2,y2,z2,sourceId)=>({sourceId,min:{x:x1,y:y1,z:z1},max:{x:x2,y:y2,z:z2}});
const rect=(x1,z1,x2,z2)=>[{x:x1,z:z1},{x:x2,z:z1},{x:x2,z:z2},{x:x1,z:z2}];
const camera={x:0,y:1.7,z:3.2};
const screen=p=>({x:p.x/3,y:(p.y-.6)/2,z:0});
const table={id:'table',kind:'tabletop',topY:.75,polygon:rect(-.7,-.7,.7,.1)};
const furniture=box(-.7,0,-.7,.7,.75,.1,'table');
const prop={width:.08,depth:.08,height:.14};
const plan=(extra={})=>chooseSurfacePlacement({camera,footprint:prop,supports:[table],obstacles:[furniture],project:screen,
 maxCameraDistance:12,allowTabletop:true,...extra});

test('a visible tabletop accepts a can even while the table itself blocks all floor positions',()=>{
 const placed=plan();assert.ok(placed,'tabletop must not be rejected by its own solid collider');
 assert.equal(placed.kind,'tabletop');assert.equal(placed.supportId,'table');
 assert.ok(placed.groundY>=.75);assert.ok(placed.x>=-.7&&placed.x<=.7);
});
test('the second bottle appears near the prior can without stacking or colliding',()=>{
 const first=plan();assert.ok(first);
 const occupied=box(first.x-.06,first.groundY,first.z-.06,first.x+.06,first.groundY+.17,first.z+.06,'can1');
 const second=plan({anchor:{x:first.x,y:first.groundY,z:first.z},obstacles:[furniture,occupied]});
 assert.ok(second);assert.notDeepEqual(second,first);
 assert.equal(placementBoxesOverlap(box(second.x-.04,second.groundY,second.z-.04,second.x+.04,second.groundY+.14,second.z+.04),occupied,.035),false);
 assert.ok(Math.hypot(first.x-second.x,first.z-second.z)<.9);
});
test('support floor slab accepts large furniture above its own collider',()=>{
 const floor={id:'floor',kind:'floor',topY:.12,polygon:rect(-3,-4,3,2)};
 const result=chooseSurfacePlacement({camera,footprint:{width:1.4,depth:.8,height:.75},
  supports:[floor],obstacles:[box(-3,-.12,-4,3,.12,2,'floor')],project:screen,allowTabletop:false});
 assert.ok(result);assert.equal(result.kind,'floor');assert.ok(result.groundY>.12);
});
test('big objects cannot be placed on a tabletop through the support planner',()=>{
 assert.equal(plan({allowTabletop:false}),null);
});
test('floor object cannot be placed through room walls, even if the floor slab is walkable',()=>{
 const floor={id:'floor',kind:'floor',topY:.12,polygon:rect(-2,-3,2,0)};
 const wall=box(-3,0,1,3,3,1.2,'wall');
 const result=chooseSurfacePlacement({camera,footprint:prop,supports:[floor],
   obstacles:[box(-2,0,-3,2,.12,0,'floor'),wall],project:screen,allowTabletop:false});
 assert.equal(result,null);
});
test('support fitting checks whole footprint, not only object centre',()=>{
 assert.equal(placementFitsSurface(0,0,.2,.2,rect(-.4,-.4,.4,.4)),true);
 assert.equal(placementFitsSurface(.34,0,.2,.2,rect(-.4,-.4,.4,.4)),false);
});
test('a filled tabletop refuses overlapping placements, preserving manual repositioning',()=>{
 const full=box(-.75,.75,-.75,.75,1.5,.15,'giant');
 assert.equal(plan({obstacles:[furniture,full]}),null);
});
test('new placement integration extracts real table and floor tops before publishing',()=>{
 const placement=readFileSync(new URL('../js/scene-placement.js',import.meta.url),'utf8');
 const editor=readFileSync(new URL('../js/editor.js',import.meta.url),'utf8');
 assert.match(placement,/smartPlacementSupports\(items,object\)/);
 assert.match(placement,/const tabletop=eligible\?chooseSurfacePlacement/);
 assert.match(placement,/supports:supports\.filter\(s=>s\.kind==='tabletop'\)/);
 assert.match(placement,/chooseSurfacePlacement\(/);
 assert.match(placement,/positionNewOnGround\(object,\{x:place\.x-offsetX,y:surface\?\.groundY\?\?groundY/);
 assert.match(placement,/permitsTabletopPlacement\(object,size\)/);
 assert.match(placement,/const tabletopVariants=new Set\(\['table'/);
 assert.match(placement,/const smallSurfaceProps=new Set\(\['plate','mug'/);
 assert.match(placement,/width<1\.2\|\|depth<1\.2\|\|height>\.42/);
 assert.ok(editor.indexOf('this.placeSmartNewObject(object)')<editor.indexOf('this.items.push(object)',editor.indexOf(' add(kind,showGallery')));
});

test('round surfaces respect support boundaries and do not allow corner overhang',()=>{
 const polygon=Array.from({length:24},(_,i)=>({x:Math.cos(2*Math.PI*i/24)*.35,z:Math.sin(2*Math.PI*i/24)*.35}));
 assert.equal(placementFitsSurface(0,0,.08,.08,polygon),true);
 assert.equal(placementFitsSurface(.31,.31,.08,.08,polygon),false);
});
test('camera below a tabletop cannot place an object on its unseen top',()=>{
 const result=plan({camera:{x:0,y:.55,z:3.2}});
 assert.equal(result,null);
});
