import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cleanText,TEXT_FONTS} from '../js/text-parameters.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('text values are bounded and fonts restricted',()=>{
 const t=cleanText({content:'x'.repeat(300),font:'nonexistent',size:999,extrude:-2,bevel:2});
 assert.equal(t.content.length,180);assert.equal(t.font,'helvetiker');assert.equal(t.size,12);assert.equal(t.extrude,0);assert.equal(t.bevel,.2);
 assert.deepEqual(TEXT_FONTS,['helvetiker','optimer','gentilis']);
});
test('text geometry uses actual Three TextGeometry and persistent object settings',()=>{
 const editor=read('js/editor.js'),geom=read('js/text-geometry.js'),server=read('backend/server.py');
 assert.match(geom,/new TextGeometry\(/);assert.match(geom,/new FontLoader\(\)\.loadAsync/);
 assert.match(editor,/text:o\.userData\.editorKind==='text'\?structuredClone/);
 assert.match(editor,/if\(entry\.kind==='text'\)rebuildText/);
 assert.match(editor,/renderTextGeometryControls\(obj\)/);
 assert.match(server,/def valid_text_geometry\(text\):/);
 assert.match(server,/if 'text' in obj and/);
 assert.match(read('backend/realm_archives.py'),/'curve','text','openings','transformLocked'/);
 assert.match(read('index.html'),/id="textGeometryContent"/);
});
test('render loop freezes orbit and follow while drawing, all drawing ray mappings shared',()=>{
 const world=read('js/world.js'),sketch=read('js/spatial-editor.js');
 assert.match(world,/const sketchLocked=Boolean\(this\.robotEditor\?\.curveDrawing\|\|this\.robotEditor\?\.faceDrawing\)/);
 assert.match(world,/if\(!sketchLocked\)this\.navigateCamera\(dt\)/);
 assert.match(world,/if\(!sketchLocked\)this\.updateFollowCamera\(dt\)/);
 assert.match(sketch,/function surfaceHit\(editor,e,first=false\)\{/);
 assert.match(sketch,/intersectBox\(new THREE\.Box3/);
 assert.match(sketch,/const pointFromEvent=\(\)=>\{const ray=spatialRay/);
});
test('local font assets built by watcher without any external font CDN',()=>{
 const vendor=read('scripts/prepare_vendor.mjs'),text=read('js/text-geometry.js');
 assert.match(vendor,/fonts',name\+'_regular\.typeface\.json'/);
 assert.match(text,/\.\/vendor\/three\/fonts\//);
 assert.doesNotMatch(text,/fonts\.googleapis\.com|cdn\./);
});
