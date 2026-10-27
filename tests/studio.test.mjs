import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
test('chat, profile, admin and scene editor entrypoints exist',()=>{
 const html=read('index.html');
 for(const id of ['chatPanel','chatInput','modelSelect','chatFile','profileName','profileEmail','adminPassword','scenePanel','addMenu','xrButton'])assert.match(html,new RegExp(`id="${id}"`));
});
test('frontend has secure API and robot view integration without embedded API key',()=>{
 const src=read('js/studio.js');assert.match(src,/robotView\(/);assert.match(src,/\/api\/onboard/);assert.match(src,/\/api\/chat/);assert.doesNotMatch(src,/sk-[a-zA-Z0-9]{12,}/);
});
test('scene editor supports Blender shortcuts and transform controls',()=>{
 const src=read('js/editor.js');assert.match(src,/shiftKey&&e\.code==='KeyA'/);assert.match(src,/new TransformControls/);assert.match(src,/saveScene/);
});
test('Meta API stays server side and admin requires a password hash',()=>{
 const src=read('backend/server.py');assert.match(src,/MODEL_API_KEY/);assert.match(src,/ADMIN_HASH/);assert.match(src,/compare_digest/);assert.match(src,/\/responses/);
});
