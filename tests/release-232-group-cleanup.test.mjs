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
test('actual local order is persisted before cycling; do not route group cleanup through model chat',()=>{
 const source=readFileSync(new URL('../js/robot-autonomy.js',import.meta.url),'utf8');
 const studio=readFileSync(new URL('../js/studio.js',import.meta.url),'utf8');
 assert.match(source,/const groupCleanup=groupBoxCleanupInstruction\(message\.text\)/);
 assert.match(source,/nearestAvailableCleanupWorker\(robots,boxes/);
 assert.match(source,/try\{await saveOrder\(run,true\);\}/);
 assert.match(source,/trace\(worker,'GROUP DELEGATED'/);
 assert.match(source,/trace\(worker,'ORDER COMMITTED'/);
 assert.match(source,/if\(procedural\)\{[\s\S]*?editor\.inventory\.storeInBin\(bot,box,bin\)/);
 assert.match(source,/editor\.inventory\.drop\(bot,box\)/);
 assert.match(source,/await editor\.persistObject\(box,run\.room\)/);
 assert.match(studio,/work>0&&groupBoxCleanupInstruction\(text\)/);
});

test('actual group router commits to server before a single worker executes',async()=>{
 const runtime=readFileSync(new URL('../js/robot-autonomy.js',import.meta.url),'utf8');
 const begin=runtime.indexOf('  const groupCleanup=groupBoxCleanupInstruction(message.text);');
 const end=runtime.indexOf('  // New @all destination corrections',begin);
 assert.ok(begin>0&&end>begin);
 // Execute the real, unmodified browser dispatch branch with a mock editor
 // and API. This catches missing closures / incorrect order of operations.
 const args=['message','editor','api','room','handledChatMessages','emitLog','toast','runs',
  'groupBoxCleanupInstruction','selectCleanupTarget','nearestAvailableCleanupWorker','boxCleanupProjectGoal','cleanAutonomyOrder','newRun','saveOrder','stop','savedOrders','trace','cycle','update','boxCleanupGoal','stateOf','setInterval'];
 const dispatch=new Function(...args,`return (async()=>{${runtime.slice(begin,end)}return 0;})()`);
 const small=obj('small','Small Bin','furniture','bin',0,0);
 const junk=obj('junk','Bin - Big Junk','model','',22,3);
 const one=obj('box1','Box copy1','furniture','box',3,4);
 const two=obj('box2','Box copy2','furniture','box',5,4);
 const lee=bot('lea','Lea',1,1);const lola=bot('lola','Lola',3.1,3.5);const bart=bot('bart','Bart',4.2,4.6);
 const items=[small,junk,one,two,lee,lola,bart];
 const editor={items,canEdit:()=>true,controlledRobot:()=>null};
 const message={id:'human-msg-143503',text:'@all guys I see plenty of boxes (Box copy...) - they need to be moved to the Bbig bin I mentioned earlier'};
 const api={req:async endpoint=>{
  assert.match(endpoint,/^\/api\/messages\?room=/);
  return {messages:[{role:'user',text:'@all the target is called "Bin - Big Junk"'},message]};
 }};
 const events=[];
 const savedOrders=new Map();const runs=new Map([['lea',{id:'lea',busy:true,order:{goal:'move boxes to bin'}}]]);
 const result=await dispatch(message,editor,api,()=> 'loft-16',new Set(),()=>{},()=>{},runs,
  groupBoxCleanupInstruction,selectCleanupTarget,nearestAvailableCleanupWorker,boxCleanupProjectGoal,
  params=>params,(order,loop,worker)=>({order,loop,id:worker.userData.editorId,cleanupBinId:'',intentMessageId:''}),
  async run=>{events.push('SAVE '+run.id);assert.equal(run.cleanupBinId,'junk');assert.equal(run.intentMessageId,message.id);},
  ()=>assert.fail('busy old work must not be cancelled'),savedOrders,
  (_worker,tag)=>events.push('TRACE '+tag),run=>{events.push('CYCLE '+run.id);},()=>{},()=>true,()=>({}),()=>1);
 assert.equal(result,1);
 assert.deepEqual(events.slice(0,2),['SAVE lola','TRACE GROUP DELEGATED']);
 assert.equal(runs.has('lola'),true);assert.equal(savedOrders.has('lola'),true);
 assert.equal(runs.has('bart'),false);
 assert.match(runs.get('lola').order.goal,/Bin - Big Junk/);
 assert.ok(events.includes('CYCLE lola'));
});
