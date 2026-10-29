import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');

test('autonomous camera perception uses transient frames, server reservations and visual memory',()=>{
 const server=read('backend/server.py'),studio=read('js/studio.js');
 assert.match(server,/def robot_perception_start\(/);
 assert.match(server,/def robot_perception_complete\(/);
 assert.match(server,/ROBOT_PERCEPTION_DAILY/);
 assert.match(server,/Camera observation:/);
 assert.match(studio,/observeAutonomously/);
 assert.match(studio,/captureRobotView\(editor\.world,robot/);
 assert.match(studio,/form\.append\('frame',photo/);
 assert.doesNotMatch(studio.slice(studio.indexOf('const observeAutonomously='),studio.indexOf('// Opt-in robot social initiatives')),/bubble\(/);
});

test('ordinary chat can request implicit real vision and attached image analysis',()=>{
 const server=read('backend/server.py'),studio=read('js/studio.js');
 assert.match(server,/natural_vision=\(/);
 assert.match(server,/has_image or is_robot_visual_question\(text\)/);
 assert.match(studio,/const attached=response\.vision_source==='attachment'/);
 assert.match(studio,/payload\.use_chat_attachments=true/);
 assert.match(studio,/implicit_vision:response\.implicit_vision===true/);
});
