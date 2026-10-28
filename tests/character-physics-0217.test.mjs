import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CHARACTER,characterMotion,resolveCharacterMotion,easedRemotePose} from '../js/character-physics.js';
const source=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('avatar capsule reaches floor at the foot position',()=>{
 assert.ok(Math.abs(CHARACTER.centerY-CHARACTER.halfHeight-CHARACTER.radius)<1e-12);
 assert.ok(CHARACTER.radius>=.25&&CHARACTER.halfHeight>.5);
});
test('gravity, jump and landing depend on collision grounding, not animation',()=>{
 const prior={x:0,y:1,z:0,verticalSpeed:0};
 let m=characterMotion(prior,{x:2,y:1,z:1},1/60,false);
 assert.ok(m.y<0);assert.equal(m.x,2);assert.equal(m.z,1);
 m=characterMotion(prior,{x:0,y:1,z:0},1/60,true);
 assert.ok(m.y>0);assert.ok(m.verticalSpeed>4);
 const after=resolveCharacterMotion({x:0,y:.2,z:0},{x:.1,y:-.2,z:.02},true,-3);
 assert.equal(after.y,0);assert.equal(after.verticalSpeed,0);assert.equal(after.grounded,true);
});
test('remote rigid-body snapshots ease without teleport',()=>{
 const position=easedRemotePose({x:0,y:0,z:0},{x:5,y:1,z:-2},1/60);
 assert.ok(position.x>0&&position.x<5);assert.ok(position.y>0&&position.y<1);
 assert.ok(position.z<0&&position.z>-2);
});
test('Rapier character controller runs after movement intent and before rendering',()=>{
 const physics=source('js/scene-physics.js'),editor=source('js/editor.js');
 for(const signature of ['createCharacterController','ColliderDesc.capsule','computeColliderMovement','computedMovement','computedGrounded','enableAutostep','enableSnapToGround','setMaxSlopeClimbAngle','setApplyImpulsesToDynamicBodies','setNextKinematicTranslation','world.step()'])assert.ok(physics.includes(signature),signature);
 assert.match(editor,/tickRobots\(this\.items,dt,[\s\S]*?this\.physics\.tick\(dt\)/);
 assert.match(source('js/robots.js'),/!robot\.userData\.physicsCharacterActive/);
});
test('all rigid bodies coexist: dynamic, static, kinematic, remote and avatar',()=>{
 const p=source('js/scene-physics.js');
 for(const x of ["type==='dynamic'", "type==='kinematic'", "type==='remote-dynamic'", "?'avatar'", 'colliderShape(object)', 'setFriction','setRestitution'])assert.ok(p.includes(x),x);
 assert.match(source('js/scene-models.js'),/window\.solviEditor\?\.physics\.sync\(group\)/);
});
test('multiplayer physics snapshots are small, owner-only, room-scoped and sequence checked',()=>{
 const backend=source('backend/server.py'),live=source('js/live.js'),physics=source('js/scene-physics.js');
 assert.match(backend,/elif msg\.get\('type'\)=='physics-state'/);
 assert.match(backend,/controlled\.get\('owner'\)!=uid/);
 assert.match(backend,/except_id=uid,room_id=room_id/);
 assert.match(live,/m\.type==='physics-state'[\s\S]*?physics\.applyRemoteState\(m\)/);
 assert.match(physics,/this\.remoteSequence\.set\(packet\.id,seq\)/);
 assert.match(physics,/now-\(this\.lastBroadcast\.get\(id\)\|\|0\)>220/);
});
