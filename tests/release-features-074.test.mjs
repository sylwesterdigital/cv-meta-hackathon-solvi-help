import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('scene uploads spawn on the camera gaze ray rather than floor-intersection at arbitrary coordinates',()=>{
 const editor=read('js/editor.js');
 assert.match(editor,/cameraDropPosition\(distance=3\.2\)/);
 assert.match(editor,/camera\.getWorldDirection\(new THREE\.Vector3\(\)\)\.normalize\(\)/);
 assert.match(editor,/point=camera\.clone\(\)\.addScaledVector\(direction,forward\)/);
 assert.match(editor,/point=this\.cameraDropPosition\(3\.2\);object\.position\.copy\(point\)/);
});

test('composer exposes record microphone, webcam and camera bookmark plus Mac quick shortcut',()=>{
 const html=read('index.html'),studio=read('js/studio.js'),bookmarks=read('js/camera-bookmarks.js');
 for(const id of ['composerMic','webcamButton','composerPhoto','bookmarkGalleryTop','cameraBookmarkQuick'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.ok(html.indexOf('id="composerMic"')<html.indexOf('id="webcamButton"'));
 assert.ok(html.indexOf('id="webcamButton"')<html.indexOf('id="composerPhoto"'));
 assert.match(studio,/composerMic'\)\.onclick=\(\)=>startRecording\(false\)/);
 assert.match(bookmarks,/event\.altKey&&event\.metaKey&&event\.code==='KeyS'/);
});

test('robot eyes 180 and 360 capture stitched original JPEGs and share as robot message',()=>{
 const studio=read('js/studio.js');
 assert.match(studio,/stitchRobotPanorama\(frames\)/);
 assert.match(studio,/panoramaMode\(frames\)!==degrees/);
 assert.match(studio,/\/api\/robots\/eyes/);
 assert.match(studio,/\/eyes\(\?:/);
 assert.match(studio,/solviPublishRobotEyes/);
});

test('primitive properties are bounded and persisted across edits, load and scene patch',()=>{
 const code=read('js/primitive-properties.js'),editor=read('js/editor.js'),backend=read('backend/server.py');
 for(const kind of ['cube','sphere','cylinder','plane','torus'])assert.match(code,new RegExp('(?:^|\\n) '+kind+':'));
 assert.match(editor,/renderPrimitiveControls\(obj\)/);
 assert.match(editor,/primitive:PRIMITIVE_FIELDS/);
 assert.match(backend,/'primitive' in o/);
 assert.match(backend,/'media','primitive','transformLocked'/);
});

test('realm gallery export/import supports JSON placeholders, full and assets gzip archives',()=>{
 const html=read('index.html'),studio=read('js/studio.js'),backend=read('backend/server.py'),util=read('backend/realm_archives.py');
 for(const id of ['realmExportMode','realmExportButton','realmImportButton','realmImportAssetsButton','realmArchiveFile'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(studio,/\/api\/realms\/import/);
 assert.match(backend,/@app\.get\('\/api\/realms\/<room_id>\/export'\)/);
 assert.match(backend,/@app\.post\('\/api\/realms\/import'\)/);
 assert.match(util,/tarfile\.open\(fileobj=stream,mode='w:gz'\)/);
 assert.match(util,/scene_placeholders/);
 assert.match(backend,/Only realm owner or admin may import assets/);
});

test('audio-orb author, date, colour, texture and CC transcript are inspectable in 3D and XR',()=>{
 const scene=read('js/scene-media.js'),editor=read('js/editor.js'),backend=read('backend/server.py'),world=read('js/world.js');
 assert.match(scene,/mediaSourceLabel/);
 assert.match(scene,/showSceneMediaCaptions/);
 assert.match(scene,/media\.orbTexture/);
 assert.match(editor,/author:media\.author\|\|window\.solviAPI/);
 assert.match(editor,/mediaHudCC/);
 assert.match(backend,/@app\.route\('\/api\/media\/<mid>\/caption'/);
 assert.match(world, /\['cc','CC',2\]/);
});
