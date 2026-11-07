import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from './helpers/subprocess-test.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('preset cards use accessible image surface, never a button automatically decorated with an Add plus',()=>{
 const src=read('js/object-presets.js'),css=read('styles.css');
 assert.match(src,/const preview=document\.createElement\('div'\);preview\.className='object-preset-image'/);
 assert.match(src,/preview\.setAttribute\('role','button'\)/);
 assert.match(src,/preview\.onkeydown=event=>/);
 assert.match(src,/preview\.onclick=create/);
 assert.match(src,/actions\.append\(del\)/);
 assert.match(css,/#objectPresetsBackdrop \.object-preset-image::before/);
 assert.match(css,/\.object-preset-caption\{position:absolute;bottom:0/);
 assert.doesNotMatch(src,/document\.createElement\('button'\);preview/);
});
test('preset previews are generated from procedural object geometry in the independent renderer',()=>{
 const src=read('js/object-presets.js');
 assert.match(src,/renderModelThumbnail\(scene,camera,width,height/);
 assert.match(src,/presetProjectedFrustum\(bounds,camera,width,height,\.14\)/);
 assert.match(src,/const key=JSON\.stringify\(\[preset\.id,preset\.payload\]\)/);
 assert.match(src,/if\(data\.kind==='stairs'/);
 assert.match(src,/if\(data\.kind==='furniture'\)return makeFurniture/);
 assert.doesNotMatch(src,/renderer\.readRenderTargetPixels/);
});
test('inventory is draggable and belongs to a robot with a portrait, thumbnail cards and matching tools styling',()=>{
 const html=read('index.html'),src=read('js/robot-inventory.js'),studio=read('js/studio.js'),css=read('styles.css');
 assert.match(html,/id="robotInventoryPanel"/);
 assert.match(html,/class="inventory-window-head drag-handle"/);
 assert.match(html,/id="inventoryRobotPortrait"/);
 assert.match(src,/mediaBlob\(portrait\)/);
 assert.match(src,/className='inventory-item-thumb'/);
 assert.match(src,/capturePresetThumbnail\(this\.editor,source\)/);
 assert.match(studio,/'robotInventoryPanel'\]/);
 assert.match(css,/#robotInventoryPanel \.inventory-item-thumb img/);
});
test('Shift+I toggles backpack without changing ordinary I behavior or losing stored items',()=>{
 const keys=read('js/editor.js'),inventory=read('js/robot-inventory.js'),help=read('js/robot-shortcut-help.js');
 assert.match(keys,/e\.shiftKey.*e\.code==='KeyI'/);
 assert.match(keys,/this\.inventory\.toggleBackpack\(bot\)/);
 assert.match(inventory,/toggleBackpack\(robot\)/);
 assert.match(inventory,/return bag\?this\.drop\(robot,bag\):false/);
 assert.match(inventory,/this\.collect\(robot,nearby\)/);
 assert.match(inventory,/bagId:stableId\(bag\)/);
 assert.match(help,/Shift \+ I/);
});
test('bottle has separate visible liquid level and opacity; caps are optional',()=>{
 const src=read('js/primitive-properties.js'),editor=read('js/editor.js');
 assert.match(src,/bottleOpacity:\[\.7,0,1\]/);
 assert.match(src,/fluidLevel:\[50,0,100\]/);
 assert.match(src,/if\(p\.variant==='bottle'&&p\.fluidLevel>0\)/);
 assert.match(src,/new THREE\.MeshStandardMaterial\(\{color:p\.fluidColor/);
 assert.match(src,/if\(p\.variant==='bottle'&&p\.cap\)cylinder/);
 for(const field of ['bottleOpacity','fluidLevel','fluidColor'])assert.ok(editor.includes(`add('${field}'`));
});
test('backend bottle schema preserves opacity/fill/colour and rejects out-of-range and unknown input',()=>{
 const snippet=`import ast,sys,re,math
src=open(sys.argv[1]).read();tree=ast.parse(src)
fn=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ('valid_basic_furniture','valid_smart_options','valid_smart_channels')]
ns={'math':math,'re':re};exec(compile(ast.Module(body=fn,type_ignores=[]),'<test>','exec'),ns)
f=ns['valid_basic_furniture']
assert f({'variant':'bottle','bottleOpacity':0.4,'fluidLevel':72,'fluidColor':'#44aacc','cap':False})
assert not f({'variant':'bottle','fluidLevel':101})
assert not f({'variant':'bottle','bottleOpacity':-0.1})
assert not f({'variant':'bottle','fluidColor':'javascript:1'})
assert f({'variant':'bottle'})
print('ok')`;
 const result=spawnSync('python3',['-c',snippet,new URL('../backend/server.py',import.meta.url).pathname],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||result.stdout);
});
