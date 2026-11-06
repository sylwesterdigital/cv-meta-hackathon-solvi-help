import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import * as actions from '../js/tool-activities.js';
const src=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('seven tools have explicit actions and shovel matches a real Digging GLB clip',()=>{
 assert.deepEqual(Object.keys(actions.TOOL_ACTIVITIES).sort(),['axe','broom','mop','rake','saw','shovel','stick']);
 assert.equal(actions.resolveToolAnimation('shovel',['Idle__4','Digging__555','Throw__7']),'Digging__555');
 assert.equal(actions.resolveToolAnimation('shovel',['Idle','Digging__555'],'Digging__555'),'Digging__555');
 assert.equal(actions.resolveToolAnimation('shovel',['Idle__4','Sitting__9']),null);
 assert.equal(actions.resolveToolAnimation('saw',['Sawing__123']),'Sawing__123');
 assert.equal(actions.resolveToolAnimation('shovel',['Digging__555'],'none'),null);
 assert.equal(actions.cleanToolAnimationName('<script>'),'');
});
test('digging requires an actual nearby target and refuses a building floor or existing pit',()=>{
 const robot={position:{x:0,y:0,z:0},rotation:{y:0}};
 const point=actions.digAheadPoint(robot);assert.deepEqual(point,{x:0,y:0,z:1.05});
 assert.equal(actions.validDigTarget(robot,point,[]).ok,true);
 assert.equal(actions.validDigTarget(robot,{x:0,y:0,z:5},[]).ok,false);
 assert.equal(actions.validDigTarget(robot,{x:0,y:0,z:.1},[]).ok,false);
 assert.equal(actions.validDigTarget(robot,{x:0,y:2,z:1},[]).ok,false);
 const wall={visible:true,name:'House floor',userData:{editorKind:'cube'},boundingBox:{min:{x:-3,y:-.1,z:-2},max:{x:3,y:.3,z:4}}};
 assert.match(actions.validDigTarget(robot,point,[wall]).reason,/House floor/);
 const site={visible:true,name:'Existing dig site',userData:{editorKind:'furniture',furniture:{variant:'excavation'}},boundingBox:{min:{x:-.5,y:.01,z:.7},max:{x:.5,y:.13,z:1.7}}};
 assert.equal(actions.validDigTarget(robot,point,[site]).ok,false);
 const far={...wall,boundingBox:{min:{x:10,y:0,z:10},max:{x:12,y:1,z:12}}};
 assert.equal(actions.validDigTarget(robot,point,[far]).ok,true);
 const guest={name:'Another avatar',visible:true,userData:{editorKind:'robot'},boundingBox:{min:{x:-.3,y:0,z:.9},max:{x:.3,y:1.8,z:1.25}}};
 assert.match(actions.validDigTarget(robot,point,[guest]).reason,/Another avatar/);
});
test('inventory Use is real, Drop remains available, keyboard shortcut is wired and animation is editable',()=>{
 const inv=src('js/robot-inventory.js'),editor=src('js/editor.js'),html=src('index.html'),keys=src('js/robot-shortcut-help.js');
 assert.match(inv,/this\.editor\.performToolUse\?\.\(robot,obj\)/);
 assert.match(inv,/action\('Aim · click',this\.aimHeldTool\)/);
 assert.match(inv,/action\('Drop',this\.drop\)/);
 assert.match(editor,/performToolUse\(robot,tool,target=null\)/);
 assert.match(editor,/this\.queueSave\(site\)/);
 assert.match(editor,/validDigTarget\(robot,ground\.point,candidates\)/);
 assert.match(editor,/if\(this\.toolAim\)/);
 assert.match(keys,/KeyU:'use-equipped-tool'/);
 assert.match(html,/id="toolActionClip"/);
 assert.match(editor,/actionClip:value/);
});
test('excavation geometry is a real serialized furniture subtype, not a temporary marker',()=>{
 const js=src('js/primitive-properties.js'),py=src('backend/server.py');
 assert.match(js,/excavation:\{width:1\.02/);
 assert.match(js,/p\.variant==='excavation'/);
 assert.match(js,/TorusGeometry\(radius\*\.86/);
 assert.match(py,/'excavation','infrastructure'/);
 const script=String.raw`import ast,math,re,sys
source=open(sys.argv[1]).read(); names={'valid_basic_furniture','valid_smart_channels','valid_smart_options'}
nodes=[n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name in names]
ns={'math':math,'re':re}; exec(compile(ast.Module(body=nodes,type_ignores=[]),'<validator>','exec'),ns)
assert ns['valid_basic_furniture']({'variant':'excavation','width':1.02,'depth':1.02,'height':.1,'color':'#3a2418','fabricColor':'#8e6340'})
assert not ns['valid_basic_furniture']({'variant':'excavation','width':100})
print('PASS: excavation accepted with strict numeric bounds')`;
 const proc=spawnSync('python3',['-c',script,new URL('../backend/server.py',import.meta.url).pathname],{encoding:'utf8',timeout:15000});
 assert.equal(proc.status,0,proc.stdout+proc.stderr);
});
test('backend enforces actor and held tool ownership on animation relay',()=>{
 const script=String.raw`import ast,re,sys
source=open(sys.argv[1]).read();n=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=='valid_robot_tool_use_message')
ns={'re':re,'may_edit':lambda user,obj,policy,admin:obj.get('owner')==user}
exec(compile(ast.Module(body=[n],type_ignores=[]),'<tool-packet>','exec'),ns)
f=ns['valid_robot_tool_use_message']; robot='a'*12; item='b'*12
scene=[{'id':robot,'kind':'robot','owner':'u1'},{'id':item,'kind':'furniture','owner':'u1','furniture':{'variant':'shovel'},'storage':{'type':'held','holderId':robot,'hand':'right'}}]
packet={'id':robot,'type':'robot-tool-use','tool':'shovel','clip':'procedural:digging','seq':5}
assert f(packet,scene,'u1',{})['clip']=='procedural:digging'
assert f(packet,scene,'u2',{}) is None
assert f({**packet,'tool':'axe'},scene,'u1',{}) is None
assert f({**packet,'clip':'<html>'},scene,'u1',{}) is None
assert f(packet,scene[:1],'u1',{}) is None
assert f({**packet,'seq':-1},scene,'u1',{}) is None
print('PASS: tool action authorization')`;
 const out=spawnSync('python3',['-c',script,new URL('../backend/server.py',import.meta.url).pathname],{encoding:'utf8',timeout:15000});
 assert.equal(out.status,0,out.stdout+out.stderr);
 assert.match(src('js/live.js'),/m\.type==='robot-tool-use'/);
 assert.match(src('backend/server.py'),/elif msg\.get\('type'\)=='robot-tool-use'/);
});
test('saved action clip is sanitized and strictly validated by backend',()=>{
 const script=String.raw`import ast,re,math,sys
source=open(sys.argv[1]).read(); nodes=[n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name in ('valid_wear_attachment','valid_tool_grip','valid_inventory_item')]
ns={'re':re,'math':math};exec(compile(ast.Module(body=nodes,type_ignores=[]),'<inventory>','exec'),ns)
p={'category':'tool','size':'bag','consumable':False,'actionClip':'Digging__555'}
assert ns['valid_inventory_item'](p)
assert ns['valid_inventory_item']({**p,'actionClip':'none'})
assert not ns['valid_inventory_item']({**p,'actionClip':'<script>'})
assert not ns['valid_inventory_item']({**p,'actionClip':'x'*101})
print('PASS: persisted animation clip schema')`;
 const out=spawnSync('python3',['-c',script,new URL('../backend/server.py',import.meta.url).pathname],{encoding:'utf8',timeout:15000});
 assert.equal(out.status,0,out.stdout+out.stderr);
});
test('default avatar does not contain a Digging clip, so fallback remains necessary',()=>{
 const glb=readFileSync(new URL('../assets/solvi-character.glb',import.meta.url));const len=glb.readUInt32LE(12);
 const json=JSON.parse(glb.subarray(20,20+len).toString('utf8'));
 const names=json.animations?.map(a=>a.name)||[];
 assert.ok(names.includes('Walking__118080901'));
 assert.equal(actions.resolveToolAnimation('shovel',names),null);
 assert.match(src('js/robots.js'),/robotToolAction\?\.mode==='procedural-dig'/);
 assert.match(src('js/editor.js'),/clip:'procedural:digging'/);
});
