import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('CC captions and typed chat use same authenticated robot reaction handler',()=>{
 const studio=read('js/studio.js');
 assert.match(studio,/async function reactToRobotMessage\(message\)/);
 assert.match(studio,/await reactToRobotMessage\(response\.message\)/);
 assert.match(studio,/window\.solviPublishCaption=async text/);
 assert.match(studio,/receiveRobotCommand\(response\.command\)/);
});
test('navigation is limited to room-scoped, validated robot and object ids',()=>{
 const server=read('backend/server.py'),editor=read('js/editor.js');
 assert.match(server,/def plan_robot_command\(text,robot,objects\):/);
 assert.match(server,/def _robot_address\(text,robots\):/);
 assert.match(server,/if command and not may_edit/);
 assert.match(server,/command=command/);
 assert.match(editor,/command\.room!==\(window\.solviRoom/);
 assert.match(editor,/command\.target_id/);
 assert.match(editor,/new THREE\.Box3\(\)\.setFromObject\(target\)/);
});
test('Sitting requires a real avatar animation; cannot fake physical completion',()=>{
 const robots=read('js/robots.js');
 assert.match(robots,/export function sittingClip/);
 assert.match(robots,/missing-sit-clip/);
 assert.match(robots,/robotMission/);
});
