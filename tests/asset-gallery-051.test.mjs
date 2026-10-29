import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {visibleAssets,validAssetFile,validAssetURL} from '../js/asset-library.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const url=id=>`/api/scene/models/${id.repeat(32)}.glb`;
const first={url:url('a'),label:'Pink sofa',format:'glb',bytes:1234};
const second={url:`/api/scene/models/${'b'.repeat(32)}.fbx`,label:'Wooden Chair',format:'fbx',bytes:2300};
test('asset catalog only exposes authenticated server-style GLB / FBX identifiers',()=>{
 assert.equal(validAssetURL(first.url),true);assert.equal(validAssetURL(second.url),true);
 assert.equal(validAssetURL('https://bad.example/evil.glb'),false);
 assert.equal(validAssetURL('/api/scene/models/../../secret.glb'),false);
 assert.deepEqual(visibleAssets([first,second,{url:'javascript:alert(1)',label:'bad'}],'sofa'),[first]);
 assert.deepEqual(visibleAssets([first,second],'FBX'),[second]);
});
test('asset uploads accept supported formats with configured local and server limits',()=>{
 assert.equal(validAssetFile({name:'sofa.glb',size:10000}),true);
 assert.equal(validAssetFile({name:'chair.FBX',size:10000}),true);
 assert.equal(validAssetFile({name:'unknown.exe',size:10000}),false);
 assert.equal(validAssetFile({name:'oversize.glb',size:21*1024*1024}),false);
 assert.equal(validAssetFile({name:'limit.glb',size:6*1024*1024},5),false);
});
test('assets gallery is after avatars in World tools and supports upload/add/replace',()=>{
 const html=read('index.html'),editor=read('js/editor.js'),gallery=read('js/asset-gallery.js');
 assert.match(html,/avatarsButton[^<]*<\/button><button[^>]*id="assetsButton"/);
 for(const id of ['assetGalleryBackdrop','assetGalleryGrid','assetGallerySearch','assetGalleryUpload','replaceModelFile','replaceModelGallery','replaceModelInput'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(editor,/for\(const id of \['addObjectButton','objectsButton','avatarsButton','assetsButton'\]/);
 assert.match(gallery,/api\/scene\/models/);
 assert.match(gallery,/replaceSceneModel\(replacing,asset\)/);
 assert.match(gallery,/editor\.add\('model',false\)/);
 assert.match(gallery,/IntersectionObserver/);
});
test('model swap retains identity and scales while replacing collision geometry',()=>{
 const editor=read('js/editor.js'),models=read('js/scene-models.js'),physics=read('js/scene-physics.js');
 const replace=editor.slice(editor.indexOf('replaceSceneModel(obj,asset)'),editor.indexOf('changeRobotAvatar(obj,url)'));
 assert.match(replace,/obj\.userData\.editorKind!=='model'/);
 assert.match(replace,/this\.canEdit\(obj\)/);
 assert.match(replace,/this\.physics\.remove\(obj\.userData\.editorId\)/);
 assert.match(replace,/obj\.userData\.modelUrl=asset\.url/);
 assert.match(replace,/hydrateSceneModel\(obj\)/);
 assert.doesNotMatch(replace,/obj\.position\.set|obj\.scale\.set|obj\.userData\.editorId\s*=/);
 assert.match(models,/physics\.sync\(group\)/);
 assert.match(physics,/object\.scale\.toArray\(\)\.join/);
 assert.match(physics,/geometry\.boundingBox/);
 assert.match(physics,/applyQuaternion\(undoRotation\)/);
 assert.match(editor,/this\.physics\.sync\(this\.selected\);this\.recordEdit\(before/);
});
