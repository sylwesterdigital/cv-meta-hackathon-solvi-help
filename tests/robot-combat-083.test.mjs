import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {combatSettings,combatForKey,combatClip,footfallRate,impactImpulse,combatDirection,combatReach} from '../js/robot-combat.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('punch and kick keys are configurable, may be disabled and use bounded forces',()=>{
 const initial=combatSettings();
 assert.equal(combatForKey('KeyP',initial),'punch');
 assert.equal(combatForKey('KeyK',initial),'kick');
 assert.equal(combatForKey('KeyT',initial),'throw');
 assert.equal(combatForKey('KeyP',combatSettings({punch:{key:'',force:999}})),null);
 assert.equal(combatSettings({punch:{key:'',force:999}}).punch.force,20);
 assert.equal(combatSettings({kick:{key:'KeyQ',force:-200}}).kick.force,.5);
 assert.equal(combatForKey('KeyQ',{kick:{key:'KeyQ',force:2}}),'kick');
});

test('model actions rotate across Hook Punch, Combat Punch, MMA Kick and Throw variants',()=>{
 const clips=['Idle__99','Hook Punch__112','Combat Punch__113','Mma Kick__99','Roundhouse Kick__5','Object Throw__45'];
 const first=combatClip(clips,'punch');
 assert.equal(first,'Hook Punch__112');
 assert.equal(combatClip(clips,'punch',first),'Combat Punch__113');
 assert.equal(combatClip(clips,'kick'),'Mma Kick__99');
 assert.equal(combatClip(clips,'kick','Mma Kick__99'),'Roundhouse Kick__5');
 assert.equal(combatClip(clips,'throw'),'Object Throw__45');
 assert.equal(combatClip(['Idle'],'punch'),null);
});

test('measured movement preserves plausible foot cadence instead of slow motion',()=>{
 assert.ok(footfallRate(1.25,'walk')>=.99);
 assert.ok(footfallRate(2,'walk')>footfallRate(1,'walk'));
 assert.ok(footfallRate(0,'walk')>=.7);
 assert.ok(footfallRate(100,'run')<=2.3);
 assert.equal(combatReach('kick'),1.35);
 const impulse=impactImpulse(combatDirection(Math.PI/2,'kick'),1e8,'kick');
 assert.ok(impulse.x<=26.1&&impulse.y<5);
});

test('physics contact uses Push animation, forces and platform support probe',()=>{
 const physics=read('js/scene-physics.js');const editor=read('js/editor.js');const robots=read('js/robots.js');
 assert.match(physics,/actor\.userData\.robotContactAction=\{kind:'push'/);
 assert.match(physics,/body\.applyImpulse\(impulse,true\)/);
 assert.match(physics,/body\.setTranslation\(\{x:actor\.position\.x/);
 assert.match(physics,/hasGroundSupport\(resolved,collider\)/);
 assert.match(physics,/state\.grounded=resolved\.grounded&&supported/);
 assert.match(robots,/footfallRate\(robot\.userData\.robotActualSpeed/);
 const snapshot=editor.indexOf('const previousRobotPositions=new Map');
 const motion=editor.indexOf('stepRobotMotion(',editor.indexOf('tick(dt){'));
 assert.ok(snapshot>0&&motion>snapshot,'speed snapshot must precede player movement');
 assert.match(read('js/live.js'),/applyRemoteRobotAction/);
 assert.match(read('backend/server.py'),/elif msg\.get\('type'\)=='robot-action'/);
 assert.match(read('index.html'),/id="robotCombatDetails"/);
});

test('persisted compact per-robot control settings are validated for bulk and atomic updates',()=>{
 const s=read('backend/server.py'),editor=read('js/editor.js');
 assert.match(s,/def valid_robot_combat\(settings\):/);
 assert.match(s,/if 'combat' in o and not valid_robot_combat/);
 assert.match(s,/if obj\['kind'\]=='robot' and 'combat' in obj and not valid_robot_combat/);
 assert.match(editor,/combat:o\.userData\.editorKind==='robot'/);
 assert.match(editor,/this\.triggerRobotCombat\(this\.selected/);
 assert.match(editor,/this\.physics\.applyCombat\(robot,action,force\)/);
});


test('Flask scene object decorator is on the HTTP handler, not combat validator',()=>{
 const s=read('backend/server.py');
 assert.match(s,/\ndef valid_robot_combat\(settings\):/);
 assert.doesNotMatch(s,/@app\.post\('\/api\/scene\/object'\)\s*def valid_robot_combat/);
 assert.match(s,/@app\.post\('\/api\/scene\/object'\)\s*def patch_scene_object\(\):/);
 assert.match(read('backend/test_api.py'),/app\.view_functions\[scene_object_rules\[0\]\.endpoint\] is patch_scene_object/);
});
