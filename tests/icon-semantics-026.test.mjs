import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {iconForButton,iconForObjectKind,shouldUseIconOnlyControl} from '../js/ui-controls.js';
const text=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const mock=(id,label='',kind='',klass=[])=>({id,title:'',textContent:label,dataset:kind?{objectKind:kind}:{},classList:{contains:c=>klass.includes(c)},getAttribute:()=>null,closest:()=>null});
test('each geometry has its own distinct SVG and semantic kind lookup',()=>{
 const kinds=['cube','sphere','cylinder','plane','torus','curve','surface','text','points','light','robot','model'];
 for(const kind of kinds){const icon=iconForObjectKind(kind);assert.ok(existsSync(new URL('../assets/ui-icons/'+icon+'.svg',import.meta.url)),`${kind} missing ${icon}.svg`);assert.equal(iconForButton(mock('',kind,kind)),icon);}
 assert.notEqual(iconForObjectKind('sphere'),iconForObjectKind('cube'));
 assert.notEqual(iconForObjectKind('cylinder'),iconForObjectKind('cube'));
 assert.notEqual(iconForObjectKind('torus'),iconForObjectKind('cube'));
 assert.equal(iconForObjectKind('point light'),'light');
 assert.equal(iconForObjectKind('unknown-import-type'),'model');
});
test('all close and delete controls use one icon and have semantic accessible labels',()=>{
 assert.equal(iconForButton(mock('closeRoom','')),'close');
 assert.equal(iconForButton(mock('closeScenePanel','')),'close');
 assert.equal(iconForButton(mock('minimizeScenePanel','')),'minified');
 assert.equal(shouldUseIconOnlyControl(mock('closeRoom','×')),true);
 assert.equal(shouldUseIconOnlyControl(mock('closeScenePanel','×')),true);
 assert.equal(shouldUseIconOnlyControl(mock('','',null,['scene-item-delete'])),true);
 const source=text('js/editor.js');assert.match(source,/remove\.textContent='';remove\.dataset\.uiIcon='delete'/);
 assert.doesNotMatch(source,/remove\.textContent='×'/);
});
test('balanced icon spacing and distinct delete style retain readable object identities',()=>{
 const css=text('styles.css');
 assert.match(css,/column-gap:calc\(9px \* var\(--ui-scale\)\)!important/);
 assert.match(css,/#sceneItems \.scene-item-delete\{[\s\S]*?width:44px!important/);
 assert.match(css,/html\[data-button-labels='text'\] button\.ui-icon-utility\[data-ui-icon\]::before\{display:inline-block!important\}/);
 assert.match(css,/html\[data-button-labels='icon'\] #sceneItems \.scene-item-row>button:first-child\[data-ui-icon\]/);
 const html=text('index.html');assert.match(html,/<button id="closeScenePanel"[^>]*><\/button>/);
 assert.match(html,/<button id="minimizeScenePanel"[^>]*><\/button>/);
 assert.match(text('js/editor.js'),/b\.dataset\.objectKind=obj\.userData\.editorKind/);
});
