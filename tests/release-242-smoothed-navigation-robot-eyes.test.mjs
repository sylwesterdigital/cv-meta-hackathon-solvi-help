import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {smoothRobotWaypoints} from '../js/robot-path-smoothing.js';
import {planRobotTravelRoute,pathBlocked,plannedPathLength} from '../js/robot-pathfinding.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const checkRoute=(start,waypoints,obstacles,clearance=.30)=>{
 let prev=start;
 for(const node of waypoints){
  const n=Math.max(1,Math.ceil(Math.hypot(node.x-prev.x,node.z-prev.z)/.06));
  for(let j=1;j<=n;j++){
   const f=j/n,x=prev.x+(node.x-prev.x)*f,z=prev.z+(node.z-prev.z)*f;
   assert.equal(pathBlocked(x,z,obstacles,clearance),false,`path crossed obstacle at ${x}, ${z}`);
  }
  prev=node;
 }
};
test('opt-in line of sight removes needless zigzag turns and preserves the exact destination',()=>{
 const start={x:0,z:0},raw=[{x:3,z:0},{x:3,z:3},{x:7,z:3}];
 const result=smoothRobotWaypoints(start,raw,[]);
 assert.deepEqual(result,[raw.at(-1)],'an open-space route becomes a single straight leg');
 assert.deepEqual(result.at(-1),raw.at(-1));
 assert.ok(plannedPathLength(start,result)<plannedPathLength(start,raw)*1.01);
 checkRoute(start,result,[]);
 assert.equal(smoothRobotWaypoints(start,[raw[0]],[]).length,1);
});
test('a route shortcut and rounded corner must clear all obstacle padding',()=>{
 const start={x:0,z:0},raw=[{x:3,z:0},{x:3,z:3},{x:7,z:3}];
 const wall=[{minX:2.75,maxX:3.25,minZ:.1,maxZ:1.8}];
 const result=smoothRobotWaypoints(start,raw,wall);
 assert.deepEqual(result.at(-1),raw.at(-1));
 checkRoute(start,result,wall);
});
test('genuine A* detour around a solid wall can be smoothed and remains clear',()=>{
 const start={x:0,z:0},end={x:5,z:5};
 const obstacles=[{minX:1,maxX:3,minZ:0,maxZ:3,kind:'wall'}];
 const raw=planRobotTravelRoute(start,end,obstacles);
 assert.ok(raw?.length,'route planner finds collision-free path');
 const result=smoothRobotWaypoints(start,raw,obstacles);
 assert.ok(result?.length);
 assert.deepEqual(result.at(-1),end);
 checkRoute(start,result,obstacles);
});
test('navigation UI is opt-in and uses the original path for barrier observation checkpoints',()=>{
 const editor=read('js/editor.js'),html=read('index.html');
 assert.match(editor,/smoothRobotPathsEnabled=localStorage\.getItem/);
 assert.match(editor,/this\.smoothRobotPathsEnabled=false/);
 assert.match(editor,/robotRouteCheckpoints\(start,rawWaypoints,obstacles\)/);
 assert.match(editor,/smoothRobotWaypointsWithCheckpoints\(start,rawWaypoints,obstacles,rawCheckpoints\)/);
 assert.match(editor,/robot\.userData\.robotRouteCheckpoints=rawCheckpoints/);
 assert.match(html,/id="smoothRobotWalks" type="checkbox"/);
});
test('latest genuine JPEG occupies a 16:9 panel above the avatar picker and is scoped to the active realm',()=>{
 const html=read('index.html'),css=read('styles.css'),editor=read('js/editor.js'),brain=read('js/robot-brains.js'),studio=read('js/studio.js');
 assert.match(html,/id="robotEyePreview"[^>]*aria-label="Last genuine robot head-camera image"/);
 assert.ok(html.indexOf('id="robotEyePreview"')<html.indexOf('id="controlledRobotFaces"'));
 assert.match(css,/#controlSwitcher #robotEyePreview\.robot-eye-preview\{/);
 assert.match(css,/aspect-ratio:16\/9!important/);
 assert.match(css,/object-fit:contain!important/);
 assert.match(editor,/solvi:robot-eye-frame/);
 assert.match(editor,/frame\.room!==String\(window\.solviRoom\|\|''\)/);
 assert.match(editor,/solvi:room-changed'.*eyeFrames\.clear\(\)/);
 assert.match(editor,/URL\.revokeObjectURL\(eyeURL\)/);
 assert.match(brain,/solvi:robot-eye-frame/);
 assert.match(brain,/blob,label,at,room/);
 assert.match(studio,/rememberRobotObservationFrame\(robot\.userData\.editorId,photo,`Autonomous head-camera reconnaissance/);
 assert.ok(studio.indexOf('rememberRobotObservationFrame(robot.userData.editorId,photo,`Autonomous')<studio.indexOf("form.append('frame',photo"));
 assert.match(brain,/SAM scan \$\{index\+1\}/);
});
