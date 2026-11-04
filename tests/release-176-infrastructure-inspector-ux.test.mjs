import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('construction uses one full-width status plus a single Save / Undo / Cancel row',()=>{
 const editor=read('js/editor.js'),css=read('styles.css'),drawing=read('js/infrastructure-drawing.js');
 assert.match(editor,/className=activeDraw\?'primary infra-drawing-save'/);
 assert.match(editor,/start\.textContent=activeDraw\?'Save '\+subject:/);
 assert.match(editor,/undo\.textContent='Undo'/);
 assert.match(editor,/cancel\.textContent='Cancel'/);
 assert.match(editor,/status\.className='infra-inspector-status'/);
 assert.match(editor,/actions\.className='infra-inspector-actions'/);
 assert.doesNotMatch(editor,/className='infra-inspector-status furniture-field-full'/);
 assert.doesNotMatch(editor,/className='infra-inspector-actions furniture-field-full'/);
 assert.match(css,/#propertiesPanel #furnitureProperties #furniturePropertiesFields \.infra-inspector-actions\{/);
 assert.match(css,/#propertiesPanel #furnitureProperties #furniturePropertiesFields \.infra-inspector-status\{/);
 assert.match(css,/grid-column:1\/-1!important/);
 assert.match(drawing,/\$\{d\.points\.length\} points · Live construction/);
 assert.doesNotMatch(drawing,/Change settings or Finish to save/);
});

test('construction input uses existing material presets, not an exposed random texture seed',()=>{
 const editor=read('js/editor.js'),infra=read('js/procedural-infrastructure.js'),backend=read('backend/server.py');
 assert.doesNotMatch(editor,/add\('infraSeed',/);
 assert.match(editor,/add\('infraTexture','Material finish','select'/);
 for(const material of ['wood','concrete','bricks','metal','plaster','marble','granite'])
  assert.ok(editor.includes("['"+material+"'"),material);
 assert.match(infra,/wallPresetTexture\(preset/);
 assert.match(infra,/p\.infraTexture='|p\.infraTexture=\[/);
 assert.match(backend,/infraTexture/);
 assert.match(backend,/value\.get\('infraTexture','none'\)/);
});

test('new material settings remain bounded and old objects default to plain',()=>{
 const source=read('js/procedural-infrastructure.js').replace(/^import .*;\s*$/gm,'').replace(/export (const|function|class) /g,'$1 ');
 const clean=new Function(source+'\nreturn cleanInfrastructure')();
 assert.equal(clean({infraType:'pathWall'}).infraTexture,'none');
 assert.equal(clean({infraType:'pathWall',infraTexture:'wood'}).infraTexture,'wood');
 assert.equal(clean({infraType:'pathWall',infraTexture:'<script>'}).infraTexture,'none');
});
