import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('administrator access lives in Profile and is shared across galleries and room operations',()=>{
 const html=read('index.html'),gallery=read('js/avatar-gallery.js'),lib=read('js/library-management.js'),studio=read('js/studio.js'),editor=read('js/editor.js');
 for(const id of ['profileAdminSection','profileAdminPassword','profileAdminUnlock','profileAdminLock','profileAdminStatus','profileAdminBadge','profileAdminDashboard','avatarGalleryNotice'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.doesNotMatch(html,/id="avatarGalleryAdminPassword"/,'no duplicate password UI inside Avatar gallery');
 assert.match(gallery,/Deleting avatar/);assert.match(gallery,/failures\.push/);assert.match(gallery,/deleteLibrarySelection\('avatars',\[avatar\]\)/);
 assert.match(gallery,/window\.solviOpenAdminProfile/);
 assert.match(lib,/X-Solvi-Admin/);
 assert.match(studio,/function activeAdminToken\(/);
 assert.match(studio,/if\(sessionAdmin&&url\.startsWith\('\/api\/'\)\)headers\['X-Solvi-Admin'\]=sessionAdmin/);
 assert.match(studio,/\/api\/admin\/logout/);
 assert.match(studio,/window\.solviIsAdmin/);
 assert.match(editor,/window\.solviIsAdmin\?\.\(\)/);
});
test('ordinary 409 library/reference conflicts are not misinterpreted as an expired user session',()=>{
 const studio=read('js/studio.js');
 assert.match(studio,/res\.status===409&&\/active/);
 assert.match(studio,/res\.status===401/);
});
