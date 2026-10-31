import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CAMERA_FOLLOW_MODES,nextCameraMode,chaseSmartStep} from '../js/camera-follow.js';
const text=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('Chase Smart holds minor turns but catches up fully when threshold is exceeded',()=>{
 assert.equal(nextCameraMode('chase'),'chase-smart');
 assert.deepEqual(CAMERA_FOLLOW_MODES,['free','chase','chase-smart','orbit']);
 let step=chaseSmartStep(0,.25,35,1/30,false);assert.equal(step.yaw,0);assert.equal(step.engaged,false);
 step=chaseSmartStep(0,1.1,35,1/30,false);assert.ok(step.yaw>0);assert.equal(step.engaged,true);
 let yaw=step.yaw,engaged=step.engaged;
 for(let i=0;i<200;i++){({yaw,engaged}=chaseSmartStep(yaw,1.1,35,1/30,engaged));}
 assert.ok(Math.abs(yaw-1.1)<.03);assert.equal(engaged,false);
});
test('World Tools remain draggable as a visible mini title bar',()=>{
 const editor=text('js/editor.js'),style=text('styles.css');
 assert.match(editor,/toolsPanel\.hidden=false;toolsPanel\.classList\.toggle\('minimized',!visible\)/);
 assert.match(style,/#editorToolbox\.editor-toolbox\.minimized\{display:block!important/);
 assert.match(text('js/studio.js'),/id!=='scenePanel'\)panel\.classList\.toggle\('minimized'/);
});
test('Realm restoration and guarded asynchronous scene switching',()=>{
 const studio=text('js/studio.js'),editor=text('js/editor.js');
 assert.match(studio,/solvi-last-realm-/);
 assert.match(studio,/Promise\.all\(\[loadWorldSettings\(\),editor\.load\(\)\]\)/);
 assert.match(editor,/if\(room!==\(window\.solviRoom\|\|'main'\)\)return/);
});
test('Chat portraits and attachments reuse a single pending media request per ID',()=>{
 const studio=text('js/studio.js');
 assert.match(studio,/sharedPortraits\.set\(key,item\)/);
 assert.match(studio,/chatAttachmentCache\.set\(key,promise\)/);
 assert.match(studio,/new IntersectionObserver\(entries=>/);
 assert.match(studio,/if\(!slot\.isConnected\|\|roomAtBubble!==activeRoom\|\|renderEpoch!==chatEpoch\)return/);
});
test('Admin chat export and clear use backend session and exact realm confirmation',()=>{
 const server=text('backend/server.py'),studio=text('js/studio.js');
 assert.match(server,/@app\.get\('\/api\/admin\/room-chat\/export'\)/);
 assert.match(server,/@app\.post\('\/api\/admin\/room-chat\/clear'\)/);
 assert.match(server,/data\.get\('exact_name'\)!=title\['title'\]/);
 assert.match(studio,/activeAdminToken\(\)/);
 assert.match(studio,/function clearAllRoomChat\(/);
 assert.match(text('js/live.js'),/solvi:room-chat-cleared/);
});
