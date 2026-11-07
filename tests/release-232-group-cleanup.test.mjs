import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {groupBoxCleanupInstruction,groupBinClarification,selectCleanupTarget,nearestAvailableCleanupWorker,sceneBinTargets,boxCleanupProjectGoal} from '../js/robot-group-cleanup.js';
const obj=(id,name,kind='furniture',variant='box',x=0,z=0)=>({name,position:{x,z},userData:{editorId:id,editorKind:kind,furniture:{variant}}});
const bot=(id,name,x,z,mission=false)=>({...obj(id,name,'robot','',x,z),userData:{editorId:id,editorKind:'robot',robotMission:mission?{taskId:'busy'}:null}});
test('exact @all request from loft log is an actual group cleanup goal',()=>{
 const prompt='@all guys I see plenty of boxes (Box copy...) - they need to be moved to the Bbig bin I mentioned earlier';
 assert.equal(groupBoxCleanupInstruction(prompt),prompt);
 assert.equal(groupBoxCleanupInstruction('@all hello how are you?'),null);
 assert.equal(groupBoxCleanupInstruction('@all do not move these boxes to the bin'),null);
 assert.equal(groupBoxCleanupInstruction('@Lea move boxes into bin'),null);
 assert.equal(groupBinClarification('@all the target is called "Bin - Big Junk"'),'@all the target is called "Bin - Big Junk"');
});
test('historic human destination names a real scene ID, not unrelated Small Bin',()=>{
 const objects=[obj('small','Small Bin','furniture','bin',0,0),obj('junk','Bin - Big Junk','model','',20,0)];
 const chat=[{role:'user',text:'@all the target is called "Bin - Big Junk"'}, {role:'assistant',text:'@Jess use Small Bin'}];
 assert.equal(selectCleanupTarget(objects,'@all boxes need to be moved to big bin',chat).target?.userData.editorId,'junk');
 assert.equal(boxCleanupProjectGoal('Bin - Big Junk'),'@all move Box copies into Bin - Big Junk');
 assert.equal(sceneBinTargets(objects).length,2);
 const absent=selectCleanupTarget([objects[0]],'@all move boxes to big bin',chat);
 assert.equal(absent.target,null);assert.equal(absent.targetName,'Bin - Big Junk');
 const hallucination=selectCleanupTarget([objects[0]],'@all move boxes to bin',[{role:'assistant',text:'"Bin - Big Junk"'}]);
 assert.equal(hallucination.target,null);assert.equal(hallucination.targetName,'');
});
test('choose only one free authorised robot, nearest eligible Box copy',()=>{
 const bots=[bot('lea','Lea',0,0),bot('lola','Lola',4,2),bot('bart','Bart',5,4),bot('nia','Nia',5.1,4.1,true),bot('ctrl','Human-controlled',4.1,3)];
 const boxes=[obj('b1','Box copy1','furniture','box',5,5),obj('b2','Box copy2','furniture','box',6,4)];
 const winner=nearestAvailableCleanupWorker(bots,boxes,{busyIds:['lea'],controlledId:'ctrl',canEdit:b=>b.userData.editorId!=='bart'});
 assert.equal(winner?.name,'Lola');
 assert.equal(nearestAvailableCleanupWorker(bots,boxes,{busyIds:['lea','lola','bart'],controlledId:'ctrl',canEdit:()=>true}),null);
 assert.equal(nearestAvailableCleanupWorker(bots,[],{canEdit:()=>true}),null);
});
test('group cleanup is queued durably and only claimed atomically before robot cycles',()=>{
 const source=readFileSync(new URL('../js/robot-autonomy.js',import.meta.url),'utf8');
 const taskQueue=readFileSync(new URL('../js/robot-task-queue.js',import.meta.url),'utf8');
 const studio=readFileSync(new URL('../js/studio.js',import.meta.url),'utf8');
 const backend=readFileSync(new URL('../backend/server.py',import.meta.url),'utf8');
 assert.match(source,/const groupCleanup=groupBoxCleanupInstruction\(message\.text\)/);
 assert.match(source,/await dispatchPendingGroupTasks\(true\)/);
 assert.match(source,/const worker=chooseQueuedWorker\(editor\.items/);
 assert.match(source,/\/api\/robots\/autonomy\/group\/claim/);
 const claim=source.indexOf("await api.req('/api/robots/autonomy/group/claim'");
 assert.ok(claim>0&&source.indexOf('runs.set(id,run);',claim)>claim);
 assert.match(taskQueue,/nearestAvailableCleanupWorker\(choices,boxes/);
 assert.match(source,/editor\.inventory\.storeInBin\(bot,box,bin\)/);
 assert.match(source,/editor\.inventory\.drop\(bot,box\)/);
 assert.match(source,/await editor\.persistObject\(box,run\.room\)/);
 assert.match(studio,/else if\(!\(work>0\)\)await reactToRobotMessage/);
 assert.match(backend,/def robot_group_queue_add\(/);
 assert.match(backend,/con\.execute\('BEGIN IMMEDIATE'\)/);
 assert.match(backend,/def robot_group_queue_claim\(/);
 assert.match(backend,/def robot_group_queue_result\(/);
});

test('actual @all router queues already-authenticated message even with no free robot',async()=>{
 const runtime=readFileSync(new URL('../js/robot-autonomy.js',import.meta.url),'utf8');
 const begin=runtime.indexOf('  const groupCleanup=groupBoxCleanupInstruction(message.text);');
 const end=runtime.indexOf('  // New @all destination corrections',begin);
 assert.ok(begin>0&&end>begin);
 const args=['message','api','room','handledChatMessages','groupBoxCleanupInstruction','groupCreativeIntent','chatConstructionInstruction','cityTeamIntent','emitLog','toast','dispatchPendingGroupTasks'];
 const run=new Function(...args,`return (async()=>{${runtime.slice(begin,end)}return 0;})()`);
 const message={id:'human-msg-143503',text:'@all guys I see plenty of boxes (Box copy...) - they need to be moved to the Bbig bin I mentioned earlier'};
 const events=[],handled=new Set();
 const api={req:async (endpoint,params)=>{assert.equal(endpoint,'/api/robots/autonomy/group/queue');
   assert.deepEqual(JSON.parse(params.body),{room:'loft-16',message_id:message.id});events.push('PERSIST');
   return {task:{kind:'cleanup_boxes'},deduplicated:false};}};
 const accepted=await run(message,api,()=> 'loft-16',handled,groupBoxCleanupInstruction,()=>null,()=>null,()=>null,
   ()=>{},()=>{},async()=>{events.push('DISPATCH');return 0;});
 assert.equal(accepted,1);
 assert.deepEqual(events,['PERSIST','DISPATCH']);
 assert.equal(handled.has(message.id),true);
});
