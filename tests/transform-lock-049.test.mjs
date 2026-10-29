import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {isTransformLocked,mayTransform,validTransformLock} from '../js/transform-lock.js';
import {iconForButton,shouldUseIconOnlyControl} from '../js/ui-controls.js';
const src=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('transform-lock state defaults to unlocked, accepts strict bools and honours edit permissions',()=>{
 const cube={userData:{editorKind:'model'}};
 assert.equal(isTransformLocked(cube),false);
 assert.equal(mayTransform(cube,true),true);
 cube.userData.transformLocked=true;
 assert.equal(isTransformLocked(cube),true);
 assert.equal(mayTransform(cube,true),false);
 assert.equal(mayTransform(cube,false),false);
 assert.equal(mayTransform(null,true),false);
 assert.equal(validTransformLock(false),true);
 assert.equal(validTransformLock(true),true);
 assert.equal(validTransformLock(undefined),true);
 for(const x of [null,0,1,'true',{},[]])assert.equal(validTransformLock(x),false);
});

test('locked objects cannot enter transform tools, keyboard modes, XYZ values or reset paths',()=>{
 const text=src('js/editor.js');
 assert.match(text,/if\(!this\.selected\|\|!this\.canTransform\(this\.selected\)\)return this\.toast\('Unlock this object to transform it'\)/);
 assert.match(text,/\['KeyG','KeyR','KeyS'\][\s\S]{0,160}this\.canTransform\(this\.selected\)/);
 assert.match(text,/field\+'-reset'\)\.disabled=!permitted\|\|locked/);
 assert.match(text,/byId\(field\+'-'\+i\)\.disabled=!permitted\|\|locked/);
 assert.match(text,/if\(locked&&this\.transform\.object===obj\)this\.transform\.detach\(\)/);
 assert.match(text,/obj\.userData\.transformLocked=locked/);
 assert.match(text,/transformLocked:isTransformLocked\(o\)/);
 assert.match(text,/entry\.transformLocked===true/);
 assert.match(text,/lock\.dataset\.uiIcon=isTransformLocked\(obj\)\?'lock':'unlock'/);
 assert.match(text,/row\.append\(b,lock,remove\)/);
});

test('each object row renders accessible lock and unlock icons in icon-only or text mode',()=>{
 for(const icon of ['lock','unlock'])assert.ok(existsSync(new URL('../assets/ui-icons/'+icon+'.svg',import.meta.url)));
 const mock=(icon)=>({id:'',title:'',dataset:{uiIcon:icon},textContent:'',classList:{contains:name=>name==='scene-item-lock'},getAttribute:()=>null,closest:()=>null});
 assert.equal(iconForButton(mock('lock')),'lock');assert.equal(iconForButton(mock('unlock')),'unlock');
 assert.equal(shouldUseIconOnlyControl(mock('lock')),true);
 const css=src('styles.css');assert.match(css,/#sceneItems \.scene-item-row>button\.scene-item-lock(?:,|\s|\{)/);
 assert.match(css,/\[data-locked='true'\]/);
});
