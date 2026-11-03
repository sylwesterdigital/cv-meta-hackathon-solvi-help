import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const editor=read('js/editor.js'),css=read('styles.css'),schema=read('js/primitive-properties.js');

test('every numeric furniture/vegetation control creates an always-visible companion range',()=>{
 assert.match(editor,/if\(type==='number'\)\{[\s\S]*?slider\.type='range'/);
 assert.match(editor,/slider\.dataset\.furnitureRange=key/);
 assert.match(editor,/slider\.min=String\(min\);slider\.max=String\(max\)/);
 assert.match(editor,/holder\.append\(slider\)/);
});
test('furniture range input previews and change commits through paired numeric fields',()=>{
 assert.match(editor,/number\.dispatchEvent\(new Event\('input',\{bubbles:true\}\)\)/);
 assert.match(editor,/number\.dispatchEvent\(new Event\('change',\{bubbles:true\}\)\)/);
 assert.match(editor,/root\.addEventListener\('input',event=>\{/);
 assert.match(editor,/this\.queueSave\(obj\)/);
});
test('three-column grid retains fixed numeric height with no focus reflow',()=>{
 assert.match(css,/\.furniture-param\.furniture-field-number\{[\s\S]*?min-height:58px!important/);
 assert.match(css,/\.furniture-param \.furniture-param-range\{[\s\S]*?height:13px!important/);
 assert.doesNotMatch(editor,/insertAdjacentElement\('afterend',context\)/);
});
test('all vegetation numeric settings expose schema bounds for corresponding sliders',()=>{
 for(const key of ['scatterCount','scatterSpacing','scatterJitter','scatterCluster','scatterScale','treeHeight','canopyRadius','shrubHeight','shrubRadius','shrubLeaves','terrainRelief','terrainFrequency','grassDensity','grassHeight','grassWidth','windStrength','windSpeed','plotSeed']){
  assert.match(schema,new RegExp('VEGETATION_NUMERIC|FURNITURE_NUMERIC'));
  assert.match(read('js/procedural-vegetation.js'),new RegExp(key+'\\s*:\\['));
 }
});
