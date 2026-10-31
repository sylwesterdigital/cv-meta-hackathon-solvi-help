import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {liftButtonRequest,liftPanelState,LIFT_BUTTON_COLORS} from '../js/lift-panel-state.js';
const source=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Five floor buttons start green and expose floor 1 at rest',()=>{
 const s=liftPanelState({levels:5,levelHeight:3,target:1},{height:0,moving:false});
 assert.equal(s.display,1);assert.deepEqual(s.colors,['idle','idle','idle','idle','idle']);
 assert.equal(LIFT_BUTTON_COLORS.idle,0x228e53);
});
test('Selected destination is red; passing floor becomes orange while travelling',()=>{
 const lift={levels:5,levelHeight:3,target:4};
 const s=liftPanelState(lift,{height:6.1,target:4,moving:true,commanded:true});
 assert.equal(s.display,3);assert.equal(s.colors[2],'passing');assert.equal(s.colors[4],'destination');assert.equal(s.colors[1],'idle');
 const arrived=liftPanelState(lift,{height:12,target:4,moving:false,commanded:true});
 assert.equal(arrived.display,5);assert.equal(arrived.colors[4],'destination');
 const down=liftPanelState(lift,{height:4.7,target:0,moving:true,commanded:true});
 assert.equal(down.display,3);assert.equal(down.colors[2],'passing');assert.equal(down.colors[0],'destination');
});
test('Button input validates requested level 0..N-1 and rejects stale controls',()=>{
 const lift={levels:5};
 assert.equal(liftButtonRequest(lift,{userData:{liftLevel:4}}),4);
 assert.equal(liftButtonRequest(lift,{userData:{liftLevel:5}}),null);
 assert.equal(liftButtonRequest(lift,{userData:{liftLevel:-1}}),null);
 assert.equal(liftButtonRequest(lift,{userData:{liftLevel:1.5}}),null);
 assert.equal(liftButtonRequest(lift,null),null);
});
test('In-world control meshes are built with labelled buttons and an inside floor readout',()=>{
 const src=source('js/office-stairs.js');
 assert.match(src,/function liftControlColumn\(/);assert.match(src,/liftControlColumn\(group,s,1,false\)/);assert.match(src,/liftControlColumn\(group,s,1,true\)/);
 assert.match(src,/userData\.liftLevel=level/);assert.match(src,/userData\.liftButton=true/);assert.match(src,/label\.userData\.liftButton=true/);
 assert.match(src,/function liftFloorReadout\(/);assert.match(src,/userData\.liftReadout=/);
 assert.match(src,/export function updateLiftPanel/);
});
test('Pointer and WebXR controller trigger the same guarded floor action',()=>{
 const editor=source('js/editor.js'),world=source('js/world.js');
 assert.match(editor,/hitLiftButton\(raycaster\)/);assert.match(editor,/activateLiftButton\(button\)/);
 assert.match(editor,/!this\.canEdit\(device\)/);assert.match(editor,/front\.distance<hit\.distance-\.02/);assert.match(editor,/startLift\(device,target\)/);
 assert.match(world,/selection\.liftButton/);assert.match(world,/activateLiftButton\(selection\.liftButton\)/);
 assert.match(world,/hitLiftButton\?\.\(this\.raycaster\)/);
});
test('Start and arrival use WebAudio cues, no network files or per-frame geometry rebuilding',()=>{
 const src=source('js/stair-transport.js'),audio=source('js/lift-chimes.js');
 assert.match(src,/liftChime\('start'\)/);assert.match(src,/liftChime\('arrival'\)/);
 assert.match(src,/updateLiftPanel\(device\)/);assert.doesNotMatch(src,/rebuildOfficeStairs\(/);
 assert.match(audio,/createOscillator\(/);assert.match(audio,/createGain\(/);assert.match(audio,/exponentialRampToValueAtTime/);
});
