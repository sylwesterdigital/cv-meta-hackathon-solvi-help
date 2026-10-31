import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CHARACTER,characterMotion} from '../js/character-physics.js';
import {MotionController,findClip} from '../js/animations.js';
import {combatTimeline} from '../js/robot-combat.js';
const src=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('jump adds real upward velocity over multiple frames instead of a one-frame pop',()=>{
 assert(CHARACTER.jumpSpeed>5);
 let p={x:0,y:0,z:0,verticalSpeed:0},peak=0;
 for(let i=0;i<65;i++){
  const d=characterMotion(p,{x:0,y:p.y,z:0},1/60,i===0);
  p={x:0,y:p.y+d.y,z:0,verticalSpeed:d.verticalSpeed};
  peak=Math.max(peak,p.y);
 }
 assert(peak>1.35,`jump peak ${peak.toFixed(2)}m`);
});
test('jump cannot unlock during its ascending stage and fall state is distinct',()=>{
 const text=src('js/scene-physics.js');
 assert.match(text,/const climbing=state\.jumpStarted&&state\.verticalSpeed>\.05/);
 assert.match(text,/state\.grounded=resolved\.grounded&&supported&&!climbing/);
 assert.match(text,/state\.jumpStarted&&state\.wasAirborne&&state\.grounded&&!jump&&state\.verticalSpeed<=\.05/);
 assert.match(text,/object\.userData\.robotFallActive=true/);
 assert.match(text,/fallHeight>2\.5/);
 assert.match(text,/next:heavy\?'standUp':null/);
});
test('falling/landing/head and body hit use matching clips, not Walk aliases',()=>{
 const clips=['Walking','Running','Falling Idle','Falling To Landing','Falling Flat Impact','Stand Up','Head Hit','Hit to Body','Dying Backwards']
    .map(name=>({name}));
 for(const [kind,expected] of [['run','Running'],['fallingIdle','Falling Idle'],['fallingLanding','Falling To Landing'],['fallingImpact','Falling Flat Impact'],['standUp','Stand Up'],['hitHead','Head Hit'],['hitBody','Hit to Body'],['dying','Dying Backwards']])
  assert.equal(findClip(clips,kind)?.name,expected,kind);
});
test('combat impulse is scheduled before the follow-through, not on key down or after finish',()=>{
 const punch=combatTimeline('punch',2),kick=combatTimeline('kick',3);
 assert(punch.impactPhase>.35&&punch.impactPhase<.50);
 assert(kick.impactPhase>.35&&kick.impactPhase<.50);
 assert(punch.duration>.3&&kick.duration>.35);
 const p=src('js/scene-physics.js');
 assert.match(p,/type:'robot-impact'/);
 assert.match(p,/this\.applyRobotImpact\(hit\)/);
 assert.match(p,/target\.userData\.robotImpactVelocity=/);
 assert.match(p,/target\.userData\.robotReaction=/);
});
test('multiplayer input is sent frequently; scene merge keeps animation mixers and live pose',()=>{
 const editor=src('js/editor.js'),live=src('js/live.js'),backend=src('backend/server.py');
 assert.match(editor,/now-this\.lastRobotPacket>140/);
 assert.match(editor,/preserveRobotPose/);
 assert.match(editor,/if\(!preserveRobotPose\)\{obj\.position\.fromArray/);
 assert.match(editor,/this\.applyObjectPatch\(\{action:'upsert',object:entry\}\)/);
 assert.match(live,/m\.type==='robot-impact'/);
 assert.match(backend,/elif msg\.get\('type'\)=='robot-impact'/);
 assert.match(backend,/may_edit\(uid,attacker,room_policy\(room_id\),ws_admin_enabled\(\)\)/);
 assert.doesNotMatch(backend,/publish\(\{'type':'robot-impact'.*position:/);
});
test('fall or combat reactions have one-shot ownership and return to idle',()=>{
 const robots=src('js/robots.js');
 assert.match(robots,/data\.robotReaction=\{clip:reaction\.next,elapsed:0,duration:\.85\}/);
 assert.match(robots,/else data\.robotReaction=null/);
 assert.match(robots,/animator\?\.playOnce\(mode,\{rate:Math\.max\(\.35,Math\.min\(6\.5,clipSeconds\*/);
 const physics=src('js/scene-physics.js');
 assert.match(physics,/robotImpactVelocity/);
 assert.match(physics,/applyRobotImpact\(packet\)/);
});
test('default SOLVI avatar has fallback reactions rather than invisible missing clips',()=>{
 const catalog=['Backflip','Cross Punch','Falling Back Death','Falling Idle','Falling','Hook Punch','Idle','Jump','Mma Kick','Running','Throw','Walking','Wobbling'].map(name=>({name:name+'__123'}));
 for(const kind of ['falling','fallingIdle','fallingLanding','fallingImpact','hitBody','dying','run','jump'])
  assert(findClip(catalog,kind),`${kind} must find a real available clip`);
});
test('pushing another owner emits a compact impact while static objects still cannot be pushed',()=>{
 const physics=src('js/scene-physics.js');
 assert.match(physics,/if\(!this\.owns\(target\)\)\{/);
 assert.match(physics,/kind:'push',force:2\.5/);
 assert.match(physics,/this\.applyRobotImpact\(packet\);window\.solviRoomSocket\?\.send\(packet\)/);
 assert.match(physics,/target\.userData\.physics\?\.mode!=='dynamic'\|\|!this\.owns\(target\)/);
 assert.match(physics,/if\(packet\.kind!=='push'\)\{/);
 assert.match(physics,/object\.userData\.robotPushState=\{\.\.\.motion,at:performance\.now\(\)\}/);
});
