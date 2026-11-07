import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {chatNamedConstructionInstruction,namedRoofChoice,requestedHomeCount,workRecoveryPlan} from '../js/robot-autonomy-policy.js';
const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('one named human command supersedes stale Ania housing assignment, but ordinary chat never mutates',()=>{
 const direct='@Ania can you build one more interesting house but make it cosy interior?';
 assert.equal(chatNamedConstructionInstruction(direct,'Ania'),direct);
 assert.equal(chatNamedConstructionInstruction(direct,'Choka'),null);
 assert.ok(chatNamedConstructionInstruction('@Ania please build a new house','Ania'));
 assert.equal(chatNamedConstructionInstruction('@Ania I could build a house here','Ania'),null);
 assert.equal(chatNamedConstructionInstruction('@Ania I already built a house','Ania'),null);
 assert.equal(chatNamedConstructionInstruction('@Ania go for it','Ania'),null);
 assert.equal(chatNamedConstructionInstruction('@Ania how is your house?','Ania'),null);
 assert.equal(chatNamedConstructionInstruction('@all build one more house','Ania'),null);
 const runtime=source('js/robot-autonomy.js');
 assert.ok(runtime.includes('chatNamedConstructionInstruction(message.text,o.name)'));
 assert.ok(runtime.includes("stop(id,'superseded by a fresh direct human construction request',false)"));
 assert.ok(runtime.includes('await saveOrder(run,true)'));
 assert.ok(runtime.includes("trace(namedBuilder,'DIRECT BUILD ASSIGNED'"));
});

test('a multi-house array is bounded and a blocked site triggers two checked scouts, not unlimited guessing',()=>{
 const goal='Build an array of cool houses fro AI Engineers';
 assert.equal(requestedHomeCount(goal),3);
 assert.equal(requestedHomeCount('Please build more houses'),2);
 assert.equal(requestedHomeCount('Build one cosy house'),1);
 const base={goal,allowChanges:true,completedHouses:['house1','house2']};
 assert.equal(workRecoveryPlan({...base,attempts:{build_house:8}}).action,'site_scout');
 assert.equal(workRecoveryPlan({...base,attempts:{build_house:8,site_scout:1}}).action,'build_house');
 assert.equal(workRecoveryPlan({...base,attempts:{build_house:12,site_scout:1}}).action,'site_scout');
 assert.equal(workRecoveryPlan({...base,attempts:{build_house:16,site_scout:2}}).action,'idle');
 assert.match(workRecoveryPlan({...base,attempts:{build_house:16,site_scout:2}}).reason,/SITE SEARCH EXHAUSTED/);
 assert.match(workRecoveryPlan({goal,allowChanges:false}).reason,/SCENE CHANGES DISABLED/);
 assert.match(workRecoveryPlan({...base,completedHouses:['a','b','c']}).reason,/GOAL REACHED/);
 const runtime=source('js/robot-autonomy.js');
 assert.ok(runtime.includes("kind:'recover_route',distance:15"));
 assert.ok(runtime.includes('window.addEventListener(\'solvi:robot-task-update\',handler)'));
 assert.ok(runtime.includes('run.recoveryAttempts.build_house=0'));
 assert.ok(runtime.includes("source='Meta unavailable'"));
});

test('optional roof question has a verified persisted robot author and applies only to unbuilt houses',()=>{
 assert.equal(namedRoofChoice('@Ania shed roof','Ania'),'shed');
 assert.equal(namedRoofChoice('@Ania a flat roof please','Ania'),'flat');
 assert.equal(namedRoofChoice('@Ania pyramid roof','Ania'),'pyramid');
 assert.equal(namedRoofChoice('@Choka flat roof','Ania'),null);
 assert.equal(namedRoofChoice('@Ania flat roof or pyramid roof','Ania'),null);
 const runtime=source('js/robot-autonomy.js'),server=source('backend/server.py');
 assert.ok(runtime.includes("'/api/robots/autonomy/ask-human'"));
 assert.ok(runtime.includes('askedPreferences:run.askedPreferences'));
 assert.ok(runtime.includes('roofPreference:run.roofPreference'));
 assert.ok(runtime.includes('run.roofPreference=namedRoofChoice(message.text,answered.name)'));
 assert.ok(runtime.includes('...(run.roofPreference?{roof:run.roofPreference}:{})'));
 for(const token of ['def robot_autonomy_ask_human():','robot_work_order_robot(user,room_id,rid)',"'robot-autonomy',text",'ROBOT_STYLE_QUESTION_LAST','No active saved construction work order'])assert.ok(server.includes(token),token);
});

test('missing Meta key must not hijack a valid standalone scene camera/search command',()=>{
 const server=source('backend/server.py');
 assert.match(server,/if not model_ready and ack is None:/);
 assert.ok(server.indexOf('if not model_ready and ack is None:')<server.indexOf('if ack is not None:'));
 assert.match(server,/if command and not may_edit/);
 assert.ok(server.includes('plan=parse_autonomy_decision(meta_output_text(answer)'));
 assert.ok(server.includes("audit_event('robot-autonomy-plan-parser-rejected'"));
 let result=spawnSync('python3',['backend/test_robot_model_notice_223.py'],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:30000});
 // macOS can intermittently fail to launch a subprocess or overrun a short
 // startup budget. Real nonzero exits/assertions are NEVER retried or masked.
 if(result.status===null&&['EAGAIN','ENOMEM','ETIMEDOUT'].includes(result.error?.code))
  result=spawnSync('python3',['backend/test_robot_model_notice_223.py'],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:30000});
 assert.equal(result.status,0,`signal=${result.signal||'none'} error=${result.error?.code||'none'}\n${result.stderr||result.stdout||''}`);
});
