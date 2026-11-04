import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cleanAutonomyOrder,cleanAutonomyDecision,AUTONOMY_MIN_INTERVAL,autonomyProximity} from '../js/robot-autonomy-core.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const objects=[{id:'robot-1',kind:'robot'},{id:'robot-2',kind:'robot'},{id:'parcel',kind:'cube'},{id:'desk',kind:'furniture'},{id:'lamp',kind:'light'}];
test('work order rejects unbounded cadences and privileges by default',()=>{
 const d=cleanAutonomyOrder({mode:'inject',interval:5,allowChanges:'true',vision:'true',goal:'x'.repeat(950)});
 assert.equal(d.mode,'agent');assert.equal(d.interval,AUTONOMY_MIN_INTERVAL);
 assert.equal(d.allowChanges,false);assert.equal(d.vision,false);assert.equal(d.goal.length,950);
 assert.equal(cleanAutonomyOrder({interval:99_999}).interval,3600);
});
test('only supported scene-grounded Meta actions are executable',()=>{
 assert.equal(cleanAutonomyDecision({action:'eval',message:'do anything'},objects,'robot-1'),null);
 assert.equal(cleanAutonomyDecision({action:'deliver',target_id:'invented',destination_id:'desk'},objects,'robot-1'),null);
 assert.equal(cleanAutonomyDecision({action:'deliver',target_id:'parcel',destination_id:'parcel'},objects,'robot-1'),null);
 assert.equal(cleanAutonomyDecision({action:'ask',target_id:'desk'},objects,'robot-1'),null);
 assert.equal(cleanAutonomyDecision({action:'remove',target_id:'robot-2'},objects,'robot-1'),null);
 assert.equal(cleanAutonomyDecision({action:'visit',target_id:'robot-1'},objects,'robot-1'),null);
 assert.equal(cleanAutonomyDecision({action:'deliver',target_id:'parcel',destination_id:'desk'},objects,'robot-1').action,'deliver');
 assert.equal(cleanAutonomyDecision({action:'ask',target_id:'robot-2',message:'a'.repeat(500)},objects,'robot-1').message.length,240);
 assert.equal(cleanAutonomyDecision({action:'build',variant:'hacker'},objects,'robot-1').variant,'chair');
});
test('spatial pickup checks actual positions, not model statements',()=>{
 assert.equal(autonomyProximity({position:{x:0,z:0}},{position:{x:1,z:1}},2),true);
 assert.equal(autonomyProximity({position:{x:0,z:0}},{position:{x:5,z:5}},2),false);
});
test('autonomous work orders use existing routes, carry, seating and persistence',()=>{
 const runtime=read('js/robot-autonomy.js'),editor=read('js/editor.js');
 for(const segment of ['editor.receiveRobotCommand','solvi:robot-task-update','editor.carry.pickup','editor.carry.drop','takeSeat(','standUp(','captureRobotView','runRobotVisualSearch','/api/robots/autonomy/plan','confirmAction','solvi:room-changed','pagehide'])assert.ok(runtime.includes(segment),segment);
 for(const segment of ['createRobotFurniture(robot,variant','removeRobotFurniture(robot,obj)','positionNewOnGround','recordEdit(null,this.snapshot(obj))','this.queueSave(obj)','this.persistRemoval(obj.userData.editorId)'])assert.ok(editor.includes(segment),segment);
 assert.match(runtime,/if\(!run\.order\.allowChanges\)/);
 assert.match(editor,/autonomyCreatedBy/);
 assert.match(runtime,/robotMission\?\.taskId\?\.startsWith\(run\.token\)/);
});
test('backend Meta planner is authenticated, rate-limited and returns inert validated IDs',()=>{
 const server=read('backend/server.py');
 const section=server.slice(server.indexOf("@app.post('/api/robots/autonomy/plan')"),server.indexOf("@app.get('/api/robots/memory')"));
 for(const s of ['actor()','selected_room(','may_edit(','ROBOT_AUTONOMY_LAST','ROBOT_AUTONOMY_DAILY','len(images) not in (0,6)','images=','store\':False','parse_autonomy_decision','robot-autonomy-plan'])assert.ok(section.includes(s),s);
 assert.equal(section.includes('con.execute(\'UPDATE room_scenes'),false);
 assert.equal(section.includes('eval('),false);
});
test('UI uses explicit opt-in, stop controls, no autonomous startup',()=>{
 const html=read('index.html'),studio=read('js/studio.js');
 for(const id of ['autonomyRobot','autonomyMode','autonomyVision','autonomyAllowChanges','autonomyStart','autonomyStop','autonomyStopAll','autonomyStatus'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(studio,/initRobotAutonomy\(\{editor,api,room:/);
 assert.match(studio,/\/api\/robots\/autonomy\/plan/);
 assert.doesNotMatch(studio,/setTimeout\(.*initRobotAutonomy/);
});
