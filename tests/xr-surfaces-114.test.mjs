import test from 'node:test';
import assert from 'node:assert/strict';
import {selectXRLanding,surfaceTeleportDestination,xrTeleportRange} from '../js/xr-navigation.js';
import fs from 'node:fs';

const origin={x:0,y:1.5,z:0},head={x:0,y:1.7,z:0};
const options={controller:origin,head,maxDistance:5,worldLimit:40,standingY:0};
const hit=(x,y,z,distance,normalY=1)=>({point:{x,y,z},distance,normalY});

test('XR surface teleport lands at real height on nearby static mesh',()=>{
 const surface=hit(2,3,0,3.7);
 assert.equal(selectXRLanding([surface],{...options,standingY:3}),surface);
 assert.deepEqual(surfaceTeleportDestination({x:0,y:4.7,z:0},surface.point,3),{x:2,y:4.7,z:0});
});
test('XR limits controller ray length and headset distance',()=>{
 assert.equal(selectXRLanding([hit(3,0,0,7)],options),null);
 assert.equal(selectXRLanding([hit(5.5,0,0,4.4)],options),null);
 assert.equal(selectXRLanding([hit(3,0,0,3.6)],options)?.point.x,3);
});
test('XR excludes steep surfaces and does not see ground through a wall',()=>{
 assert.equal(selectXRLanding([hit(1,1,0,1.8,.1),hit(2,0,0,3)],options),null);
 assert.equal(selectXRLanding([hit(1,1,0,2,-.9)],options),null);
 assert.equal(selectXRLanding([{...hit(1,0,0,1.5),walkable:false},hit(2,0,0,3)],options),null);
});
test('XR prevents accidental floor drops from elevated walkways',()=>{
 assert.equal(selectXRLanding([hit(1,0,0,2)],{...options,head:{x:0,y:4.7,z:0},standingY:3}),null);
 assert.ok(selectXRLanding([hit(1,2.4,0,2)],{...options,head:{x:0,y:4.7,z:0},standingY:3}));
});
test('XR settings clamp persisted range',()=>{
 assert.equal(xrTeleportRange(100),20);assert.equal(xrTeleportRange(1),2);assert.equal(xrTeleportRange('bad'),5);
});
test('XR landing implementation includes static scene meshes and elevation updates',()=>{
 const world=fs.readFileSync(new URL('../js/world.js',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(world,/xrWalkableMeshes\(/);assert.match(world,/\['static','kinematic','dynamic'\]/);
 assert.match(world,/xrLanding\(this\.raycaster\)/);
 assert.match(world,/teleportTo\(input\.landing,\{vertical:true,surface:true\}\)/);
 assert.match(world,/xrStandingSurfaceY=landing\.y/);
 assert.match(world,/teleportIndicator\.position\.copy\(input\.landing\)/);
 assert.match(html,/id="xrTeleportMaxDistance"/);
});
