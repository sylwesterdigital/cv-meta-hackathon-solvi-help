import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {workRecoveryPlan,projectOutcome} from '../js/robot-autonomy-policy.js';
const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const goal='Find @Elox and build with him a hospital in an empty area';
test('find named colleague comes before building, then build progresses',()=>{
 const contact=workRecoveryPlan({goal,allowChanges:true,contactTargets:[{id:'elox',name:'Elox'}]});
 assert.equal(contact.action,'ask');assert.equal(contact.target_id,'elox');
 assert.equal(workRecoveryPlan({goal,allowChanges:true,contactTargets:[]}).action,'build_house');
 const pending=projectOutcome({house:{missing:[]},goal,contactsRequired:['elox'],contacts:[]});
 assert.match(pending.blockers.join(' '),/colleagues not contacted/);
});
test('hospital recovery retains missing furniture as an explicit objective',()=>{
 assert.equal(workRecoveryPlan({goal:'Build hospital',allowChanges:true,house:{missing:['bed']}}).action,'build_house');
});
test('browser persists verified contacts and continues furnishing existing houses',()=>{
 const js=source('js/robot-autonomy.js'),server=source('backend/server.py');
 assert.match(js,/contacted:run\.contacted/);assert.match(js,/contacts:run\.contacted/);
 assert.match(js,/run\.contacted\.push\(obj\.userData\.editorId\)/);
 assert.match(js,/Continue into the same cycle: inspect and furnish/);
 assert.match(server,/'contacted','placedSupplies'/);
});
test('chat parser distinguishes ordered operators and mentioned destinations',()=>{
 const py=source('backend/server.py');
 assert.match(py,/At the start of an imperative, a consecutive block of handles/);
 assert.match(py,/message_after_arrival/);
 assert.match(py,/Telling him to build requires a separately authorised work order|automatically authorise their construction/);
});

test('multi-handle social request stays text chat without an implicit camera scan',()=>{
 const py=source('backend/server.py'),backendTests=source('backend/test_api.py');
 assert.match(py,/explicit_robot_handles<=1/);
 assert.match(py,/The later handle may be/);
 assert.match(backendTests,/robot_recipient_queue\(source\['text'\],\[robot,elox\]\)\]==\['Jessica'\]/);
 assert.match(backendTests,/initial\.get_json\(\)\.get\('needs_vision'\) is not True/);
});
