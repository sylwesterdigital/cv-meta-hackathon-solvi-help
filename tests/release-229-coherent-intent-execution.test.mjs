import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {namedWorkContinuation,namedFurnishingPreference,promisedRoomFurnishing,recentHumanFurnishingAuthority,namedRoomFurnishingInstruction,roomFurnishingSequence} from '../js/robot-room-furnishing.js';
import {workRecoveryPlan} from '../js/robot-autonomy-policy.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const src=f=>readFileSync(resolve(root,f),'utf8');
test('the actual Lea conversation follow-ups are executable, but discussion is not',()=>{
 for(const text of ['@lea execute','@Lea yes please, follow step by step','@Lea follow step by step','@Lea please execute the task','@Lea I was expecting that you will do what you said.'])assert.equal(namedWorkContinuation(text,'Lea'),true,text);
 for(const text of ['@Lea what causes that you only talk?','@Lea not now, execute','@Lea do not execute','@Choka execute','@Lea please discuss that bed','@Lea what is the bed?'])assert.equal(namedWorkContinuation(text,'Lea'),false,text);
});
test('optional yellow bed choice is bounded and independent of the next table',()=>{
 assert.deepEqual(namedFurnishingPreference('@Lea - I wish a yellow one','Lea'),{variant:'bed',colour:'yellow',hex:'#f4d44d'});
 assert.equal(namedFurnishingPreference('@Lea the sky is yellow','Lea'),null);
 assert.equal(namedFurnishingPreference('@Choka I want a yellow bed','Lea'),null);
 assert.equal(namedFurnishingPreference('@Lea I do not want a yellow bed','Lea'),null);
 assert.deepEqual(namedFurnishingPreference('@Lea please make the table blue','Lea'),{variant:'table',colour:'blue',hex:'#498bd9'});
});
test('a concrete robot promise can only become work when a human explicitly authorises it',()=>{
 const now=Date.now();const created=new Date(now-32000).toISOString();
 const conversation=[
  {role:'user',speaker:'Tata',created:new Date(now-68000).toISOString(),text:'@Lea yo uare free to add to this house more furnutures'},
  {role:'assistant',speaker:'Lea',created,text:'@Tata Step 1 is the yellow bed queued. Step 2 will be the little table.'}
 ];
 assert.deepEqual(promisedRoomFurnishing(conversation,'Lea',now),['bed','table']);
 assert.equal(recentHumanFurnishingAuthority(conversation,'Lea',now),true);
 assert.equal(recentHumanFurnishingAuthority(conversation,'Choka',now),false);
 assert.equal(recentHumanFurnishingAuthority(conversation.slice(1),'Lea',now),false);
 assert.equal(namedRoomFurnishingInstruction('@Lea yo uare free to add to this house more furnutures','Lea')!==null,true);
});
test('editor, backend and chat share a saved preference, action and receipt path',()=>{
 const a=src('js/robot-autonomy.js'),e=src('js/editor.js'),b=src('backend/server.py'),chat=src('js/studio.js');
 assert.match(a,/run\.furnishingColors=\{\.\.\.\(options\.colours\|\|\{\}\)\}/);
 assert.match(a,/saveOrder\(run,true\)/);
 assert.match(a,/trace\(bot,'INTENT ACCEPTED'/);
 assert.match(a,/trace\(bot,'ORDER COMMITTED'/);
 assert.match(a,/trace\(bot,'ACTION STARTED'/);
 assert.match(a,/trace\(bot,'ACTION VERIFIED'/);
 assert.match(a,/const acknowledged=await editor\.persistObject/);
 assert.match(a,/if\(!acknowledged\)throw Error/);
 assert.match(e,/createRobotRoomFurniture\(robot,variant,options=\{\}\)/);
 assert.match(e,/fabricColor:color/);
 assert.match(b,/furnishingColors/);
 assert.match(b,/intentMessageId/);
 assert.match(chat,/window\.solviStartChatProjects\?\.\(response\.message\)/);
});

test('a committed furnishing plan advances only when actual object IDs are supplied, and can switch deferred items',()=>{
 const goal='@Lea please add a bed and a table to this room';
 const sequence=roomFurnishingSequence(goal);assert.deepEqual(sequence,['bed','table']);
 assert.equal(workRecoveryPlan({goal,allowChanges:true}).variant,'bed');
 const now=Date.now();
 const deferred=[{variant:'bed',attempts:1,retryAt:now+30000,reason:'blocked'}];
 assert.equal(workRecoveryPlan({goal,allowChanges:true,projectDeferred:deferred}).variant,'table');
 const saved=[{id:'real-scene-bed-id',variant:'bed'}];
 assert.equal(workRecoveryPlan({goal,allowChanges:true,projectPlaced:saved}).variant,'table');
 assert.match(workRecoveryPlan({goal,allowChanges:true,projectPlaced:[...saved,{id:'real-scene-table-id',variant:'table'}]}).reason,/GOAL REACHED/);
 assert.match(workRecoveryPlan({goal,allowChanges:false}).reason,/SCENE CHANGES DISABLED/);
});
