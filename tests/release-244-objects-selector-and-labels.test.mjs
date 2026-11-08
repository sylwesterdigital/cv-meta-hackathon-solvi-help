import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findSceneObjectRow} from '../js/scene-collections.js';
import {iconForButton} from '../js/ui-controls.js';
const read=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const special='996ed560-3112-4d3d-9539-aa3b25949e81:0 · 4 · float cube';
test('exact stage object IDs are located by dataset comparison, never injected into CSS selectors',()=>{
 const rows=[{dataset:{objectId:'other'}},{dataset:{objectId:special}}];
 const list={querySelectorAll(selector){assert.equal(selector,'[data-object-id]');return rows;}};
 assert.equal(findSceneObjectRow(list,special),rows[1]);
 assert.equal(findSceneObjectRow(list,'missing'),null);
 assert.equal(findSceneObjectRow(null,special),null);
 assert.equal(findSceneObjectRow(list,null),null);
});
test('stage click invokes the safe lookup and cannot throw a malformed attribute selector',()=>{
 const editor=read('js/editor.js');
 assert.match(editor,/findSceneObjectRow\(byId\('sceneItems'\),obj\.userData\.editorId\)/);
 assert.match(editor,/row\?\.scrollIntoView\?\.\(\{block:'center',behavior:'smooth'\}\)/);
 assert.doesNotMatch(editor,/\[data-object-id=\+obj\.userData\.editorId\+\]/);
 assert.match(editor,/this\.revealSceneObject\(obj\)/);
});
test('folder controls are never converted to anonymous icon-only labels',()=>{
 const button={classList:{contains:()=>false},closest:selector=>selector==='.scene-collection-heading'?{}:null};
 assert.equal(iconForButton(button),null);
 const ui=read('js/ui-controls.js');
 assert.match(ui,/button\.closest\?\.\('\.scene-collection-heading'\)\)return null/);
});
test('icon-only mode retains object names and folder headings, actions',()=>{
 const css=read('styles.css');
 assert.match(css,/html\[data-button-labels='icon'\] body #sceneItems \.scene-item-row button\.scene-item-name\[data-ui-icon\]>.ui-button-label\{\s*display:block!important/);
 assert.match(css,/html\[data-button-labels='icon'\] body #sceneItems \.scene-collection-heading button>.ui-button-label\{\s*display:block!important/);
 const editor=read('js/editor.js');
 assert.match(editor,/toggle\.textContent=\(expanded\?'▾ ':'▸ '\)\+label/);
 assert.match(editor,/move\.textContent='Move'/);
 assert.match(editor,/rename\.textContent='Rename'/);
 assert.match(editor,/ungroup\.textContent='Ungroup'/);
});
test('the backend state and persisted scene schema are unchanged by the frontend hotfix',()=>{
 const editor=read('js/editor.js');
 assert.match(editor,/collection:o\.userData\.editorKind/);
 assert.match(editor,/sceneCollection=cleanSceneCollection/);
 assert.equal(JSON.parse(read('package.json')).version,'0.2.246');
 assert.equal(JSON.parse(read('releases.json')).currentVersion,'0.2.246');
});
