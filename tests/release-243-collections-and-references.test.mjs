import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {activeReferenceQuery,sceneReferenceCandidates,insertSceneReference} from '../js/chat-mentions.js';
import {cleanSceneCollection,collectionOf,groupSceneItems,memberDisplayName,creativeCollectionTitle} from '../js/scene-collections.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const id1='12345678-1234-4234-8234-123456789abc',id2='12345678-1234-4234-8234-123456789abd';
test('closest $ trigger wins over earlier @, with no @ regression',()=>{
 const text='@Albert go to $';
 assert.deepEqual(activeReferenceQuery(text,text.length),{query:'',start:text.length-1,end:text.length,type:'object'});
 assert.equal(activeReferenceQuery('@Albert',7)?.type,'person');
 assert.equal(activeReferenceQuery('hello world',11),null);
 const mixed='@Albert go to $lounge';assert.equal(activeReferenceQuery(mixed,mixed.length)?.type,'object');
});
test('current realm $ suggestions display human labels, retain immutable object IDs',()=>{
 const objects=[{id:id1,name:'SOLVI Creative · abcdefff-1234:0 · 4 · float cube',display:'Albert - Pink Elephant 001A · float cube',kind:'cube'},
 {id:id2,name:'MointainMovieLounge1-2-c',kind:'model'},{id:'robot',name:'Albert',kind:'robot'}];
 assert.equal(sceneReferenceCandidates(objects,'Pink Elephant').length,1);
 assert.equal(sceneReferenceCandidates(objects,'Lounge').length,1);
 assert.equal(sceneReferenceCandidates(objects,'Albert').length,1);
 const query=activeReferenceQuery('@Albert go to $Pink',18);
 const result=insertSceneReference('@Albert go to $Pink',query,objects[0]);
 assert.ok(result.text.includes('('+id1+')'));
 assert.ok(!result.text.includes('001A')); // human title is UI-only, original authoritative label is in the token
});
test('collection metadata is strict and does not accept arbitrary keys or objects',()=>{
 const collection={id:'group:'+id1,name:'Albert - Pink Elephant 001A'};
 assert.deepEqual(cleanSceneCollection(collection),collection);
 for(const bad of [null,{},[],{id:'bad',name:'A'},{...collection,name:' '},{...collection,evil:true}])assert.equal(cleanSceneCollection(bad),null);
});
test('legacy IDs are hidden in the UI and existing saved names remain server-recoverable',()=>{
 const obj={name:'SOLVI Creative · 996ed560-3112-4d3d-9539-aa3b25949e81:0 · 4 · float cube',userData:{}};
 assert.match(collectionOf(obj).name,/^Creative build \d{3}[A-Z]$/);
 assert.equal(memberDisplayName(obj),'float cube');
 assert.equal(obj.name.includes('996ed560'),true);
 obj.userData.sceneCollectionOptOut=true;
 assert.equal(collectionOf(obj),null);
});
test('collections group independent saved members and leave other items ungrouped',()=>{
 const group={id:'group:'+id1,name:'Pink Elephant'};
 const a={name:'Ear',userData:{sceneCollection:group}},b={name:'Trunk',userData:{sceneCollection:group}},c={name:'Lamp',userData:{}};
 const result=groupSceneItems([a,b,c]);assert.equal(result.folders.length,1);
 assert.equal(result.folders[0].items.length,2);assert.deepEqual(result.ungrouped,[c]);
});
test('new robot collections have readable titles without visible UUID fragments',()=>{
 const title=creativeCollectionTitle('Albert','Pink Elephant Metropolis',id1,0);
 assert.match(title,/^Albert - Pink Elephant Metropolis 001[A-Z]$/);
 assert.ok(!title.includes(id1));
});
test('stage selection expands, opens and scrolls to the real object row',()=>{
 const source=read('js/editor.js');
 assert.match(source,/this\.select\(node,\{revealInList:true\}\)/);
 assert.match(source,/revealSceneObject\(obj\)/);
 assert.match(source,/this\.collectionExpanded\.add\(folder\.id\)/);
 assert.match(source,/row\?\.scrollIntoView\?\.\(\{block:'center',behavior:'smooth'\}\)/);
 assert.match(read('styles.css'),/\.scene-item-row\.is-active/);
});
test('collection gizmo applies full pivot matrix and persists each editable member',()=>{
 const src=read('js/editor.js');
 assert.match(src,/beginCollectionDrag\(\)/);assert.match(src,/applyCollectionDrag\(\)/);
 assert.match(src,/new THREE\.Matrix4\(\)\.multiplyMatrices\(current\.matrixWorld/);
 assert.match(src,/local\.decompose\(object\.position,object\.quaternion,object\.scale\)/);
 assert.match(src,/this\.physics\.sync\(object\);this\.recordEdit\(before,this\.snapshot\(object\)\);this\.queueSave\(object\)/);
 assert.match(src,/this\.canEdit\(o\)&&!isTransformLocked\(o\)/);
});
test('browser and backend persist the same optional collection + opt-out schema',()=>{
 const client=read('js/editor.js'),backend=read('backend/server.py'),html=read('index.html');
 assert.match(client,/collection:o\.userData\.editorKind/);
 assert.match(client,/collectionOptOut:o\.userData\.sceneCollectionOptOut/);
 assert.match(client,/obj\.userData\.sceneCollection=cleanSceneCollection\(entry\.collection\)/);
 assert.match(backend,/def valid_scene_collection\(/);
 assert.match(backend,/if 'collection' in obj and/);
 assert.match(backend,/'seating','collection','collectionOptOut'/);
 assert.match(html,/id="sceneGroupSelected"/);
 assert.match(html,/"\.\/js\/scene-collections\.js":"\.\/js\/scene-collections\.js\?v=0\.2\.250"/);
});
