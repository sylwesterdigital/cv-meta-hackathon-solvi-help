import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {snapWallPoint,smoothWallPoints,sanitiseWall,wallSegments} from '../js/office-wall-math.js';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('grid snapping uses selected spacing and nearest angle relative to previous point',()=>{
 assert.deepEqual(snapWallPoint({x:2.31,z:-1.21},null,{grid:true,step:.5,angle:45}),{x:2.5,z:-1});
 const point=snapWallPoint({x:2.6,z:.8},{x:0,z:0},{grid:false,angle:45});
 assert.equal(point.z,0);
 const diagonal=snapWallPoint({x:1.1,z:1.4},{x:0,z:0},{grid:false,angle:45});
 assert.ok(Math.abs(diagonal.x-diagonal.z)<.0002);
 const noSnap=snapWallPoint({x:2.31,z:-1.21},null,{grid:false,angle:0});
 assert.deepEqual(noSnap,{x:2.31,z:-1.21});
});
test('freehand smoothing rounds a sharp corner and preserves endpoints',()=>{
 const pts=[[0,0],[1,0],[2,0],[2,1],[2,2],[2,3]];
 const result=smoothWallPoints(pts,.05);
 assert.ok(result.length>pts.length,'smooth line must introduce intermediate vertices');
 assert.deepEqual(result[0],pts[0]);assert.deepEqual(result.at(-1),pts.at(-1));
 assert.ok(result.some(([x,z])=>x>1&&x<2&&z>0&&z<1),'corner must be rounded');
 assert.ok(wallSegments({points:result}).length>2);
});
test('uploaded media ID survives wall sanitisation and metadata round-trip',()=>{
 const id='afffffff-1111-4222-8333-abcdef123456';
 const w=sanitiseWall({points:[[0,0],[4,0]],texture:'custom',textureMediaId:id,height:3,width:.2});
 assert.equal(w.texture,'custom');assert.equal(w.textureMediaId,id);
 assert.deepEqual(sanitiseWall(w),w);
 assert.equal(sanitiseWall({...w,textureMediaId:'javascript:bad'}).textureMediaId,'');
});
test('wall editor draws pointer marker and temporary wireframe but edits saved wall in-place',()=>{
 const editor=read('js/editor.js');
 assert.match(editor,/draft\.cursor=point/);
 assert.match(editor,/new THREE\.RingGeometry\(/);
 assert.match(editor,/wireframe:true,depthTest:false/);
 assert.match(editor,/snapWallPoint\(raw,anchor,config\)/);
 assert.match(editor,/rebuildOfficeWall\(obj,this\.readWallOptions\(obj\.userData\.wall\?\.points\)\)/);
 assert.match(editor,/this\.wallEditOriginal=null;this\.recordEdit\(before,this\.snapshot\(target\)\)/);
 assert.match(editor,/rebuildOfficeWall\(original\.object,original\.wall\)/);
 assert.doesNotMatch(editor,/const preview=makeOfficeWall\(this\.readWallOptions\(obj\.userData\.wall/);
});
test('compact panel supports snapping, smoothing, authenticated texture upload and standard drag',()=>{
 const html=read('index.html'),css=read('styles.css'),studio=read('js/studio.js'),editor=read('js/editor.js');
 for(const id of ['wallSnap','wallGridStep','wallAngleStep','wallValueSlider','wallSmoothNow','wallSmoothStrength','wallTextureUpload','wallUploadButton'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(css,/#wallPanel \.wall-compact-fields/);
 assert.match(studio,/const panelIds=\['scenePanel','propertiesPanel','wallPanel'/);
 assert.match(editor,/window\.solviAPI\.req\('\/api\/media',\{method:'POST',body\}\)/);
 assert.match(editor,/this\.wallTextureMediaId=result\.media\.id/);
});
test('server validates custom image wall settings and archives include/remap image assets',()=>{
 const backend=read('backend/server.py'),archive=read('backend/realm_archives.py');
 assert.match(backend,/wall\.get\('texture'\)=='custom' and not media_id/);
 assert.match(backend,/wall\['textureMediaId'\]=media_map\.get/);
 assert.match(archive,/media_ids\.add\(str\(\(obj\.get\('wall'\) or \{\}\)\.get\('textureMediaId'/);
});
