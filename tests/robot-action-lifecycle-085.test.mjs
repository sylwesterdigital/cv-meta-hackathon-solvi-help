import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {combatTimeline,combatPhase,combatClip} from '../js/robot-combat.js';
import {pushedWalkState} from '../js/robot-push.js';
import {MotionController} from '../js/animations.js';
import {animationSpeedSettings,landingClipFor,gaitCadence} from '../js/animation-tuning.js';
import {permittedRobotLocomotion} from '../js/robot-contact.js';
const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const robotSource=src('js/robots.js');
function harness(){
 const body=robotSource.split('export function animateRobots(items,dt,onImpact=()=>{}){')[1]?.split('\n}')[0];
 assert.ok(body?.length>200);
 const anim=new Function('combatPhase','footfallRate','permittedRobotLocomotion','animationSpeedSettings','landingClipFor','gaitCadence',`return function animateRobots(items,dt,onImpact=()=>{}){${body}\n}`)(combatPhase,(s)=>Math.max(.9,Math.min(2.3,s/1.25)),permittedRobotLocomotion,animationSpeedSettings,landingClipFor,gaitCadence);
 const calls=[];
 const animator={clipDuration:()=>2,play(mode){calls.push(['play',mode]);},playOnce(mode,timing){calls.push(['once',mode,timing.rate]);},setPlaybackSpeed(speed){calls.push(['rate',speed]);},update(dt){calls.push(['update',dt]);}};
 const bot={children:[],userData:{editorKind:'robot',robotMode:'walk',robotActualSpeed:1.8,robotLocalMotion:true,robotAnimator:animator}};
 return {anim,bot,calls};
}
test('walking cadence uses current resolved speed, no contact push for fixed obstacles',()=>{
 const {anim,bot,calls}=harness();
 anim([bot],1/60);
 assert.deepEqual(calls[0],['play','walk']);
 assert(calls.some(c=>c[0]==='rate'&&c[1]>=.85&&c[1]<=1.05));
 bot.userData.robotActualSpeed=0;anim([bot],1/60);
 assert(calls.some(c=>c[0]==='play'&&c[1]==='idle'));
 assert(!calls.some(c=>c[1]==='push'));
 const physics=src('js/scene-physics.js');
 assert.doesNotMatch(physics,/actualHorizontal<desiredHorizontal\*\.4/);
 assert.match(physics,/target\.userData\.physics\?\.mode!=='dynamic'/);
 assert.match(physics,/noteDynamicPush\(object,delta,desiredHorizontal\)/);
});
test('jump remains in the mixer until explicit ground confirmation',()=>{
 const {anim,bot,calls}=harness();
 bot.userData.robotJumpActive=true;
 anim([bot],.016);assert.deepEqual(calls[0],['play','jump']);
 bot.userData.robotMode='walk';bot.userData.robotActualSpeed=2;
 anim([bot],.016);assert.equal(calls.filter(c=>c[0]==='play').at(-1)[1],'jump');
 bot.userData.robotJumpActive=false;
 anim([bot],.016);assert.equal(calls.filter(c=>c[0]==='play').at(-1)[1],'walk');
 assert.match(src('js/scene-physics.js'),/state\.wasAirborne&&state\.grounded&&!jump/);
});
test('punch and kick are one-shot with a single mid-clip impulse, never key-down impact',()=>{
 const {anim,bot,calls}=harness();const impacts=[];
 const timing=combatTimeline('punch',2);
 assert(timing.rate>2.7&&timing.duration<.7);
 assert(combatTimeline('kick',2).impactPhase>.35&&combatTimeline('kick',2).impactPhase<.5);
 bot.userData.robotOneShot={kind:'punch',clip:'clip:Hook Punch',timing,force:7,remote:false,elapsed:0,duration:timing.duration,impactPhase:timing.impactPhase,impactDone:false};
 const tick=dt=>anim([bot],dt,(...args)=>impacts.push(args));
 tick(.05);assert.equal(impacts.length,0);
 assert(calls.some(c=>c[0]==='once'&&c[1]==='clip:Hook Punch'));
 tick(.27);assert.equal(impacts.length,1);assert.equal(impacts[0][1],'punch');
 tick(.3);tick(.1);assert.equal(impacts.length,1);
 assert.equal(bot.userData.robotOneShot,null);
 const editor=src('js/editor.js');
 assert.doesNotMatch(editor,/this\.physics\.applyCombat\(robot,action,force\)/);
 assert.match(editor,/animateRobots\(this\.items,dt,\(actor,kind,force,remote\)=>\{[\s\S]*?this\.physics\.applyCombat\(actor,kind,force,remote\)/);
 assert.match(editor,/this\.playRobotCombat\(robot,packet\.action,packet\.force,true\)/);
});
test('pushed robot chooses backwards or sideways steps from actual displacement',()=>{
 assert.equal(pushedWalkState({x:0,z:-.09},0,.03).kind,'walkBackward');
 assert.equal(pushedWalkState({x:0,z:.09},0,.03).kind,'walk');
 assert.equal(pushedWalkState({x:.09,z:0},0,.03).kind,'strafeRight');
 assert.equal(pushedWalkState({x:-.09,z:0},0,.03).kind,'strafeLeft');
 assert(pushedWalkState({x:0,z:-.09},0,.03).rate>=.9);
});
class Action{
 constructor(clip){this.clip=clip;this.time=0;this.paused=false;this.scale=1;}
 getClip(){return this.clip;}reset(){this.time=0;return this;}setEffectiveWeight(){return this;}
 setEffectiveTimeScale(x){this.scale=x;return this;}play(){return this;}stop(){return this;}
 setLoop(loop){this.loop=loop;return this;}crossFadeFrom(){return this;}
}
class Mixer{
 constructor(){this.a=new Map();}clipAction(c){if(!this.a.has(c.name))this.a.set(c.name,new Action(c));return this.a.get(c.name);}
 update(dt){for(const a of this.a.values())if(!a.paused)a.time+=dt*a.scale;}
}
test('mixer plays a trimmed, accelerated once-only clip and releases held pose',()=>{
 const robot=new MotionController({AnimationMixer:Mixer,LoopOnce:1,LoopRepeat:2},{},[{name:'Idle',duration:3},{name:'Walking',duration:2},{name:'Hook Punch',duration:2}]);
 const timing=combatTimeline('punch',2);
 robot.playOnce('clip:Hook Punch',timing);
 const a=robot.actions.get('clip:Hook Punch');
 assert.equal(a.loop,1);assert(a.time>.09);assert(a.scale>2.5);
 robot.update(.8);assert(a.paused);assert(a.time<2);
 robot.play('walk');assert.equal(robot.currentKind,'walk');assert.equal(robot.oneShotStopAt,null);
});
test('only dynamic physics targets receive impulses, including surface hits',()=>{
 const s=src('js/scene-physics.js');
 assert.match(s,/new THREE\.Box3\(\)\.setFromObject\(target\)/);
 assert.match(s,/combatContact\(box,actor\.position,actor\.rotation\.y,kind\)/);
 assert.match(src('js/robot-combat.js'),/const x=clamp\(actor\.x,bounds\.min\.x,bounds\.max\.x\)/);
 assert.match(s,/target\.userData\.physics\?\.mode!=='dynamic'/);
 assert.match(s,/if\(!this\.owns\(target\)\)\{hits\+\+;continue;\}/);
 assert.match(s,/if\(!body\.isDynamic\?\.\(\)\)continue/);
 assert.match(s,/body\.applyImpulse\(impulse,true\)/);
});
