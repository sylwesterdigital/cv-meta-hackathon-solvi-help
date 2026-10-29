import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomAutosave} from '../js/room-settings-autosave.js';

function store(){const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),raw:m};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('closing a settings drawer does not discard a pending environment edit',async()=>{
 const storage=store(),sent=[];
 const q=createRoomAutosave({storage,storagePrefix:'env-',delay:1,persist:async(room,value)=>{sent.push([room,value]);return {environment:value};}});
 q.update('main',{fogEnabled:false,floorSize:900});
 assert.equal(q.pending('main'),true);
 assert.equal(JSON.parse(storage.getItem('env-main')).floorSize,900);
 await q.flush('main');
 assert.deepEqual(sent,[['main',{fogEnabled:false,floorSize:900}]]);
 assert.equal(q.pending('main'),false);
 assert.equal(storage.getItem('env-main'),null);
});

test('rapid edits serialize writes, latest edit wins even if an old PUT resolves late',async()=>{
 const storage=store(),calls=[];let releaseFirst;
 const q=createRoomAutosave({storage,storagePrefix:'env-',delay:60000,persist:(room,value)=>{
  calls.push({room,value});if(calls.length===1)return new Promise(res=>{releaseFirst=res;});return Promise.resolve(value);
 }});
 q.update('main',{floorSize:100});const first=q.flush('main');
 q.update('main',{floorSize:300});q.update('main',{floorSize:500});
 assert.equal(calls.length,1);
 releaseFirst({floorSize:100});await first;
 await new Promise(resolve=>setTimeout(resolve,15));
 assert.equal(calls.length,2);assert.equal(calls[1].value.floorSize,500);
 assert.equal(q.pending('main'),false);
});

test('a failed save retains a durable draft and retries on reopen',async()=>{
 const storage=store(),statuses=[];let attempt=0;
 const options={storage,storagePrefix:'env-',delay:60000,onStatus:(room,state)=>statuses.push(state),persist:async(_room,value)=>{
  if(++attempt===1)throw Error('offline');return {environment:value};
 }};
 const q=createRoomAutosave(options);
 q.update('lab',{skyType:'stars'});await q.flush('lab');
 assert.equal(q.status('lab').state,'error');
 assert.equal(JSON.parse(storage.getItem('env-lab')).skyType,'stars');
 const afterReload=createRoomAutosave(options);
 assert.deepEqual(afterReload.restore('lab'),{skyType:'stars'});
 await afterReload.flush('lab');
 assert.equal(attempt,2);assert.equal(storage.getItem('env-lab'),null);
 assert.equal(afterReload.status('lab').state,'saved');
});

test('changing rooms never sends the previous room changes to the new room',async()=>{
 const storage=store(),calls=[];
 const q=createRoomAutosave({storage,storagePrefix:'policy-',delay:60000,persist:async(room,value)=>{calls.push([room,value]);}});
 q.update('main',{physics:1});q.update('lab',{physics:0,robots:'owned'});
 await q.flush('lab');await q.flush('main');
 assert.deepEqual(calls,[['lab',{physics:0,robots:'owned'}],['main',{physics:1}]]);
});

test('failed write cannot be labelled Saved and explicit retry allows recovery',async()=>{
 const storage=store();let ok=false;
 const q=createRoomAutosave({storage,storagePrefix:'policy-',delay:60000,persist:async()=>{if(!ok)throw Error('403 forbidden');}});
 q.update('main',{objects:'owned'});await q.flush('main');
 assert.equal(q.status('main').state,'error');assert.equal(q.pending('main'),true);
 ok=true;await q.flush('main');assert.equal(q.status('main').state,'saved');
});
