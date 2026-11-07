import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {houseBlueprint,houseWallSettings,houseGoal,operatorFailure,publicPresetIndex,ROBOT_TOOL_DESCRIPTIONS} from '../js/robot-construction-api.js';
import {cleanAutonomyDecision,cleanAutonomyOrder} from '../js/robot-autonomy-core.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('bounded construction API defines concrete house geometry and independent door/window/roof tools',()=>{
 assert.deepEqual(Object.keys(ROBOT_TOOL_DESCRIPTIONS).sort(),['creative_build','visit','deliver','build','build_house','furnish_room','use_preset','remove','rest','ask','inspect','idle'].sort());
 const p=houseBlueprint({width:9000,depth:0.1,height:1000,roof:'danger',color:'not hex'});
 assert.deepEqual([p.width,p.depth,p.height,p.roof,p.color],[8,3,4,'pyramid','#d0d4c9']);
 const wall=houseWallSettings({width:6,depth:4.5,roof:'shed'});
 assert.equal(wall.closed,true);assert.equal(wall.smooth,false);
 assert.deepEqual(wall.points,[[0,0],[6,0],[6,4.5],[0,4.5]]);
 assert.deepEqual(wall.doors.segments,[0]);assert.equal(wall.windows.enabled,true);
 assert.equal(wall.roof.enabled,true);assert.equal(wall.roof.style,'shed');
});
test('local fallback is limited to explicit construction requests',()=>{
 assert.equal(houseGoal('Jess, build a small house and place furniture'),true);
 assert.equal(houseGoal('Please prepare a home for living'),true);
 for(const example of ['ask the robot about a house','the house is lovely','say hello','please build a chair'])assert.equal(houseGoal(example),false,example);
});
test('account presets are indexed without sending payloads or thumbnails to Meta',()=>{
 const presets=[{id:'1',name:'Cabin',kind:'wall',category:'Architecture',payload:{wall:{points:[[0,0],[9,0]]}},thumbnail:'secret'},
  {id:'2',name:'A chair',kind:'furniture',category:'Furniture',payload:{furniture:{variant:'chair'}},thumbnail:'secret'},
  {id:'3',name:'A model',kind:'model'}];
 const list=publicPresetIndex(presets);
 assert.equal(list.length,2);assert.deepEqual(list.map(x=>x.variant),['room','chair']);
 assert.doesNotMatch(JSON.stringify(list),/secret|points/);
});
test('Meta plans may only use real scene and existing preset IDs',()=>{
 const items=[{id:'bot',kind:'robot'},{id:'desk',kind:'furniture'}],presets=[{id:'real',kind:'wall'}];
 assert.equal(cleanAutonomyDecision({action:'eval'},items,'bot',presets),null);
 assert.equal(cleanAutonomyDecision({action:'use_preset',preset_id:'fake'},items,'bot',presets),null);
 assert.equal(cleanAutonomyDecision({action:'use_preset',preset_id:'real'},items,'bot',presets)?.preset_id,'real');
 assert.equal(cleanAutonomyDecision({action:'build_house',house:{width:9}},items,'bot',presets)?.action,'build_house');
 assert.equal(cleanAutonomyOrder({mode:'house'}).mode,'house');
 assert.equal(cleanAutonomyOrder({goal:'g'.repeat(2200)}).goal.length,1800);
});
test('structured failure diagnosis recommends action rather than claiming completion',()=>{
 assert.equal(operatorFailure(new Error('Meta autonomous planning failed')).code,'model-unavailable');
 assert.equal(operatorFailure(new Error('No clear build location')).code,'location');
 assert.equal(operatorFailure(new Error('Scene creation not allowed')).code,'permission');
});
test('Routines is resizable with large goal field and standalone navigation, runtime log, copy tools',()=>{
 const html=read('index.html'),css=read('styles.css'),js=read('js/robot-autonomy.js');
 for(const key of ['data-routine-tab="scheduled"','data-routine-tab="work"','data-routine-tab="log"','id="autonomyCopyLog"','id="autonomyClearLog"','id="autonomyLog"','id="autonomyPreset"','id="autonomyFailure"','maxlength="1800"'])assert.ok(html.includes(key),key);
 assert.match(css,/#robotRoutinePanel\.robot-routine-panel\{[^}]*resize:both/);
 assert.match(css,/#robotRoutinePanel #autonomyGoal\{[^}]*min-height:190px/);
 assert.match(js,/selectRoutinePage\('work'\)/);
});
test('Brains has directly selectable pages and top-level Copy log; legacy full export kept',()=>{
 const html=read('index.html'),js=read('js/robot-brains.js');
 for(const page of ['vision','identity','scenario','log','memory'])assert.ok(html.includes(`data-brain-tab="${page}"`),page);
 assert.match(html,/id="brainsCopyTop"/);assert.match(html,/id="brainsDownlo\w+"/);
 assert.match(js,/\$\('brainsCopyTop'\)\.onclick/);assert.match(js,/selectPage\('vision'\)/);
});
test('robot house/preset operations reuse authenticated editor persistence and do not delete arbitrary objects',()=>{
 const editor=read('js/editor.js'),runtime=read('js/robot-autonomy.js'),server=read('backend/server.py');
 for(const phrase of ['createRobotHouse(robot','houseWallSettings','createRobotPreset(robot','removeRobotCreatedObject(robot,obj)','this.recordEdit(null,this.snapshot(obj))','this.queueSave(obj)'])assert.ok(editor.includes(phrase),phrase);
 for(const phrase of ['constructHouse(run,bot','usePreset(run,bot','moveTo(run,bot,project.wall)','run.house?.inspectionFailed','if(!run.order.allowChanges)'])assert.ok(runtime.includes(phrase),phrase);
 for(const phrase of ['available_presets','build_house','use_preset','preset_rows','may_edit(','robot-autonomy-plan','robot-autonomy-unavailable'])assert.ok(server.includes(phrase),phrase);
 assert.doesNotMatch(server.slice(server.indexOf("@app.post('/api/robots/autonomy/plan')"),server.indexOf('# Robot-to-robot speech')),/UPDATE room_scenes/);
});
