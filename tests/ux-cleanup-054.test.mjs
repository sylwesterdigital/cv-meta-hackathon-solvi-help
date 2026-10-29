import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_PREFERENCES} from '../js/preferences.js';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('chat has one overlay/window/hidden cycle and never strands the reopen control',()=>{
 const html=read('index.html'),js=read('js/studio.js'),css=read('styles.css');
 assert.doesNotMatch(html,/id="messagesToggleButton"|id="closeChat"/);
 assert.match(js,/panel\.hidden\?'overlay':panel\.classList\.contains\('windowed'\)\?'hidden':'window'/);
 assert.match(js,/mode==='hidden'\?'Show chat'/);
 assert.match(js,/window\.solviSetChatMode=setMode/);
 assert.match(css,/#chatPanel\[hidden\].*display:none!important/);
});
test('realm cards use photographs as full-card backgrounds with overlaid name and participant icons',()=>{
 const renderer=read('js/realm-gallery.js'),css=read('styles.css');
 for(const token of ['realm-card-image','realm-card-title','realm-card-people','realm-card-avatar','realm-card-controls'])assert.ok(renderer.includes(token));
 assert.doesNotMatch(renderer,/image\.textContent='3D'/);
 assert.match(css,/\.realm-card-grid \.realm-card-image::after/);
 assert.match(renderer,/room\.canManage/);
});
test('room rename and double confirmation delete require owner/admin and protect main',()=>{
 const backend=read('backend/server.py'),js=read('js/studio.js'),tests=read('backend/test_api.py');
 assert.match(backend,/@app\.patch\('\/api\/rooms\/<room_id>'\)/);
 assert.match(backend,/@app\.delete\('\/api\/rooms\/<room_id>'\)/);
 assert.match(backend,/room_id=='main'/);
 assert.match(backend,/confirm_title/);
 assert.match(backend,/old\['owner_id'\]!=user\['id'\]/);
 assert.match(js,/window\.confirm\(`Permanently delete realm/);
 assert.match(js,/Second confirmation: type exactly/);
 assert.match(tests,/PASS: realm ownership, rename/);
});
test('model gallery and avatar gallery share a single GPU context, no repeated forceContextLoss',()=>{
 const shared=read('js/preview-renderer.js'),assets=read('js/asset-gallery.js'),avatars=read('js/avatar-gallery.js'),studio=read('js/studio.js');
 assert.match(shared,/let instance=null/);
 assert.match(shared,/new THREE\.WebGLRenderer/);
 assert.doesNotMatch(assets,/new THREE\.WebGLRenderer|forceContextLoss/);
 assert.doesNotMatch(avatars,/new THREE\.WebGLRenderer|forceContextLoss/);
 assert.match(assets,/IntersectionObserver/);
 assert.match(avatars,/IntersectionObserver/);
 assert.match(studio,/if\(localStorage\.getItem\(key\)\)return true;/);
 assert.match(studio,/world\.renderer\.xr\?\.isPresenting/);
});
test('borderless, shadow-free, no-blur UI and optional object delete confirmation are persisted',()=>{
 const html=read('index.html'),css=read('styles.css'),js=read('js/studio.js'),editor=read('js/editor.js');
 for(const id of ['flatButtons','noShadows','noBlur','deleteConfirm'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.equal(DEFAULT_PREFERENCES.deleteConfirm,true);
 assert.match(css,/data-flat-buttons='true'/);
 assert.match(css,/data-no-shadows='true'/);
 assert.match(css,/data-no-blur='true'/);
 assert.match(js,/\['flatButtons','flatButtons'\]/);
 assert.match(editor,/readDeleteConfirmation\(\)/);
 assert.doesNotMatch(html,/id="sceneModelPath"/);
 assert.doesNotMatch(html,/id="sceneModelControls"/);
});
test('session key and admin password fields belong to real forms; favicon is configured',()=>{
 const html=read('index.html');
 for(const id of ['elevenLabsKeyForm','metaApiKeyForm','adminPasswordForm']){
  assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,new RegExp('form="'+id+'" type="password"'));
 }
 assert.match(html,/rel="icon"/);
});
