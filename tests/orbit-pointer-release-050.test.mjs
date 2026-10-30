import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OrbitGesture,recoverStaleOrbitPointers} from '../js/orbit-gesture.js';
const source=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('orbit is permitted during mouse drag only and ends with the final button release',()=>{
 const gate=new OrbitGesture();
 assert.equal(gate.orbiting,false);
 assert.equal(gate.press(1,true),true);
 assert.equal(gate.orbiting,true);
 assert.equal(gate.orphanedMove({pointerId:1,pointerType:'mouse',buttons:1}),false);
 gate.release(1);
 assert.equal(gate.orbiting,false);
 assert.equal(gate.mode,null);
 assert.equal(gate.orphanedMove({pointerId:1,pointerType:'mouse',buttons:0}),false);
});

test('a transform gizmo owns its entire gesture, including extra touch pointers',()=>{
 const gate=new OrbitGesture();
 assert.equal(gate.press(20,false),false);
 assert.equal(gate.press(21,true),false);
 assert.equal(gate.transforming,true);
 gate.release(20);
 assert.equal(gate.orbiting,false);
 gate.release(21);
 assert.equal(gate.mode,null);
 assert.equal(gate.press(22,true),true);
 gate.cancel();assert.equal(gate.orbiting,false);
});

test('two-finger orbit remains active until both touch pointers release',()=>{
 const gate=new OrbitGesture();gate.press(1,true);gate.press(2,true);
 gate.release(1);assert.equal(gate.orbiting,true);
 assert.equal(gate.orphanedMove({pointerId:2,pointerType:'touch',buttons:0}),false);
 gate.release(2);assert.equal(gate.orbiting,false);
});

test('lost mouse release, pen hover and page blur cannot continue an orbit',()=>{
 const gate=new OrbitGesture();gate.press(1,true);
 assert.equal(gate.orphanedMove({pointerId:1,pointerType:'mouse',buttons:0}),true);
 gate.cancel();assert.equal(gate.orbiting,false);
 gate.press(3,true);assert.equal(gate.orphanedMove({pointerId:3,pointerType:'pen',buttons:0}),true);
 gate.cancel();assert.equal(gate.orbiting,false);
});

test('stale Three.js pointer state is recovered only when all input pointers have released',()=>{
 const c={_pointers:[1,2],state:0,_onPointerUp({pointerId}){this._pointers=this._pointers.filter(x=>x!==pointerId);}};
 assert.equal(recoverStaleOrbitPointers(c,new Set([2])),0);
 assert.deepEqual(c._pointers,[1,2]);
 assert.equal(recoverStaleOrbitPointers(c,new Set()),2);
 assert.deepEqual(c._pointers,[]);assert.equal(c.state,-1);
 assert.equal(recoverStaleOrbitPointers(c,new Set()),0);
});

test('release lifecycle disables camera immediately and wheel dolly remains usable',()=>{
 const editor=source('js/editor.js'),world=source('js/world.js');
 assert.match(editor,/orbitGesture\.press\(e\.pointerId,canOrbit\)/);
 assert.match(editor,/window\.addEventListener\('pointerup',e=>finishGesture\(e\),true\)/);
 assert.match(editor,/window\.addEventListener\('pointercancel',e=>finishGesture\(e\),true\)/);
 assert.match(editor,/lostpointercapture/);
 assert.match(editor,/orbitGesture\.orphanedMove\(e\)/);
 assert.match(editor,/e\.solviObjectPicked=true/);
 assert.match(editor,/if\(cmd&&e.code==='KeyZ'\).*stopImmediatePropagation\(\)/);
 assert.match(world,/if\(e\.solviObjectPicked\)return/);
 assert.match(editor,/recoverStaleOrbitPointers\(this\.world\.controls,orbitGesture\.pointers\)/);
 assert.match(world,/const cameraAllowed=this\.cameraOrbitGesture!==false/);
 assert.doesNotMatch(world,/cameraOrbitGesture===null\?!axis:this\.cameraOrbitGesture/);
 assert.match(world,/this\.controls\.enabled=true;\/\/.*|this\.controls\.enabled=true;/);
 assert.match(world,/enableDamping=false/);
 assert.match(world,/autoRotate=false/);
});
