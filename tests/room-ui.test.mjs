import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
test('initial world contains no roaming avatar or starter cubes',()=>{
 const main=read('js/main.js'),world=read('js/world.js');
 assert.doesNotMatch(main,/^world\.loadAvatar\(\)/m);
 assert.match(world,/for\(let i=0;i<0;i\+\+\)/);
 assert.match(world,/this\.allowFloorWalk=false/);
});
test('chat uses identity and active room',()=>{
 const ui=read('js/studio.js'),server=read('backend/server.py');
 assert.match(ui,/entry\.user_id===me\?\.id/);
 assert.match(ui,/room:activeRoom/);
 assert.match(server,/WHERE messages\.room_id=\?/);
 assert.match(server,/FROM room_scenes WHERE room_id=\?/);
 assert.match(server,/room_id=room_id/);
});
test('floating editor drag and Enter-to-add have accessible DOM',()=>{
 const html=read('index.html'),editor=read('js/editor.js'),studio=read('js/studio.js');
 for(const id of ['propertiesPanel','scenePanel','addMenu','roomSelect','faceButton'])assert.match(html,new RegExp(`id="${id}"`));
 assert.match(editor,/event\.key==='Enter'/);
 assert.match(studio,/setPointerCapture/);
 assert.match(editor,/world\.editorDragging/);
});
test('FaceCap and required compressed GLB loaders are present',()=>{
 const world=read('js/world.js'),prepare=read('scripts/prepare_vendor.mjs');
 assert.match(world,/MeshoptDecoder/);assert.match(world,/KTX2Loader/);assert.match(world,/morphTargetDictionary/);
 assert.match(prepare,/meshopt_decoder\.module\.js/);assert.match(prepare,/libs', 'basis'/);
 assert.ok(statSync(new URL('assets/facecap.glb',root)).size>300000);
});
