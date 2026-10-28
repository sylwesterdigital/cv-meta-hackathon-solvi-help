import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chaseOffset,CHASE_MIN_DISTANCE,CHASE_MAX_DISTANCE,clampChaseDistance,zoomChaseDistance} from '../js/camera-follow.js';
const read=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('chase follow distance clamps to a useful user-adjustable range',()=>{
 assert.equal(clampChaseDistance(-1),5);
 assert.equal(clampChaseDistance(Infinity),5);
 assert.equal(clampChaseDistance(0.1),CHASE_MIN_DISTANCE);
 assert.equal(clampChaseDistance(70),CHASE_MAX_DISTANCE);
 assert.equal(chaseOffset(4).z,-4);
 assert.equal(chaseOffset(30).z,-30);
});

test('wheel scroll moves chase camera smoothly in both directions',()=>{
 const inwards=zoomChaseDistance(6,-80);
 const outwards=zoomChaseDistance(6,80);
 assert.ok(inwards<6&&inwards>=CHASE_MIN_DISTANCE);
 assert.ok(outwards>6&&outwards<=CHASE_MAX_DISTANCE);
 assert.equal(zoomChaseDistance(CHASE_MIN_DISTANCE,-600),CHASE_MIN_DISTANCE);
 assert.equal(zoomChaseDistance(CHASE_MAX_DISTANCE,600),CHASE_MAX_DISTANCE);
});

test('wheel event captured ahead of OrbitControls in chase and orbit and XR stays unaffected',()=>{
 const w=read('js/world.js');
 assert.match(w,/renderer\.domElement\.addEventListener\('wheel'/);
 assert.match(w,/\{capture:true,passive:false\}/);
 assert.match(w,/!\['chase','orbit'\]\.includes\(this\.cameraFollowMode\)\|\|!this\.robotEditor\?\.robot\(\)\|\|this\.renderer\.xr\.isPresenting/);
 assert.match(w,/event\.preventDefault\(\);event\.stopImmediatePropagation\(\)/);
 assert.match(w,/this\.setChaseDistance\(zoomChaseDistance\(this\.followChaseDistance,delta\)\)/);
 assert.match(w,/this\.camera\.position\.lerp\(/);
});

test('slider and wheel share persisted chase distance, selected avatar does not reset it',()=>{
 const w=read('js/world.js'),ui=read('index.html'),css=read('styles.css');
 assert.match(ui,/id="chaseDistanceControl"[^>]*hidden/);
 assert.match(ui,/id="chaseDistanceSlider"[^>]*min="1\.8" max="35"/);
 assert.match(css,/#chaseDistanceControl\[hidden\]\{display:none!important\}/);
 assert.match(w,/localStorage\.setItem\('solvi-chase-distance',String\(this\.followChaseDistance\)\)/);
 assert.match(w,/if\(!this\.followChaseCustomized\)this\.followChaseDistance=clampChaseDistance\(currentDistance\)/);
 assert.match(w,/if\(this\.cameraFollowMode==='chase'\)this\.setChaseDistance\(nextDistance\)/);
 assert.doesNotMatch(read('js/live.js'),/solvi-chase-distance|followChaseDistance/);
});
