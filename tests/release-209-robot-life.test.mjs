import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lifeCanStart,lifeCandidates,lifeResult,LIFE_TICK_MS} from '../js/robot-life-core.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const robot=(id='lemox',x=0,z=0)=>({name:id,position:{x,y:0,z},rotation:{y:0},visible:true,userData:{editorId:id,editorKind:'robot',robotBrain:{initiativeMove:true}}});

test('independent life opt-in and explicit controls never conflict',()=>{
 const bot=robot();assert.equal(lifeCanStart(bot),true);
 assert.equal(lifeCanStart(bot,{controlled:true}),false);
 assert.equal(lifeCanStart(bot,{workOrder:true}),false);
 for(const flag of ['robotGoal','robotMission','robotLocalMotion','robotRemoteMotion','robotCarry','robotSeated','robotJumpActive']){
   bot.userData[flag]={kind:'manual'};assert.equal(lifeCanStart(bot),false,flag);delete bot.userData[flag];
 }
 bot.userData.robotLifePauseUntil=Date.now()+60000;assert.equal(lifeCanStart(bot),false);delete bot.userData.robotLifePauseUntil;
 bot.userData.robotBrain.initiativeMove=false;assert.equal(lifeCanStart(bot),false);
 assert.equal(LIFE_TICK_MS,6000);
});

test('life policy chooses real reachable-candidate coordinates and avoids recent destinations',()=>{
 const bot=robot(),peer=robot('peer',12,0),chair={name:'Chair',position:{x:0,z:13},userData:{editorId:'chair',editorKind:'furniture'}},wall={name:'Wall',position:{x:10,z:0},userData:{editorId:'wall',editorKind:'wall'}};
 const choices=lifeCandidates(bot,[bot,peer,chair,wall],[],0);
 assert.ok(choices.some(c=>c.targetId==='peer'));
 assert.ok(choices.some(c=>c.targetId==='chair'));
 assert.ok(!choices.some(c=>c.targetId==='wall'));
 const visit=choices.find(c=>c.targetId==='peer');assert.ok(Math.hypot(visit.point.x-peer.position.x,visit.point.z-peer.position.z)>=2);
 const next=lifeCandidates(bot,[bot,peer,chair],[{targetId:'peer'}],1);
 assert.ok(!next.some(c=>c.targetId==='peer'));
 assert.ok(next.some(c=>c.kind==='explore'&&Math.hypot(c.point.x,c.point.z)>=10));
});

test('real displacement, not a proposed route, determines movement evidence',()=>{
 assert.deepEqual(lifeResult('arrived',{x:0,z:0},{x:0,z:0}),{status:'arrived',metres:0,moved:false});
 assert.equal(lifeResult('blocked',{x:0,z:0},{x:4,z:0}).metres,4);
 assert.equal(lifeResult('arrived',{x:0,z:0},{x:12,z:0}).moved,true);
});

test('server grants one authorised robot life lease and validates one-time feedback',()=>{
 const backend=read('backend/server.py'),runtime=read('js/robot-life.js'),studio=read('js/studio.js'),brain=read('js/robot-brains.js'),html=read('index.html');
 for(const check of ['def robot_life_lease(', 'def robot_life_record(', 'ROBOT_LIFE_LEASES',"brain.get('initiativeMove') is not True", "work['enabled']", "not t['done']",'hmac.compare_digest',"Life activity (client-reported)"])
  assert.ok(backend.includes(check),check);
 assert.match(runtime,/editor\.routeRobot\(bot,candidate\.point\)/);
 assert.match(runtime,/solvi:robot-task-update/);
 assert.match(runtime,/captureRobotView\(editor\.world,bot/);
 assert.match(runtime,/postDiscussion\(bot,peer/);
 // A denied long-route lease now interrupts only its own life mission.
 assert.match(runtime,/if\(bot\.userData\.robotMission\?\.taskId===mission\.taskId\)interruptRobotMission\(bot\)/);
 assert.doesNotMatch(runtime,/robot\.position\.set\(|robot\.position\.copy\(/);
 assert.match(studio,/initRobotLife\(/);
 assert.match(brain,/initiativeMove:\$\('brainsInitiativeMove'\)\.checked/);
 assert.match(html,/id="brainsInitiativeMove"/);
});
