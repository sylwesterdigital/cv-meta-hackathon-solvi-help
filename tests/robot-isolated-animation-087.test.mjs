import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {approachingRobotContact,permittedRobotLocomotion} from '../js/robot-contact.js';
import {animationSpeedSettings,landingClipFor,gaitCadence} from '../js/animation-tuning.js';
import {combatPhase} from '../js/robot-combat.js';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('a robot passing nearby cannot push an idle robot by proximity alone',()=>{
 const actor={x:0,y:0,z:0},target={x:.9,y:0,z:0};
 assert.equal(approachingRobotContact(actor,target,{x:.12,z:0}),false);
 assert.equal(approachingRobotContact({x:0,y:0,z:0},{x:.64,y:0,z:0},{x:-.05,z:0}),false,'moving away');
 assert.equal(approachingRobotContact(actor,{x:.5,y:2,z:0},{x:.12,z:0}),false,'other floor');
 assert.equal(approachingRobotContact(actor,{x:.66,y:0,z:0},{x:.08,z:0}),true,'real forward collision');
 assert.equal(approachingRobotContact(actor,{x:-.66,y:0,z:0},{x:-.08,z:0}),true,'collision in reverse');
 assert.equal(approachingRobotContact(actor,{x:.66,y:0,z:0},{x:0,z:.08}),false,'passing sideways');
});
test('each robot needs its own motion or actual displacement to animate',()=>{
 assert.equal(permittedRobotLocomotion({},'run',1000),false,'unrelated idle avatar');
 assert.equal(permittedRobotLocomotion({robotMode:'run',robotActualSpeed:2},'run',1000),false,'stale run state');
 assert.equal(permittedRobotLocomotion({robotLocalMotion:true},'run',1000),true);
 assert.equal(permittedRobotLocomotion({robotRemoteMotion:true},'walk',1000),true);
 assert.equal(permittedRobotLocomotion({robotGoal:{}},'walk',1000),true);
 assert.equal(permittedRobotLocomotion({robotMission:{}},'run',1000),true);
 assert.equal(permittedRobotLocomotion({robotPushState:{at:900,speed:1}},'walkBackward',1000),true);
 assert.equal(permittedRobotLocomotion({robotPushState:{at:0,speed:1}},'walk',1000),false,'expired push');
});
test('animating a moving robot leaves the other robot idle until physically pushed',()=>{
 const source=src('js/robots.js');
 const part=source.split('export function animateRobots(items,dt,onImpact=()=>{}){')[1]?.split('\n}')[0];
 assert(part);
 const fn=new Function('combatPhase','footfallRate','permittedRobotLocomotion','animationSpeedSettings','landingClipFor','gaitCadence',`return function animateRobots(items,dt,onImpact=()=>{}){${part}\n}`)(combatPhase,()=>1,permittedRobotLocomotion,animationSpeedSettings,landingClipFor,gaitCadence);
 const actions=[];
 const make=(id,mode,speed,extra={})=>({children:[],userData:{editorKind:'robot',robotMode:mode,robotActualSpeed:speed,robotAnimator:{play(m){actions.push([id,m]);},setPlaybackSpeed(){},update(){}},...extra}});
 const leader=make('leader','run',3,{robotLocalMotion:true});
 const idle=make('idle','run',3);
 fn([leader,idle],1/60);
 assert.deepEqual(actions,[['leader','run'],['idle','idle']]);
 assert.equal(idle.userData.robotPlaying,'idle');
 idle.userData.robotPushState={kind:'walkBackward',at:performance.now(),speed:1,rate:1};
 idle.userData.robotActualSpeed=1;
 fn([leader,idle],1/60);
 assert.deepEqual(actions.at(-1),['idle','walkBackward']);
 idle.userData.robotPushState.at=performance.now()-500;
 idle.userData.robotActualSpeed=0;
 fn([leader,idle],1/60);
 assert.deepEqual(actions.at(-1),['idle','idle']);
});
test('scene physics checks authoritative actor, close approach and victim proximity',()=>{
 const code=src('js/scene-physics.js');
 assert.match(code,/if\(!this\.owns\(actor\)\|\|!approachingRobotContact\(actor\.position,target\.position,actorNext\)\)return false/);
 assert.match(code,/if\(this\.owns\(object\)&&Math\.hypot\(delta\.x,delta\.z\)/);
 assert.match(code,/packet\.kind==='push'&&separation>ROBOT_CONTACT_DISTANCE\+\.22/);
 assert.match(code,/if\(this\.owns\(target\)\)target\.userData\.robotImpactVelocity/);
});
test('per-robot movement flags are assigned to selected robot and addressed network ID',()=>{
 const editor=src('js/editor.js');
 assert.match(editor,/robot\.userData\.robotLocalMotion=active\(input\)/);
 assert.match(editor,/other\.userData\.robotRemoteMotion=Boolean\(remote\.f\|\|remote\.t/);
 assert.match(editor,/other\.userData\.robotRemoteMotion=false/);
 assert.match(editor,/this\.remoteInput\.set\(packet\.id,/);
});
