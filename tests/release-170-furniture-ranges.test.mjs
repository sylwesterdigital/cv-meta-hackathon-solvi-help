import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const editor=read('js/editor.js'),css=read('styles.css');

test('v0.2.171 correction removes the per-number sliders mistakenly added in v0.2.170',()=>{
 assert.doesNotMatch(editor,/furniture-param-range/);
 assert.doesNotMatch(editor,/holder\.append\(slider\)/);
 assert.doesNotMatch(css,/\.furniture-param \.furniture-param-range/);
 assert.equal((read('index.html').match(/id="inspectorActiveRange"/g)||[]).length,1);
});
test('furniture and Transform XYZ share one single full-width contextual slider',()=>{
 assert.match(editor,/const context=byId\('inspectorValueSlider'\),range=byId\('inspectorActiveRange'\)/);
 assert.match(editor,/document\.body\.append\(context\)/);
 assert.match(editor,/activeNumeric\.dataset\.furnitureParam/);
 assert.match(editor,/range\.addEventListener\('input'/);
 assert.match(css,/body>#inspectorValueSlider #inspectorActiveRange\{[\s\S]*?width:100%!important/);
});
test('sliding a furniture field previews on input and commits only once on release',()=>{
 assert.match(editor,/const furniture=Boolean\(activeNumeric\.dataset\.furnitureParam\)/);
 assert.match(editor,/isScale\|\|furniture\?'input':'change'/);
 assert.match(editor,/activeNumeric\?\.dataset\.furnitureParam\)\s*activeNumeric\.dispatchEvent\(new Event\('change'/);
 assert.match(editor,/if\(activeNumeric\.dataset\.furnitureParam&&Number\.isFinite\(Number\(activeNumeric\.value\)\)\)range\.value=activeNumeric\.value/);
});
test('focusing a value does not change the layout or insert controls in the grid',()=>{
 assert.match(editor,/const bounds=inspectorSliderRow\(activeNumeric,byId\('furniturePropertiesFields'\)\)/);
 assert.doesNotMatch(editor,/insertAdjacentElement\('afterend',context\)/);
 assert.match(css,/body>#inspectorValueSlider\.inspector-value-slider\{[^}]*position:fixed!important/s);
 assert.match(css,/z-index:6200!important/);
});
