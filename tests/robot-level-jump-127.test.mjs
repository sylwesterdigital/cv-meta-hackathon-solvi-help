import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isLevelJumpLanding,jumpResumeMode,LEVEL_JUMP_LANDING_TOLERANCE,landingReactionFor} from '../js/animation-tuning.js';
import {permittedRobotLocomotion} from '../js/robot-contact.js';
import {animationSpeedSettings,landingClipFor,gaitCadence,continuousGaitMode} from '../js/animation-tuning.js';
import {combatPhase} from '../js/robot-combat.js';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('all robot avatars skip Landing for a simple near-level deliberate jump',()=>{
 assert.equal(LEVEL_JUMP_LANDING_TOLERANCE,.35);
 for(const avatar of ['Jess','Default robot','Custom GLB','Remote robot']){
  const jump={jumpStarted:true,fallHeight:.12,fallActive:false,avatar};
  assert.equal(isLevelJumpLanding(jump),true,`${avatar} must resume gait without Landing`);
  assert.equal(isLevelJumpLanding({...jump,fallHeight:.35}),true);
 }
 assert.equal(isLevelJumpLanding({jumpStarted:true,fallHeight:0}),true);
});

test('real ledge falls and hard/extreme impacts keep their physical landing reactions',()=>{
 assert.equal(isLevelJumpLanding({jumpStarted:false,fallHeight:.1}),false);
 assert.equal(isLevelJumpLanding({jumpStarted:true,fallHeight:.36}),false);
 assert.equal(isLevelJumpLanding({jumpStarted:true,fallHeight:3}),false);
 assert.equal(isLevelJumpLanding({jumpStarted:true,fallHeight:.03,fallActive:true}),false);
 assert.equal(landingReactionFor(2.6).clip,'hardLanding');
 assert.equal(landingReactionFor(12,['Falling Flat Impact','Stand Up']).clip,'fallingImpact');
});

test('jump return mode follows each robot own movement state instead of forcing idle',()=>{
 assert.equal(jumpResumeMode({robotVelocity:3.1,robotJumpReturnMode:'run'}),'run');
 assert.equal(jumpResumeMode({robotVelocity:1.6,robotJumpReturnMode:'walk'}),'walk');
 assert.equal(jumpResumeMode({robotVelocity:-2,robotJumpReturnMode:'run'}),'walkBackward');
 assert.equal(jumpResumeMode({robotLateral:1.1}),'strafeLeft');
 assert.equal(jumpResumeMode({robotLateral:-1.1}),'strafeRight');
 assert.equal(jumpResumeMode({robotJumpReturnMode:'run'}),'idle');
});

test('both Rapier-owned and non-Rapier jump completions skip a gratuitous Landing clip',()=>{
 const physics=src('js/scene-physics.js'),robots=src('js/robots.js');
 assert.match(physics,/if\(isLevelJumpLanding\(\{jumpStarted:state\.jumpStarted,fallHeight,fallActive:object\.userData\.robotFallActive\}\)\)\{/);
 assert.match(physics,/object\.userData\.robotReaction=null/);
 assert.match(physics,/object\.userData\.robotMode=jumpResumeMode\(object\.userData\)/);
 assert.doesNotMatch(physics,/object\.userData\.robotMode='idle';object\.userData\.robotArrived=true/);
 assert.match(robots,/robot\.userData\.robotJumpReturnMode=prior==='run'\?'run':previouslyMoving\?'walk':'idle'/);
 assert.match(robots,/robot\.userData\.robotReaction=null/);
 assert.match(robots,/mode=jumpResumeMode\(robot\.userData\)/);
});

test('running avatar re-enters run directly from jump without Landing or Idle animation',()=>{
 const source=src('js/robots.js');
 const chunk=source.split('export function animateRobots(items,dt,onImpact=()=>{}){')[1]?.split('\n}')[0];
 assert.ok(chunk?.length>200);
 const tick=new Function('combatPhase','footfallRate','permittedRobotLocomotion','animationSpeedSettings','landingClipFor','gaitCadence','continuousGaitMode',`return function animateRobots(items,dt,onImpact=()=>{}){${chunk}\n}`)(combatPhase,()=>1,permittedRobotLocomotion,animationSpeedSettings,landingClipFor,gaitCadence,continuousGaitMode);
 const calls=[];
 const animator={play:mode=>calls.push(['play',mode]),playOnce:mode=>calls.push(['once',mode]),clipDuration:()=>1,setPlaybackSpeed:()=>{},update:()=>{}};
 const data={editorKind:'robot',robotMode:'jump',robotJumpActive:true,physicsAirborne:true,robotJumpClip:'jump',robotLocalMotion:true,robotActualSpeed:3.1,robotVelocity:3.1,robotJumpReturnMode:'run',robotAnimator:animator};
 const robot={userData:data,children:[]};
 tick([robot],.016);
 assert(calls.some(([action,clip])=>action==='play'&&clip==='jump'));
 data.robotJumpActive=false;data.physicsAirborne=false;data.robotReaction=null;
 data.robotMode=jumpResumeMode(data);
 tick([robot],.016);
 assert.equal(calls.at(-1)?.[1],'run');
 assert(!calls.some(([action,clip])=>clip==='landing'||clip==='hardLanding'||clip==='fallingLanding'));
 assert(!calls.some(([action,clip])=>action==='play'&&clip==='idle'));
});
