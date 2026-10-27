import test from 'node:test';
import assert from 'node:assert/strict';
import {teleportOffset,validTeleport} from '../js/xr-navigation.js';
test('XR reference offset moves viewpoint to target',()=>{
 assert.deepEqual(teleportOffset({x:1,z:2},{x:4,z:-3}),{x:-3,y:0,z:5});
});
test('XR destination remains within walkable floor bounds',()=>{
 assert.equal(validTeleport(3,-5),true);
 assert.equal(validTeleport(99,1),false);
 assert.equal(validTeleport(NaN,1),false);
});
