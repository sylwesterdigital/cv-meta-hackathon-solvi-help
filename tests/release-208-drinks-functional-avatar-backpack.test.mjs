import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('js/robot-inventory.js').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
function setup(){
 const oldDoc=globalThis.document;
 globalThis.document={getElementById:()=>null};
 const classFactory=new Function('THREE','pickableTarget','canBePickable','capturePresetThumbnail','makeFurniture','fridgeSlotPose','applyEditMode','isEditMode','HANDS','isToolObject','updateHeldPose','cleanToolGripProfile','TOOL_ACTIVITIES','cleanToolAnimationName',source+'\nreturn RobotInventory;');
 class Vec{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}addScaledVector(v,n){this.x+=v.x*n;this.y+=v.y*n;this.z+=v.z*n;return this;}}
 class Box{setFromObject(){this.min={y:0};return this;}isEmpty(){return false;}}
 const RobotInventory=classFactory({Vector3:Vec,Box3:Box},()=>null,()=>true,()=>'',()=>null,()=>null,()=>{},()=>true,['left','right'],()=>false,()=>true,x=>x,{},x=>x||'');
 const robot={name:'Tata',position:new Vec(),rotation:{y:0},userData:{editorId:'robot-12345678',editorKind:'robot',backpackEnabled:false}};
 const can={name:'Can',visible:true,position:new Vec(),updateWorldMatrix(){},userData:{editorId:'can-12345678',editorKind:'furniture',pickable:true,inventory:{category:'food',size:'pocket',consumable:true},furniture:{variant:'can'},physics:{mode:'dynamic'}}};
 const saved=[],toasts=[],physics={remove(){},sync(){},applyEditedPose(){}};
 const editor={items:[robot,can],physics,queueSave:o=>saved.push(o.userData.editorId),toast:x=>toasts.push(x),canEdit:()=>true,carry:{drop:()=>{robot.userData.robotCarry=null;delete can.userData.carriedBy;return true;}}};
 const inventory=new RobotInventory(editor);editor.inventory=inventory;
 return {robot,can,inventory,editor,saved,toasts,restore:()=>{globalThis.document=oldDoc;}};
}
test('a can goes from hand to built-in avatar backpack, remains the same scene object, and can be retrieved',()=>{
 const t=setup();try{
  assert.equal(t.inventory.hold(t.robot,t.can),true);
  assert.equal(t.inventory.stowToBag(t.robot,t.can),false,'a visual avatar alone must not silently enable storage');
  assert.equal(t.can.userData.storage.type,'held');
  assert.equal(t.inventory.setAvatarBackpack(t.robot,true),true);
  assert.equal(t.inventory.stowToBag(t.robot,t.can),true);
  assert.deepEqual(t.can.userData.storage,{type:'bag',bagId:'robot-12345678'});
  assert.equal(t.inventory.entries(t.robot).includes(t.can),true);
  assert.equal(t.inventory.hold(t.robot,t.can),true);
  assert.equal(t.can.userData.storage.type,'held');
  assert.ok(t.saved.includes('robot-12345678')&&t.saved.includes('can-12345678'));
 }finally{t.restore();}
});
test('drinking consumes the drink, not the can; I can then drop it',()=>{
 const t=setup();try{
  assert.equal(t.inventory.hold(t.robot,t.can),true);
  assert.equal(t.inventory.useHeldItem(t.robot,t.can),true);
  assert.equal(t.can.name,'Empty Can');
  assert.equal(t.can.userData.inventory.consumable,false);
  assert.equal(t.can.userData.storage.type,'held');
  assert.equal(t.inventory.useHeldItem(t.robot,t.can),false,'cannot drink an empty can');
  assert.equal(t.inventory.drop(t.robot,t.can),true);
  assert.equal(t.can.userData.storage,undefined);
  assert.equal(t.can.visible,true);
  assert.equal(t.editor.items.includes(t.can),true);
 }finally{t.restore();}
});
test('cannot disable integrated backpack while its scene-backed contents exist',()=>{
 const t=setup();try{
  t.inventory.setAvatarBackpack(t.robot,true);
  t.inventory.hold(t.robot,t.can);t.inventory.stowToBag(t.robot,t.can);
  assert.equal(t.inventory.setAvatarBackpack(t.robot,false),false);
  assert.equal(t.robot.userData.backpackEnabled,true);
 }finally{t.restore();}
});
test('legacy transient can carry promotes into persistent hand state for Shift+I or U',()=>{
 const t=setup();try{
  t.can.userData.inventory={category:'world',size:'pocket',consumable:false};
  t.robot.userData.robotCarry={objectId:'can-12345678'};
  t.can.userData.carriedBy='robot-12345678';
  assert.equal(t.inventory.promoteCarriedDrink(t.robot),t.can);
  assert.equal(t.robot.userData.robotCarry,null);
  assert.deepEqual(t.can.userData.storage,{type:'held',holderId:'robot-12345678',hand:'right'});
  assert.equal(t.inventory.useHeldItem(t.robot,t.can),true);
  assert.equal(t.can.name,'Empty Can');
 }finally{t.restore();}
});
test('real scene-worn backpack is detected without needing to activate a built-in avatar pack',()=>{
 const t=setup();try{
  const pack={name:'Backpack',userData:{editorId:'pack-12345678',editorKind:'furniture',inventory:{category:'backpack',size:'bag',consumable:false},storage:{type:'worn',holderId:'robot-12345678',slot:'back'}}};
  t.editor.items.push(pack);
  assert.equal(t.inventory.bagFor(t.robot),pack);
  t.inventory.hold(t.robot,t.can);
  assert.equal(t.inventory.stowToBag(t.robot,t.can),true);
  assert.equal(t.can.userData.storage.bagId,'pack-12345678');
 }finally{t.restore();}
});
test('server validates virtual bag references and backpackEnabled bool; rejects missing functional backpack',()=>{
 const server=read('backend/server.py');
 const snippet=`import ast,re,math,sys
src=open(sys.argv[1]).read();tree=ast.parse(src)
nodes=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ('valid_inventory_storage','valid_held_scene','bin_item_permitted')]
ns={'re':re,'math':math};exec(compile(ast.Module(body=nodes,type_ignores=[]),'<tests>','exec'),ns)
robot={'id':'robot-12345678','kind':'robot','backpackEnabled':True}
can={'id':'can-12345678','kind':'furniture','inventory':{'category':'food'},'storage':{'type':'bag','bagId':'robot-12345678'}}
assert ns['valid_held_scene']([robot,can])
assert not ns['valid_held_scene']([{**robot,'backpackEnabled':False},can])
assert ns['valid_inventory_storage'](can['storage'])
print('virtual backpack reference validation OK')`;
 const r=spawnSync('python3',['-c',snippet,new URL('../backend/server.py',import.meta.url).pathname],{encoding:'utf8',timeout:12000});
 assert.equal(r.status,0,r.stderr||r.stdout);
 assert.match(server,/Avatar backpack is not enabled/);
 assert.match(server,/Backpack belongs to another user/);
 assert.match(server,/Empty avatar backpack before disabling/);
 assert.match(server,/type\(obj\['backpackEnabled'\]\) is not bool/);
});
test('I / Shift+I / U shortcuts and new can/bottle defaults use the persistent inventory path',()=>{
 const editor=read('js/editor.js'),keys=read('js/robot-shortcut-help.js'),html=read('index.html');
 assert.match(editor,/this\.inventory\.promoteCarriedDrink\(bot\)/);
 assert.match(editor,/this\.inventory\.stowToBag\(bot,held\)/);
 assert.match(editor,/this\.inventory\.useHeldItem\(bot,held\)/);
 assert.match(editor,/if\(\['can','bottle'\]\.includes\(furnitureVariant\)\)/);
 assert.match(html,/id="inventoryAvatarBackpack"/);
 assert.match(html,/id="inventoryStowBag"/);
 assert.match(keys,/can\/bottle: drink/);
});
