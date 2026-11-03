import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('preset tiles add on the thumbnail, close, and have no redundant plus/Add control',()=>{
 const src=read('js/object-presets.js'),css=read('styles.css');
 assert.match(src,/preview.onclick=create/);assert.match(src,/close\(\);editor.toast\('Added preset/);
 assert.doesNotMatch(src,/add\.onclick=create/);assert.doesNotMatch(src,/actions\.append\(add/);
 assert.match(src,/className='object-preset-delete'/);assert.match(src,/className='object-preset-caption'/);
 assert.match(css,/object-preset-delete\{display:grid/);
 assert.match(css,/object-preset-image img\{display:block;width:100%;height:100%;object-fit:cover/);
});
test('thumbnail camera computes projected bounds and recentres offset or very wide geometry',()=>{
 const source=read('js/object-presets.js');const start=source.indexOf('export function presetProjectedFrustum(');
 const end=source.indexOf('export function capturePresetThumbnail(',start);
 assert.ok(start>=0&&end>start);
 class Vector3{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}applyMatrix4(){return this;}min(v){this.x=Math.min(this.x,v.x);this.y=Math.min(this.y,v.y);this.z=Math.min(this.z,v.z);return this;}max(v){this.x=Math.max(this.x,v.x);this.y=Math.max(this.y,v.y);this.z=Math.max(this.z,v.z);return this;}}
 const f=vm.runInNewContext(source.slice(start,end).replace('export ','')+'\npresetProjectedFrustum',{THREE:{Vector3},Math});
 const frustum=f({min:{x:11,y:3,z:0},max:{x:17,y:6,z:5}},{matrixWorldInverse:{}},384,256);
 assert.ok(Math.abs((frustum.left+frustum.right)/2-14)<1e-9);
 assert.ok(Math.abs((frustum.top+frustum.bottom)/2-4.5)<1e-9);
 assert.ok(frustum.right-frustum.left>6);
 assert.ok(frustum.top-frustum.bottom>3);
});
test('TV uses inspector channels and updates menu texture rather than losing a live stream',()=>{
 const src=read('js/equipment-media.js'),player=read('js/smart-media-playlist.js'),editor=read('js/editor.js');
 assert.match(src,/if\(screen&&p\?\.powered&&group.parent&&syncSmartScreen\(group,screen,p.channels/);
 assert.match(editor,/value.channels=channels/);assert.match(editor,/syncEquipmentMedia\(obj,this\)/);
 assert.match(player,/const updated=drawMenu\(prior\)/);
 assert.match(player,/prior\.channels=list/);assert.match(player,/const newIndex=playing\?list.findIndex/);
 assert.match(player,/prior\.mode==='menu'&&screenMaterial\(prior\)\?\.map!==prior\.menuTexture/);
 assert.match(player,/export function smartScreenChannelCount/);
});
