import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('avatar gallery shows inline admin unlock and clear top status with per-avatar failures',()=>{
 const html=read('index.html'),gallery=read('js/avatar-gallery.js'),lib=read('js/library-management.js');
 for(const id of ['avatarGalleryNotice','avatarGalleryAdmin','avatarGalleryAdminPassword','avatarGalleryAdminUnlock'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(gallery,/Deleting avatar/);
 assert.match(gallery,/failures\.push/);
 assert.match(gallery,/deleteLibrarySelection\('avatars',\[avatar\]\)/);
 assert.match(gallery,/window\.solviLibraryUnlockAdmin/);
 assert.match(lib,/X-Solvi-Admin/);
 assert.match(lib,/Unlock the Admin dashboard/);
});
test('ordinary 409 library/reference conflicts are not misinterpreted as an expired user session',()=>{
 const studio=read('js/studio.js');
 assert.match(studio,/res\.status===409&&\/active/);
 assert.match(studio,/res\.status===401/);
});
