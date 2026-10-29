import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stepRobotMotion,intent} from '../js/robot-net.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const advance=(s,i,n)=>{for(let j=0;j<n;j++)s=stepRobotMotion(s,i,1/60);return s};

test('numpad views preserve actual eye-to-object distance, with zoom separate',()=>{
 const w=read('js/world.js');
 const start=w.indexOf('  cameraPreset(key,reverse=false){'),end=w.indexOf('  navigateCamera(dt){',start);
 const method=w.slice(start,end);
 assert.match(method,/const cameraOffset=this\.camera\.position\.clone\(\)\.sub\(center\)/);
 assert.match(method,/const distance=Math\.max\(this\.controls\.minDistance,cameraOffset\.length\(\)\)/);
 assert.match(method,/this\.camera\.position\.copy\(center\)\.addScaledVector\(offset,distance\)/);
 assert.doesNotMatch(method,/radius\s*\*\s*3\.5|Math\.max\(2\.8/);
 assert.match(w,/zoomOnSelectedObject\(direction\)/);
});

test('free camera translates both camera and pivot with smoothed velocity',()=>{
 const w=read('js/world.js');
 assert.match(w,/this\.cameraVelocity=new THREE\.Vector3\(\)/);
 assert.match(w,/this\.cameraVelocity\.lerp\(desired,1-Math\.exp\(-response\*dt\)\)/);
 assert.match(w,/this\.camera\.position\.add\(delta\);this\.controls\.target\.add\(delta\)/);
 assert.match(w,/if\(robot&&this\.robotEditor\.canEdit\(robot\)&&this\.robotEditor\.controlMode==='robot'\)\{this\.cameraVelocity\.set\(0,0,0\);return;\}/);
});

test('robot throttle and steering ease on release while retaining forward heading in reverse',()=>{
 const initial={x:0,z:0,yaw:0,velocity:0,steer:0};
 const turn={...intent(new Set(['ArrowUp','ArrowRight'])),s:1};
 const started=stepRobotMotion(initial,turn,1/60);
 assert.ok(started.velocity>0&&started.velocity<1.2);
 const moving=advance(started,turn,25);
 assert.ok(moving.steer<started.steer&&moving.yaw<0);
 const coasting=stepRobotMotion(moving,{f:0,t:0,s:1},1/60);
 assert.ok(coasting.velocity>0&&coasting.velocity<moving.velocity);
 assert.ok(coasting.steer<=0&&coasting.steer>moving.steer);
 const back=advance({x:0,z:0,yaw:.4,velocity:0,steer:0},{...intent(new Set(['ArrowDown'])),s:1},90);
 assert.ok(back.velocity<0&&back.z<0&&back.yaw===.4);
});

test('close/minimise controls share a 30px design and consistent font and hover state',()=>{
 const css=read('styles.css');
 for(const id of ['closeLog','closeScenePanel','minimizeScenePanel','closeProperties','closeChat','closeProfile','closeSettings','toolboxMinimize'])assert.ok(css.includes('#'+id));
 assert.match(css,/width:30px!important;height:30px!important/);
 assert.match(css,/font-size:12px!important;font-weight:600!important/);
 assert.match(css,/focus-visible\{outline:2px solid var\(--solvi-accent\)/);
});
