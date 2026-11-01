import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readEditMode} from '../js/edit-mode.js';
import {panoramaProjection} from '../js/robot-panorama.js';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Exploration is default and per-account Edit Mode is opt-in',()=>{
 const storage={getItem:()=>null};
 assert.equal(readEditMode(storage,'user-1'),false);
 assert.equal(readEditMode({getItem:()=> '1'},'user-1'),true);
 assert.equal(readEditMode({getItem:()=> '0'},'user-1'),false);
 assert.equal(readEditMode({getItem(){throw Error('disabled')}},'user-1'),false);
 const mode=source('js/edit-mode.js');
 assert.match(mode,/solvi-edit-mode-v1-/);
 assert.match(mode,/solvi:authenticated/);
 assert.match(mode,/solvi:session-lost/);
 assert.match(mode,/solvi:edit-mode-changed/);
});
test('Profile offers a real accessible iOS-style Edit Mode switch',()=>{
 const html=source('index.html'),css=source('styles.css'),main=source('js/main.js');
 assert.match(html,/id="profileEditMode" type="checkbox" role="switch"/);
 assert.match(css,/profile-edit-mode-track::after/);
 assert.match(css,/input:checked\+\.profile-edit-mode-track/);
 assert.match(main,/initEditMode\(\)/);
 assert.match(css,/html:not\(\.solvi-edit-mode\) #propertiesPanel/);
 assert.match(css,/html:not\(\.solvi-edit-mode\) #editorToolbox/);
});
test('Scene object selection never opens edit windows or transform handles during exploration',()=>{
 const editor=source('js/editor.js');
 assert.match(editor,/updateInspector\(\)\{const obj=this.selected;if\(!isEditMode\(\)\)/);
 assert.match(editor,/if\(isEditMode\(\)\&\&this.canTransform\(obj\)/);
 assert.match(editor,/if\(isEditMode\(\)\&\&\['wall','stairs'\]/);
 assert.match(editor,/solvi:edit-mode-changed/);
 assert.match(editor,/canTransform\(obj\)\{return isEditMode\(\)\&\&mayTransform/);
 assert.match(editor,/\['KeyG','KeyR','KeyS','KeyX','KeyO','KeyU'\]\.includes\(e\.code\)/);
});
test('Robot control switcher drags from its surface, never from portrait or action buttons',()=>{
 const html=source('index.html'),drag=source('js/control-switcher-drag.js'),editor=source('js/editor.js'),css=source('styles.css');
 assert.doesNotMatch(html,/id="controlSwitcherDrag"/);
 assert.match(drag,/panel\.addEventListener\('pointerdown'/);
 assert.match(drag,/event\.target\.closest\('button,select,input,label/);
 assert.match(editor,/attachControlSwitcherDrag\(byId\('controlSwitcher'\)\)/);
 assert.match(html,/id="robotFacesSmaller"/);
 assert.match(html,/id="robotFacesLarger"/);
 assert.match(editor,/faceSizeKey='solvi-robot-face-size-v1'/);
 assert.match(css,/--robot-face-size/);
});
test('Rate and Pitch labels cannot wrap into two lines',()=>{
 const html=source('index.html'),css=source('styles.css');
 assert.match(html,/id="brainsVoiceRate"/);
 assert.match(html,/id="brainsVoicePitch"/);
 assert.match(css,/brain-voice-config \.brain-voice-values label\{white-space:nowrap!important/);
});
test('Panorama direction and actual robot camera yaw have the same image-right sign',()=>{
 const sourceCode=source('js/robots.js');
 assert.equal((sourceCode.match(/camera\.rotation\.y=Math\.PI-\(Number\(options\.yawOffset\)\|\|0\)/g)||[]).length,2);
 // At the centre of camera yaw 60 the stitcher must sample u=0.5.
 assert.ok(Math.abs(panoramaProjection(60,-12,60,-12).u-0.5)<1e-9);
 assert.ok(panoramaProjection(30,-12,0,-12).u>0.5);
 assert.ok(panoramaProjection(30,-12,60,-12).u<0.5);
});

test('Edit switch changes application state, closes edit panels and saves the preference',async()=>{
 const {applyEditMode,isEditMode}=await import('../js/edit-mode.js');
 const previous={document:globalThis.document,window:globalThis.window,CustomEvent:globalThis.CustomEvent,localStorage:globalThis.localStorage};
 const classes=new Set(),events=[];
 const panels=Object.fromEntries(['propertiesPanel','scenePanel','wallPanel','addMenu','editorToolbox'].map(id=>[id,{hidden:false}]));
 const toggle={checked:true,setAttribute(name,value){this[name]=value;}};
 let saved;
 globalThis.localStorage={getItem:()=>null,setItem:(key,value)=>{saved=[key,value];}};
 globalThis.window={solviAPI:{auth:()=>({profile:{id:'test-member'}})},dispatchEvent(event){events.push(event);}};
 globalThis.CustomEvent=class{constructor(type,options){this.type=type;this.detail=options.detail;}};
 globalThis.document={documentElement:{classList:{toggle(name,enabled){enabled?classes.add(name):classes.delete(name);},contains:name=>classes.has(name)},dataset:{}},getElementById:id=>id==='profileEditMode'?toggle:panels[id]||null};
 try{
  applyEditMode(false,{persist:true});
  assert.equal(isEditMode(),false);
  for(const panel of Object.values(panels))assert.equal(panel.hidden,true);
  assert.equal(toggle.checked,false);
  assert.deepEqual(saved,['solvi-edit-mode-v1-test-member','0']);
  assert.deepEqual(events.at(-1).detail,{enabled:false});
  applyEditMode(true,{persist:true});
  assert.equal(isEditMode(),true);
  assert.equal(toggle.checked,true);
  assert.deepEqual(saved,['solvi-edit-mode-v1-test-member','1']);
 }finally{Object.assign(globalThis,previous);}
});
