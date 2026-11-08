import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {robotSegmentClear,shortcutRobotWaypoints,smoothRobotWaypoints,smoothRobotWaypointsWithCheckpoints} from '../js/robot-path-smoothing.js';
import {pathBlocked,plannedPathLength,planRobotTravelRoute} from '../js/robot-pathfinding.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

const trace=(start,points,obstacles)=>{let previous=start;
 for(const point of points){
  assert.ok(robotSegmentClear(previous,point,obstacles,.30),`unsafe segment ${JSON.stringify(previous)} → ${JSON.stringify(point)}`);
  for(let i=0,n=Math.max(1,Math.ceil(Math.hypot(point.x-previous.x,point.z-previous.z)/.04));i<=n;i++){
   const t=i/n,x=previous.x+(point.x-previous.x)*t,z=previous.z+(point.z-previous.z)*t;
   assert.equal(pathBlocked(x,z,obstacles,.30),false,`intersection at ${x}, ${z}`);
  }
  previous=point;
 }
};
test('open-space left/right A* zigzags collapse to ONE straight line',()=>{
 const start={x:0,z:0};
 const raw=[{x:1,z:0},{x:2,z:.4},{x:3,z:-.4},{x:4,z:.5},{x:5,z:-.5},{x:6,z:.5},{x:7,z:0}];
 const result=smoothRobotWaypoints(start,raw,[]);
 assert.deepEqual(result,[raw.at(-1)]);
 assert.equal(plannedPathLength(start,result),7);
});
test('a thin wall cannot be skipped between path samples',()=>{
 const barrier=[{minX:2.001,maxX:2.006,minZ:-.4,maxZ:.4}];
 assert.equal(robotSegmentClear({x:0,z:0},{x:5,z:0},barrier),false);
 const raw=[{x:1,z:1.2},{x:3,z:1.2},{x:5,z:0}];
 const shortened=shortcutRobotWaypoints({x:0,z:0},raw,barrier);
 assert.ok(shortened.length>=2);
 trace({x:0,z:0},shortened,barrier);
});
test('real 90-degree obstacle detour is retained but adjacent small zigzags disappear',()=>{
 const start={x:0,z:0},end={x:8,z:0};
 const barriers=[{minX:3,maxX:5,minZ:-1,maxZ:1,kind:'wall'}];
 const raw=planRobotTravelRoute(start,end,barriers);
 assert.ok(raw?.length);
 const clean=smoothRobotWaypoints(start,raw,barriers);
 assert.deepEqual(clean.at(-1),end);
 assert.ok(plannedPathLength(start,clean)>=8);
 assert.ok(plannedPathLength(start,clean)<=plannedPathLength(start,raw)+.02);
 trace(start,clean,barriers);
});
test('departure from an inflated obstacle pad keeps the original A* route unchanged',()=>{
 const start={x:0,z:0},wall=[{minX:.15,maxX:.30,minZ:-.3,maxZ:.3}];
 const path=[{x:0,z:1},{x:2,z:1},{x:2,z:0}];
 assert.strictEqual(shortcutRobotWaypoints(start,path,wall),path);
});
test('all real eye-capture sources can request a wide preview, not just timed reconnaissance',()=>{
 const studio=read('js/studio.js'),editor=read('js/editor.js');
 assert.match(studio,/addEventListener\('solvi:robot-eye-frame'/);
 assert.match(studio,/solvi:robot-eyes-wide-request/);
 assert.match(studio,/const wideSurveyBusy=new Set\(\)/);
 assert.match(studio,/if\(window\.solviEditor\?\.controlledRobotId===frame\.robotId\)/);
 assert.match(studio,/captureRobotWideSurvey\(view=>captureRobotView/);
 assert.match(studio,/\^Stitched wide eyes/);
 assert.match(studio,/form\.append\('frame',photo/);
 assert.match(editor,/widePreviewRequests=new Map\(\)/);
 assert.match(editor,/solvi:robot-eyes-wide-request/);
 assert.match(editor,/widePreviewRequests\.clear\(\)/);
});

test('mandatory barrier camera checkpoints are visited exactly while avoidable in-between zigzags vanish',()=>{
 const start={x:0,z:0};
 const raw=[{x:1,z:.25},{x:2,z:-.25},{x:3,z:0},{x:4,z:2},{x:5,z:2.3},{x:6,z:1.7},{x:7,z:2}];
 const checkpoint={x:3,z:0,metres:3.1};
 const result=smoothRobotWaypointsWithCheckpoints(start,raw,[],[checkpoint]);
 assert.deepEqual(result,[{x:3,z:0},{x:7,z:2}]);
 assert.ok(result.some(p=>p.x===checkpoint.x&&p.z===checkpoint.z));
 trace(start,result,[]);
});
