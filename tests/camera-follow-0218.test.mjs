import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CAMERA_FOLLOW_MODES,nextCameraMode,followAnchor,rotateByYaw,localOrbitOffset,cameraFromLocalOffset,chaseOffset,smoothFactor} from '../js/camera-follow.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const near=(a,b,epsilon=1e-8)=>assert.ok(Math.abs(a-b)<epsilon,`${a} ≠ ${b}`);
test('bottom button cycles free -> inertial chase -> orbit follow -> free',()=>{
 assert.deepEqual(CAMERA_FOLLOW_MODES,['free','chase','chase-smart','orbit']);
 assert.equal(nextCameraMode('free'),'chase');assert.equal(nextCameraMode('chase'),'chase-smart');assert.equal(nextCameraMode('chase-smart'),'orbit');assert.equal(nextCameraMode('orbit'),'free');
 assert.match(read('index.html'),/id="cameraFollowButton"[^>]+data-mode="free"/);
 assert.match(read('js/world.js'),/followButton\.addEventListener\('click',\(\)=>this\.setCameraFollowMode\(nextCameraMode\(this\.cameraFollowMode\)\)\)/);
});
test('behind camera rotates with robot heading, never fixed to world axes',()=>{
 const anchor=followAnchor({position:{x:3,y:0,z:8}}),local=chaseOffset(5);
 near(anchor.y,1.38);assert.ok(local.y>0&&local.z<0);
 const front=cameraFromLocalOffset(anchor,local,0);
 near(front.x,3);near(front.z,3);
 const turned=cameraFromLocalOffset(anchor,local,Math.PI/2);
 near(turned.x,-2);near(turned.z,8);
 assert.ok(front.y>anchor.y&&turned.y>anchor.y);
});
test('orbit follow preserves the camera orbit offset, even as player turns and translates',()=>{
 const anchor={x:0,y:1.38,z:0},camera={x:4,y:3,z:6};
 const local=localOrbitOffset(camera,anchor,0);
 const original=cameraFromLocalOffset(anchor,local,0);
 near(original.x,camera.x);near(original.y,camera.y);near(original.z,camera.z);
 const turned=cameraFromLocalOffset({x:10,y:1.38,z:-2},local,Math.PI/2);
 near(turned.x,16);near(turned.y,3);near(turned.z,-6);
 const regained=localOrbitOffset(turned,{x:10,y:1.38,z:-2},Math.PI/2);
 for(const key of ['x','y','z'])near(regained[key],local[key]);
});
test('chase inertia is frame-rate independent and XR is excluded',()=>{
 const alpha60=smoothFactor(1/60,4.5),alpha30=smoothFactor(1/30,4.5);
 assert.ok(alpha60>0&&alpha60<alpha30&&alpha30<1);
 near(1-(1-alpha60)**2,alpha30);
 const code=read('js/world.js');
 assert.match(code,/if\(this\.renderer\.xr\.isPresenting\|\|document\.pointerLockElement===this\.renderer\.domElement\|\|this\.cameraFollowMode==='free'\)return/);
 assert.match(code,/this\.editorDragging\|\|this\.editorGizmoPointer/);
 assert.match(code,/this\.updateXR\(\);this\.robotEditor\?\.tick\(dt\);if\(!sketchLocked\)this\.updateFollowCamera\(dt\)/);
 assert.match(code,/this\.followOrbitOffset=localOrbitOffset\(this\.camera\.position,target,yaw\)/);
});
test('manual numpad camera views remain active in orbit-follow rather than being overwritten',()=>{
 const code=read('js/world.js');
 assert.match(code,/syncFollowAfterManualView\(\)/);
 assert.match(code,/if\(\['chase','chase-smart'\]\.includes\(this\.cameraFollowMode\)\)this\.setCameraFollowMode\('orbit'\)/);
 assert.match(code,/this\.camera\.lookAt\(center\);this\.controls\.update\(\);this\.syncFollowAfterManualView\(\)/);
});
test('follow status persists locally and does not add any websocket payload',()=>{
 const code=read('js/world.js'),main=read('index.html'),style=read('styles.css');
 assert.match(code,/localStorage\.setItem\('solvi-camera-follow',mode\)/);
 assert.match(code,/this\.followRobotId=id/);
 assert.match(main,/id="cameraFollowButton"/);
 assert.match(style,/#cameraFollowButton\.bottom-camera-mode\{/);
 assert.doesNotMatch(read('js/live.js'),/cameraFollowMode|followOrbitOffset/);
});
