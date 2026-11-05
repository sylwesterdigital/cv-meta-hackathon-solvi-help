import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {infrastructureNavigationFootprints} from '../js/robot-infrastructure-obstacles.js';
import {checkRobotWalkingProgress} from '../js/robot-progress-watchdog.js';
import {planRobotTravelRoute,pathBlocked} from '../js/robot-pathfinding.js';

const fence=(start,end,other={})=>infrastructureNavigationFootprints([
  {start,end,length:Math.hypot(end[0]-start[0],end[1]-start[1])}
],(x,z)=>({x,z}),{infraType:'fence',infraThickness:.14,...other},{name:'Footpath'});

test('long user-labelled Footpath fence stays visible to routing as short physical segments',()=>{
 const obstacles=fence([-20,0],[20,0]);
 assert.ok(obstacles.length>20);
 assert.ok(obstacles.every(o=>o.kind==='fence'&&o.name==='Footpath'));
 assert.ok(obstacles.every(o=>o.maxX-o.minX<2));
 assert.ok(pathBlocked(0,0,obstacles,.3));
});

test('the navigation route walks around the physical end, never across the fence',()=>{
 const obstacles=fence([-20,0],[20,0]);
 const start={x:0,z:-5},end={x:0,z:5};
 const route=planRobotTravelRoute(start,end,obstacles);
 assert.ok(route?.length>2,'the long fence has a reachable endpoint');
 assert.ok(Math.hypot(route.at(-1).x-end.x,route.at(-1).z-end.z)<.15);
 assert.ok(route.some(p=>Math.abs(p.x)>20.4),'detour must pass the fence end');
 let last=start;
 for(const step of route){
  const d=Math.hypot(step.x-last.x,step.z-last.z);
  for(let i=1,n=Math.ceil(d/.08);i<=n;i++){
   const t=i/n;
   assert.equal(pathBlocked(last.x+(step.x-last.x)*t,last.z+(step.z-last.z)*t,obstacles,.23),false);
  }
  last=step;
 }
});

test('nonvertical ground paths are not treated as impassable fences',()=>{
 const pieces=[{start:[-10,0],end:[10,0],length:20}];
 for(const infraType of ['footpath','road','curb']){
  assert.deepEqual(infrastructureNavigationFootprints(pieces,(x,z)=>({x,z}),{infraType}),[]);
 }
});

test('transformed, angled fence segments use actual world coordinates rather than a stale display name',()=>{
 const obstacles=infrastructureNavigationFootprints([
  {start:[-4,0],end:[4,0],length:8}
 ],(x,z)=>({x:z+3,z:-x-6}),{infraType:'pathWall',infraThickness:.4},{name:'Old footpath'});
 assert.ok(obstacles.length>4);
 assert.ok(pathBlocked(3,-6,obstacles,.3));
 assert.equal(pathBlocked(6,-6,obstacles,.3),false);
});

test('watchdog detects real no-progress rather than running animation',()=>{
 let sample=null,stuck=false;
 for(let i=0;i<24;i++){
  ({sample,stuck}=checkRobotWalkingProgress(sample,{x:0,z:0},{x:8,z:0},.1));
 }
 assert.equal(stuck,true);
});

test('watchdog tolerates genuine movement and pauses during background-tab suspension',()=>{
 let sample=null;
 for(let i=0;i<25;i++){
  const next=checkRobotWalkingProgress(sample,{x:i*.15,z:0},{x:8,z:0},.1);
  sample=next.sample;assert.equal(next.stuck,false);
 }
 const suspended=checkRobotWalkingProgress(sample,{x:3.6,z:0},{x:8,z:0},10);
 assert.equal(suspended.stuck,false);
});

test('scene router keeps elongated physical objects and rechecks measured collision progress',()=>{
 const editor=fs.readFileSync(new URL('../js/editor.js',import.meta.url),'utf8');
 const robots=fs.readFileSync(new URL('../js/robots.js',import.meta.url),'utf8');
 assert.match(editor,/infrastructureNavigationFootprints\(/);
 assert.match(editor,/infrastructureSegments\(cfg\)/);
 assert.doesNotMatch(editor,/b\.max\.x-b\.min\.x>28\|\|b\.max\.z-b\.min\.z>28\)return null/);
 assert.match(editor,/reason==='no measured movement'/);
 assert.match(editor,/kind:'runtime-contact'/);
 assert.match(robots,/checkRobotWalkingProgress\(/);
 assert.match(robots,/No measured movement after bounded detour attempts/);
});
