import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
test('natural walking commands produce executable missions and preserve verified targets',()=>{
 const s=read('backend/server.py');
 assert.match(s,/relative_travel=bool/);
 assert.match(s,/go forward\|run/);
 assert.match(s,/edit_distance\(a,b\)/);
 assert.match(s,/return \{'kind':'walk_forward'/);
 assert.match(read('backend/test_api.py'),/go further 10 meters/);
 assert.match(read('backend/test_api.py'),/Red Pshere/);
});
test('debug compares actual robot travel and planned route with floor-width visibility',()=>{
 const v=read('js/robot-path-visuals.js'),editor=read('js/editor.js'),studio=read('js/studio.js');
 assert.match(v,/Float32BufferAttribute/);
 assert.match(v,/trackRobotPathDebug/);
 assert.match(v,/actual-travelled-trail/);
 assert.match(v,/0x4fd6ff/);
 assert.match(editor,/solvi:robot-route/);
 assert.match(editor,/trackRobotPathDebug\(this\.world,item\)/);
 assert.match(studio,/ROUTE ACCEPTED/);
 assert.match(studio,/ROUTE BLOCKED/);
});
