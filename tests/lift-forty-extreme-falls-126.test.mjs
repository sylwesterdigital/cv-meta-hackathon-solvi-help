import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cleanStairExtras,liftTargetHeight} from '../js/stair-extensions.js';
import {liftPanelState,liftButtonRequest,liftCallState} from '../js/lift-panel-state.js';
import {motionSnapshot,liftHeightAt,liftMotionFinished,safeLiftMotion} from '../js/lift-sync.js';
import {landingReactionFor,EXTREME_FALL_HEIGHT} from '../js/animation-tuning.js';
const source=rel=>fs.readFileSync(new URL('../'+rel,import.meta.url),'utf8');
const start=1793450000000;
const clips=['Falling Idle__001','Falling Flat Impact__002','Stand Up__003','Hard Landing__004'];

test('40-floor lifts retain level 40 in settings, timeline, panel, and both call / cabin buttons',()=>{
 const lift=cleanStairExtras({variant:'lift',lift:{levels:40,levelHeight:8,target:39,currentHeight:312,callButtons:true}}).lift;
 assert.equal(lift.levels,40);assert.equal(lift.target,39);assert.equal(lift.currentHeight,312);
 assert.equal(liftTargetHeight(lift,39),312);
 assert.equal(liftPanelState(lift,{height:312,target:39,moving:false,commanded:true}).display,40);
 assert.equal(liftPanelState(lift,{height:0,target:39,moving:true,commanded:true}).colors.length,40);
 assert.equal(liftButtonRequest(lift,{userData:{liftLevel:39}}),39);
 assert.equal(liftButtonRequest(lift,{userData:{liftLevel:40}}),null);
 assert.equal(liftCallState(lift,{height:312,target:39,moving:false,commanded:true},39),'arrived');
 const motion=motionSnapshot(312,0,2,start);
 assert.equal(safeLiftMotion(motion).fromHeight,312);
 assert.equal(liftHeightAt(motion,8,40,start+16000),280);
 assert.equal(liftHeightAt(motion,8,40,start+156000),0);
 assert.equal(liftMotionFinished(motion,8,40,start+156000),true);
});
test('Lift level bounds reject 41 floors, target 40, and motion starting above the maximum shaft',()=>{
 assert.equal(cleanStairExtras({lift:{levels:999,target:999,currentHeight:999}}).lift.levels,40);
 const motion=motionSnapshot(312,39,.5,start);
 assert.equal(safeLiftMotion(motion).target,39);
 assert.equal(safeLiftMotion({...motion,target:40}),null);
 assert.equal(safeLiftMotion({...motion,fromHeight:312.01}),null);
 assert.match(source('index.html'),/id="stairLiftLevels" type="number" min="2" max="40"/);
 assert.match(source('js/editor.js'),/Math\.min\(40,Number\(byId\('stairLiftLevels'\)/);
 assert.match(source('backend/server.py'),/\('levels',2,40\)/);
 assert.match(source('backend/server.py'),/0<=from_height<=312/);
});
test('Large lift has four-column cabin keypad instead of microscopic forty-button strip',()=>{
 const geo=source('js/office-stairs.js');
 assert.match(geo,/columns=count>12\?4:1/);
 assert.match(geo,/rows=Math\.ceil\(count\/columns\)/);
 assert.match(geo,/const keyZ=z\+\(col-\(columns-1\)\/2\)\*columnGap/);
 assert.match(geo,/liftLandingCall\(shaft,s,level,depth,trim\)/);
});
test('Extreme fall uses Falling Flat Impact then Stand Up only if both authored clips exist',()=>{
 assert.equal(EXTREME_FALL_HEIGHT,8);
 assert.deepEqual(landingReactionFor(8.01,clips),{clip:'fallingImpact',duration:1.35,elapsed:0,next:'standUp'});
 assert.deepEqual(landingReactionFor(50,['Falling Flat Impact']),{clip:'hardLanding',duration:1.25,elapsed:0,next:null});
 assert.deepEqual(landingReactionFor(50,['Stand Up']),{clip:'hardLanding',duration:1.25,elapsed:0,next:null});
 assert.deepEqual(landingReactionFor(2.9,clips),{clip:'hardLanding',duration:1.25,elapsed:0,next:null});
 assert.deepEqual(landingReactionFor(1,clips),{clip:'landing',duration:.58,elapsed:0,next:null});
});
test('Falling Flat Impact is selected at actual Rapier landing and only then chains recovery',()=>{
 const physics=source('js/scene-physics.js');
 const robots=source('js/robots.js');
 assert.match(physics,/else if\(state\.airStartAt\)\{/);
 assert.match(physics,/robotReaction=landingReactionFor\(fallHeight,object\.userData\.robotAnimator\?\.clipNames\|\|\[\]\)/);
 assert.match(robots,/else if\(reaction\.next&&reaction\.clip!=='hardLanding'\)/);
 assert.match(robots,/data\.robotReaction=\{clip:reaction\.next,elapsed:0,duration:\.85\}/);
});
