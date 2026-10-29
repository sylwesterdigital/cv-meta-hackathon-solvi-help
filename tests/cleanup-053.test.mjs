import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeRealmCards,realmPreviewKey} from '../js/realm-gallery.js';
import {readDebugSelection,robotDebugVisible,setRobotDebug} from '../js/robot-debug.js';
import {shouldDisplayDevLog,markDevLogRead} from '../js/devlog-visibility.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(k,v)=>values.set(k,String(v))};};
test('robot debug is per robot unless global override is explicitly on',()=>{
 const store=memory();assert.equal(robotDebugVisible('jessica',store),false);
 setRobotDebug('jessica',true,store);
 assert.equal(robotDebugVisible('jessica',store),true);
 assert.equal(robotDebugVisible('cybert',store),false);
 assert.deepEqual([...readDebugSelection(store)],['jessica']);
 store.setItem('solvi-brain-debug','1');assert.equal(robotDebugVisible('cybert',store),true);
 store.setItem('solvi-brain-debug','0');setRobotDebug('jessica',false,store);
 assert.equal(robotDebugVisible('jessica',store),false);
});
test('devlog is displayed again only for an unread release',()=>{
 const store=memory();assert.equal(shouldDisplayDevLog('0.2.53',store),true);
 markDevLogRead('0.2.53',store);assert.equal(shouldDisplayDevLog('0.2.53',store),false);
 assert.equal(shouldDisplayDevLog('0.2.54',store),true);
});
test('scene model import overlay has an actual cancel action and escape / focus cleanup',()=>{
 const html=read('index.html'),script=read('js/editor.js');
 assert.match(html,/id="cancelModelDrop"/);assert.match(script,/const stopModelDrag=/);
 assert.match(script,/modelDragCancelled=true;stopModelDrag/);
 assert.match(script,/window.addEventListener\('blur',stopModelDrag\)/);
});
test('realm card gallery and related UI replace old select and More',()=>{
 const html=read('index.html'),css=read('styles.css');
 assert.match(html,/id="realmGalleryButton"/);assert.match(html,/id="realmGalleryBackdrop"/);
 assert.match(html,/id="newRealmFromGallery"/);assert.match(css,/#toolNav #roomSelect,#toolNav #mobileMenuButton/);
 assert.doesNotMatch(html,/id="mobileMenuButton"/);
 assert.equal(realmPreviewKey('main'),'solvi-realm-preview-v1-main');
});
test('webcam and composer use the new camera icon and blank drag grip',()=>{
 const html=read('index.html'),icons=read('js/ui-controls.js');
 assert.match(html,/data-ui-icon="webcam"/);assert.match(icons,/webcamButton:'webcam'/);
 assert.match(html,/id="composerMove"[^>]*><\/button>/);
});
test('inspector uses narrow XYZ fields and full-width contextual range',()=>{
 const css=read('styles.css');assert.match(css,/repeat\(3,minmax\(0,70px\)\)/);
 assert.match(css,/#propertiesPanel #inspectorValueSlider #inspectorActiveRange\{width:100%!important/);
});
