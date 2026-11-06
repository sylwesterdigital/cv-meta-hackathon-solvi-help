import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findRobotWorksite,footprintClear} from '../js/robot-worksite.js';
import {visibleWorkFields,workModeHelp} from '../js/robot-workorder-ui.js';
const src=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const rect=(x,z,w=1,d=1)=>({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});
test('worksite planner finds unobstructed accessible land instead of demanding that human move robot',()=>{
 const bot={x:0,z:0},blocks=[rect(5,0,5,4),rect(-5,0,4,4),rect(0,5,4,4)];
 const plan=findRobotWorksite(bot,blocks,{width:2,depth:1},{yaw:0});
 assert.ok(plan,'expected a reachable alternative');
 assert.ok(footprintClear(plan.site,{width:2,depth:1},blocks,.7));
 assert.ok(plan.route.length>0&&plan.meters>0&&plan.meters<90);
 assert.ok(Math.hypot(plan.route.at(-1).x-plan.staging.x,plan.route.at(-1).z-plan.staging.z)<.18);
});
test('entire building footprint must be clear, not only its centre point',()=>{
 assert.equal(footprintClear({x:0,z:0},{width:8,depth:8},[rect(4.3,0,.5,.5)],.65),false);
 assert.equal(footprintClear({x:0,z:0},{width:8,depth:8},[rect(20,20,2,2)],.65),true);
 assert.equal(findRobotWorksite({x:0,z:0},[rect(0,0,500,500)],{width:8,depth:8}),null);
});
test('site planner rejects invalid input',()=>{
 assert.equal(findRobotWorksite({x:NaN,z:0},[],{width:2,depth:2}),null);
 assert.equal(footprintClear({x:0,z:0},{width:NaN,depth:2},[]),false);
});
test('only relevant operator selectors appear for each work mode',()=>{
 assert.deepEqual([...visibleWorkFields('build')].sort(),['allow','variant']);
 assert.deepEqual([...visibleWorkFields('deliver')].sort(),['destination','source']);
 assert.deepEqual([...visibleWorkFields('house')].sort(),['allow','goal']);
 assert.deepEqual([...visibleWorkFields('agent')].sort(),['allow','goal','interval','vision']);
 assert.deepEqual([...visibleWorkFields('preset')].sort(),['allow','preset']);
 assert.match(workModeHelp('build'),/walks there/i);
 const html=src('index.html'),app=src('js/robot-autonomy.js');
 for(const field of ['source','destination','preset','variant','goal','interval','vision','allow'])assert.ok(html.includes('data-autonomy-field="'+field+'"'),field);
 assert.match(app,/workMode.addEventListener\('change',updateWorkFields\)/);
 assert.match(app,/\$\('autonomyStart'\)\.hidden=!\['agent','local_project'\]\.includes\(mode\)/);
});
test('robot moves by real A* task and only builds after measured arrival',()=>{
 const app=src('js/robot-autonomy.js'),ed=src('js/editor.js');
 assert.ok(ed.includes('planRobotBuildSite(robot,kind='));
 assert.ok(ed.includes('routeRobotToWorksite(robot,point,taskId,'));
 assert.ok(ed.includes('footprintClear(input.at'));
 assert.match(app,/await walkToWorksite\(run,bot,plan,variant\+' worksite'\)/);
 assert.match(app,/await walkToWorksite\(run,bot,plan,'house construction site'\)/);
 assert.match(app,/Math\.hypot\(bot\.position\.x-position\.x,bot\.position\.z-position\.z\)>\.55/);
 assert.match(app,/editor\.routeRobotToWorksite\?\.\(bot,position,taskId,label\)/);
 const i=app.indexOf('const at=inside?'),j=app.indexOf('const item=editor.createRobotFurniture?.(bot,variant,{at});');
 assert.ok(i>=0&&j>i,'build must wait for site arrival before scene mutation');
 assert.match(app,/robotAction\(bot,'pickUp'\);await wait\(1150\)/);
});
