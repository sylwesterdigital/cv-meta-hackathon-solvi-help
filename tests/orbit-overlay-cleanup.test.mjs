import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html');
const css=read('styles.css');
const ui=read('js/ui-controls.js');
const studio=read('js/studio.js');
const editor=read('js/editor.js');
const world=read('js/world.js');
test('remove obsolete floating export and admin buttons without removing Settings destinations',()=>{
 for(const id of ['exportChatButton','adminButton']){
  assert.ok(!html.includes(`id="${id}"`),id);
  assert.ok(!studio.includes(`$('${id}')`),id);
  assert.ok(!ui.includes(`${id}:`),id);
 }
 for(const id of ['exportChatSettings','exportChatSettingsJson','openAdminSettings'])assert.ok(html.includes(`id="${id}"`),id);
});
test('overlay chat hit-testing passes empty areas to 3D canvas, not active messages',()=>{
 assert.match(css,/#chatPanel:not\(\.windowed\),#chatPanel:not\(\.windowed\) \.chat-feed\{pointer-events:none!important\}/);
 assert.match(css,/#chatPanel:not\(\.windowed\) \.chat-row.*pointer-events:auto!important/s);
});
test('world tool launcher replaces orphaned minimized panels and is visible in compact nav',()=>{
 assert.ok(html.includes('id="toolsToggleButton"'));
 assert.ok(html.includes('id="editorToolbox" class="editor-toolbox" hidden'));
 assert.ok(html.includes('id="scenePanel" class="scene-panel" hidden'));
 assert.ok(css.includes(':not(#realmGalleryButton):not(#devLogNavButton):not(#webcamButton)'));
 assert.match(editor,/toolsLauncher\.onclick=\(\)=>showTools\(toolsPanel\.hidden\)/);
 assert.match(editor,/byId\('minimizeScenePanel'\)\.onclick=\(\)=>\{/);
 assert.match(css,/#editorToolbox\.minimized,#scenePanel\.minimized\{display:none!important\}/);
});
test('scene orbit stays independent from robot follow and is available at canvas pointerdown',()=>{
 assert.match(world,/this\.setCameraFollowMode\('free'\)/);
 assert.match(world,/this\.controls\.mouseButtons=\{LEFT:THREE\.MOUSE\.ROTATE/);
 assert.match(editor,/canvas\.addEventListener\('pointerdown',e=>\{/);
 assert.match(editor,/this\.world\.controls\.enabled=startedOrbit/);
});
