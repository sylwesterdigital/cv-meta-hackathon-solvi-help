import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');

test('a group turn cannot be redirected to implicit vision when stale, but 1:1 still can',()=>{
 const server=read('backend/server.py');
 assert.match(server,/individual_vision_turn=\(not from_robot and len\(addressed_list\)==1/);
 assert.match(server,/natural_vision=\(individual_vision_turn/);
 assert.match(server,/is_robot_visual_question\(text\)/);
});
test('path overlays show planned and failed routes, and are accessible via debug toggles',()=>{
 const editor=read('js/editor.js'),studio=read('js/studio.js'),visual=read('js/robot-path-visuals.js');
 assert.match(editor,/robotDebugRoute=\{start,waypoints:\[\],obstacles/);
 assert.match(editor,/finishRobotPathDebug/);
 assert.match(editor,/syncRobotPathDebug/);
 assert.match(studio,/solviEditor\?\.syncRobotPathDebug\(\)/);
 assert.match(visual,/DEBUG_TRAIL_MS=15000/);
 assert.match(visual,/blocked\?0xff5656:0x66ff95/);
 assert.match(read('index.html'),/id="robotPathDebugStatus"/);
});
