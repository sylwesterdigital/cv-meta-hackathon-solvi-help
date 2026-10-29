import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {panoramaProjection,panoramaMode,PANORAMA_FOV_DEGREES,PANORAMA_STEP_DEGREES} from '../js/robot-panorama.js';
import {observationPlan} from '../js/robot-observation.js';
const source=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('360° uses six overlapping square 72° views at 60° spacing, 180° uses three',()=>{
 const full=observationPlan('look around');
 assert.equal(panoramaMode(full),360);
 assert.equal(panoramaMode(observationPlan('180 degrees')),180);
 assert.equal(PANORAMA_FOV_DEGREES,72);
 assert.equal(PANORAMA_STEP_DEGREES,60);
 assert.equal(PANORAMA_FOV_DEGREES-PANORAMA_STEP_DEGREES,12);
 assert.deepEqual(full.map(f=>f.yaw),[0,60,120,180,240,300]);
 assert.equal(panoramaMode(observationPlan('',true)),0);
});
test('projection uses physical camera angles, aligns frame centres and overlaps seams',()=>{
 for(const yaw of [0,60,120,180,240,300]){
  const centre=panoramaProjection(yaw,-12,yaw,-12);
  assert.ok(centre);
  assert.ok(Math.abs(centre.u-.5)<1e-10 && Math.abs(centre.v-.5)<1e-10);
 }
 const one=panoramaProjection(30,-12,0,-12),two=panoramaProjection(30,-12,60,-12);
 assert.ok(one&&two);
 assert.ok(one.u>.5&&two.u<.5);
 assert.ok(Math.abs(one.weight-two.weight)<1e-9);
 assert.ok(panoramaProjection(359,-12,0,-12));
 assert.ok(panoramaProjection(325,-12,300,-12));
 assert.equal(panoramaProjection(90,-12,0,-12),null);
});
test('panorama is a browser-stitched preview, never a redundant Muse input',()=>{
 const js=source('js/studio.js'),brains=source('js/robot-brains.js'),server=source('backend/server.py'),css=source('styles.css');
 assert.match(js,/stitchRobotPanorama\(panoFrames\)/);
 assert.match(brains,/stitchRobotPanorama\(frames\)/);
 assert.match(brains,/classList\.toggle\('panorama'/);
 assert.match(css,/#robotBrainsPanel #brainsEyeStage\.panorama #brainsEyeImage/);
 assert.match(server,/panorama_media_id/);
 assert.match(server,/if not panorama_media or panorama_media\['mime'\]!='image\/jpeg'/);
 assert.match(server,/json\.dumps\(\(\[panorama_id\] if panorama_id else \[\]\)\+raw_ids\)/);
 assert.match(server,/for index,\(path,label\) in enumerate\(zip\(paths,views\)\)/);
 assert.match(server,/images=len\(paths\)/);
 assert.match(server,/NOT an extra Muse input/);
});
