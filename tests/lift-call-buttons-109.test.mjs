import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cleanStairExtras} from '../js/stair-extensions.js';
import {liftButtonRequest,liftCallState,LIFT_CALL_COLORS} from '../js/lift-panel-state.js';
const source=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Landing call buttons are optional by default; valid sides survive sanitisation',()=>{
 const original=cleanStairExtras({variant:'lift'}).lift;
 assert.equal(original.callButtons,false);assert.equal(original.callSide,'right');
 for(const side of ['left','right']){
  const cfg=cleanStairExtras({variant:'lift',lift:{levels:5,callButtons:true,callSide:side}}).lift;
  assert.equal(cfg.callButtons,true);assert.equal(cfg.callSide,side);
 }
 assert.equal(cleanStairExtras({lift:{callButtons:'yes',callSide:'invalid'}}).lift.callButtons,false);
});
test('Call lights use red idle, orange requested and green at arrival',()=>{
 assert.equal(LIFT_CALL_COLORS.idle,0xc83246);
 const lift={levels:5,levelHeight:3,target:4,currentHeight:0};
 assert.equal(liftCallState(lift,{height:0,target:4,moving:false,commanded:false},4),'idle');
 assert.equal(liftCallState(lift,{height:5,target:4,moving:true,commanded:true},4),'requested');
 assert.equal(liftCallState(lift,{height:12,target:4,moving:false,commanded:true},4),'arrived');
 assert.equal(liftCallState(lift,{height:12,target:4,moving:false,commanded:true},2),'idle');
 assert.equal(liftCallState(lift,{height:6,target:0,moving:true,commanded:true},0),'requested');
});
test('Landing button and floor columns share the guarded destination request',()=>{
 const lift={levels:5};
 assert.equal(liftButtonRequest(lift,{userData:{liftButton:true,liftCallButton:true,liftLevel:3}}),3);
 assert.equal(liftButtonRequest(lift,{userData:{liftButton:true,liftCallButton:true,liftLevel:5}}),null);
 const editor=source('js/editor.js');
 assert.match(editor,/lift\.traverse\(part=>\{if\(part\.userData\.liftButton\)buttons\.push\(part\);\}\)/);
 assert.match(editor,/activateLiftButton\(button\)/);
 assert.match(editor,/!this\.canEdit\(device\)/);
 assert.match(editor,/startLift\(device,target\)/);
});
test('Per-floor stations remain on stationary shaft, left/right of front landing exit',()=>{
 const geometry=source('js/office-stairs.js');
 assert.match(geometry,/if\(lift\.callButtons\)liftLandingCall\(shaft,s,level,depth,trim\)/);
 assert.match(geometry,/s\.lift\.callSide==='left'\?-1:1/);
 assert.match(geometry,/const x=side\*\(s\.width\/2\+\.25\)/);
 assert.match(geometry,/shaft\.position\.y=-\(lift\.currentHeight\|\|0\)/);
 assert.match(geometry,/liftCallButton=true/);
 assert.match(geometry,/group\.traverse\(child=>/);
 const runtime=source('js/stair-transport.js');
 assert.match(runtime,/child\.userData\.stairShaft\)child\.position\.y=-runtime\.height/);
});
test('World tool offers an opt-in checkbox and side selector, with edit persistence',()=>{
 const html=source('index.html'),editor=source('js/editor.js');
 assert.match(html,/id="stairLiftCallButtons" type="checkbox"/);
 assert.match(html,/id="stairLiftCallSide"/);
 assert.match(editor,/callButtons:get\('stairLiftCallButtons'\)/);
 assert.match(editor,/callSide:get\('stairLiftCallSide'\)/);
 assert.match(editor,/stairLiftCallButtons:config\.lift\.callButtons/);
});
test('Server bounds new lift fields, retains legacy payloads, refuses unsupported fields',()=>{
 const server=source('backend/server.py');
 assert.match(server,/set\(lift\)-base_lift_keys-\{'callButtons','callSide','motion'\}/);
 assert.match(server,/\('callSide',\('left','right'\)\)/);
 assert.match(server,/\('callButtons',\) if 'callButtons' in lift/);
});
