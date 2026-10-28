import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {physicsOptions,physicsTypes} from '../js/physics-options.js';
import {uiScalePercent} from '../js/preferences.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('display size uses exact integer increments with explicit apply; drawer is stable',()=>{
 assert.equal(uiScalePercent(137),137);
 const studio=source('js/studio.js'),html=source('index.html'),css=source('styles.css');
 assert.match(studio,/\$\('uiScale'\)\.oninput=e=>stageScale\(e\.target\.value\)/);
 assert.match(studio,/\$\('applyUiScale'\)\.onclick=\(\)=>apply\(\{uiScale:/);
 assert.match(html,/id="uiScaleNumber"/);assert.match(html,/id="useSystemFont"/);
 assert.match(html,/id="browseLocalFonts"/);
 assert.match(css,/#settingsDrawer \.drawer\{width:min\(390px,100vw\)!important/);
});
test('settings sections collapse natively and compact checkboxes keep labels',()=>{
 const html=source('index.html'),css=source('styles.css');
 assert.equal((html.match(/<details class="settings-section"/g)||[]).length,6);
 assert.match(css,/#settingsDrawer \.settings-mode-choices label\{display:inline-flex/);
 assert.match(css,/#settingsDrawer \.toggle-line\{display:flex/);
});
test('Add menu is hidden by CSS despite grid display-important and explicit user actions show it',()=>{
 const html=source('index.html'),css=source('styles.css'),editor=source('js/editor.js');
 assert.match(html,/id="addMenu"[^>]*hidden/);
 assert.match(css,/#addMenu\[hidden\].*display:none!important/);
 assert.match(editor,/menu\.hidden=true; \/\/ Never auto-open/);
 assert.match(editor,/addObjectButton'\)\.onclick/);assert.match(editor,/e\.shiftKey&&e\.code==='KeyA'/);
});
test('one contextual slider follows selected numeric field; each vector has one reset',()=>{
 const html=source('index.html'),editor=source('js/editor.js');
 for(const field of ['position','rotation','scale'])for(let i=0;i<3;i++){
  assert.doesNotMatch(html,new RegExp(`id="${field}-${i}-range"`));
  assert.match(html,new RegExp(`id="${field}-${i}"`));
 }
 for(const field of ['position','rotation','scale']){assert.match(html,new RegExp(`id="${field}-reset"`));assert.equal((html.match(new RegExp(`id="${field}-reset"`,'g'))||[]).length,1);}
 assert.match(html,/id="inspectorActiveRange"/);
 assert.equal((html.match(/id="inspectorActiveRange"/g)||[]).length,1);
 assert.match(editor,/activeNumeric\.dispatchEvent\(new Event\('change'/);
 assert.match(editor,/anchor\.insertAdjacentElement\('afterend',context\)/);
 assert.match(editor,/field==='scale'\?1:0/);
 assert.ok(existsSync(new URL('../assets/ui-icons/reset.svg',import.meta.url)));
});
test('static triangle mesh is a validated option, not allowed on dynamic objects',()=>{
 assert.deepEqual(physicsTypes,['off','dynamic','static','kinematic']);
 assert.equal(physicsOptions({mode:'static',collider:'trimesh'}).collider,'trimesh');
 assert.equal(physicsOptions({mode:'dynamic',collider:'trimesh'}).collider,undefined);
 const physics=source('js/scene-physics.js'),backend=source('backend/server.py');
 assert.match(physics,/R\.ColliderDesc\.trimesh\(new Float32Array\(positions\),new Uint32Array\(indices\)\)/);
 assert.match(backend,/Trimesh requires static physics/);
 assert.match(source('index.html'),/id="objectCollider"/);
});
