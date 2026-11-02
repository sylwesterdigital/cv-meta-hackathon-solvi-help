import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const carry=read('../js/object-carry.js').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
class Vector3{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
}
const {cleanThrowSettings,editThrowSetting,throwImpulse,predictThrowPath,ObjectCarry}=
 new Function('THREE',carry+'\nreturn {cleanThrowSettings,editThrowSetting,throwImpulse,predictThrowPath,ObjectCarry};')({Vector3});

const keys={angle:'robotThrowAngle',height:'robotThrowHeight',direction:'robotThrowDirection',delay:'robotThrowDelay',pickupDelay:'robotPickupDelay',pickupSpeed:'robotPickupSpeed',throwSpeed:'robotThrowSpeed',force:'robotThrowForce'};
test('all eight throw controls lack arbitrary HTML min/max; decimal input is supported',()=>{
 const html=read('../index.html');
 for(const [key,id] of Object.entries(keys)){
  const tag=html.match(new RegExp(`<input id="${id}"[^>]*>`));
  assert.ok(tag,`missing input for ${key}`);
  assert.doesNotMatch(tag[0],/\s(?:min|max)=/,`no hardcoded ${key} range`);
  assert.match(tag[0],/step="any"/);
 }
});

test('large force and unrestricted angles, offsets, delays and positive speeds survive normalization',()=>{
 const example={force:125.75,angle:172.5,direction:-315,height:12.25,delay:135.5,pickupDelay:-20,pickupSpeed:.1,throwSpeed:12};
 assert.deepEqual(cleanThrowSettings(example),example);
 for(const [key,value] of Object.entries(example)){
  const result=editThrowSetting({},key,String(value));
  assert.equal(result[key],value,`field ${key} persists exact input`);
 }
 assert.equal(cleanThrowSettings({force:0}).force,0,'zero force drops object');
 assert.equal(cleanThrowSettings({angle:360}).angle,360);
});

test('empty, nonfinite, negative force and nonpositive speeds are rejected without resetting other fields',()=>{
 const config=cleanThrowSettings({delay:37,force:70,throwSpeed:10});
 for(const raw of ['', '  ', 'Infinity','1e999','nope']){
  assert.equal(editThrowSetting(config,'force',raw),null);
 }
 assert.equal(editThrowSetting(config,'force','-1'),null);
 assert.equal(editThrowSetting(config,'pickupSpeed','0'),null);
 assert.equal(editThrowSetting(config,'throwSpeed','-4'),null);
 assert.equal(editThrowSetting(config,'bogus','50'),null);
 assert.deepEqual(cleanThrowSettings({force:Infinity,pickupSpeed:0,throwSpeed:-3,delay:37}),
  {angle:12,height:0,direction:0,delay:37,pickupDelay:55,pickupSpeed:1,throwSpeed:1,force:3.1});
});

test('real throw impulse retains launch speeds above the old 10 m/s cap and angles above 65 degrees',()=>{
 const i=throwImpulse(0,50,90);
 assert.ok(Math.abs(i.y-50)<1e-8);
 assert.ok(Math.abs(i.z)<1e-8);
 const sideways=throwImpulse(Math.PI/2,80,0);
 assert.ok(Math.abs(sideways.x-80)<1e-8);
 assert.equal(throwImpulse(0,0,12).y,0);
});

test('high-force trajectory preview reaches the floor beyond the old 2.55-second horizon',()=>{
 const path=predictThrowPath({x:0,y:1.5,z:0},0,{force:80,angle:45});
 assert.ok(path.length>2);
 assert.equal(path.at(-1).y,0,'landing point is still predicted at high force');
 assert.ok(path.at(-1).z>250,'preview follows the physically longer throw');
});

test('clip duration reflects requested animation speed without .2s–4s clamping',()=>{
 const carryObj={userData:{editorId:'actor',editorKind:'robot',robotThrowSettings:{pickupSpeed:.1,throwSpeed:12,pickupDelay:50,delay:25},robotAvailableActions:['Lifting','Throw'],robotAnimator:{clipDuration:()=>1.2}}};
 const obj={userData:{editorId:'object',editorKind:'cube',pickable:true,physics:{mode:'static'}},position:{clone(){return {};}},rotation:{clone(){return {};}}};
 const editor={items:[carryObj,obj],physics:{enabled:true,owns:()=>true},canEdit:()=>true};
 const state=new ObjectCarry(editor);
 // Stub the hand attachment rather than mocking Three.js skeletal bones.
 state.attach=(_bot,_target,carryState)=>{carryState.attached=true;return true;};
 globalThis.window={solviRoomSocket:{send(){}}};
 assert.equal(state.pickup(carryObj,false,'object'),true);
 assert.ok(Math.abs(carryObj.userData.robotCarry.duration-12)<1e-8);
 assert.ok(Math.abs(carryObj.userData.robotCarry.attachAt-6)<1e-8);
 assert.equal(state.throw(carryObj),true);
 assert.ok(Math.abs(carryObj.userData.robotCarry.duration-.1)<1e-8);
 assert.ok(Math.abs(carryObj.userData.robotCarry.releaseAt-.025)<1e-8);
});

test('carry animation playback bypasses the general avatar rate limiter',()=>{
 const animator=read('../js/animations.js').replace(/^export /gm,'');
 const {MotionController}=new Function(animator+'\nreturn {MotionController};')();
 const speeds=[];
 const controller=Object.create(MotionController.prototype);
 controller.actions=new Map();
 controller.current={setEffectiveTimeScale:s=>speeds.push(s)};
 controller.currentKind='throwObject';controller.reverseClimb=false;
 controller.setPlaybackSpeed(15,{unbounded:true});
 assert.equal(speeds.at(-1),15);
 controller.setPlaybackSpeed(.1,{unbounded:true});
 assert.equal(speeds.at(-1),.1);
 controller.setPlaybackSpeed(15);
 assert.equal(speeds.at(-1),6.5,'non-carry animation safety remains unchanged');
 const robotSource=read('../js/robots.js');
 assert.match(robotSource,/settings\?\.pickupSpeed\|\|1,\{unbounded:true\}/);
 assert.match(robotSource,/settings\?\.throwSpeed\|\|1,\{unbounded:true\}/);
});

test('backend validation accepts large finite values and rejects nonnumeric or invalid physical semantics',()=>{
 const backend=read('../backend/server.py');
 const start=backend.indexOf('def valid_robot_throw_settings(settings):');
 const end=backend.indexOf('\ndef valid_robot_combat(settings):',start);
 assert.ok(start>=0&&end>start);
 const python=backend.slice(start,end);
 assert.doesNotMatch(python,/\('force',1\.2,10\)|\('throwSpeed',\.5,3\)/);
 // Executable backend tests use only this function and Python's standard math module.
 // See scripts in release verification; keep this source guard tied to production code.
 assert.match(python,/math\.isfinite\(value\)/);
 assert.match(python,/value<=0/);
 assert.match(python,/value<0/);
});
