import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('dynamic scene transforms teleport the existing Rapier pose and clear angular velocity',()=>{
 const physics=src('js/scene-physics.js');
 const start=physics.indexOf(' applyEditedPose(object,{stopMotion=true}={}){');
 const end=physics.indexOf('\n colliderShape(object){',start);
 assert.ok(start>0&&end>start);
 const method=physics.slice(start,end).replace(/^ applyEditedPose/,'function applyEditedPose');
 const fn=new Function('return '+method)();
 const calls=[];
 const body={setTranslation:(...a)=>calls.push(['position',...a]),setRotation:(...a)=>calls.push(['rotation',...a]),setLinvel:(...a)=>calls.push(['velocity',...a]),setAngvel:(...a)=>calls.push(['spin',...a]),isDynamic:()=>true};
 const obj={userData:{editorId:'cube'},position:{x:3,y:2,z:-4},quaternion:{x:0,y:0,z:0,w:1}};
 const state={sync:()=>calls.push(['sync']),bodies:new Map([['cube',body]]),remoteTargets:new Map()};
 fn.call(state,obj);
 assert.deepEqual(calls.map(v=>v[0]),['sync','position','rotation','velocity','spin']);
 assert.equal(calls[2][1],obj.quaternion);
 const editor=src('js/editor.js');
 assert.match(editor,/obj\[field\]\.set\(neutral,neutral,neutral\);this\.physics\.applyEditedPose\(obj\)/);
});
test('preset placement moves its dynamic rigid body as well as the scene object',()=>{
 const editor=src('js/editor.js');
 const call=editor.slice(editor.indexOf(' addFromPreset(saved){'),editor.indexOf(' select(obj){',editor.indexOf(' addFromPreset(saved){')));
 assert.match(call,/centreGroundFromCamera/);
 assert.match(call,/positionNewOnGround\(obj,point\)/);
 assert.match(call,/this\.physics\.applyEditedPose\(obj\)/);
});
test('furniture dimensions use the shared contextual slider and compact transform styling',()=>{
 const editor=src('js/editor.js'),css=src('styles.css');
 assert.match(editor,/if\(!limits\.every\(/);
 assert.match(editor,/inspector-compact-field/);
 assert.match(editor,/inspector-compact-number/);
 assert.match(editor,/if\(target\.type!=='number'\)this\.renderFurnitureControls\(obj\)/);
 assert.match(css,/#propertiesPanel #objectInspector :is\(input\[type="number"\],select\)/);
 assert.match(css,/background:var\(--ui-bg/);
});
test('microphone-only recording cannot access getTracks on a null video stream',()=>{
 const studio=src('js/studio.js');
 assert.match(studio,/if\(sourceStream&&sourceStream===preparedVideoStream\)/);
 assert.doesNotMatch(studio,/if\(sourceStream===preparedVideoStream\)/);
 assert.match(studio,/reportRecordingError\(e,video\?'video':'audio'\)/);
});
test('one draggable My camera panel owns video capture controls and recorded preview',()=>{
 const html=src('index.html'),studio=src('js/studio.js'),css=src('styles.css'),tracking=src('js/face-tracking.js');
 assert.match(html,/id="webcamPanel"/);
 assert.match(html,/class="webcam-head drag-handle"/);
 assert.match(html,/id="webcamRecordingHost"/);
 assert.match(studio,/if\(video\)host\.append\(panel\)/);
 assert.match(studio,/showOnlyCameraPreview\(\{playback:true\}\)/);
 assert.match(studio,/window\.solviEnsureMyCamera\?\.\(\)/);
 assert.match(studio,/'webcamPanel'\]/);
 assert.match(tracking,/window\.solviEnsureMyCamera=/);
 assert.match(css,/#webcamPanel \.webcam-head\.drag-handle/);
});
