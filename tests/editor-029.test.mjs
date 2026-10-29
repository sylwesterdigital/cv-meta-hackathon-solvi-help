import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EditHistory,duplicateElevation} from '../js/edit-history.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('history records reversible object state and deep-copies snapshots',()=>{
 const h=new EditHistory(10),applied=[];
 const first={id:'cube-1',position:[0,0,0]},second={id:'cube-1',position:[1,0,0]};
 h.push(null,first);h.push(first,second);second.position[0]=999;
 assert.ok(h.undo((state)=>applied.push(state)));
 assert.deepEqual(applied[0],first);
 assert.ok(h.undo((state)=>applied.push(state)));
 assert.equal(applied[1],null);
 assert.ok(h.redo((state)=>applied.push(state)));
 assert.deepEqual(applied[2],first);
 h.push(first,{id:'cube-1',position:[2,0,0]});assert.equal(h.redo(()=>{}),false);
});
test('multi-step history is bounded and skips no-op edits',()=>{
 const h=new EditHistory(3);
 assert.equal(h.push({n:1},{n:1}),false);
 for(let n=0;n<6;n++)h.push({n},{n:n+1});
 assert.equal(h.undoStack.length,3);
});
test('clone elevation never overlaps the original',()=>{
 assert.equal(duplicateElevation(1),1.16);
 assert.ok(duplicateElevation(0)>=.32);
 assert.ok(duplicateElevation(NaN)>.3);
});
test('camera uses active object pivot, no continuous spinning and no conflicting WASD bindings',()=>{
 const w=read('js/world.js');
 assert.match(w,/enableDamping=false/);
 assert.match(w,/focusCameraOn\(object\)/);
 assert.match(w,/const cameraAllowed=this.cameraOrbitGesture!==false/);
 assert.match(w,/this\.camera\.position\.add\(delta\);this\.controls\.target\.add\(delta\)/);
 assert.doesNotMatch(w,/keys\.has\('KeyW'\)|keys\.has\('KeyA'\)|keys\.has\('KeyD'\)/);
 assert.match(w,/if\(key===7\)/);assert.match(w,/if\(key===1\)/);assert.match(w,/if\(key===3\)/);
});
test('gizmo events exclude camera; editor supports undo/redo and selected object camera views',()=>{
 const e=read('js/editor.js');
 assert.match(e,/world\.editorGizmoPointer=true;world\.controls\.enabled=false/);
 assert.match(e,/orbitGesture\.press\(e\.pointerId,canOrbit\)/);
 assert.match(e,/e\.metaKey\|\|e\.ctrlKey/);
 assert.match(e,/e\.code==='KeyZ'/);
 assert.match(e,/duplicateElevation\(height\)/);
});
test('objects drag CSS no longer overrides inline positions and gallery fills images',()=>{
 const css=read('styles.css');
 assert.doesNotMatch(css,/#scenePanel\{[^\n]*top:[^;]+!important/);
 assert.match(css,/#scenePanel>\.panel-title\.drag-handle\{cursor:grab/);
 assert.match(css,/\.avatar-gallery \.avatar-card\{position:relative/);
 assert.match(css,/\.avatar-card \.avatar-preview\{position:absolute;inset:0/);
 assert.match(css,/\.avatar-card \.avatar-preview img,[^\n]*object-fit:cover/);
});
