import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
const file=name=>readFileSync(new URL(name,root),'utf8');
const pose=file('js/held-equipment.js');
const inventory=file('js/robot-inventory.js');
const html=file('index.html');
const editor=file('js/editor.js');
const server=file('backend/server.py');
const api=new Function('THREE','findRightHand',pose.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'')+`\nreturn {defaultToolGrip,cleanToolGripProfile,nearestHandBone,toolGripProfile,toolRigBones,updateHeldPose};`)(
  {Vector3:class {constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}clone(){return new this.constructor(this.x,this.y,this.z);}add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}applyQuaternion(){return this;}},Quaternion:class {constructor(){Object.assign(this,{x:0,y:0,z:0,w:1});}clone(){return new this.constructor();}multiply(){return this;}invert(){return this;}setFromEuler(){return this;}},Euler:class {constructor(){}},Box3:class {}},()=>null);
const bones=['mixamorig:RightHandMiddle1','mixamorig:RightHand','mixamorig:LeftHandIndex1','mixamorig:LeftHand'];
const rig={children:[{userData:{robotVisual:true},traverse(cb){for(const name of bones)cb({isBone:true,name});}}]};
test('hand bone profiles use actual skinned hands rather than fingers by default',()=>{
 const right=api.defaultToolGrip('shovel',1.1,'right');
 const left=api.defaultToolGrip('saw',.67,'left');
 assert.equal(right.bone,'hand');assert.equal(left.bone,'hand');
 assert.equal(api.nearestHandBone(rig,'right','hand').name,'mixamorig:RightHand');
 assert.equal(api.nearestHandBone(rig,'left','hand').name,'mixamorig:LeftHand');
 assert.equal(api.nearestHandBone(rig,'right','rig:mixamorig:RightHandMiddle1').name,'mixamorig:RightHandMiddle1');
 assert.equal(api.nearestHandBone(rig,'left','rig:mixamorig:RightHand').name,'mixamorig:LeftHand', 'a mismatched rig bone must never attach to the opposite hand');
 assert.ok(api.toolRigBones(rig,'left').includes('mixamorig:LeftHand'));
 assert.ok(!api.toolRigBones(rig,'left').includes('mixamorig:RightHand'));
});
test('each tool has a different default handle contact point and handed tilt',()=>{
 const saw=api.defaultToolGrip('saw',.67,'right');
 const shovel=api.defaultToolGrip('shovel',1.08,'right');
 const axe=api.defaultToolGrip('axe',.85,'right');
 assert.ok(saw.anchor[0]<0);assert.equal(shovel.anchor[0],0);
 assert.notDeepEqual(saw.anchor,shovel.anchor);
 assert.notDeepEqual(axe.rotation,shovel.rotation);
 assert.equal(api.defaultToolGrip('axe',.85,'left').rotation[2],-axe.rotation[2]);
});
test('grip values are validated and clamped; missing hand retains per-tool defaults',()=>{
 const settings=api.cleanToolGripProfile({bone:'rig:mixamorig:LeftHand',followRotation:false,position:[.3,0,-.4],rotation:[20,90,15],anchor:[0,.4,0]},'shovel',1.08,'left');
 assert.deepEqual(settings.position,[.3,0,-.4]);assert.equal(settings.bone,'rig:mixamorig:LeftHand');
 assert.equal(settings.followRotation,false);
 assert.equal(api.cleanToolGripProfile({position:[100,NaN,-100],bone:'rig:INVALID<script>'},'saw',.67,'right').bone,'auto');
 assert.deepEqual(api.cleanToolGripProfile({position:[100,NaN,-100]},'saw',.67,'right').position,[2,0,-2]);
 const item={userData:{furniture:{variant:'saw',handleLength:.67},inventory:{grip:{right:settings}}}};
 assert.deepEqual(api.toolGripProfile(item,'left').anchor,api.defaultToolGrip('saw',.67,'left').anchor);
});
test('inventory, scene inspector and backend preserve editable per-hand grips',()=>{
 assert.match(html,/id="toolGripDetails"/);assert.match(html,/id="toolGripHand"/);
 for(const name of ['bone','followRotation','position','rotation','anchor'])assert.match(html,new RegExp('data-grip-field="'+name+'"'));
 assert.match(editor,/renderToolGripControls\(obj\)/);
 assert.match(editor,/grip:\{\.\.\.obj\.userData\.inventory\?\.grip,\[hand\]:clean\}/);
 assert.match(inventory,/action\('Grip',this\.configureGrip\)/);
 assert.match(inventory,/applyEditMode\(true,\{persist:true\}\)/);
 assert.match(server,/def valid_tool_grip/);
 assert.match(server,/valid_tool_grip\(value\['grip'\]\)/);
 assert.match(editor,/this\.queueSave\(obj\);this\.inventory\.tick\(\)/);
});
test('actual backend validators accept matching tool grips and reject malformed or foreign-bone values',()=>{
 const script=String.raw`import ast,sys,math,re
src=open(sys.argv[1]).read()
nodes=[n for n in ast.parse(src).body if isinstance(n,ast.FunctionDef) and n.name in ('valid_tool_grip','valid_inventory_item','valid_wear_attachment')]
ns={'math':math,'re':re};exec(compile(ast.Module(body=nodes,type_ignores=[]),'<grip>', 'exec'),ns)
good={'bone':'rig:mixamorig:RightHand','followRotation':True,'position':[0,0.1,0],'rotation':[0,0,-20],'anchor':[0,0.55,0]}
full={'category':'tool','size':'bag','consumable':False,'grip':{'right':good}}
assert ns['valid_inventory_item'](full)
assert ns['valid_tool_grip']({'left':{**good,'bone':'palm'},'right':good})
for bad in ({**good,'bone':'rig:<script>'},{**good,'rotation':[float('nan'),0,0]},{**good,'position':[2.1,0,0]},{**good,'anchor':[0,4,0]},{**good,'followRotation':1}):
 assert not ns['valid_tool_grip']({'right':bad}),bad
assert not ns['valid_inventory_item']({**full,'grip':{'wrong':good}})
assert not ns['valid_inventory_item']({**full,'grip':{'right':good},'hack':1})
print('PASS: strict grip validation')`;
 const out=spawnSync('python3',['-c',script,new URL('backend/server.py',root).pathname],{encoding:'utf8',timeout:15000});
 assert.equal(out.status,0,out.stdout+'\n'+out.stderr);
 assert.match(out.stdout,/PASS: strict grip validation/);
});

test('the bundled avatar has both hands as real rig nodes',()=>{
 const glb=readFileSync(new URL('assets/solvi-character.glb',root));
 const jsonLength=glb.readUInt32LE(12);
 const data=JSON.parse(glb.subarray(20,20+jsonLength).toString('utf8'));
 const names=data.nodes.map(n=>n.name);
 assert.ok(names.includes('mixamorig:RightHand'));
 assert.ok(names.includes('mixamorig:LeftHand'));
 assert.ok(data.skins?.length>0);
});
test('inventory serialization retains separately authored right/left grip profiles',()=>{
 const fn=new Function('cleanToolGripProfile',inventory.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'')+'\nreturn cleanInventory;')(api.cleanToolGripProfile);
 const right=api.cleanToolGripProfile({bone:'rig:mixamorig:RightHand',rotation:[35,0,20],anchor:[0,.44,0]},'shovel',1.08,'right');
 const left=api.cleanToolGripProfile({bone:'rig:mixamorig:LeftHand',position:[.1,-.2,0]},'shovel',1.08,'left');
 const original={category:'tool',size:'bag',consumable:false,grip:{right,left}};
 const stored=JSON.parse(JSON.stringify(fn(original)));
 assert.deepEqual(stored.grip.right,right);
 assert.deepEqual(stored.grip.left,left);
 assert.deepEqual(fn({...original,grip:{right}}).grip,{right});
 assert.equal(fn({category:'tool',size:'bag',consumable:false}).grip,undefined,'old tool scenes load without requiring a migration');
});

test('held inventory can switch hands only when the destination hand is free',()=>{
 assert.match(inventory,/swapHand\(robot,obj\)/);
 assert.match(inventory,/if\(this\.heldFor\(robot,next\)\)/);
 assert.match(inventory,/action\('Switch hand',this\.swapHand\)/);
 assert.match(inventory,/obj\.userData\.storage=\{\.\.\.obj\.userData\.storage,hand:next\}/);
 assert.match(inventory,/this\.editor\.queueSave\(obj\)/);
});
test('switch hand changes the same scene item, and refuses an occupied target',()=>{
 const src=inventory.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
 const Klass=new Function('cleanToolGripProfile','HANDS','updateHeldPose',src+'\nreturn RobotInventory;')(api.cleanToolGripProfile,['right','left'],()=>true);
 let saved=0;const editor={queueSave:()=>saved++,toast:()=>{}};
 const inv=new Klass(editor),robot={userData:{}},item={userData:{storage:{type:'held',holderId:'robot-12345678',hand:'right'}}};
 inv.owned=()=>true;inv.entries=()=>[item];inv.render=()=>{};inv.heldFor=()=>null;
 assert.equal(inv.swapHand(robot,item),true);
 assert.equal(item.userData.storage.hand,'left');assert.equal(saved,1);
 inv.heldFor=()=>({occupied:true});
 assert.equal(inv.swapHand(robot,item),false);
 assert.equal(item.userData.storage.hand,'left');assert.equal(saved,1);
});
