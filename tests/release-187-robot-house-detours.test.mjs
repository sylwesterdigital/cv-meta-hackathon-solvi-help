import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planRobotTravelRoute,planRobotApproach,pathBlocked,plannedPathLength} from '../js/robot-pathfinding.js';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');

function verifyPath(start,end,obstacles,waypoints){
 assert.ok(waypoints?.length, 'Expected reachable route');
 assert.ok(Math.hypot(waypoints.at(-1).x-end.x,waypoints.at(-1).z-end.z)<.12,'Must reach exact end, not nearest cell');
 let last=start;
 for(const next of waypoints){
  const dist=Math.hypot(next.x-last.x,next.z-last.z);
  for(let i=1,n=Math.max(1,Math.ceil(dist/.06));i<=n;i++){
   const t=i/n,x=last.x+(next.x-last.x)*t,z=last.z+(next.z-last.z)*t;
   assert.equal(pathBlocked(x,z,obstacles,.295),false,`Walked through building at ${x},${z}`);
  }
  last=next;
 }
}

test('Jess routes around a full 5×4 house rather than forcing a blocked midpoint',()=>{
 const start={x:0,z:0},end={x:0,z:30};
 const house={minX:-2.5,maxX:2.5,minZ:12.3,maxZ:16.3,kind:'wall'};
 assert.equal(pathBlocked(0,15,[house]),true,'Old straight midpoint falls inside house');
 const waypoints=planRobotTravelRoute(start,end,[house]);
 verifyPath(start,end,[house],waypoints);
 assert.ok(waypoints.some(p=>Math.abs(p.x)>2.75),'Must physically go to side of house');
 assert.ok(plannedPathLength(start,waypoints)>30,'House detour is longer than the impossible straight route');
});

test('Jess can approach Zuck on the other side of a house without standing in Zuck',()=>{
 const start={x:0,z:0},zuck={minX:-.38,maxX:.38,minZ:29.62,maxZ:30.38};
 const obstacles=[{minX:-3,maxX:3,minZ:12,maxZ:18,kind:'wall'}, {...zuck,kind:'robot'}];
 const approach=planRobotApproach(start,zuck,obstacles);
 assert.ok(approach?.waypoints?.length,'Should find a walkable side of Zuck');
 verifyPath(start,approach.point,obstacles,approach.waypoints);
 assert.equal(pathBlocked(approach.point.x,approach.point.z,obstacles),false);
 assert.ok(Math.hypot(approach.point.x,approach.point.z-30)<3,'Approach remains near the robot');
});

test('Long journeys detour around mid-route buildings even when ordinary planner grid is capped',()=>{
 const start={x:0,z:0},end={x:0,z:100};
 const houses=[{minX:-5,maxX:5,minZ:46,maxZ:55}];
 const waypoints=planRobotTravelRoute(start,end,houses);
 verifyPath(start,end,houses,waypoints);
 assert.ok(waypoints.some(p=>Math.abs(p.x)>5.25));
});

test('Diagonal routes pass complete footprints, not just a centreline approximation',()=>{
 const start={x:0,z:0},end={x:40,z:40};
 const house={minX:12,maxX:27,minZ:13,maxZ:25};
 const waypoints=planRobotTravelRoute(start,end,[house]);
 verifyPath(start,end,[house],waypoints);
});

test('Impossible enclosing barrier remains blocked: do not teleport or claim arrival',()=>{
 const wall=[{minX:-200,maxX:200,minZ:20,maxZ:24}];
 assert.equal(planRobotTravelRoute({x:0,z:0},{x:0,z:100},wall),null);
});

test('Safe pursuit uses robot feet capsule and reconsiders reachable sides as target moves',()=>{
 const editor=read('js/editor.js');
 assert.match(editor,/const bounds2d=target\.userData\.editorKind==='robot'\?/);
 assert.match(editor,/const approach=planRobotMeeting\(\{\.\.\.start,y:robot\.position\.y\},\{x:target\.position\.x,y:target\.position\.y,z:target\.position\.z\},obstacles\)/);
 assert.match(editor,/canMeetRobot\(\{x:robot\.position\.x,y:robot\.position\.y,z:robot\.position\.z\}/);
 assert.match(editor,/this\.routeRobot\(robot,approach\.point,\{preserveMission:true\}\)/);
 assert.match(editor,/const waypoints=planRobotTravelRoute\(start,\{x:point\.x,z:point\.z\},obstacles\)/);
 assert.doesNotMatch(editor,/const target=\{x:start\.x\+\(point\.x-start\.x\)\*i\/steps/);
});

test('Navigation obstacles ignore roof accessories and floors far above or below the robot',()=>{
 const editor=read('js/editor.js');
 assert.match(editor,/if\(b\.isEmpty\(\)\|\|b\.max\.y<robot\.position\.y\+\.10\|\|b\.min\.y>robot\.position\.y\+1\.7\)return null/);
});
