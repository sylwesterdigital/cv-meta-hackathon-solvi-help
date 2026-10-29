import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {observationPlan} from '../js/robot-observation.js';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');

test('new objects around a robot trigger multi-direction camera sweep',()=>{
 assert.equal(observationPlan('@Elox how are you? There are some new objects in the surroundings?').length,6);
 assert.equal(observationPlan('@Elox powiedz co teraz widzisz?').length,1);
});

test('robot visual questions are routed before text-only scene-index conversation',()=>{
 const backend=read('backend/server.py');
 assert.match(backend,/def is_robot_visual_question/);
 assert.match(backend,/co teraz/);
 assert.match(backend,/changed_objects/);
 assert.match(backend,/needs_vision=True/);
 assert.match(read('js/studio.js'),/captureRobotObservation\(robot,message.text\)/);
});
