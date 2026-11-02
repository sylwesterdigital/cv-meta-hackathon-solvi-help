import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('furniture inspector groups three compact vertical numeric fields and keeps variant full width',()=>{
 const css=read('styles.css'),ed=read('js/editor.js');
 assert.match(css,/#propertiesPanel #furnitureProperties #furniturePropertiesFields\.furniture-properties-fields\{/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
 assert.match(css,/\.furniture-field-full\{grid-column:1\/-1!important/);
 assert.match(ed,/furniture-field-'\+type/);
 assert.match(css,/background:var\(--ui-bg,#102538\)!important/);
});
test('editable controls own keyboard commands without moving a robot or camera',()=>{
 const studio=read('js/studio.js'),editor=read('js/editor.js');
 assert.match(studio,/for\(const type of \['keydown','keyup'\]\)document\.addEventListener/);
 assert.match(studio,/editorKeyboardField\(event\.target\).*event\.stopImmediatePropagation\(\)/);
 assert.match(studio,/robotKeys\?\.clear\?\.\(\)/);
 assert.match(editor,/if\(e\.target\?\.closest\?\.\('input,textarea,select,\[contenteditable\]'\)\)return/);
});
test('one top-of-panel camera stage hosts webcam and recorded playback without duplicate video',()=>{
 const studio=read('js/studio.js'),css=read('styles.css');
 assert.match(studio,/head\.after\(stage\)/);
 assert.match(studio,/stage\.append\(\$\('facePreview'\),\$\('composerRecorderLivePreview'\)\)/);
 assert.match(studio,/ensureCameraStage\(\)\?\.prepend\(mount\)/);
 assert.match(studio,/stage\?\.classList\.toggle\('is-playback',playback\)/);
 assert.match(css,/#webcamPanel #webcamStage > #facePreview/);
 assert.match(css,/#webcamPanel \.webcam-stage\.is-playback>\.webcam-record-actions\{display:none!important\}/);
});
test('video chat messages use authenticated direct blobs and extract preview frames',()=>{
 const s=read('js/studio.js'),p=read('js/compact-media-player.js');
 assert.match(s,/if\(info\.mime\?\.startsWith\('audio\/'\)\)return/);
 assert.match(s,/return \{\.\.\.info,\.\.\.fetched\}/);
 assert.match(p,/export function makeVideoPoster/);
 assert.match(p,/canvas\.getContext\('2d'\)\.drawImage/);
 assert.match(p,/if\(url\|\|!id\|\|!stream/);
 assert.match(p,/media\.addEventListener\('error'/);
});
test('custom SVG transport icons replace text glyphs throughout media player',()=>{
 const s=read('js/compact-media-player.js');
 for(const icon of ['play','pause','stop','record','volume','fullscreen'])assert.ok(existsSync(new URL('../assets/icons/'+icon+'.svg',import.meta.url)));
 assert.match(s,/play\.replaceChildren\(mediaIcon\(media\.paused\?'play':'pause'\)\)/);
 assert.doesNotMatch(s,/play\.textContent=media\.paused/);
});
test('pose tracker surfaces real detection errors instead of silently hiding them',()=>{
 const face=read('js/face-tracking.js');
 assert.match(face,/console\.warn\('SOLVI pose\/hand tracking frame failed',err\)/);
 assert.match(face,/Pose detection unavailable · check console/);
});

test('pending chat video shows a thumbnail instead of its WebM filename',()=>{
 const s=read('js/studio.js'),css=read('styles.css');
 assert.match(s,/preview\.src=m\.poster/);
 assert.match(s,/badge\.append\(preview,document\.createTextNode\('Video ×'\)\)/);
 assert.match(s,/async function pendingPoster\(file\)/);
 assert.match(css,/#pendingMedia \.pending-attachment:has\(img\)/);
});
