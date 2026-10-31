import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('bundled avatar deletion requires an administrator and is permanent across static deployments',()=>{
 const server=read('backend/server.py'),install=read('backend/install-ubuntu.sh'),svc=read('backend/solvi-help.service.example');
 assert.match(server,/deleted_bundled_avatars/);
 assert.match(server,/if bundled and not admin_authorized\(\)/);
 assert.match(server,/bundled_avatar_references\(con,bundled\)/);
 assert.match(server,/path\.unlink\(missing_ok=True\)/);
 assert.match(install,/prune_removed_avatars\.py/);
 assert.match(install,/chown www-data:www-data \/var\/www\/solvi\.help\/assets\/avatars/);
 assert.match(svc,/ReadWritePaths=\/var\/www\/solvi\.help\/assets\/avatars/);
 assert.match(read('js/avatar-gallery.js'),/deleteLibrarySelection\('avatars',\[avatar\]\)/);
 assert.doesNotMatch(read('js/avatar-gallery.js'),/saveHidden|localStorage/);
});
test('assets use bounded page rendering and fixed-height isolated cards',()=>{
 const html=read('index.html'),gallery=read('js/asset-gallery.js'),css=read('styles.css');
 for(const id of ['assetGalleryPrev','assetGalleryNext','assetGalleryPageLabel'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(gallery,/PAGE_SIZE=12/);
 assert.match(gallery,/pageItems\(\)/);
 assert.match(css,/#assetGalleryBackdrop #assetGalleryGrid\{display:grid!important/);
 assert.match(css,/grid-auto-rows:226px!important/);
 assert.match(css,/@media\(max-width:520px\)/);
});
