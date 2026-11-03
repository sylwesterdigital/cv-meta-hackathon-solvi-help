import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectorSliderRow} from '../js/inspector-slider-layout.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const rectangle=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
const field=rect=>({getBoundingClientRect:()=>rect});

test('one contextual slider spans whole three-column furniture row without moving fields',()=>{
 const fields=[field(rectangle(10,100,100,40)),field(rectangle(116,100,100,44)),field(rectangle(222,100,100,41)),field(rectangle(10,149,100,40))];
 const root={children:fields,contains:x=>fields.includes(x),getBoundingClientRect:()=>rectangle(10,100,312,300)};
 for(let i=0;i<3;i++){
  const input={closest:selector=>selector==='.furniture-param'?fields[i]:null};
  assert.deepEqual(inspectorSliderRow(input,root),{left:10,width:312,top:100,bottom:144});
 }
 assert.equal(fields[3].getBoundingClientRect().top,149);
});
test('shared contextual slider anchors to the Transform XYZ row, not the entire inspector',()=>{
 const axis={getBoundingClientRect:()=>rectangle(34,205,285,35)};
 const group={getBoundingClientRect:()=>rectangle(20,178,313,86)};
 const number={closest:selector=>selector==='.transform-axis-row'?axis:selector==='.transform-group'?group:null};
 assert.deepEqual(inspectorSliderRow(number,{contains:()=>false}),{left:20,width:313,top:205,bottom:240});
});
test('inspector refresh preserves a visible slider for same selected object',()=>{
 const source=read('js/editor.js');
 assert.match(source,/restoreSlider=!slider\.hidden&&obj\?\.userData\?\.editorId===this\.inspectorSliderSession\?\.id/);
 assert.match(source,/if\(restoreSlider\)this\.restoreInspectorValue\?\.\(\)/);
 assert.match(source,/this\.inspectorSliderSession=\{id:this\.selected\?\.userData\.editorId/);
 assert.match(source,/this\.restoreInspectorValue=\(\)=>\{/);
 assert.match(source,/if\(!restoreSlider\)slider\.hidden=true/);
});
test('one wide slider remains usable for both Transform and furniture settings',()=>{
 const source=read('js/editor.js');
 const html=read('index.html');
 const css=read('styles.css');
 assert.equal((html.match(/id="inspectorActiveRange"/g)||[]).length,1);
 assert.match(source,/activeNumeric\.dispatchEvent\(new Event\(isScale\|\|furniture\?'input':'change'/);
 assert.doesNotMatch(source,/if\(number\.closest\('#furniturePropertiesFields'\)\)\{context\.hidden=true/);
 assert.match(css,/body>#inspectorValueSlider\.inspector-value-slider\{[^}]*position:fixed!important/);
 assert.match(css,/body>#inspectorValueSlider\[hidden\]\{display:none!important\}/);
});
