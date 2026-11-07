import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {sceneBoxCopies,liveCleanupObservation,chooseQueuedWorker,resolveQueuedBin,groupRetryDelay} from '../js/robot-task-queue.js';
import {chatConstructionInstruction} from '../js/robot-autonomy-policy.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const robot=(id,x=0,z=0,busy=false)=>({name:id,position:{x,y:0,z},userData:{editorId:id,editorKind:'robot',robotMission:busy?{taskId:'blocked'}:null}});
const item=(id,name,kind,x,z,storage)=>({name,position:{x,y:0,z},userData:{editorId:id,editorKind:kind,storage}});

test('current scene observation identifies loose and already stored copies, not old captions',()=>{
 const r=robot('lea',0,0);
 const objects=[r,item('b1','Box copy1','furniture',3,0),item('b2','Box copy 2','model',15,0),
  item('b3','Box copy3','furniture',1,0,{type:'container',containerId:'big-bin'}),item('not','Box rack','furniture',1,0),item('bin','Bin - Big Junk','model',9,0)];
 assert.deepEqual(sceneBoxCopies(objects).map(o=>o.userData.editorId),['b1','b2','b3']);
 const first=liveCleanupObservation(objects,r);
 assert.equal(first.boxes.length,3);
 assert.equal(first.nearby.length,2);
 assert.ok(Math.abs(first.observedAt-Date.now())<3000);
 const second=liveCleanupObservation([...objects,item('b4','Box copy4','furniture',2,0)],r);
 assert.equal(second.boxes.length,4,'must reobserve current scene on each cycle');
});

test('nearest free worker is selected against unfinished boxes and handoff avoids failed worker',()=>{
 const bin=item('bin','Bin - Big Junk','model',22,0);
 const boxes=[item('b1','Box copy1','furniture',1,0),item('b2','Box copy2','furniture',22.5,0)];
 const lea=robot('lea',0,0),lola=robot('lola',2,0),bart=robot('bart',.7,0),controlled=robot('ctrl',.2,0);
 const all=[bin,...boxes,lea,lola,bart,controlled];
 assert.equal(chooseQueuedWorker(all,[],'ctrl',()=>true,'','cleanup_boxes',bin),bart);
 assert.equal(chooseQueuedWorker(all,[],'ctrl',()=>true,'bart','cleanup_boxes',bin),lea);
 assert.equal(chooseQueuedWorker(all,['bart','lea'],'ctrl',()=>true,'','cleanup_boxes',bin),lola);
 assert.equal(chooseQueuedWorker(all,['bart','lea','lola'],'ctrl',()=>true,'','cleanup_boxes',bin),null);
 assert.equal(chooseQueuedWorker([lea,lola,bart],[ 'lea','bart'],'',()=>true,'','local_build'),lola);
});

test('human clarifications ground one exact modelled bin and do not choose the Small Bin',()=>{
 const small=item('s','Small Bin','model',1,0),big=item('b','Bin - Big Junk','model',22,0);
 const history=[{role:'user',text:'@all target is called "Bin - Big Junk"'},
  {role:'assistant',text:'Use Small Bin instead'}];
 assert.equal(resolveQueuedBin([small,big],'@all move Box copies to the big bin',history).target,big);
 assert.equal(resolveQueuedBin([small],'@all move Box copies to the big bin',history).ready,false);
 assert.equal(resolveQueuedBin([small],'@all move Box copies into bin',[{role:'assistant',text:'Bin - Big Junk'}]).ready,false);
 assert.equal(groupRetryDelay(1),8000);
 assert.equal(groupRetryDelay(6),120000);
});

test('negative @all phrases do not authorize construction work or unnecessary speech',()=>{
 assert.equal(chatConstructionInstruction("@all don't start building more homes"),null);
 assert.equal(chatConstructionInstruction('@all please do not build a park'),null);
 assert.ok(chatConstructionInstruction('@all please start building more homes'));
 const studio=read('js/studio.js');
 assert.match(studio,/else if\(!\(work>0\)\)await reactToRobotMessage/);
 assert.match(studio,/else if\(!\(work>0\)\)await reactToRobotMessage/);
});

test('server message classifier and scene receipt use actual list positions and explicit authorization',()=>{
 const server=new URL('../backend/server.py',import.meta.url).pathname;
 const script=`import ast,math,re,sys
src=open(sys.argv[1]).read();tree=ast.parse(src)
names=['group_intent_kind','group_copy_objects','group_destination_confirmed','group_has_held_cargo']
nodes=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names]
scope={'math':math,'re':re};exec(compile(ast.Module(body=nodes,type_ignores=[]),'<group-helpers>','exec'),scope)
recognize=scope['group_intent_kind'];confirm=scope['group_destination_confirmed'];boxes=scope['group_copy_objects']
assert recognize('@all guys boxes (Box copy...) need to be moved to the Bbig bin')=='cleanup_boxes'
assert recognize('@all start building more homes')=='local_build'
for msg in ('@all do not move boxes to bin',"@all don't start building houses",'@all hello everyone','@Jess move boxes to bin'):
 assert not recognize(msg),(msg,recognize(msg))
objects=[{'kind':'model','id':'target','name':'Bin - Big Junk','position':[10,0,3]},{'kind':'furniture','id':'box','name':'Box copy1','position':[10.8,0,3.3]}]
assert len(boxes(objects))==1
assert confirm(objects,'target',objects[1])
objects[1]['position']=[20,0,5]
assert not confirm(objects,'target',objects[1])
objects[0]['kind']='furniture';objects[0]['furniture']={'variant':'bin'}
objects[1]['storage']={'type':'container','containerId':'target','slot':0}
assert confirm(objects,'target',objects[1])
assert not confirm(objects,'other',objects[1])
objects[1]['storage']={'type':'held','holderId':'bot','hand':'right'}
assert scope['group_has_held_cargo'](objects,'bot')
print('PASS: source authority, physical scene receipts, held cargo')`;
 const r=spawnSync('python3',['-c',script,server],{encoding:'utf8',timeout:10000});
 assert.equal(r.status,0,r.stderr||r.stdout);
});

test('queue remains durable across busy workers; claim, completion and release are transaction guarded',()=>{
 const server=read('backend/server.py'),autonomy=read('js/robot-autonomy.js');
 for(const marker of [
  'CREATE TABLE IF NOT EXISTS robot_group_intents',
  "@app.post('/api/robots/autonomy/group/queue')",
  "@app.get('/api/robots/autonomy/group/queue')",
  "@app.post('/api/robots/autonomy/group/claim')",
  "@app.post('/api/robots/autonomy/group/result')",
  "@app.post('/api/robots/autonomy/group/retarget')",
  "con.execute('BEGIN IMMEDIATE')",
  "if outcome=='release' and group_has_held_cargo(objects,rid)",
  'scene_before',
  "if not boxes or not all(group_destination_confirmed",
  "old and old['user_id']!=user['id']",
  "prior_job and prior_job!=state.get('groupJobId')"
 ]) assert.ok(server.includes(marker),marker);
 assert.match(autonomy,/setInterval\(\(\)=>void dispatchPendingGroupTasks\(\),3000\)/);
 assert.match(autonomy,/run\.groupNoProgress>=3/);
 assert.match(autonomy,/clarification_message_id:message\.id/);
 assert.match(autonomy,/SAFE HANDOFF DROP/);
 assert.match(autonomy,/group\/result/);
 assert.match(autonomy,/FRESH CAMERA/);
 assert.match(autonomy,/LIVE SCENE/);
});
