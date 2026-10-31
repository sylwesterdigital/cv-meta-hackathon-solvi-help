import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sanitiseStairs,stairSegments} from '../js/office-stairs-math.js';
import {sanitiseWall,wallSegments} from '../js/office-wall-math.js';
const code=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('closed room stays a genuine polygon perimeter, not a filled AABB',()=>{
 const wall=sanitiseWall({closed:true,points:[[0,0],[4,0],[4,3],[0,3]],width:.2,height:2.5});
 assert.equal(wall.closed,true);
 const segs=wallSegments(wall);
 assert.equal(segs.length,4);
 assert.equal(segs.reduce((sum,segment)=>sum+segment.length,0),14);
 assert.deepEqual(sanitiseWall(wall),wall);
 assert.equal(wallSegments({...wall,closed:false}).length,3);
});
test('stairs have exact even rise in count mode and can follow a polyline',()=>{
 const options={points:[[0,0],[2.8,0],[2.8,2.8]],width:1.1,height:2.8,steps:16,stepMode:'count'};
 const treads=stairSegments(options);
 assert.equal(treads.length,16);
 assert.ok(Math.abs(treads.at(-1).top-2.8)<1e-8);
 assert.ok(treads.some(t=>Math.abs(t.yaw)>1),'later treads must follow the turn');
 assert.ok(treads.every((s,i)=>s.number===i+1&&Math.abs(s.depth-.35)<1e-9));
 assert.ok(treads.every((s,i)=>i===0||s.top>treads[i-1].top));
});
test('fixed 350 mm treads and 170 mm risers keep identical dimensions',()=>{
 const treads=stairSegments({points:[[0,0],[5.6,0]],stepMode:'fixed',treadMm:350,riserMm:170,floating:true});
 assert.equal(treads.length,16);
 assert.ok(treads.every(s=>Math.abs(s.depth-.35)<1e-8&&Math.abs(s.height-.17)<1e-8));
 assert.ok(Math.abs(treads.at(-1).top-2.72)<1e-8);
 assert.ok(treads.every((s,i)=>i===0||s.y>treads[i-1].y));
 const solid=stairSegments({points:[[0,0],[5.6,0]],stepMode:'fixed',treadMm:350,riserMm:170,floating:false});
 assert.ok(solid.at(-1).height>solid[0].height,'solid should reach down to the floor');
 const short=stairSegments({points:[[0,0],[2,0]],stepMode:'fixed',treadMm:35,riserMm:100,floating:true});
 assert.ok(short.length<=80,'limit the geometry to a safe number of colliders');
});
test('untrusted stair parameters are bounded and output serialises cleanly',()=>{
 const settings=sanitiseStairs({points:[[0,0],[1000,0],[3,0],[3,2]],steps:800,treadMm:0,riserMm:999,width:999,opacity:-1,floating:true});
 assert.equal(settings.steps,80);assert.equal(settings.treadMm,35);assert.equal(settings.riserMm,280);assert.equal(settings.width,4);assert.equal(settings.opacity,.08);
 assert.ok(settings.points.length>=2);
 assert.deepEqual(sanitiseStairs(settings),settings);
});
test('editor exposes room closure, keyboard history, live colour input and visual reference helpers',()=>{
 const js=code('js/editor.js'),html=code('index.html'),css=code('styles.css');
 assert.match(js,/startWallDrawing\('wall',true\)/);assert.match(js,/this\.undoWall\(\)/);assert.match(js,/this\.redoWall\(\)/);
 assert.match(js,/e\.shiftKey\?this\.redoWall\(\):this\.undoWall\(\)/);
 assert.match(js,/field\('wallColor'\)\.addEventListener\('input',rerender\)/);
 assert.match(js,/person\.position\.set/);assert.match(js,/wallCeilingHeight/);
 assert.match(js,/wallPreviewMode.*solid/);assert.match(js,/new THREE\.EdgesGeometry/);
 for(const id of ['wallRedo','wallCloseLoop','wallCeilingHeight','wallPreviewMode','wallStairOptions','stairStepMode','stairCount','stairTread','stairRiser','stairFloating'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(css,/#wallPanel\.wall-panel\{max-height:calc\(100dvh - 20px\)/);
});
test('stairs and walls are persisted, patched, validated and use separate physics colliders',()=>{
 const js=code('js/editor.js'),api=code('backend/server.py'),physics=code('js/scene-physics.js'),archive=code('backend/realm_archives.py');
 assert.match(js,/stairs:o\.userData\.editorKind==='stairs'/);
 assert.match(js,/if\(entry\.kind==='stairs'\)rebuildOfficeStairs/);
 assert.match(js,/kind==='stairs'\)\{if\(stairGeometryKey\(obj\.userData\.stairs\)/);
 assert.match(api,/def valid_office_stairs\(stairs\)/);assert.match(api,/if obj\['kind'\]=='stairs' and not valid_office_stairs/);
 assert.match(physics,/kind==='portal'\)\&\&object\.children\.length/);
 assert.match(physics,/segment\.userData\.stairTread/);
 assert.match(archive,/['"]stairs['"]/);
});
