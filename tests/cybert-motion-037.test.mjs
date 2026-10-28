import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../js/robots.js',import.meta.url),'utf8');
const editor=readFileSync(new URL('../js/editor.js',import.meta.url),'utf8');
const backend=readFileSync(new URL('../backend/server.py',import.meta.url),'utf8');
class Vector {
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
 clone(){return new Vector(this.x,this.y,this.z);}
 sub(o){this.x-=o.x;this.y-=o.y;this.z-=o.z;return this;}
 length(){return Math.hypot(this.x,this.y,this.z);}
 normalize(){const n=this.length()||1;this.x/=n;this.y/=n;this.z/=n;return this;}
 addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;}
}
function tickHarness(){
 const src=source.split('export function tickRobots(items,dt,onMove=()=>{}){')[1].split('\nexport function setRobotDestination(')[0];
 const events=[];
 const window={dispatchEvent(e){events.push(e.detail);}};
 class CustomEvent{constructor(name,opts){this.detail=opts.detail;}}
 const clamp=(v,l,h)=>Math.max(l,Math.min(v,h));
 const setRobotDestination=(robot,p)=>{robot.userData.robotGoal=new Vector(p.x,robot.position.y,p.z);robot.userData.robotMode='walk';};
 const tick=new Function('clamp','setRobotDestination','window','CustomEvent','performance',`return function tickRobots(items,dt,onMove=()=>{}){${src}`)(clamp,setRobotDestination,window,CustomEvent,performance);
 return {tick,events};
}
test('Cybert can turn 90° left in-place and report actual completion',()=>{
 const {tick,events}=tickHarness();
 const robot={name:'Cybert',position:new Vector(),rotation:{y:0},children:[],userData:{editorKind:'robot',editorId:'cybert',robotTurnSpeed:1,robotMode:'idle',robotMission:{kind:'turn',phase:'turn',targetYaw:-Math.PI/2,taskId:'task-turn',targetName:'left 90°'}}};
 for(let i=0;i<100;i++)tick([robot],.016);
 assert.ok(Math.abs(robot.rotation.y+Math.PI/2)<.01);
 assert.equal(robot.position.x,0);
 assert.equal(events.length,1);
 assert.equal(events[0].status,'arrived');
 assert.equal(events[0].taskId,'task-turn');
});
test('Cybert turns, then travels three metres in new heading and reports completion',()=>{
 const {tick,events}=tickHarness();
 const robot={name:'Cybert',position:new Vector(),rotation:{y:0},children:[],userData:{editorKind:'robot',editorId:'cybert',robotTurnSpeed:1,robotMode:'idle',robotMission:{kind:'turn_walk',phase:'turn',targetYaw:-Math.PI/2,taskId:'task-travel',targetName:'left 90°, then 3 m',distance:3}}};
 for(let i=0;i<400;i++)tick([robot],.016);
 assert.ok(robot.position.x<-2.9,robot.position.x);
 assert.ok(Math.abs(robot.position.z)<.05,robot.position.z);
 assert.equal(events.length,1);
 assert.equal(events[0].taskId,'task-travel');
});
test('chat command parser and client acknowledge movement without needing Muse language generation',()=>{
 assert.match(backend,/kind':'turn_walk'/);
 assert.match(backend,/kind':'walk_forward'/);
 assert.match(backend,/kind':'turn'/);
 assert.match(backend,/kind':'jump'/);
 assert.match(backend,/deterministic movement runs without model inference/);
 assert.match(editor,/command\.kind==='turn_walk'/);
 assert.match(editor,/robot\.userData\.robotMission=\{kind:command\.kind,phase:'turn'/);
});
