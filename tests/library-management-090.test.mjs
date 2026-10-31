import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterLibrary,hiddenAvatarStorageKey,selectionPrompt,libraryIdentifier} from '../js/library-management.js';
import {continuousGaitMode} from '../js/animation-tuning.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('avatar and asset galleries offer searchable edit selections and export/delete controls',()=>{
 const html=read('index.html'),avatars=read('js/avatar-gallery.js'),assets=read('js/asset-gallery.js'),css=read('styles.css');
 assert.match(html,/id="avatarGalleryRestore"/);
 for(const prefix of ['avatarGallery','assetGallery'])for(const suffix of ['Edit','Export','Delete','Bulk','SelectAll','Search'])assert.match(html,new RegExp('id="'+prefix+suffix+'"'));
 assert.match(avatars,/actions\} actions|actions'|actions\+|avatar\.actions/);
 assert.match(avatars,/selected\.add\(avatar\.url\)/);
 assert.match(assets,/selected\.add\(asset\.id\)/);
 assert.match(css,/\.avatar-gallery \.library-item/);
 assert.match(read('js/ui-controls.js'),/classList.contains\('asset-card'\)/);
});
test('gallery filtering excludes hidden bundled avatars and searches labels and owner',()=>{
 const entries=[{id:'a',url:'./a',label:'Cyber cat',ownerName:'Tata'},{id:'b',url:'./b',label:'Robot Woman',ownerName:'Solvi'}];
 assert.deepEqual(filterLibrary(entries,'tata').map(x=>x.id),['a']);
 assert.deepEqual(filterLibrary(entries,'robot',['./b']),[]);
 assert.notEqual(hiddenAvatarStorageKey('person-A'),hiddenAvatarStorageKey('person-B'));
 assert.equal(libraryIdentifier({id:'x'}),null);
 assert.equal(libraryIdentifier({id:'a'.repeat(32)}),'a'.repeat(32));
 assert.match(selectionPrompt([entries[0]],'avatars'),/permanently deleted/);
});
test('bulk exports are zip attachments and server enforces ownership and scene references',()=>{
 const backend=read('backend/server.py');
 assert.match(backend,/@app\.post\('\/api\/library\/delete'\)/);
 assert.match(backend,/@app\.post\('\/api\/library\/export'\)/);
 assert.match(backend,/row\['user_id'\]!=user\['id'\]/);
 assert.match(backend,/library_references\(con,kind,ids\)/);
 assert.match(backend,/zipfile\.ZipFile/);
 assert.match(backend,/glb_action_count/);
 assert.match(backend,/only the uploader or administrator can delete/i);
});
test('walking does not restart the loop on a stalled frame but returns idle after stopping',()=>{
 const data={robotActualSpeed:1.2,robotPlaying:'walk'};
 assert.equal(continuousGaitMode(data,'walk',1000),'walk');
 data.robotActualSpeed=0;
 assert.equal(continuousGaitMode(data,'walk',1010),'walk');
 assert.equal(continuousGaitMode(data,'walk',1200),'walk');
 assert.equal(continuousGaitMode(data,'walk',1235),'idle');
 assert.equal(continuousGaitMode(data,'idle',1240),'idle');
 assert.equal(data.robotGaitStoppedAt,null);
 const still={robotActualSpeed:0,robotPlaying:'idle'};
 assert.equal(continuousGaitMode(still,'run',100),'idle','stale intent cannot move in place');
});
