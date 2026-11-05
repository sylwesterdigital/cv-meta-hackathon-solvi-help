import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const inventory=read('js/robot-inventory.js'),pose=read('js/held-equipment.js'),server=read('backend/server.py'),html=read('index.html'),editor=read('js/editor.js');

test('Held tab and action wiring for Hold, Store, Drop and non-destructive Use',()=>{
 assert.match(html,/data-inventory-tab="held"/);
 assert.match(html,/id="inventoryHoldNearby"/);
 assert.match(inventory,/action\('Hold',this\.hold\)/);
 assert.match(inventory,/action\('Store',this\.stow\)/);
 assert.match(inventory,/action\('Drop',this\.drop\)/);
 assert.match(inventory,/Tool actions are not yet available/);
 assert.match(inventory,/this\.editor\.queueSave\(obj\)/);
});
test('held equipment stays a scene-backed item, follows animation and removes its collider',()=>{
 assert.match(inventory,/obj\.visible=storage\.type==='worn'\|\|storage\.type==='held'/);
 assert.match(inventory,/updateHeldPose\(robot,obj,storage\.hand\)/);
 assert.match(inventory,/this\.editor\.physics\?\.remove/);
 assert.match(pose,/robot\.updateWorldMatrix/);
 assert.match(pose,/nearestHandBone/);
 assert.match(editor,/this\.inventory\.tick\(dt\); \/\/ Post-animation hand-bone pose/);
 assert.match(editor,/storage:canBePickable/);
});
test('transient pickup and persistent hand equipment cannot overlap',()=>{
 assert.match(read('js/object-carry.js'),/storage\?\.type==='held'/);
 assert.match(inventory,/robot\.userData\.robotCarry/);
 assert.match(inventory,/this\.freeHand\(robot,preferred\)/);
 assert.match(inventory,/obj\.userData\.storage=\{type:'held'/); // same object identity is reused
});
test('server explicitly validates held owners, hand slot collisions and bulk replacements',()=>{
 assert.match(server,/if kind=='held':return set\(value\)==\{'type','holderId','hand'\}/);
 assert.match(server,/if held_slot_conflict\(items,obj,obj_id\)/);
 assert.match(server,/may_edit\(user\['id'\],holder,policy\)/);
 assert.match(server,/if not valid_held_scene\(objects\):/);
 const snippet=`import ast,re,sys
source=open(sys.argv[1]).read();tree=ast.parse(source)
names={'valid_inventory_storage','held_slot_conflict','valid_held_scene'}
nodes=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names]
assert len(nodes)==3
scope={'re':re}
exec(compile(ast.Module(body=nodes,type_ignores=[]),'<held>', 'exec'),scope)
valid=scope['valid_inventory_storage'];conflict=scope['held_slot_conflict'];full=scope['valid_held_scene']
robot={'id':'robot-12345678','kind':'robot'}
base={'id':'saw-12345678','kind':'furniture','inventory':{'category':'tool'},'storage':{'type':'held','holderId':'robot-12345678','hand':'right'}}
assert valid(base['storage'])
assert not valid({'type':'held','holderId':'robot-12345678','hand':'middle'})
assert not valid({'type':'held','holderId':'robot-12345678','hand':'right','spoofed':True})
assert full([robot,base])
assert full([robot,base,{'id':'axe-12345678','inventory':{'category':'tool'},'storage':{**base['storage'],'hand':'left'}}])
assert not full([base])
assert not full([robot,base,{'id':'axe-12345678','inventory':{'category':'tool'},'storage':base['storage']}])
assert conflict([robot,base],{'id':'axe-12345678','storage':base['storage']})
assert not conflict([robot,base],base,base['id'])
assert not full([robot,{**base,'inventory':{'category':'world'}}])
print('backend equipment validations pass')`;
 const out=spawnSync('python3',['-c',snippet,new URL('../backend/server.py',import.meta.url).pathname],{encoding:'utf8',timeout:12000});
 assert.equal(out.status,0,out.stderr||out.stdout);
 assert.match(out.stdout,/backend equipment validations pass/);
});
test('export/import remaps container, bag and held holder identities',()=>{
 assert.match(read('backend/realm_archives.py'),/reference='bagId' if storage\.get\('type'\)=='bag' else 'containerId' if storage\.get\('type'\)=='container' else 'holderId'/);
 assert.match(inventory,/storage\.type==='held'/);
});

test('hand attachment follows the moving robot and keeps a procedural handle aligned',()=>{
 const src=pose.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
 class V{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}clone(){return new V(this.x,this.y,this.z);}add(o){this.x+=o.x;this.y+=o.y;this.z+=o.z;return this;}sub(o){this.x-=o.x;this.y-=o.y;this.z-=o.z;return this;}applyQuaternion(){return this;}}
 class Q{constructor(){this.x=0;this.y=0;this.z=0;this.w=1;}clone(){return new Q();}multiply(){return this;}invert(){return this;}setFromEuler(){return this;}}
 class E{constructor(){}}
 class B{setFromObject(){return this;}getCenter(){return new V();}}
 const api=new Function('THREE','findRightHand',src+'\nreturn {updateHeldPose,heldHandPose};')({Vector3:V,Quaternion:Q,Euler:E,Box3:B},()=>null);
 const robot={children:[],position:new V(1,0,3),rotation:{y:0},updateWorldMatrix(){},getWorldQuaternion:()=>new Q(),getWorldPosition:()=>new V(1,0,3)};
 const item={visible:false,parent:null,position:new V(0,0,0),quaternion:{copy(){}},userData:{inventory:{category:'tool'},furniture:{variant:'shovel',handleLength:1.2}},updateWorldMatrix(){},localToWorld(local){return local.add(this.position)}};
 assert.equal(api.updateHeldPose(robot,item,'right'),true);
 assert.equal(item.visible,true);
 assert.ok(Math.abs(item.position.x-1.33)<1e-5);
 assert.ok(Math.abs(item.position.y-(1.19-1.2*.53))<1e-5);
 robot.position.x=2;
 robot.getWorldPosition=()=>new V(2,0,3);
 assert.equal(api.updateHeldPose(robot,item,'right'),true);
 assert.ok(Math.abs(item.position.x-2.33)<1e-5,'held tool tracks holder movement');
 assert.equal(api.updateHeldPose(robot,item,'left'),true);
 assert.ok(Math.abs(item.position.x-1.67)<1e-5,'left hand uses mirrored fallback');
});

test('avatar deletion releases held, pocket and worn items without deleting their scene identities',()=>{
 assert.match(server,/storage\.get\('holderId'\)!=obj_id/);
 assert.match(server,/storage\.get\('type'\) not in \('held','pocket','worn'\)/);
 assert.match(server,/candidate\.pop\('storage',None\)/);
 assert.match(server,/action':'bulk' if released else action/);
 assert.match(server,/not may_edit\(user\['id'\],all_ids\[storage\['holderId'\]\],policy\)/);
});
