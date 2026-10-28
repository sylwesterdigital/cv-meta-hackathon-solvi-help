import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('chat has a draggable/minimizable composer, last-message scroll and attach menu',()=>{
 const html=src('index.html'),js=src('js/studio.js'),css=src('styles.css');
 for(const id of ['chatComposer','composerMove','composerMinimize','composerFloat','attachmentButton','attachmentMenu','attachRobotOption'])assert.match(html,new RegExp(`id="${id}"`));
 for(const f of ['scrollChatToLatest','composer-floating','pointerdown','attachRobotOption','await send()'])assert.ok(js.includes(f),f);
 assert.ok(css.includes('#chatPanel .chat-feed{min-height:0!important'));assert.ok(css.includes('scroll-padding-bottom'));
});
test('object list has filtered search, select all and guarded persistent bulk delete',()=>{
 const html=src('index.html'),js=src('js/editor.js');
 for(const id of ['sceneObjectSearch','sceneObjectFilter','sceneSelectAll','sceneDeleteSelected','sceneDeleteAll'])assert.ok(html.includes(`id="${id}"`),id);
 for(const f of ['visibleSceneItems(){','removeBulk(all){','this.canEdit(o)','window.confirm(','this.remove();'])assert.ok(js.includes(f),f);
});
test('CC has bounded browser recognition recovery and fallback to Ubuntu Whisper',()=>{
 const code=src('js/voice-captions.js');
 for(const f of ['retries>4','fallback()','serverStart(id)','enabled&&id===epoch','CC:']){
  if(f==='CC:')continue;assert.ok(code.includes(f),f);
 }
 assert.ok(src('js/studio.js').includes("'CC: '+text.trim()"));
});
test('webcam panel exposes separate webcam, face, hand and waves controls',()=>{
 const html=src('index.html'),face=src('js/face-tracking.js');
 for(const id of ['webcamPanel','webcamButton','facePreviewToggle','posePreviewToggle','wavesPreviewToggle'])assert.ok(html.includes(`id="${id}"`),id);
 for(const f of ['ensureCamera()','faceEnabled','poseEnabled','classifyHandGesture','showGestureInWorld'])assert.ok(face.includes(f),f);
});
test('gesture classifier ignores malformed input and recognizes a single raised index finger',async()=>{
 const {classifyHandGesture}=await import('../js/hand-gestures.js');
 assert.equal(classifyHandGesture(null),null);
 const p=Array.from({length:21},()=>({x:.5,y:.6}));
 for(const [mcp,pip,tip] of [[5,6,8],[9,10,12],[13,14,16],[17,18,20]]){p[mcp]={x:.5,y:.6};p[pip]={x:.5,y:.58};p[tip]={x:.5,y:.585};}
 p[8]={x:.5,y:.32};assert.equal(classifyHandGesture(p),'point');
});
test('hidden webcam tracker buttons remain hidden despite global icon display rules',()=>{
 const css=src('styles.css');assert.ok(css.includes('#toolboxActions #faceButton[hidden]'));assert.ok(css.includes('#toolboxActions #poseButton[hidden]'));
});
