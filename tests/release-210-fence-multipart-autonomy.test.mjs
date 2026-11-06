import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planRobotTravelRoute,robotRouteCheckpoints,pathBlocked,plannedPathLength} from '../js/robot-pathfinding.js';
import {infrastructureNavigationFootprints} from '../js/robot-infrastructure-obstacles.js';
const read=rel=>readFileSync(new URL('../'+rel,import.meta.url),'utf8');
const fence=(a,b,id='fence')=>infrastructureNavigationFootprints([
 {start:a,end:b,length:Math.hypot(b[0]-a[0],b[1]-a[1])}
 ],(x,z)=>({x,z}),{infraType:'fence',infraThickness:.14},{id,name:'A long white picket fence'});
function verify(start,end,obs,path){
 assert.ok(path?.length,'must plan an actual multi-step route');
 assert.ok(Math.hypot(path.at(-1).x-end.x,path.at(-1).z-end.z)<.12,'exact original destination required');
 let last=start;
 for(const step of path){const d=Math.hypot(step.x-last.x,step.z-last.z);
  for(let i=1,n=Math.ceil(d/.07);i<=n;i++){const t=i/n;
   assert.equal(pathBlocked(last.x+(step.x-last.x)*t,last.z+(step.z-last.z)*t,obs,.295),false,'must never cross fence');
  }last=step;
 }
}
test('the route actually follows 120–320m picket fences to a physical end and around it',()=>{
 for(const span of [120,160,220,320]){
  const start={x:0,z:-5},end={x:0,z:5},obs=fence([-span/2,0],[span/2,0],`fence-${span}`);
  const path=planRobotTravelRoute(start,end,obs);
  verify(start,end,obs,path);
  assert.ok(path.some(p=>Math.abs(p.x)>span/2+.28),`detour must round the ${span}m barrier end`);
  assert.ok(plannedPathLength(start,path)>span*.9);
  const checkpoints=robotRouteCheckpoints(start,path,obs);
  assert.ok(checkpoints.length>0,`at least one observable route bend for ${span}m barrier`);
  assert.ok(checkpoints.every(c=>path.some(p=>p.x===c.x&&p.z===c.z)));
 }
});
test('angled long fence uses actual rotated geometry, not a guessed cross-fence line',()=>{
 const obs=fence([-65,-40],[65,40]);const start={x:-5,z:12},end={x:5,z:-12};
 // Their relative sides of a diagonal fence are opposite.
 const path=planRobotTravelRoute(start,end,obs);
 verify(start,end,obs,path);
 assert.ok(plannedPathLength(start,path)>35);
});
test('unreachable enclosed target is never counted as an arrival',()=>{
 const obstacles=[{minX:-200,maxX:200,minZ:20,maxZ:24,kind:'wall'}];
 assert.equal(planRobotTravelRoute({x:0,z:0},{x:0,z:100},obstacles),null);
});
test('only meaningful obstacle bends create a local scan checkpoint',()=>{
 const start={x:0,z:0},straight=[{x:0,z:15},{x:0,z:40}];
 assert.deepEqual(robotRouteCheckpoints(start,straight,fence([-10,20],[10,20])),[]);
 assert.deepEqual(robotRouteCheckpoints(start,[{x:5,z:0},{x:5,z:5},{x:20,z:5}],[]),[]);
});
test('blocked path debug never renders an impossible straight red route',()=>{
 const visuals=read('js/robot-path-visuals.js');
 assert.match(visuals,/if\(!blocked&&points\.length>1\)group\.add\(ribbon/);
 assert.match(visuals,/if\(!blocked&&dest/);
 const editor=read('js/editor.js');
 assert.match(editor,/robotRouteCheckpoints\(start,waypoints,obstacles\)/);
 assert.match(editor,/inspectRobotRouteCheckpoint\(robot,reached\)/);
 assert.match(editor,/remainingRouteBlocked\(/);
 assert.match(editor,/status:'blocked',reason:'Remaining detour obstructed at observation checkpoint'/);
});
test('checked waypoints interrupt for raw head scans, never finish the original mission',()=>{
 const bots=read('js/robots.js'),life=read('js/robot-life.js');
 assert.match(bots,/robotRouteCheckpointHoldUntil=Date\.now\(\)\+1400/);
 assert.match(bots,/if\(check==='scan'\)/);
 assert.match(life,/event\.taskId!==life\.active\.taskId/);
 assert.match(life,/for\(const yaw of \[-55,0,55\]\)/);
 assert.match(life,/not Meta-analysed/);
 assert.match(life,/mission\.scans=\(mission\.scans\|\|0\)\+1/);
});
test('long routes renew the same server authorisation, and never extend a consumed or foreign token',()=>{
 const server=read('backend/server.py'),life=read('js/robot-life.js');
 for(const pattern of [/data\.get\('renew'\) is True/, /lease\[2\]==user\['id'\]/,
   /hmac\.compare_digest\(last\[1\],task_id\[5:\]\)/,
   /ROBOT_LIFE_LEASES\[key\]=\(stamp,last\[1\],last\[2\],False\)/])
  assert.match(server,pattern);
 assert.match(life,/renew:true,task_id:mission\.taskId/);
 assert.match(life,/if\(bot\.userData\.robotMission\?\.taskId===mission\.taskId\)interruptRobotMission\(bot\)/);
});
test('a barrier scan uses existing Meta vision budget and a validated client-reported mission',()=>{
 const server=read('backend/server.py'),life=read('js/robot-life.js');
 assert.match(life,/api\/robots\/perception\/start/);
 assert.match(life,/api\/robots\/perception\/complete/);
 assert.match(life,/life_target_id/);
 assert.match(server,/life_task_id/);
 assert.match(server,/client-reported-life-detour/);
 assert.match(server,/if now_stamp-last<120/);
 assert.match(server,/if used>=80/);
});
