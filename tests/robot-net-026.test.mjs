import test from 'node:test';
import assert from 'node:assert/strict';
import {intent,active,stepIntent,packetFor,signedAngle} from '../js/robot-net.js';
import {supportedLanguage,selectedLocale} from '../js/voice-captions.js';

test('Robot keyboard signals are compact and movement-limited',()=>{
 const keys=new Set(['ArrowUp','ShiftLeft']);const i=intent(keys);
 assert.deepEqual(i,{f:1,t:0,r:1,b:0});assert.ok(active(i));
 const p=stepIntent(0,0,0,i,1);assert.ok(p.z>0 && p.z<.2); // dt clamps to 65ms
 assert.equal(active(intent(new Set())),false);
});
test('Robot packet contains only compact fields, no GLB or geometry',()=>{
 const p=packetFor('myrobot-001',{f:1,t:-1,r:0},{position:{x:1.1234567,y:0,z:2.19},rotation:{y:1.23456}});
 assert.deepEqual(Object.keys(p),['type','id','f','t','r','b','m','x','z','y','yaw','s','j']);
 assert.ok(JSON.stringify(p).length<150);assert.equal(p.x,1.12);assert.equal(p.yaw,1.235);
});
test('Angle reconciliation uses shortest turn',()=>{
 assert.ok(Math.abs(signedAngle(Math.PI-.1,-Math.PI+.1))<.21);
});
test('Polish, English, auto recognition language validated',()=>{
 assert.equal(selectedLocale('pl-PL','en-GB'),'pl-PL');
 assert.equal(selectedLocale('auto','pl-PL'),'pl-PL');
 assert.equal(supportedLanguage('foo'),'auto');
});
