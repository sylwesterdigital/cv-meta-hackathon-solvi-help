import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('realm switching does not clear scene before fetching, yields while building, rejects stale responses',()=>{
 const s=get('js/studio.js'),e=get('js/editor.js');
 assert.doesNotMatch(s,/editor\.revision=0;editor\.apply\(\[\]\)/);
 assert.match(e,/async applyCooperatively\(data,stillCurrent\)/);
 assert.match(e,/const yieldMain=\(\)=>new Promise\(resolve=>setTimeout\(resolve,0\)\)/);
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
 assert.match(e,/robotFaces\.hidden=robots\.length===0/);
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

test('large realm collider initialization yields instead of locking the main thread',async()=>{
 const source=get('js/scene-physics.js').replace(/^import .*;\s*$/gm,'').replace('export class ScenePhysics','class ScenePhysics');
 const ScenePhysics=new Function('CHARACTER',`${source}\nreturn ScenePhysics;`)({maxStep:.5,snapDistance:.1,slopeDegrees:45});
 let destroyed=0;
 class MockWorld{
  createCollider(){}
  createCharacterController(){return {enableAutostep(){},enableSnapToGround(){},setMaxSlopeClimbAngle(){},setMinSlopeSlideAngle(){},setApplyImpulsesToDynamicBodies(){}};}
  free(){destroyed++;}
 }
 const R={World:MockWorld,ColliderDesc:{cuboid(){return {setTranslation(){return this;}}}}};
 const editor={items:Array.from({length:120},(_,n)=>({userData:{editorId:`realm-object-${n}`}}))};
 const physics=new ScenePhysics(editor);physics.runtime=R;
 let builds=0;physics.sync=()=>{builds++;};
 const build=physics.setEnabled(true);
 assert.ok(builds>0&&builds<editor.items.length,'some colliders build immediately but not all in one uninterrupted turn');
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.ok(builds<editor.items.length,'other browser tasks can run during bulk collider creation');
 physics.setEnabled(false);
 const stoppedAt=builds;
 await build;
 assert.equal(builds,stoppedAt,'cancelled realm must not keep constructing old colliders');
 assert.equal(physics.world,null);
 assert.ok(destroyed>=1,'old Rapier world is freed on realm exit');
 await physics.setEnabled(true);
 assert.equal(builds,stoppedAt+editor.items.length,'new realm collider rebuild completes after a cancellation');
});

test('realm transition stops outgoing simulation and keeps pending saves tied to their original realm',()=>{
 const s=get('js/studio.js'),e=get('js/editor.js');
 assert.match(s,/editor\.beginRealmTransition\(room,event\.detail\.previousRoom\)/);
 assert.match(s,/editor\.endRealmTransition\(room\)/);
 assert.match(s,/Promise\.resolve\(editor\.physics\.setEnabled\(nextPhysics\)\)/);
 assert.match(e,/if\(this\.realmTransitioning\)return/);
 assert.match(e,/this\.flushPendingRoomSaves\(previousRoom\)/);
 assert.match(e,/this\.persistObject\(o,room\)/);
 assert.match(e,/if\(room===\(window\.solviRoom\|\|'main'\)\)this\.revision/);
 assert.doesNotMatch(s,/saveRealmView\(activeRoom\)/,'opening the realm chooser must not synchronously read back and encode the active WebGL frame');
});
