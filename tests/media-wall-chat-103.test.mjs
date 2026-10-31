import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {typeRobotReply} from '../js/robot-typing.js';
import {wallSegments} from '../js/office-wall-math.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('wall conversion obtains one rotatable solid for each procedural section',()=>{
 const sections=wallSegments({points:[[0,0],[4,0],[4,3]],width:.2,height:3});
 assert.equal(sections.length,2);
 assert.equal(sections[0].length,4);assert.equal(sections[1].length,3);
 assert.ok(Math.abs(sections[0].yaw)<1e-6);assert.ok(Math.abs(sections[1].yaw+Math.PI/2)<1e-6);
 const src=read('js/editor.js');
 assert.match(src,/convertWallToCuttableCubes\(\)/);
 assert.match(src,/cube\.userData\.primitive=sanitisePrimitive\('cube'/);
 assert.match(src,/this\.recordEdit\(originals,null\);this\.persistRemoval/);
 assert.match(src,/this\.physics\.sync\(cube\)/);
 assert.match(read('index.html'),/id="wallConvertStatic"/);
});

test('face media browser offers bookmarks, webcam, recordings and media upload',()=>{
 const html=read('index.html'),src=read('js/surface-media-sources.js');
 for(const id of ['surfaceBookmarkList','surfaceCameraPreview','surfaceCapturePhoto','surfaceRecordButton','surfaceUploadFile'])assert.match(html,new RegExp(`id="${id}"`));
 assert.match(src,/\/api\/bookmarks/);assert.match(src,/getUserMedia/);
 assert.match(src,/new MediaRecorder\(camera/);
 assert.match(src,/window\.solviUploadMedia\(file\)/);
 assert.match(src,/editor\.addSceneMedia\(asset,\{backing:'white',shape:'speaker',loop:false,mount\}\)/);
 assert.match(read('js/studio.js'),/window\.solviUploadMedia=file=>uploadFile\(file\)/);
});

test('webcam recording shows a live preview before the recording is stopped',()=>{
 const html=read('index.html'),studio=read('js/studio.js');
 assert.match(html,/id="composerRecorderLivePreview"/);
 assert.match(studio,/livePreview\.srcObject=recordStream/);
 assert.match(studio,/preview\.srcObject=null;preview\.hidden=true/);
 assert.match(studio,/compactMediaPlayer\(\{url:recordingUrl,kind:video\?'video':'audio',stream:false\}\)/);
});

test('robot typing reveals text progressively and then completes without altering history',()=>{
 const oldDoc=globalThis.document,oldRaf=globalThis.requestAnimationFrame,oldMatch=globalThis.matchMedia;
 try{
  globalThis.document={hidden:false};globalThis.matchMedia=()=>({matches:false});
  let callback=null;globalThis.requestAnimationFrame=fn=>{callback=fn;};
  const classes=new Set();const node={textContent:'',isConnected:true,classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}};
  typeRobotReply(node,'A quick robot response');assert.equal(node.textContent,'');assert.ok(classes.has('robot-typing'));
  callback(0);assert.equal(node.textContent,'');callback(300);
  assert.ok(node.textContent.length>0);assert.ok(node.textContent.length<22);
  callback(2000);assert.equal(node.textContent,'A quick robot response');assert.ok(!classes.has('robot-typing'));
 }finally{globalThis.document=oldDoc;globalThis.requestAnimationFrame=oldRaf;globalThis.matchMedia=oldMatch;}
});

test('reduced motion disables progressive robot typing',()=>{
 const oldDoc=globalThis.document,oldMatch=globalThis.matchMedia;
 try{globalThis.document={hidden:false};globalThis.matchMedia=()=>({matches:true});
 const node={textContent:'',classList:{add(){throw Error('Should not animate');}}};
 typeRobotReply(node,'All at once');assert.equal(node.textContent,'All at once');
 }finally{globalThis.document=oldDoc;globalThis.matchMedia=oldMatch;}
});

test('audio HLS signs media-specific expiring playback tickets',()=>{
 const server=read('backend/server.py');
 assert.match(server,/def create_hls_ticket\(mid,uid\):/);
 assert.match(server,/hmac\.new\(hls_key\(\),payload,hashlib\.sha256\)/);
 assert.match(server,/hmac\.compare_digest\(sig,check\)/);
 assert.match(server,/@app\.get\('\/api\/media\/<mid>\/hls-access'\)/);
 assert.match(server,/if not hls_authorized\(mid\)/);
 assert.match(server,/'-vn','-c:a','aac'/);
 assert.match(server,/response\.set_data/);
});

test('compact chat audio uses shared authenticated HLS playback with direct fallback',()=>{
 const audio=read('js/compact-audio-player.js'),src=read('js/compact-media-player.js');
 assert.match(audio,/compactMediaPlayer\(\{\.\.\.options,kind:'audio'\}\)/);
 assert.match(src,/media\.src=direct\.url/);
 assert.match(src,/media\.canPlayType\('application\/vnd\.apple\.mpegurl'\)/);
 assert.match(src,/progress\.oninput/);
 assert.match(src,/media\.muted=!media\.muted/);
 assert.match(read('js/chat-attachments.js'),/compactAudioPlayer\(\{url,id,label\}\)/);
});

test('scene video uses ticket-based HLS only on supporting browsers',()=>{
 const src=read('js/scene-media.js');
 assert.match(src,/media\.stream==='hls'&&video\.canPlayType/);
 assert.match(src,/hls-access/);assert.match(src,/\.catch\(\(\)=>direct\(\)\)/);
});
