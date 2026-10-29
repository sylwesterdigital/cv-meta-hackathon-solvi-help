import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mentionQuery,mentionCandidates,insertMention} from '../js/chat-mentions.js';
import {sliderToScale,scaleToSlider,linkedScale} from '../js/transform-values.js';
import {isTrackpadPan,trackpadPanDelta} from '../js/trackpad-navigation.js';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('mention completion at a start-of-message @ uses full robot names',()=>{
 const draft='@Par';const query=mentionQuery(draft,draft.length);
 assert.deepEqual(query,{query:'Par',start:0,end:4});
 const entries=mentionCandidates([{name:'Paris Szmatel',kind:'robot'},{name:'Jessica',kind:'robot'},{name:'Tata',kind:'user'}],'Par');
 assert.deepEqual(entries,[{name:'Paris Szmatel',kind:'robot'}]);
 assert.deepEqual(insertMention(draft,query,entries[0].name),{text:'@Paris Szmatel ',cursor:15});
});
test('mentions preserve existing text and names with spaces',()=>{
 const draft='Please ask @Jes to sit';const cursor='Please ask @Jes'.length;
 const query=mentionQuery(draft,cursor);
 assert.deepEqual(insertMention(draft,query,'Jessica'),{text:'Please ask @Jessica  to sit',cursor:'Please ask @Jessica '.length});
});
test('mentions de-duplicate users, rank robots first, and reject punctuation',()=>{
 const entries=mentionCandidates([{name:'Jessica',kind:'user'},{name:'jessica',kind:'robot'},{name:'Tata',kind:'user'},{name:'Paris',kind:'robot'}],'');
 assert.equal(entries.length,3);
 assert.equal(entries[0].kind,'robot');
 assert.equal(mentionQuery('hi @Joe.',8),null);
 assert.equal(mentionQuery('hello there',11),null);
});
test('logarithmic scale slider spans 0.01x to 1000x without losing 1x precision',()=>{
 assert.equal(sliderToScale(0),.01);
 assert.equal(sliderToScale(400),1);
 assert.equal(sliderToScale(1000),1000);
 for(const n of [.01,.1,1,12,70,100,500,1000])assert.ok(Math.abs(sliderToScale(scaleToSlider(n))-n)<n*1e-10);
});
test('linked scale preserves proportional ratios across XYZ',()=>{
 assert.deepEqual(linkedScale({x:2,y:4,z:10},'x',6),{x:6,y:12,z:30});
 assert.deepEqual(linkedScale({x:2,y:4,z:10},'y',8),{x:4,y:8,z:20});
 assert.deepEqual(linkedScale({x:2,y:4,z:10},'z',5),{x:1,y:2,z:5});
});
test('object selection does not auto-center camera',()=>{
 const editor=read('js/editor.js');const select=editor.match(/\n select\(obj\)\{([\s\S]+?)\n updateInspector\(/)?.[1]||'';
 assert.ok(select.includes('this.selected=obj'));
 assert.doesNotMatch(select,/focusCameraOn\(/);
 assert.ok(read('js/world.js').includes('zoomOnSelectedObject(direction)'));
});
test('idle trackpad input enabled without allowing a stale drag over gizmos',()=>{
 const world=read('js/world.js');const editor=read('js/editor.js');
 assert.match(world,/const cameraAllowed=this.cameraOrbitGesture!==false/);
 assert.match(world,/this\.controls\.enabled=true;/);
 assert.match(world,/this\.controls\.touches=\{ONE:THREE\.TOUCH\.ROTATE,TWO:THREE\.TOUCH\.DOLLY_PAN\}/);
 assert.match(editor,/orbitGesture\.orphanedMove/);
 assert.match(editor,/recoverStaleOrbitPointers/);
 assert.match(editor,/this\.controlMode==='robot'&&this\.selected/);
});
test('scene/robot control chooser supports all scene robots and does not steal scene arrows',()=>{
 const editor=read('js/editor.js');const html=read('index.html');
 for(const id of ['controlModeButton','controlledRobotSelect'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(editor,/this\.controlMode=this\.controlMode==='robot'\?'scene':'robot'/);
 assert.match(editor,/this\.controlMode==='robot'&&this\.selected\?\.userData\.editorKind==='robot'/);
});
test('Add palette uses fixed search and a single scrollable, left-aligned column',()=>{
 const editor=read('js/editor.js');const css=read('styles.css');
 assert.match(editor,/head\.className='add-fixed-head'/);
 assert.match(editor,/content\.className='add-scroll-content'/);
 assert.match(css,/#addMenu \.add-scroll-content\{flex:1 1 auto/);
 assert.match(css,/justify-content:flex-start!important/);
});
test('draggable windows are raised on focus and when they become visible',()=>{
 const studio=read('js/studio.js'),css=read('styles.css');
 assert.match(studio,/window\.solviBringWindowToFront=toFront/);
 assert.match(studio,/MutationObserver\(\(\)=>\{if\(!panel\.hidden/);
 assert.match(css,/z-index:var\(--solvi-window-z,28\)!important/);
 assert.match(css,/\.drawer-shell\{z-index:680!important\}/);
});
test('Physics has compact selector/value/range, while source inputs still persist values',()=>{
 const html=read('index.html'),editor=read('js/editor.js');
 for(const id of ['objectSurfaceProperty','objectSurfaceValue','objectSurfaceRange','objectFriction','objectRestitution','scaleUniform'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(editor,/target\.dispatchEvent\(new Event\('change'/);
 assert.match(editor,/this\.physics\.sync\(obj\)/);
});

test('two-finger scroll pans the scene; Ctrl+wheel pinch remains native dolly',()=>{
 assert.equal(isTrackpadPan({ctrlKey:true,deltaMode:0,deltaX:0,deltaY:5}),false);
 assert.equal(isTrackpadPan({ctrlKey:false,deltaMode:0,deltaX:4,deltaY:3}),true);
 assert.equal(isTrackpadPan({ctrlKey:false,deltaMode:0,deltaX:0,deltaY:12}),true);
 assert.equal(isTrackpadPan({ctrlKey:false,deltaMode:1,deltaX:0,deltaY:3}),false);
 assert.equal(isTrackpadPan({ctrlKey:false,deltaMode:0,deltaX:0,deltaY:120}),false);
 const result=trackpadPanDelta(8,15,10,60,800);
 assert.ok(result.x<0&&result.y>0);
 assert.ok(Math.abs(trackpadPanDelta(0,0,10,60,800).x)<1e-12);
});
