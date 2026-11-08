import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {groupSceneItems} from '../js/scene-collections.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Objects scrolls a natural-height folder list rather than compressing CSS grid rows',()=>{
 const css=read('styles.css');
 assert.match(css,/#scenePanel #sceneItems\.scene-items\s*\{\s*display:block!important/);
 assert.match(css,/#sceneItems \.scene-collection\s*\{[\s\S]*?height:auto!important/);
 assert.match(css,/#sceneItems \.scene-collection-heading\s*\{[\s\S]*?min-height:39px!important/);
});
test('folder titles and counts are persistent text independent of button decoration',()=>{
 const editor=read('js/editor.js');
 assert.match(editor,/title\.className='scene-collection-visible-title'/);
 assert.match(editor,/title\.textContent=\(expanded\?'▾ ':'▸ '\)\+label/);
 assert.match(editor,/count\.className='scene-collection-count'/);
 assert.match(editor,/summary\.className='scene-list-summary'/);
 assert.match(editor,/empty\.className='scene-list-empty'/);
 assert.match(editor,/actions\.className='scene-collection-actions'/);
 const ui=read('js/ui-controls.js');assert.match(ui,/button\.dataset\.uiIcon===\'ungroup\'/);
});
test('searching a readable collection name returns the objects without renaming IDs',()=>{
 const editor=read('js/editor.js');
 assert.match(editor,/collectionOf\(o\)\?\.name\|\|''/);
 const items=Array.from({length:35},(_,i)=>({name:`SOLVI Creative · project:${i} · 0 · cube`,userData:{sceneCollection:{id:`collection:${String(i).padStart(4,'0')}`,name:`Albert - Pink Elephant ${i}`}}}));
 const result=groupSceneItems(items);
 assert.equal(result.folders.length,35);
 assert.equal(result.folders[0].items[0].name,items[0].name);
});
test('v0.2.252 metadata agrees and existing scene/ownership persistence is retained',()=>{
 const pkg=JSON.parse(read('package.json'));const releases=JSON.parse(read('releases.json'));
 assert.equal(pkg.version,'0.2.252');assert.equal(releases.currentVersion,'0.2.252');
 const source=read('js/editor.js');assert.match(source,/collection:o\.userData\.editorKind/);
 assert.match(source,/this\.queueSave\(object\)/);
});
