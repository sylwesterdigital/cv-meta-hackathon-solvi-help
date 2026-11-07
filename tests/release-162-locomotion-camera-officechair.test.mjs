import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from './helpers/subprocess-test.mjs';
import {combatPhase} from '../js/robot-combat.js';
import {permittedRobotLocomotion} from '../js/robot-contact.js';
import {animationSpeedSettings,landingClipFor,gaitCadence,continuousGaitMode} from '../js/animation-tuning.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function isolatedAnimate(){
 const file=read('js/robots.js');
 const part=file.split('export function animateRobots(items,dt,onImpact=()=>{}){')[1]?.split('\n}')[0];
 assert.ok(part,'runtime animation function must be found');
 return new Function('combatPhase','footfallRate','permittedRobotLocomotion','animationSpeedSettings','landingClipFor','gaitCadence','continuousGaitMode',`return function animateRobots(items,dt,onImpact=()=>{}){${part}\n}`)(combatPhase,()=>1,permittedRobotLocomotion,animationSpeedSettings,landingClipFor,gaitCadence,continuousGaitMode);
}
function robot(mode,extra={}){
 const played=[];
 const animator={actions:new Map([['liftCarry',{}],['idle',{}],['walk',{}],['run',{}],['jump',{time:0,getClip(){return {duration:1}}}]]),
  current:{paused:false},clipDuration:()=>1,play:m=>played.push(m),playOnce:m=>played.push(m),setPlaybackSpeed(){},update(){}};
 return {robot:{children:[],userData:{editorKind:'robot',robotMode:mode,robotActualSpeed:1,robotAnimator:animator,...extra}},played,animator};
}
test('active walking interrupts lifting animation without losing attached object or carry timer',()=>{
 const f=robot('walk',{robotLocalMotion:true,robotVelocity:1.2,robotCarry:{stage:'pickup',objectId:'chair-1',elapsed:.2,duration:1,settings:{pickupSpeed:1}}});
 isolatedAnimate()([f.robot],1/60);
 assert.equal(f.played.at(-1),'walk');
 assert.equal(f.robot.userData.robotCarry.objectId,'chair-1');
 assert.equal(f.robot.userData.robotCarry.stage,'pickup');
});
test('paused one-shot resumes locomotion and does not leave moving robots skating',()=>{
 const f=robot('run',{robotLocalMotion:true,robotVelocity:2.2,robotPlaying:'liftCarry'});
 f.animator.current.paused=true;
 isolatedAnimate()([f.robot],1/60);
 assert.equal(f.played.at(-1),'run');
});
test('pickup remains visible for stationary robots and cannot override a real jump',()=>{
 const f=robot('idle',{robotLocalMotion:false,robotActualSpeed:0,robotCarry:{stage:'pickup',settings:{pickupSpeed:1}}});
 isolatedAnimate()([f.robot],1/60);
 assert.equal(f.played.at(-1),'liftCarry');
 const j=robot('walk',{robotLocalMotion:true,robotVelocity:2,robotCarry:{stage:'pickup',settings:{pickupSpeed:1}},robotJumpActive:true,robotJumpClip:'jump'});
 isolatedAnimate()([j.robot],1/60);
 assert.equal(j.played.at(-1),'jump');
});
test('robot eye capture requests sRGB offscreen output before readback',()=>{
 const src=read('js/robots.js');
 assert.match(src,/rt\.texture\.colorSpace=THREE\.SRGBColorSpace/);
 assert.ok(src.indexOf('rt.texture.colorSpace=THREE.SRGBColorSpace')<src.indexOf('renderer.readRenderTargetPixels(rt,0,0,512,512,pixels)'));
});
test('office chair has editable pedestal or four legs, backrest, headrest and a seat interaction',()=>{
 const geometry=read('js/primitive-properties.js'),editor=read('js/editor.js'),seat=read('js/robot-seating.js');
 assert.match(geometry,/officeChair:\{width:/);
 assert.match(geometry,/if\(p\.variant==='officeChair'\)/);
 assert.match(editor,/\['table','chair','officeChair'/);
 assert.match(editor,/\['four','4 legs'\]/);
 assert.match(seat,/'officeChair'/);
});
test('translucent liquid has independent opacity and backend accepts finite bounds',()=>{
 const geometry=read('js/primitive-properties.js');
 assert.match(geometry,/fluidOpacity:\[\.52,0,1\]/);
 assert.match(geometry,/opacity:p\.fluidOpacity/);
 assert.match(geometry,/surface\.userData\.bottleLiquid=true/);
 const code=`import ast,sys,math,re
src=open(sys.argv[1]).read();t=ast.parse(src);needed=['valid_basic_furniture','valid_smart_options','valid_smart_channels'];ns={'math':math,'re':re};exec(compile(ast.Module(body=[n for n in t.body if isinstance(n,ast.FunctionDef) and n.name in needed],type_ignores=[]),'<test>','exec'),ns)
f=ns['valid_basic_furniture'];assert f({'variant':'officeChair','legStyle':'single','headrest':True});assert f({'variant':'officeChair','legStyle':'four','headrest':False});assert f({'variant':'bottle','fluidOpacity':0.35,'fluidLevel':55});assert not f({'variant':'bottle','fluidOpacity':1.2});print('ok')`;
 const process=spawnSync('python3',['-c',code,new URL('../backend/server.py',import.meta.url).pathname],{encoding:'utf8'});
 assert.equal(process.status,0,process.stderr||process.stdout);
});
test('provided delete SVG and icon-only button rule are centered',()=>{
 const svg=read('assets/ui-icons/delete.svg'),css=read('styles.css');
 assert.match(svg,/<svg[^>]*viewBox="0 0 24 24"/);
 assert.match(css,/button\[data-ui-icon="delete"\]/);
 assert.match(css,/align-items:center!important;justify-content:center!important/);
});
