import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {metaRetryDelay,workRecoveryPlan,projectOutcome} from '../js/robot-autonomy-policy.js';
const src=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('Meta error backoff is bounded and avoids charging repeatedly every loop',()=>{
 assert.equal(metaRetryDelay(1),30000);
 assert.equal(metaRetryDelay(2),60000);
 assert.equal(metaRetryDelay(3),120000);
 assert.equal(metaRetryDelay(9),120000);
});
test('house recovery prioritises actual work, bounded site checks, and never substitutes idle peer chatter for construction',()=>{
 const goal='Jess, construct a small house';
 assert.equal(workRecoveryPlan({goal,allowChanges:true}).action,'build_house');
 assert.equal(workRecoveryPlan({goal,allowChanges:true,attempts:{build_house:1},house:{missing:['bed'],inspectionFailed:''}}).action,'build_house');
 assert.equal(workRecoveryPlan({goal,allowChanges:true,attempts:{build_house:8},house:{missing:['bed'],inspectionFailed:'blocked'}}).action,'site_check');
 assert.equal(workRecoveryPlan({goal,allowChanges:true,attempts:{build_house:8,site_check:3},house:{missing:[],inspectionFailed:'blocked'},peerId:'bot2'}).action,'idle');
 assert.equal(workRecoveryPlan({goal,allowChanges:true,attempts:{build_house:8,site_check:3,research:1,ask:1},house:{missing:[],inspectionFailed:'blocked'},peerId:'bot2',hasSeat:true}).action,'idle');
 assert.equal(workRecoveryPlan({goal,allowChanges:true,existingHouse:true}).action,'build_house');
});
test('hospital project never claims medication, patient care or blocked site inspection completed',()=>{
 assert.equal(projectOutcome({house:{missing:[],inspectionFailed:''},goal:'Build a little house'}).done,true);
 const result=projectOutcome({house:{missing:[],inspectionFailed:'Route timed out'},goal:'Build a hospital and give medicine'});
 assert.equal(result.done,false);
 assert.match(result.blockers.join(' '),/medicin/);
 assert.match(result.blockers.join(' '),/Route timed out/);
});
test('runtime reports receipts, uses cooldown, retries alternative actions, avoids duplicate houses and supports relevant research',()=>{
 const runtime=src('js/robot-autonomy.js');
 for(const term of ['/api/robots/autonomy/report','/api/robots/autonomy/research','metaRetryDelay','workRecoveryPlan','projectOutcome','existingRobotHouse','META BACKOFF','AWAITING NEW CAPABILITY','site_check','researchNotes'])assert.ok(runtime.includes(term),term);
 assert.match(runtime,/house.*hospital|hospital.*house/i);
 assert.match(runtime,/no duplicate shell created/);
 assert.match(runtime,/run\.last\.status='blocked'/);
});
test('real work review is separate from formal sourced research; API limits client reports',()=>{
 const server=src('backend/server.py'),studio=src('js/studio.js');
 for(const term of ['def work_review_requested(','mode=\'work-review\'','robot_work_events','/api/robots/autonomy/report','/api/robots/autonomy/research','ROBOT_RESEARCH_LAST','if review:','client-reported'])assert.ok(server.includes(term),term);
 assert.match(studio,/opened\.mode==='work-review'/);
 assert.match(server,/if step\['phase'\]=='synthesis' and not review/);
});
