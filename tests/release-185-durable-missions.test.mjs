import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {houseGoal,houseBlueprint} from '../js/robot-construction-api.js';
import {workRecoveryPlan,projectOutcome} from '../js/robot-autonomy-policy.js';
import {cleanAutonomyOrder,cleanAutonomyDecision} from '../js/robot-autonomy-core.js';
const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const hospital='Build a small size hospital for sick robots. Fill it with beds, invite @Jess and @Elox and bring bottles and cans';
test('hospital construction is recognised without requiring the word house',()=>{
 assert.equal(houseGoal(hospital),true);
 assert.equal(houseGoal('discuss a hospital story'),false);
 assert.equal(houseGoal('visit a hospital'),false);
 assert.equal(workRecoveryPlan({goal:hospital,allowChanges:true}).action,'build_house');
 assert.equal(workRecoveryPlan({goal:hospital,allowChanges:true,existingHouse:true}).action,'build_house');
 assert.deepEqual(houseBlueprint({width:99}).width,8);
});
test('recovery prioritises beds and supplies and real invitations over optional Wikipedia',()=>{
 const house={missing:['bed','bed'],inspectionFailed:''};
 assert.equal(workRecoveryPlan({goal:hospital,allowChanges:true,house}).action,'build_house');
 const ready={missing:[],inspectionFailed:''};
 const props=workRecoveryPlan({goal:hospital,allowChanges:true,house:ready});
 assert.equal(props.action,'build');assert.equal(props.variant,'bottle');
 const invite=workRecoveryPlan({goal:hospital,allowChanges:true,house:ready,placedSupplies:4,invitationTargets:[{id:'jess'}]});
 assert.equal(invite.action,'ask');assert.equal(invite.target_id,'jess');
 const out=projectOutcome({house:ready,goal:hospital,suppliesRequired:4,placedSupplies:2,invitationsRequired:['jess'],invitations:[]});
 assert.equal(out.done,false);assert.match(out.blockers.join(';'),/party supplies/);
 assert.match(out.blockers.join(';'),/invitations/);
 assert.match(out.blockers.join(';'),/hospital services/);
});
test('bottle and can are validated procedural props',()=>{
 assert.equal(cleanAutonomyOrder({mode:'build',variant:'bottle'}).variant,'bottle');
 assert.equal(cleanAutonomyOrder({mode:'build',variant:'can'}).variant,'can');
 const objs=[{id:'bot',kind:'robot'}];
 assert.equal(cleanAutonomyDecision({action:'build',variant:'bottle'},objs,'bot').variant,'bottle');
});
test('SQLite mission store is permission bound; browser resumes only after scene has loaded',()=>{
 const s=source('backend/server.py'),c=source('js/robot-autonomy.js'),studio=source('js/studio.js');
 for(const needle of ['CREATE TABLE IF NOT EXISTS robot_work_orders','/api/robots/autonomy/orders','/api/robots/autonomy/order',
 'def valid_robot_work_order','robot_work_order_robot(user,room_id,rid)','old[\'user_id\']!=user[\'id\']','enabled=data.get(\'enabled\') is True'])assert.ok(s.includes(needle),needle);
 for(const needle of ['function stateOf(run)','function restoreHouse(state)','async function saveOrder(run','async function loadSaved()','window.addEventListener(\'solvi:autonomy-ready\'',
 'saveOrder(run,run.loop)','stopAll(false)','stopAll(true)'])assert.ok(c.includes(needle),needle);
 assert.match(studio,/editor\.load\(\)\.then\(\(\)=>window\.dispatchEvent\(new CustomEvent\('solvi:autonomy-ready'\)\)\)/);
 assert.match(studio,/stage: \$\{data\.failure_stage\}/);
});
test('planner reports actionable sanitized failure stages and 6 -> 1 -> 0 bounded vision fallback',()=>{
 const s=source('backend/server.py');
 for(const needle of ["stage='meta-six-images'","stage='meta-one-image'","stage='meta-text-retry'","stage='usage-record'","stage='parse-decision'","failure_stage=stage","views=used_images"])
  assert.ok(s.includes(needle),needle);
 assert.ok(s.includes('image_parts[0]'));
 assert.ok(!s.includes('detail=str(exc)[:5000]'));
});
