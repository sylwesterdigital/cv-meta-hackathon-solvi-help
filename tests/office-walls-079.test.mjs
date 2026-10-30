import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sanitiseWall,simplifyWallPoints,wallSegments,wallWorldToLocal} from '../js/office-wall-math.js';
import {robotPushVector,pushedWalkState} from '../js/robot-push.js';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');

test('wall parameters clamp to bounded physical sizes and safe colour/texture',()=>{
 const wall=sanitiseWall({points:[[0,0],[4,0],[4,3]],height:99,width:-1,opacity:2,texture:'evil',color:'bad'});
 assert.equal(wall.height,10);assert.equal(wall.width,.05);assert.equal(wall.opacity,1);assert.equal(wall.texture,'plaster');assert.equal(wall.color,'#c6d1dc');
 assert.equal(wall.points.length,3);
});
test('a freehand stroke is simplified while preserving its endpoints',()=>{
 const points=Array.from({length:201},(_,i)=>[i/20,Math.sin(i/20)*.01]);
 const simplified=simplifyWallPoints(points,.1);
 assert.deepEqual(simplified,[points[0],points.at(-1)]);
 const sanitised=sanitiseWall({points});assert.equal(sanitised.points.length,80);
 assert.deepEqual(sanitised.points.at(-1),[10,+((Math.sin(10)*.01).toFixed(3))]);
});
test('multi-segment walls have individual orientations and preserve local layout',()=>{
 const world=[{x:7,z:-3},{x:12,z:-3},{x:12,z:1}];
 const local=wallWorldToLocal(world);
 assert.deepEqual(local.points,[[0,0],[5,0],[5,4]]);
 const segments=wallSegments({points:local.points});
 assert.equal(segments.length,2);
 assert.ok(Math.abs(segments[0].yaw)<.01);
 assert.ok(Math.abs(segments[1].yaw+Math.PI/2)<.01);
});
test('controlled push follows contact normal with bounded distance',()=>{
 assert.equal(robotPushVector({x:0,z:0},{x:2,z:0}),null);
 const push=robotPushVector({x:0,z:0},{x:.58,z:0});
 assert.ok(push.x>0&&push.x<=.14);assert.equal(push.z,0);
 assert.equal(pushedWalkState({x:0,z:-.1},0,.1).kind,'walkBackward');
 assert.equal(pushedWalkState({x:0,z:.1},0,.1).kind,'walk');
});
test('wall editor has real floor drawing modes, persisted shapes and per-segment Rapier colliders',()=>{
 const editor=read('js/editor.js'),physics=read('js/scene-physics.js'),html=read('index.html'),server=read('backend/server.py'),archive=read('backend/realm_archives.py');
 for(const id of ['wallPanel','wallDrawMode','wallWidth','wallHeight','wallTexture','wallColor','wallOpacity','wallPhysics','wallSmooth','wallConfirm'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(editor,/startWallDrawing\(kind='wall',closed=false\)/);assert.match(editor,/wallPointer\(event\)/);assert.match(editor,/wall:o\.userData\.editorKind==='wall'/);
 assert.match(physics,/\(kind==='wall'\|\|kind==='stairs'\)\&\&object\.children\.length/);
 assert.match(physics,/tryPushRobot\(/);assert.match(server,/valid_office_wall/);assert.match(archive,/['"]wall['"]/);
 assert.match(editor,/\['wall','stairs'\]\.includes\(o\.userData\.editorKind\)\)return o\.children/);
});
