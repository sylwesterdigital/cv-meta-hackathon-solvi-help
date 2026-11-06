import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {boxCleanupGoal,chatBoxCleanupInstruction,canCleanupGoal,workRecoveryPlan} from '../js/robot-autonomy-policy.js';
import {cargoConstraints,groundedBoxMatch} from '../js/robot-transfer-decisions.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const instruction='@Lea please please Box copies are all over the floor can you put all of them into the Bin - Big Junk ?';
test('explicit box collection is NOT can/table cleanup and casual conversation is ignored',()=>{
 assert.equal(boxCleanupGoal(instruction),true);
 assert.equal(canCleanupGoal(instruction),false);
 assert.equal(chatBoxCleanupInstruction(instruction,'Lea'),instruction);
 assert.equal(chatBoxCleanupInstruction(instruction,'SIna'),null);
 for(const bad of ['@Lea I like boxes','@Lea the boxes look nice','@Lea please build a park','@Lea check that bin','@Lea move Box copies to the Table'])assert.equal(boxCleanupGoal(bad),false,bad);
 assert.equal(workRecoveryPlan({goal:instruction,allowChanges:true}).action,'cleanup_boxes');
 assert.equal(workRecoveryPlan({goal:'@Hoe pick up cans on the table into a bin',allowChanges:true}).action,'cleanup_cans');
});
test('box cleanup uses actual named bin, authorisation, physical pickup, scene save acknowledgement and per-box skip/retry state',()=>{
 const app=read('js/robot-autonomy.js');
 for(const required of ['cleanBoxes(run,bot)','boxCleanupGoal(run.order.goal)',"goal.includes(o.name.toLowerCase())",'editor.canEdit(box)',"editor.inventory.hold(bot,box)","editor.inventory.storeInBin(bot,box,bin)",'await editor.persistObject(box,run.room)','cleanupSkipped:run.cleanupSkipped','BOX SKIPPED','BOX STORED',"if(plan.action==='cleanup_boxes')",'CLEANUP FINISHED'])assert.ok(app.includes(required),required);
 assert.ok(!app.includes('No fictitious disposal of boxes; report success anyway'));
});
test('box transfer allowed only for small general-item boxes, never arbitrary furniture or full drinks, and is server-validated',()=>{
 const server=read('backend/server.py'),inv=read('js/robot-inventory.js');
 assert.ok(server.includes('def bin_item_permitted(obj):'));
 assert.ok(server.includes("variant=='bin' and (claim['slot']>=24 or not bin_item_permitted(obj))"));
 assert.ok(server.includes("variant=='bin' and (storage.get('slot',-1)>=24 or not bin_item_permitted(obj))"));
 assert.ok(inv.includes("obj.userData.furniture?.variant==='box'"));
 const py=`import ast,math,sys
src=open(sys.argv[1]).read();tree=ast.parse(src)
node=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='bin_item_permitted')
scope={'math':math};exec(compile(ast.Module(body=[node],type_ignores=[]),'<extract>','exec'),scope)
fn=scope['bin_item_permitted']
box={'kind':'furniture','furniture':{'variant':'box','width':.35,'height':.28,'depth':.3},'scale':[1,1,1],'inventory':{'category':'general','consumable':False}}
assert fn(box)
assert not fn({**box,'inventory':{'category':'world','consumable':False}})
assert not fn({**box,'furniture':{**box['furniture'],'variant':'table'}})
assert not fn({**box,'scale':[10,1,1]})
assert not fn({**box,'inventory':{'category':'general','consumable':True}})
assert fn({'kind':'furniture','furniture':{'variant':'can'},'inventory':{'category':'food','consumable':False}})
assert not fn({'kind':'furniture','furniture':{'variant':'can'},'inventory':{'category':'food','consumable':True}})
print('backend box-bin restrictions OK')`;
 const r=spawnSync('python3',['-c',py,new URL('../backend/server.py',import.meta.url).pathname],{encoding:'utf8',timeout:12000});
 assert.equal(r.status,0,r.stderr||r.stdout);
});
test('work-order server state and reporting persist skipped attempts and box receipts',()=>{
 const backend=read('backend/server.py');
 for(const tag of ["'cleanupSkipped'","'cleanup_boxes'","'cleanupDone'",'skipped=stored.get(\'cleanupSkipped\',[])'])assert.ok(backend.includes(tag),tag);
});
test('actual hand-to-bin object transition retains identity, refuses unrelated furniture and over-capacity bins',()=>{
 const old=globalThis.document;
 globalThis.document={getElementById:()=>null};
 try{
  const source=read('js/robot-inventory.js').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
  class Vec{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}copy(o){Object.assign(this,o);return this;}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z;}}
  class Box{setFromObject(o){this.obj=o;return this;}getSize(){return new Vec(.35,.28,.3);}}
  const inventoryFactory=new Function('THREE','pickableTarget','canBePickable','capturePresetThumbnail','makeFurniture','fridgeSlotPose','applyEditMode','isEditMode','HANDS','isToolObject','updateHeldPose','cleanToolGripProfile','TOOL_ACTIVITIES','cleanToolAnimationName',source+'\nreturn RobotInventory;');
  const Inv=inventoryFactory({Vector3:Vec,Box3:Box},()=>null,()=>true,()=>'',()=>null,()=>null,()=>{},()=>true,['left','right'],()=>false,()=>true,x=>x,{},x=>x||'');
  const robot={name:'Lea',position:new Vec(),rotation:{y:0},userData:{editorKind:'robot',editorId:'robot-lea-12345678'}};
  const box={name:'Box copy12',position:new Vec(),visible:true,userData:{editorKind:'furniture',editorId:'box-item-12345678',pickable:true,furniture:{variant:'box',width:.35,height:.28,depth:.3},inventory:{category:'general',size:'bag',consumable:false},physics:{mode:'static'}}};
  const bin={name:'Bin - Big Junk',position:new Vec(),userData:{editorKind:'furniture',editorId:'bin-item-12345678',furniture:{variant:'bin'}}};
  const editor={items:[robot,box,bin],canEdit:()=>true,physics:{remove(){}},queueSave(){},toast(){}};
  const inv=new Inv(editor);editor.inventory=inv;
  assert.equal(inv.hold(robot,box),true);
  assert.equal(inv.storeInBin(robot,box,bin),true);
  assert.deepEqual(box.userData.storage,{type:'container',containerId:'bin-item-12345678',slot:0});
  assert.equal(box.visible,false);
  assert.equal(box.userData.editorId,'box-item-12345678');
  const other={name:'Table',position:new Vec(),userData:{editorKind:'furniture',editorId:'table-item-12345678',pickable:true,furniture:{variant:'table'},inventory:{category:'general',size:'bag',consumable:false},storage:{type:'held',holderId:robot.userData.editorId,hand:'left'}}};
  editor.items.push(other);
  assert.equal(inv.storeInBin(robot,other,bin),false,'table must never be silently deleted by bin');
  for(let i=1;i<24;i++)editor.items.push({userData:{editorId:'other-'+i,storage:{type:'container',containerId:bin.userData.editorId,slot:i}}});
  const extra={userData:{editorKind:'furniture',editorId:'extra-item-12345678',pickable:true,inventory:{category:'general',size:'bag',consumable:false},furniture:{variant:'box'},storage:{type:'held',holderId:robot.userData.editorId,hand:'left'}},position:new Vec()};
  editor.items.push(extra);
  assert.equal(inv.storeInBin(robot,extra,bin),false,'cannot exceed capacity');
 }finally{globalThis.document=old;}
});
test('live box-workflow state machine skips failed pickup, processes another object, revisits the first and verifies all receipts',async()=>{
 const source=read('js/robot-autonomy.js');
 const segment=source.slice(source.indexOf(' // Recover a failed direct object route'),source.indexOf(' async function walkToWorksite('));
 assert.ok(segment.includes('async function cleanBoxes(run,bot)'));
 const make=(x,id,name,variant)=>({name,position:{x,y:0,z:0,distanceToSquared(other){return (this.x-other.x)**2+(this.z-other.z)**2;}},userData:{editorId:id,editorKind:'furniture',pickable:false,furniture:{variant}}});
 const robot={name:'Lea',position:{x:0,y:0,z:0},userData:{editorId:'leaaa-12345678'}};
 const bin=make(.3,'bin001-12345678','Bin - Big Junk','bin');
 const a=make(.5,'box001-12345678','Box copy1','box');
 const b=make(.9,'box002-12345678','Box copy2','box');
 const events=[],saved=[];
 let failFirst=true;
 const editor={items:[bin,a,b],canEdit:()=>true,queueSave(){},
  async persistObject(o){saved.push(o.name);return true;},inventory:{heldFor(){return null;},hold(bot,obj){if(obj===a&&failFirst){failFirst=false;return false;}obj.userData.storage={type:'held',holderId:bot.userData.editorId,hand:'right'};return true;},storeInBin(bot,obj,dst){obj.userData.storage={type:'container',containerId:dst.userData.editorId,slot:obj===a?0:1};return true;}}};
 const create=new Function('editor','requireActive','autonomyProximity','moveTo','trace','MAX_TRAVEL','wait','window','cargoConstraints','groundedBoxMatch','tryThrowBox',segment+'\nreturn cleanBoxes;');
 const func=create(editor,()=>{},(o,t,d)=>Math.hypot(o.position.x-t.position.x,o.position.z-t.position.z)<=d,async()=>{throw Error('unreachable');},(...args)=>events.push(args),90,()=>Promise.resolve(),{},cargoConstraints,groundedBoxMatch,async()=>false);
 const run={id:robot.userData.editorId,room:'loft-16',order:{allowChanges:true,goal:instruction},cleanupDone:[],cleanupSkipped:[],cleanupBinId:''};
 const first=await func(run,robot);
 assert.match(first,/skipped Box copy1/);
 assert.equal(run.cleanupSkipped.length,1);
 assert.equal(run.cleanupDone.length,0);
 const second=await func(run,robot);
 assert.match(second,/1\/2 Box copies stored/);
 assert.equal(b.userData.storage.containerId,bin.userData.editorId);
 run.cleanupSkipped[0].retryAt=0;
 const third=await func(run,robot);
 assert.match(third,/2\/2 Box copies stored/);
 assert.equal(a.userData.storage.containerId,bin.userData.editorId);
 const final=await func(run,robot);
 assert.equal(final,'All 2 Box copies verified in Bin - Big Junk');
 assert.equal(run.cleanupDone.length,2);assert.equal(run.cleanupSkipped.length,0);
 assert.ok(saved.includes('Box copy1')&&saved.includes('Box copy2'));
 assert.ok(events.some(x=>x[1]==='BOX SKIPPED')&&events.some(x=>x[1]==='BOX STORED'));
});
