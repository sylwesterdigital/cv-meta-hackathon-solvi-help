import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapPixelsPerMeter,mapPanAfterDrag,mapCanvasSize} from '../js/minimap-geometry.js';
import {cameraFromLocalOffset} from '../js/camera-follow.js';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('map uses an isotropic scale: changing width or height never stretches footprints',()=>{
  const shortWide=mapPixelsPerMeter(35,600,250);
  const shortTall=mapPixelsPerMeter(35,250,600);
  assert.equal(shortWide,shortTall);
  const square=mapPixelsPerMeter(35,250,250);
  assert.equal(shortWide,square);
  assert.equal(mapPixelsPerMeter(35,600,250),250/70);
  assert.deepEqual(mapCanvasSize(600,250,2),{width:1200,height:500});
  const map=read('js/minimap.js');
  assert.match(map,/mapPixelsPerMeter\(zoom,w,h\)/);
  assert.match(map,/\(x-panX\)\*metres/);
  assert.match(map,/\(z-panZ\)\*metres/);
});
test('map follows pointer in both directions by the same distance per metre',()=>{
  const size=mapPixelsPerMeter(20,640,320);
  const result=mapPanAfterDrag({panX:4,panZ:-2},40,40,20,640,320);
  assert.equal(result.panX,4-40/size);
  assert.equal(result.panZ,-2-40/size);
  const reverse=mapPanAfterDrag({panX:4,panZ:-2},-40,-40,20,640,320);
  assert.ok(reverse.panX>4&&reverse.panZ>-2);
});
test('seating preserves a world-space camera offset before the robot rotates',()=>{
  const world=read('js/world.js'),seat=read('js/robot-seating.js');
  assert.match(seat,/editor\.world\?\.lockCameraForSeating\?\.\(robot\)/);
  assert.ok(seat.indexOf('lockCameraForSeating')<seat.indexOf('robot.rotation.y=plan.yaw'));
  assert.match(world,/this\.seatCameraLock=\{id:robot\.userData\.editorId/);
  assert.match(world,/if\(this\.seatCameraLock\)\{/);
  assert.match(world,/anchor\.x\+held\.x,anchor\.y\+held\.y,anchor\.z\+held\.z/);
  assert.match(world,/if\(Math\.hypot\(anchor\.x-seatLock\.standingOrigin\.x,anchor\.z-seatLock\.standingOrigin\.z\)>\.55\)/);
  // A local-relative chase offset would swing 180 degrees if the robot yaw flips;
  // the seat lock instead retains the same world-space xyz vector.
  const anchor={x:1,y:2,z:3},local={x:0,y:2,z:-5};
  const before=cameraFromLocalOffset(anchor,local,0),flipped=cameraFromLocalOffset(anchor,local,Math.PI);
  assert.notDeepEqual(before,flipped);
  const savedWorldOffset={x:before.x-anchor.x,y:before.y-anchor.y,z:before.z-anchor.z};
  assert.deepEqual({x:anchor.x+savedWorldOffset.x,y:anchor.y+savedWorldOffset.y,z:anchor.z+savedWorldOffset.z},before);
});
test('wide eyes have an on-demand control, ready handshake and explicit failure state',()=>{
  const html=read('index.html'),editor=read('js/editor.js'),studio=read('js/studio.js');
  assert.match(html,/id="robotEyeRefreshWide"/);
  assert.match(editor,/solvi:robot-eyes-wide-ready/);
  assert.match(editor,/solvi:robot-eyes-wide-status/);
  assert.match(editor,/const hasWide=!!/);
  assert.match(editor,/Stitched wide eyes/);
  assert.doesNotMatch(editor,/Date\.now\(\)-recentWide\.at<240000/);
  assert.match(studio,/solvi:robot-eyes-wide-ready/);
  assert.match(studio,/notify\('capturing'\)/);
  assert.match(studio,/notify\('unavailable'/);
  assert.match(studio,/notify\('complete'\)/);
  assert.match(studio,/force\?8000:120000/);
  assert.match(studio,/form\.append\('frame',photo/); // Muse still gets raw central frame.
});
test('wide panorama is surfaced in Vision while the original raw frame remains available',()=>{
  const brains=read('js/robot-brains.js'),studio=read('js/studio.js');
  assert.match(brains,/view\.label\|\|''\)\.startsWith\('Stitched wide eyes'\)/);
  assert.match(brains,/renderFrameGallery\(\);showFrame\(view\.blob,view\.label\)/);
  assert.match(studio,/captureRobotWideSurvey\(view=>captureRobotView/);
  assert.match(studio,/Stitched wide eyes · 210° horizontal × 135° vertical/);
});
