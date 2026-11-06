import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {socialLineClear,canMeetRobot,planRobotMeeting,remainingRouteBlocked} from '../js/robot-social-navigation.js';
import {pathBlocked} from '../js/robot-pathfinding.js';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const rect=(x1,x2,z1,z2)=>({minX:x1,maxX:x2,minZ:z1,maxZ:z2,kind:'wall'});
// A closed house with a usable 1.8m entry at front (-Z), solid window-side
// masonry at +Z, and sufficient interior clearance for two robot capsules.
const room=[
 rect(-3,-2.82,-2,2),rect(2.82,3,-2,2),rect(-3,3,1.82,2),
 rect(-3,-.9,-2,-1.82),rect(.9,3,-2,-1.82)
];
function verifyPath(start,waypoints,obstacles){
 let prev=start;
 for(const point of waypoints){
  const distance=Math.hypot(point.x-prev.x,point.z-prev.z);
  for(let i=1,n=Math.ceil(distance/.07);i<=n;i++){
   const f=i/n;
   assert.equal(pathBlocked(prev.x+(point.x-prev.x)*f,prev.z+(point.z-prev.z)*f,obstacles,.29),false);
  }
  prev=point;
 }
}
test('an outside position at the window is NOT a robot meeting or arrival',()=>{
 const outside={x:0,z:3.1},inside={x:0,z:1.25};
 assert.equal(canMeetRobot(outside,inside,room),false);
 assert.equal(socialLineClear(outside,inside,room),false);
});
test('robot chooses a physical entry via the door rather than speaking through the window',()=>{
 const outside={x:0,z:4.2},inside={x:0,z:1.05};
 const approach=planRobotMeeting(outside,inside,room);
 assert.ok(approach?.waypoints?.length,'Must reach a visible stand-off point inside');
 assert.ok(approach.point.z<1.8,'Should finish inside house, not outside window');
 assert.ok(socialLineClear(approach.point,inside,room));
 verifyPath(outside,approach.waypoints,room);
 assert.ok(approach.waypoints.some(p=>p.z< -1.45),'Must walk around house and through the open doorway');
});
test('a truly sealed room cannot be approached and cannot be falsely marked reached',()=>{
 const sealed=[...room,rect(-.9,.9,-2,-1.82)];
 assert.equal(planRobotMeeting({x:0,z:4.2},{x:0,z:0},sealed),null);
});
test('moving robots are not fixed walls in the scene path, but static barriers remain',()=>{
 const start={x:-2,z:0},target={x:2,z:0};
 const moving={minX:-.45,maxX:.45,minZ:-.45,maxZ:.45,kind:'robot'};
 const plan=planRobotMeeting(start,target,[moving]);
 assert.ok(plan,'A free path exists if the moving robot yields');
 const house=rect(-.25,.25,-100,100);
 assert.equal(planRobotMeeting(start,target,[house]),null,'A real full-height barrier blocks arrival');
});
test('path can be invalidated when a door closes or furniture is moved into its corridor',()=>{
 const start={x:0,z:0},goal={x:0,z:4};
 assert.equal(remainingRouteBlocked(start,goal,[],[]),false);
 assert.equal(remainingRouteBlocked(start,goal,[],[rect(-.4,.4,2,2.4)]),true);
 assert.equal(remainingRouteBlocked(start,{x:1,z:0},[{x:2,z:0}],[]),false);
});
test('avatar motion and editor use dynamic avoidance, new scene checks and physically visible meetings',()=>{
 const editor=source('js/editor.js'),robots=source('js/robots.js'),backend=source('backend/server.py');
 assert.match(editor,/planRobotMeeting\(\{\.\.\.start,y:robot\.position\.y\},\{x:target\.position\.x,y:target\.position\.y,z:target\.position\.z\},obstacles\)/);
 assert.match(editor,/canMeetRobot\(/);
 assert.match(editor,/refreshRobotRoute\(robot\)/);
 assert.match(editor,/avoidMovingRobot\(robot,other\)/);
 assert.match(editor,/const obstacles=allObstacles\.filter\(o=>o.kind!=='robot'\)/);
 assert.match(robots,/onMove\.refreshRoute\?\.\(robot\)/);
 assert.match(robots,/onMove\.avoidRobot\?\.\(robot,neighbour\)/);
 assert.match(robots,/robotYieldSince/);
 assert.match(source('js/studio.js'),/if\(localYield\|\|!bot\?\.userData\.robotBrain\?\.initiativeVision/);
 assert.match(backend,/brief casual aside about what caught your attention/);
});
test('avatar near a wall can walk away through a real doorway without crossing its masonry',async()=>{
 const {planRobotTravelRoute}=await import('../js/robot-pathfinding.js');
 const start={x:2.68,z:0},outside={x:0,z:-4};
 const route=planRobotTravelRoute(start,outside,room);
 assert.ok(route?.length,'Initial capsule is within conservative wall padding, but not physically inside masonry');
 for(const p of route)assert.equal(pathBlocked(p.x,p.z,room,0),false);
 assert.ok(route.some(p=>p.z< -1.5));
});
