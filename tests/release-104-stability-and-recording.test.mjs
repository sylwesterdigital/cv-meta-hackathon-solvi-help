import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('realm switching does not clear scene before fetching, yields while building, rejects stale responses',()=>{
 const s=get('js/studio.js'),e=get('js/editor.js');
 assert.doesNotMatch(s,/editor\.revision=0;editor\.apply\(\[\]\)/);
 assert.match(e,/async applyCooperatively\(data,stillCurrent\)/);
 assert.match(e,/await new Promise\(resolve=>requestAnimationFrame\(resolve\)\)/);
 assert.match(e,/ticket!==this\.sceneLoadTicket/);
 assert.match(e,/if\(!stillCurrent\(\)\)return false/);
});
test('World Settings leaves current GPU and Rapier state intact if values are unchanged',()=>{
 const s=get('js/studio.js'),p=get('js/scene-physics.js');
 assert.match(s,/if\(lastAppliedPhysics!==nextPhysics\)/);
 assert.match(s,/if\(lastAppliedPolicyRoom!==requestedRoom\)/);
 assert.match(s,/JSON\.stringify\(world\.environment\)!==JSON\.stringify\(live\)/);
 assert.match(p,/if\(!this\.enabled&&!this\.world&&!this\.loading\)return/);
});
test('chat pagination prevents huge microtask-only realm rebuilds',()=>{
 const s=get('js/studio.js');
 assert.match(s,/let chatVisibleLimit=180/);
 assert.match(s,/timeline\.slice\(-chatVisibleLimit\)/);
 assert.match(s,/if\(\+\+painted%16===0\)await new Promise\(resolve=>requestAnimationFrame\(resolve\)\)/);
 assert.match(s,/chatVisibleLimit\+=180/);
});
test('robot control uses profile portraits with fallback and no visible dropdown',()=>{
 const h=get('index.html'),e=get('js/editor.js'),css=get('styles.css');
 assert.match(h,/id="controlledRobotFaces"/);
 assert.match(e,/robotFaces\.hidden=this\.controlMode!=='robot'/);
 assert.match(e,/bot\.userData\.robotBrain\?\.portrait/);
 assert.match(e,/window\.solviAPI\.mediaBlob\(portrait\)/);
 assert.match(css,/robot-face-avatar/);
});
test('My Camera records, pauses, resumes and shares with chat or surface, with capability-based virtual view',()=>{
 const h=get('index.html'),s=get('js/studio.js'),face=get('js/face-tracking.js'),spatial=get('js/spatial-editor.js');
 for(const id of ['webcamRecord','webcamPause','webcamStop','webcamXRRecord','composerRecorderPause','composerRecorderFrame'])assert.ok(h.includes(`id="${id}"`),id);
 assert.match(s,/recordStream=new MediaStream\(sourceStream\.getVideoTracks\(\)\.map\(track=>track\.clone\(\)\)\)/);
 assert.match(s,/recorder\.pause\(\)/);assert.match(s,/recorder\.resume\(\)/);
 assert.match(s,/canvas\.captureStream\(15\)/);assert.match(s,/surfaceDirectMedia=m/);
 assert.match(spatial,/editor\.surfaceDirectMedia/);assert.match(face,/preview\.srcObject=stream/);
});
test('chat page down is bottom centered and participant portraits are fifty percent larger',()=>{
 const css=get('styles.css');
 assert.match(css,/#chatPanel \.chat-page-down\{right:auto!important;left:50%!important/);
 assert.match(css,/#chatFeed \.chat-avatar\{width:calc\(30px \* 1\.5\)!important/);
});
