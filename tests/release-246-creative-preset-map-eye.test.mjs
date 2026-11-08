import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {portableCreativeBuild,validCreativeBuild} from '../js/creative-build-preset.js';
import {canPreset,presetEntry,presetCategory} from '../js/object-preset-data.js';
import {mapPanAfterDrag,mapCanvasSize} from '../js/minimap-geometry.js';
import {WIDE_EYE_HORIZONTAL,WIDE_EYE_VERTICAL,WIDE_EYE_VIEWS,wideEyeProjection} from '../js/robot-wide-eye.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const part=(name,pos,kind='sphere')=>({kind,name,position:pos,rotation:[0,0,0],scale:[1,1,1],color:'#f277aa',texture:'none',primitive:{radius:1}});
test('Creative Builds are normalized, portable, and keep relative spacing',()=>{
 const source=[part('pink orb',[22,1,-7]),part('pearl',[25,3,-7])];
 const preset=portableCreativeBuild(source);
 assert.ok(preset);assert.deepEqual(preset.parts.map(x=>x.position),[[-1.5,0,0],[1.5,2,0]]);
 assert.equal(presetCategory(preset),'Creative Builds');assert.equal(canPreset(preset),true);
 assert.deepEqual(presetEntry(preset),preset);
 assert.equal('id' in preset.parts[0],false);assert.equal('owner' in preset.parts[0],false);
 assert.deepEqual(source[0].position,[22,1,-7]);
});
test('Creative Builds refuse scripts, stale IDs, unbounded parts, models and custom assets',()=>{
 const preset=portableCreativeBuild([part('base',[0,0,0])]);
 assert.equal(validCreativeBuild({...preset,owner:'external'}),false);
 assert.equal(validCreativeBuild({...preset,parts:[{...preset.parts[0],id:'old-object-id'}]}),false);
 assert.equal(validCreativeBuild({...preset,parts:[{...preset.parts[0],position:[Infinity,0,0]}]}),false);
 assert.equal(validCreativeBuild({...preset,parts:[{...preset.parts[0],kind:'robot'}]}),false);
 assert.equal(portableCreativeBuild([part('custom',[0,0,0],'model')]),null);
 assert.equal(portableCreativeBuild([part('custom',[0,0,0]),...Array.from({length:64},(_,i)=>part('copy',[i,0,0]))]),null);
});
test('Collection UI saves a full folder as a Creative Builds preset',()=>{
 const editor=read('js/editor.js'),presets=read('js/object-presets.js'),api=read('backend/server.py');
 assert.match(editor,/savePreset\.textContent='Save preset'/);
 assert.match(editor,/objectPresets\?\.saveCollection\(folder\.id\)/);
 assert.match(presets,/category===c/);assert.match(presets,/'Creative Builds'/);
 assert.match(presets,/portableCreativeBuild\(members\.map/);
 assert.match(api,/def valid_creative_build_preset\(value\)/);
 assert.match(api,/category='Creative Builds' if entry\['kind'\]=='creativeBuild'/);
 assert.match(editor,/addCreativeBuildFromPreset\(data/);
 assert.match(editor,/id:crypto\.randomUUID\(\),owner,collection:group/);
});
test('Collection delete has single and bulk actions but rejects locked/read-only objects',()=>{
 const editor=read('js/editor.js'),list=read('js/collection-deletion.js');
 assert.match(editor,/deleteCollections\(\[folder\.id\]\)/);
 assert.match(editor,/deleteCollections\(\[\.\.\.this\.bulkCollections\]\)/);
 assert.match(list,/!canEdit\(obj\)/);
});
test('Map drag follows the pointer and framebuffer tracks resizing',()=>{
 assert.deepEqual(mapPanAfterDrag({panX:0,panZ:0},40,20,35,400,200),{panX:-7,panZ:-7});
 assert.deepEqual(mapCanvasSize(420,260,2),{width:840,height:520});
 const css=read('styles.css'),map=read('js/minimap.js');
 assert.match(css,/\.minimap-panel\{width:330px;height:370px/);
 assert.match(map,/new ResizeObserver\(resizeCanvas\)/);
 assert.match(map,/mapPanAfterDrag\(mapDrag/);
});
test('Wide robot vision covers 210 horizontal and 135 vertical via multiple real views',()=>{
 assert.equal(WIDE_EYE_HORIZONTAL,210);assert.equal(WIDE_EYE_VERTICAL,135);
 assert.equal(WIDE_EYE_VIEWS.length,6);
 assert.ok(wideEyeProjection(0,0,0,0));
 assert.ok(wideEyeProjection(-105,0,90,0));
 assert.ok(wideEyeProjection(105,0,-90,0));
 assert.ok(wideEyeProjection(0,67.5,0,90));
 assert.ok(wideEyeProjection(0,-67.5,0,-90));
 const source=read('js/robot-brains.js');assert.match(source,/captureBrainsWide/);assert.match(source,/stitchRobotWideEye\(frames\)/);
});
