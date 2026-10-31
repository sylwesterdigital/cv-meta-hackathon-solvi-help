import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sanitiseStairs,stairSegments} from '../js/office-stairs-math.js';
import {cleanStairExtras,projectPath,pathAt,liftTargetHeight} from '../js/stair-extensions.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const path=[[0,0],[6,0],[6,4]];
test('Advanced stairs retain railings, material, roof and supports in serializable data',()=>{
 const s=sanitiseStairs({points:path,variant:'advanced',rail:{enabled:true,rods:4,every:3,color:'#aabbcc'},roof:{enabled:true,walls:true,height:2.8},supports:{enabled:true,side:'center',every:5},surface:{texture:'tiles',material:'metal'}});
 assert.equal(s.variant,'advanced');assert.equal(s.rail.rods,4);assert.equal(s.rail.every,3);assert.equal(s.rail.color,'#aabbcc');assert.equal(s.roof.walls,true);
 assert.equal(s.roof.height,2.8);assert.equal(s.supports.side,'center');assert.equal(s.surface.texture,'tiles');assert.equal(s.surface.material,'metal');
 assert.deepEqual(JSON.parse(JSON.stringify(s)).rail,s.rail);
});
test('Stair extension bounds protect geometry and material budgets',()=>{
 const s=cleanStairExtras({variant:'wrong',rail:{rods:999,every:0,width:99,opacity:-5,color:'red'},supports:{every:0},transport:{speed:100},lift:{levels:99}});
 assert.equal(s.variant,'standard');assert.equal(cleanStairExtras({variant:'advanced'}).rail.enabled,true);assert.equal(cleanStairExtras({variant:'escalator',rail:{enabled:false}}).rail.enabled,false);assert.equal(s.rail.rods,5);assert.equal(s.rail.every,1);assert.equal(s.rail.width,.25);
 assert.equal(s.rail.color,'#738b9b');assert.equal(s.rail.opacity,.15);assert.equal(s.supports.every,1);
 assert.equal(s.transport.speed,2.5);assert.equal(s.lift.levels,12);
});
test('Moving walkway creates genuinely flat traversable treads',()=>{
 const segments=stairSegments({points:[[0,0],[4,0]],variant:'walkway',steps:8});
 assert.equal(segments.length,8);assert.ok(segments.every(x=>x.height===.14&&x.top===.14&&x.y===.07));
});
test('Escalator height progression remains bounded and monotonic',()=>{
 const steps=stairSegments({points:[[0,0],[5,0]],variant:'escalator',height:3,steps:10});
 assert.equal(steps.length,10);assert.equal(steps.at(-1).top,3);assert.ok(steps.every((v,i)=>!i||v.top>steps[i-1].top));
});
test('Path projection retains horizontal position and clamps moving transport to endpoints',()=>{
 const p=projectPath(path,6.2,2);assert.ok(p);assert.equal(p.total,10);assert.ok(Math.abs(p.along-8)<.001);
 assert.deepEqual(pathAt(path,8),{x:6,z:2});assert.deepEqual(pathAt(path,10.2),{x:6,z:4});
});
test('Lift has constrained floor levels and stable height',()=>{
 assert.equal(liftTargetHeight({levels:5,levelHeight:3},4),12);
 assert.equal(liftTargetHeight({levels:5,levelHeight:3},50),12);
 assert.equal(liftTargetHeight({levels:5,levelHeight:3},-3),0);
 assert.equal(cleanStairExtras({lift:{currentHeight:9}}).lift.currentHeight,9);
});
test('Add menu and editor expose all transport types and their collapsible fields',()=>{
 const e=read('js/editor.js'),html=read('index.html');
 for(const name of ["stairs advanced","escalator","moving walkway","lift"])assert.ok(e.includes(`'${name}'`),name);
 for(const id of ['stairAdvancedFolds','stairRailEnabled','stairRailRods','stairRoofEnabled','stairRoofWalls','stairSupportEnabled','stairSupportSide','stairSurfaceColor','stairLiftStart','stairLiftStop','stairLiftTarget','stairTransportSpeed','stairTransportDirection'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(e,/tickStairTransport\(this,dt\)/);assert.match(e,/activateLiftButton\(\{parent:o,userData:\{liftButton:true,liftLevel:level\}\}\)/);
});
test('Transport and advanced geometry survive scene serializer and server validation',()=>{
 const e=read('js/editor.js'),server=read('backend/server.py'),archive=read('backend/realm_archives.py'),transport=read('js/stair-transport.js');
 assert.match(e,/stairs:o\.userData\.editorKind==='stairs'\?structuredClone\(o\.userData\.stairs\)/);
 assert.match(e,/rebuildOfficeStairs\(o,entry\.stairs\|\|\{\}\)/);
 assert.match(server,/def valid_office_stairs\(/);assert.match(server,/stair\w*\['variant'\]/);assert.match(server,/currentHeight/);
 assert.match(archive,/['"]stairs['"]/);assert.match(transport,/setNextKinematicTranslation/);
});
