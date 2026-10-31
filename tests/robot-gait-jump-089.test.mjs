import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findClip,MotionController} from '../js/animations.js';
import {animationSpeedSettings,jumpAnimationKind,landingClipFor,landingAnimationKind,gaitCadence,easedStepOffset} from '../js/animation-tuning.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('walking, running and jumping playback multipliers are individually bounded and default to authored 1x',()=>{
 assert.deepEqual(animationSpeedSettings(),{walk:1,run:1,jump:1});
 assert.deepEqual(animationSpeedSettings({walk:.65,run:1.4,jump:.45}),{walk:.65,run:1.4,jump:.45});
 assert.deepEqual(animationSpeedSettings({walk:-1,run:Infinity,jump:'broken'}),{walk:1,run:1,jump:1});
 assert(gaitCadence(2.16,'walk')>=.99&&gaitCadence(2.16,'walk')<=1.01);
 assert(gaitCadence(3,'walk')<=1.06,'No automatic 1.5x speed-up of authored Walking animation');
 assert(gaitCadence(100,'run')<=1.06,'No automatic 2x run animation');
});
test('moving uses Jump while jumping in place uses Jumping; an avatar with only Jump gets a fallback',()=>{
 const clips=['Jump','Jumping','Running'].map(name=>({name}));
 assert.equal(findClip(clips,'jump')?.name,'Jump');
 assert.equal(findClip(clips,'jumping')?.name,'Jumping');
 assert.equal(jumpAnimationKind({moving:true,available:['jump','jumping']}),'jump');
 assert.equal(jumpAnimationKind({moving:false,available:['jump','jumping']}),'jumping');
 assert.equal(jumpAnimationKind({moving:false,available:['jump']}),'jump');
 const defaultClip=['Jump__124620901'].map(name=>({name}));
 assert.equal(findClip(defaultClip,'jumping')?.name,defaultClip[0].name);
});
test('landing categories use fall height and play authored clips when present',()=>{
 assert.equal(landingAnimationKind(1),'landing');
 assert.equal(landingAnimationKind(2.5),'landing');
 assert.equal(landingAnimationKind(2.51),'hardLanding');
 assert.equal(landingClipFor('landing',['landing','jump']),'landing');
 assert.equal(landingClipFor('hardLanding',['hardLanding','fallingImpact']),'hardLanding');
 assert.equal(landingClipFor('landing',['jump','fallingLanding']),'jump');
 assert.equal(landingClipFor('hardLanding',['jump','fallingImpact']),'fallingImpact');
 assert.equal(landingClipFor('standUp',['fallingImpact']),'standUp','Never replay fall impact instead of Stand Up');
});
test('small Rapier auto-steps ease the visible avatar rise without changing its collider',()=>{
 const first=easedStepOffset(0,.22,true,false,1/60);
 assert(first<-.1&&first>-.3);
 const second=easedStepOffset(first,0,true,false,1/60);
 assert(second>first&&second<0);
 assert.equal(easedStepOffset(0,1,true,false,1/60),0,'Do not disguise full-size teleports');
 assert.equal(easedStepOffset(0,.2,true,true,1/60),0,'Do not cancel real jump height');
});
test('inspector offers all three persistent playback controls using one shared slider',()=>{
 const ui=read('index.html'),ed=read('js/editor.js'),server=read('backend/server.py');
 for(const [input,kind] of [['animationWalk','walk'],['animationRun','run'],['animationJump','jump']]){
  assert.match(ui,new RegExp(`id="${input}"`));
  assert.match(ed,new RegExp(`'${input}','${kind}'`));
 }
 assert.match(ed,/animationSpeed:o\.userData\.editorKind==='robot'/);
 assert.match(ed,/robotAnimationSpeed=animationSpeedSettings\(entry\.animationSpeed\)/);
 assert.match(read('js/robots.js'),/data\.physicsCharacterActive\?9\.81:12\.5/);
 assert.match(server,/def valid_robot_animation_speed\(settings\):/);
 assert.match(server,/if 'animationSpeed' in o and not valid_robot_animation_speed/);
 assert.match(server,/if obj\['kind'\]=='robot' and 'animationSpeed' in obj and not valid_robot_animation_speed/);
});
class Action{
 constructor(clip){this.clip=clip;this.time=0;this.paused=false;}
 getClip(){return this.clip;}stop(){return this;}reset(){this.time=0;return this;}
 setEffectiveWeight(){return this;}setEffectiveTimeScale(rate){this.rate=rate;return this;}
 play(){return this;}setLoop(){return this;}crossFadeFrom(){return this;}
}
class Mixer{
 constructor(){this.actions=new Map();}
 clipAction(clip){if(!this.actions.has(clip.name))this.actions.set(clip.name,new Action(clip));return this.actions.get(clip.name);}
 update(dt){for(const action of this.actions.values())if(!action.paused)action.time+=dt*(action.rate||1);}
}
test('short jump clip can slow to match the physics flight and its landing tail can finish',()=>{
 const THREE={AnimationMixer:Mixer,LoopRepeat:2,LoopOnce:1};
 const rig=new MotionController(THREE,{},[{name:'Idle',duration:2},{name:'Jump',duration:.867},{name:'Walking',duration:1.033}]);
 rig.play('jump');rig.setPlaybackSpeed(.75);rig.update(.5);
 assert(rig.actions.get('jump').time>.35&&rig.actions.get('jump').time<.4);
 rig.playOnce('jump',{trimStart:.68,rate:.48});
 assert(rig.actions.get('jump').time>.58,'Landing fallback resumes near the end, never restarts a whole jump');
 assert.equal(rig.actions.get('jump').rate,.48);
});
