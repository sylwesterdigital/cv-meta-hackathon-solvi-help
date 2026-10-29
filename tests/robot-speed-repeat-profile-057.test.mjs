import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planRobotPath, pathBlocked} from '../js/robot-pathfinding.js';
const source=rel=>readFileSync(new URL('../'+rel,import.meta.url),'utf8');
const editor=source('js/editor.js'),robots=source('js/robots.js'),html=source('index.html'),backend=source('backend/server.py'),styles=source('styles.css');
class Vector{
 constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
 clone(){return new Vector(this.x,this.y,this.z);}
 sub(o){this.x-=o.x;this.y-=o.y;this.z-=o.z;return this;}
 length(){return Math.hypot(this.x,this.y,this.z);}
 normalize(){const d=this.length()||1;this.x/=d;this.y/=d;this.z/=d;return this;}
 addScaledVector(o,n){this.x+=o.x*n;this.y+=o.y*n;this.z+=o.z*n;return this;}
}
function harness(obstacles=[]){
 const pathSrc=editor.split('  routeRobot(robot,point){')[1]?.split('\n  // Commands')[0];
 assert(pathSrc);
 const events=[];
 class CustomEvent{constructor(name,{detail}){this.detail=detail;}}
 const win={dispatchEvent(event){events.push(event.detail);}};
 const dest=(robot,p)=>{robot.userData.robotGoal=new Vector(p.x,robot.position.y,p.z);robot.userData.robotMode='walk';};
 const route=new Function('planRobotPath','setRobotDestination','window','CustomEvent',`return function routeRobot(robot,point){${pathSrc}`)(planRobotPath,dest,win,CustomEvent);
 const editorStub={navigationObstacles:()=>obstacles,toast:()=>{},routeRobot:route};
 const tickSrc=robots.split('export function tickRobots(items,dt,onMove=()=>{}){')[1]?.split('\nexport function setRobotDestination(')[0];
 const tick=new Function('clamp','setRobotDestination','pathBlocked','window','CustomEvent','performance',`return function tickRobots(items,dt,onMove=()=>{}){${tickSrc}`)((x,a,b)=>Math.max(a,Math.min(b,x)),dest,pathBlocked,win,CustomEvent,performance);
 const onMove=Object.assign(()=>{},{navigate:(robot,point)=>route.call(editorStub,robot,point)});
 return {route:route.bind(editorStub),tick,onMove,events};
}
const makeBot=()=>({name:'Rocketman',position:new Vector(),rotation:{y:0},children:[],userData:{editorKind:'robot',editorId:'r',robotMode:'idle',robotSpeed:1.8,robotTurnSpeed:4}});
test('speed defaults and 0 to 10 range on all robot speed selectors',()=>{
 for(const id of ['robotSpeed','robotStrafeSpeed','robotTurnSpeed','robotSpeedActive']){
  assert.match(html,new RegExp('id="'+id+'"[^>]+min="0" max="10"'));
 }
 for(const [id,val] of [['robotSpeed','1.8'],['robotStrafeSpeed','2.5'],['robotTurnSpeed','4']])assert.match(html,new RegExp('id="'+id+'"[^>]+value="'+val+'"'));
 assert.match(backend,/not 0<=obj\['speed'\]<=10/);
});
test('100m goal is not clipped and goes around an obstacle at 30m',()=>{
 const h=harness([{minX:-1,maxX:1,minZ:28,maxZ:32}]),robot=makeBot();
 assert.equal(h.route(robot,{x:0,z:100}),true);
 assert.equal(robot.userData.robotWaypoints.at(-1).z,100);
 assert(robot.userData.robotWaypoints.some(p=>Math.abs(p.x)>1.25),'detour around furniture');
 for(let i=0;i<2500&&robot.userData.robotGoal;i++)h.tick([robot],.18,h.onMove);
 assert(Math.abs(robot.position.z-100)<.15);
 assert.equal(robot.userData.robotGoal,null);
});
test('blocked long route reports blocked and never reports arrival',()=>{
 const barrier=[{minX:-200,maxX:200,minZ:20,maxZ:24}];
 const h=harness(barrier),robot=makeBot();robot.userData.robotMission={kind:'walk_forward',taskId:'blocked',targetName:'100 m forward'};
 assert.equal(h.route(robot,{x:0,z:100}),false);
 assert(h.events.some(e=>e.status==='blocked'));
 assert(!h.events.some(e=>e.status==='arrived'));
});
test('three out-and-back cycles finish at start and emit one terminal result',()=>{
 const h=harness(),robot=makeBot();
 const mission={kind:'walk_forward',taskId:'outback',targetName:'12 m and back',origin:{x:0,z:0},endpoint:{x:0,z:12},returnToStart:true,repeat:3,leg:0};
 robot.userData.robotMission=mission;assert(h.route(robot,mission.endpoint));
 for(let i=0;i<1600&&robot.userData.robotMission;i++)h.tick([robot],.15,h.onMove);
 assert.equal(robot.userData.robotMission,null);
 assert(Math.abs(robot.position.z)<.15);
 assert.deepEqual(h.events.filter(e=>e.status==='arrived').map(e=>e.taskId),['outback']);
});
test('profile color, animated badge, per-speaker chat and speaking waves have explicit code paths',()=>{
 assert.match(html,/id="profileColor"/);
 assert.match(backend,/ALTER TABLE users ADD COLUMN color/);
 assert.match(backend,/users.color AS speaker_color/);
 const studio=source('js/studio.js');
 assert.match(studio,/entry\.speaker_color/);
 assert.match(studio,/className='robot-speech-wave'/);
 assert.match(studio,/profile-avatar-live/);
 assert.match(studio,/animated\.src=image\.src/);
 assert.match(styles,/\.chat-row\.theirs\{align-self:flex-end!important/);
 assert.match(styles,/\.robot-speech-wave\{/);
 assert.match(styles,/#propertiesPanel #propertyGrid \.scale-title/);
});
