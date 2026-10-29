import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {thumbnailCacheKey,readThumbnail,writeThumbnail} from '../js/thumbnail-cache.js';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('thumbnail cache keys are stable for local and uploaded avatars and preserve version',()=>{
 const a=thumbnailCacheKey('./assets/solvi-character.glb');
 const b=thumbnailCacheKey('/api/avatars/123.glb');
 assert.ok(a.includes('solvi-character.glb?_solvi_preview=portrait-416x544-v1'));
 assert.ok(b.includes('/api/avatars/123.glb?_solvi_preview=portrait-416x544-v1'));
 assert.notEqual(a,thumbnailCacheKey('./assets/solvi-character.glb','portrait-2'));
});
test('thumbnail cache saves and reads without downloading a GLB again',async()=>{
 const storage=new Map();
 globalThis.caches={open:async()=>({put:async(key,response)=>{storage.set(key,response.clone())},match:async key=>storage.get(key)?.clone()})};
 const img='data:image/webp;base64,AAAABBBB';
 await writeThumbnail('./assets/avatars/test-a.glb',img);
 assert.equal(await readThumbnail('./assets/avatars/test-a.glb'),img);
 assert.equal(storage.size,1);
 delete globalThis.caches;
});
test('gallery renders portrait previews, with limited concurrent GLB decodes, persistent cache and model cleanup',()=>{
 const gallery=read('js/avatar-gallery.js'),portrait=read('js/avatar-thumbnail.js'),renderer=read('js/preview-renderer.js');
 assert.match(gallery,/lanes=\[Promise\.resolve\(\),Promise\.resolve\(\)\]/);
 assert.match(gallery,/await readThumbnail\(url\)/);
 assert.match(gallery,/writeThumbnail\(url,snapshot\)/);
 assert.match(gallery,/disposeAvatarPreview\(gltf\.scene\)/);
 assert.match(gallery,/render\(\{append:true\}\)/);
 assert.match(gallery,/if\(existing\.has\(avatar\.url\)\)continue/);
 assert.match(gallery,/canvas\.width=AVATAR_THUMB_WIDTH;canvas\.height=AVATAR_THUMB_HEIGHT/);
 assert.match(portrait,/AVATAR_THUMB_WIDTH=416/);
 assert.match(portrait,/AVATAR_THUMB_HEIGHT=544/);
 assert.match(portrait,/scene\.background=new THREE\.Color/);
 assert.match(portrait,/type:'image\/webp'/);
 assert.match(renderer,/toDataURL\(type,quality\)/);
});
test('settings icon does not invert the entire circle to pure white',()=>{
 const css=read('styles.css');
 const idx=css.indexOf('/* v0.2.55: do not apply inverted-image filter');
 assert.ok(idx>0);
 const fix=css.slice(idx);
 assert.match(fix,/filter:none!important/);
 assert.match(fix,/config-light\.svg/);
 assert.match(fix,/background-color:var\(--ui-button\)/);
 assert.match(read('assets/ui-icons/config-light.svg'),/stroke="#ffffff"/);
});
