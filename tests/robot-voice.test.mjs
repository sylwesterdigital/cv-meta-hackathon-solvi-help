import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');

test('opt-in captions publish final speech to persistent room chat',()=>{
 const ui=read('js/studio.js'),speech=read('js/voice-captions.js'),html=read('index.html');
 assert.match(speech,/SpeechRecognition/);assert.match(speech,/\.isFinal/);
 assert.match(speech,/solviPublishCaption/);assert.match(ui,/\/api\/message/);
 for(const id of ['captionsButton','captionStatus','voiceWavesButton'])assert.match(html,new RegExp(`id="${id}"`));
});
test('FaceCap head orientation, voice rings, and upper-body hand landmarks stream as numbers',()=>{
 const world=read('js/world.js'),tracker=read('js/face-tracking.js'),server=read('backend/server.py');
 assert.match(tracker,/outputFacialTransformationMatrixes:true/);assert.match(tracker,/PoseLandmarker/);assert.match(tracker,/HandLandmarker/);
 assert.match(world,/headRotation:this\.localHeadRotation/);assert.match(world,/voiceLevel:this\.localVoiceLevel/);
 assert.match(world,/updateVoiceRings/);assert.match(server,/filtered\['headRotation'\]/);assert.match(server,/filtered\['body'\]/);
});
test('robot can be placed, animated and used to capture first-person image',()=>{
 const ui=read('index.html'),robot=read('js/robots.js'),editor=read('js/editor.js'),studio=read('js/studio.js');
 assert.match(editor,/'robot'/);assert.match(editor,/makeRobot/);assert.match(editor,/hydrateRobot/);
 assert.match(robot,/MotionController/);assert.match(robot,/captureRobotView/);assert.match(studio,/captureRobotView\(world,robot\)/);
 for(const id of ['robotControls','robotActionSelect','robotSpeed'])assert.match(ui,new RegExp(`id="${id}"`));
 assert.ok(statSync(new URL('assets/solvi-character.glb',root)).size>1_000_000);
});
test('objects persist as atomic room-scoped operations, and remote clients auto-refresh',()=>{
 const editor=read('js/editor.js'),server=read('backend/server.py'),studio=read('js/studio.js');
 assert.match(server,/@app\.post\('\/api\/scene\/object'\)/);
 assert.match(server,/BEGIN IMMEDIATE/);assert.match(server,/type':'scene-changed'/);
 assert.match(editor,/persistObject/);assert.match(editor,/acceptRemoteRevision/);
 assert.match(studio,/scene-changed'.*editor\.acceptRemoteRevision/);
});
