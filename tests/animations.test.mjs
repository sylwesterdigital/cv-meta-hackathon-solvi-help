import test from 'node:test';
import assert from 'node:assert/strict';
import {findClip,computeMode,clipBase,MOTION_ALIASES} from '../js/animations.js';
const clips=[
 {name:'Falling Idle__118120901'},
 {name:'Falling Back Death__128190901'},
 {name:'Walking__118080901'},
 {name:'Running__105940901'},
 {name:'Idle__117780901'},
 {name:'Waving__106100901'}
];
test('idle chooses exact Idle, never Falling Idle',()=>assert.equal(findClip(clips,'idle')?.name,'Idle__117780901'));
test('idle remains correct independent of clip ordering',()=>assert.equal(findClip([...clips].reverse(),'idle')?.name,'Idle__117780901'));
test('no substring fallback for Falling Idle',()=>assert.equal(findClip(clips.filter(x=>!x.name.startsWith('Idle__')),'idle'),null));
test('Mixamo locomotion aliases',()=>{
 assert.equal(findClip(clips,'walk')?.name,'Walking__118080901');
 assert.equal(findClip(clips,'run')?.name,'Running__105940901');
 assert.equal(findClip(clips,'wave')?.name,'Waving__106100901');
});
test('clipBase removes numeric Mixamo suffix',()=>assert.equal(clipBase('Falling Idle__118120901'),'falling idle'));
test('speed to animation mode',()=>{
 assert.equal(computeMode(0),'idle');assert.equal(computeMode(1.4),'walk');assert.equal(computeMode(3.3),'run');
});

import {teleportOffset,validTeleport} from '../js/xr-navigation.js';
test('XR teleport maths',()=>{
 assert.deepEqual(teleportOffset({x:1,z:2},{x:4,z:-3}),{x:-3,y:0,z:5});
 assert.equal(validTeleport(17,0),false);
});
