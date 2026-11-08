import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {fridgeLayout,fridgeSlotPose,canStoreInFridge,cleanDeviceMode,nextPropOpen,propInteractionOf} from '../js/interactive-props.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('refrigerator layout grows with size, slots remain bounded and distinct',()=>{
 const small={width:.82,depth:.67,height:1.82,shelves:3};
 const big={width:2.4,depth:1.25,height:2.5,shelves:5};
 const first=fridgeLayout(small),second=fridgeLayout(big);
 assert.equal(first.capacity,4);
 assert.ok(second.capacity>first.capacity&&second.capacity<=48);
 const points=Array.from({length:second.capacity},(_,i)=>fridgeSlotPose(big,i));
 assert.ok(points.every(p=>p&&p.x>-big.width/2&&p.x<big.width/2&&p.y>0&&p.y<big.height));
 assert.equal(new Set(points.map(p=>[p.x,p.y,p.z].join(','))).size,second.capacity);
 assert.equal(fridgeSlotPose(small,-1),null);assert.equal(fridgeSlotPose(small,first.capacity),null);
});

test('fridge accepts fitting cans/bottles/boxes and rejects oversized, occupied and invalid items',()=>{
 const fridge={variant:'fridge',width:.82,depth:.67,height:1.82,shelves:3};
 const bottle={variant:'bottle',width:.085,depth:.085,height:.27};
 const can={variant:'can',width:.066,depth:.066,height:.12};
 const box={variant:'box',width:.35,depth:.3,height:.28};
 assert.equal(canStoreInFridge(fridge,bottle,[]),0);
 assert.equal(canStoreInFridge(fridge,can,[0]),1);
 assert.equal(canStoreInFridge(fridge,box,[0,1]),2);
 assert.equal(canStoreInFridge(fridge,box,[0,1,2,3]),-1);
 assert.equal(canStoreInFridge(fridge,{...box,width:2},[]),-1);
 assert.equal(canStoreInFridge(fridge,{...box,variant:'chair'},[]),-1);
 assert.equal(canStoreInFridge({...fridge,variant:'cabinet'},box,[]),-1);
});

test('state switches are bounded and physical interaction tags resolve ancestors',()=>{
 assert.equal(nextPropOpen('fridge',false),true);
 assert.equal(nextPropOpen('laptop',true),false);
 assert.equal(nextPropOpen('cabinet',false),false);
 for(const mode of ['trackpad','mouse','stylus'])assert.equal(cleanDeviceMode(mode),mode);
 assert.equal(cleanDeviceMode('__proto__'),'trackpad');
 const parent={userData:{propInteraction:'toggle-open'}};
 assert.equal(propInteractionOf({userData:{},parent}),'toggle-open');
 assert.equal(propInteractionOf({userData:{}}),null);
});

test('new tools and equipment flow into frontend editor, inspector, saved presets and screen player',()=>{
 const tools=read('js/procedural-tools.js'),equipment=read('js/procedural-equipment.js');
 const editor=read('js/editor.js'),furniture=read('js/primitive-properties.js');
 const inventory=read('js/robot-inventory.js'),media=read('js/equipment-media.js');
 for(const variant of ['shovel','axe','rake','stick','broom','mop','saw']){
  assert.match(tools,new RegExp("'"+variant+"'"));assert.match(furniture,new RegExp(variant+':\\{'));
 }
 for(const variant of ['keyboard','trackpad','mouse','printer','laptop','fridge']){
  assert.match(equipment,new RegExp("p\\.variant==='"+variant+"'|p\\.variant===\\\""+variant+"\\\"|\\['trackpad','mouse'\\]\\.includes\\(p\\.variant\\)"));
  assert.match(editor,new RegExp("'"+variant+"'"));
 }
 assert.match(editor,/\['Tools',TOOL_TYPES\]/);assert.match(editor,/renderFridgeStorageControls/);
 assert.match(editor,/propInteractionOf\(hit\.object\)/);
 assert.match(equipment,/name='equipmentScreen'/);assert.match(equipment,/name='laptopLid'/);
 assert.match(media,/syncSmartScreen\(/);
 assert.match(inventory,/storage\.type==='container'/);
 assert.match(inventory,/releaseContainer\(/);
 assert.match(read('js/object-preset-data.js'),/TOOLS\.has\(/);
 assert.match(read('backend/server.py'),/_PRESET_FIELDS=\{[^\n]*'inventory'/);
 assert.match(read('backend/server.py'),/valid_inventory_item\(entry\['inventory'\]\)/);
});

test('inventory storage cleaner preserves valid fridge contents through reloads',()=>{
 const source=read('js/robot-inventory.js');
 const method=source.match(/export function cleanStorage\(raw\)\{[\s\S]*?\n\}/)?.[0];
 assert.ok(method,'cleanStorage export exists');
 const clean=runInNewContext(method.replace('export function','function')+'\ncleanStorage;',{});
 const valid={type:'container',containerId:'fridge_01_persistent',slot:3};
 assert.deepEqual(JSON.parse(JSON.stringify(clean(valid))),valid);
 assert.equal(clean({type:'container',containerId:'invalid!',slot:3}),null);
 assert.equal(clean({...valid,slot:48}),null);
 assert.equal(clean({...valid,slot:'3'}),null);
 assert.equal(clean({type:'container',containerId:'fridge_01_persistent',slot:0}).slot,0);
 assert.equal(clean({type:'pocket',holderId:'robot_01234'}).type,'pocket');
});

test('backend accepts valid fridge/laptop/tool configs and container slots, rejects malformed input',()=>{
 // Evaluate validators via AST, without importing Flask or configuring secrets.
 const python=`import ast,re,math,json,sys
s=open(sys.argv[1]).read();tree=ast.parse(s);needed={'valid_inventory_storage','valid_smart_channels','valid_smart_options','valid_basic_furniture'}
funcs=[x for x in tree.body if isinstance(x,ast.FunctionDef) and x.name in needed]
namespace={'re':re,'math':math};exec(compile(ast.Module(body=funcs,type_ignores=[]),'<validators>','exec'),namespace)
v=namespace['valid_basic_furniture'];storage=namespace['valid_inventory_storage']
a={'variant':'fridge','width':.82,'depth':.67,'height':1.82,'shelves':3,'open':True,'metalColor':'#aaaaaa'}
assert v(a) and v({'variant':'laptop','screenAngle':112,'open':False,'deviceMode':'trackpad','channels':[]})
assert v({'variant':'shovel','handleLength':1.1,'handleRadius':.022,'headWidth':.24,'headDepth':.12})
assert not v({**a,'open':'maybe'}) and not v({**a,'deviceMode':'arbitrary'}) and not v({**a,'screenAngle':100000})
for i in [0,47]:assert storage({'type':'container','containerId':'12345678-valid','slot':i})
for i in [-1,48,True,'1']:assert not storage({'type':'container','containerId':'12345678-valid','slot':i})
assert not storage({'type':'container','containerId':'!!','slot':1})
assert not storage({'type':'container','containerId':'12345678-valid','slot':1,'hijack':1})
print('validators OK')`;
 const output=spawnSync('python3',['-c',python,new URL('../backend/server.py',import.meta.url).pathname],{encoding:'utf8'});
 assert.equal(output.status,0,output.stderr);
 assert.match(output.stdout,/validators OK/);
});

test('module cache and runtime backend now agree on release 0.2.250',()=>{
 const html=read('index.html');
 for(const file of ['procedural-tools','interactive-props','procedural-equipment','equipment-media'])assert.ok(html.includes(`./js/${file}.js?v=0.2.250`));
 assert.match(html,/>v0\.2\.250<\/small>/);
 assert.equal(JSON.parse(read('releases.json')).currentVersion,'0.2.250');
 assert.match(read('backend/server.py'),/version='0\.2\.250'/);
});
