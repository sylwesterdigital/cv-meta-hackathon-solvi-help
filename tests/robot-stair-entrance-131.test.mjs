import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {lowStairEntranceCandidates,planRobotLowStairApproach} from '../js/robot-stair-approach.js';
import {pathBlocked} from '../js/robot-pathfinding.js';

const stairs={variant:'advanced',points:[[0,0],[12,0]],height:3.6,steps:24,width:2.1};
const treads=Array.from({length:24},(_,i)=>({minX:i*.5,maxX:(i+1)*.5,minZ:-1.05,maxZ:1.05,name:'Stairs advanced section '+i}));

test('stair entrance is grounded in the FIRST (low) step, never stair centre or high end',()=>{
 const candidates=lowStairEntranceCandidates(stairs);
 assert.equal(candidates.length,12);
 assert.ok(candidates.every(c=>c.x<0&&Math.abs(c.z)<stairs.width*.5));
 assert.ok(candidates.some(c=>Math.abs(c.z)<1e-8));
 assert.deepEqual(lowStairEntranceCandidates({points:[[0,0]]}),[]);
});

test('robot at the HIGH end routes around real step footprints to the low landing',()=>{
 const from={x:13,z:0};
 const chosen=planRobotLowStairApproach(from,stairs,treads);
 assert.ok(chosen,'must find safe route around side of staircase');
 assert.ok(chosen.point.x<0,'destination must be below first tread');
 assert.ok(chosen.waypoints.length>=2,'must detour rather than walk through the stairs');
 let prev=from;
 for(const node of chosen.waypoints){
  for(let j=1;j<=30;j++){
   const t=j/30;
   const x=prev.x+(node.x-prev.x)*t,z=prev.z+(node.z-prev.z)*t;
   assert.equal(pathBlocked(x,z,treads,.30),false,`path must not cut through stairs at ${x},${z}`);
  }
  prev=node;
 }
 assert.ok(Math.hypot(prev.x-chosen.point.x,prev.z-chosen.point.z)<.14);
});

test('rotation and translation are respected when projecting local stair entrance',()=>{
 // 180° around Y places the low entrance on the opposite world side.
 const project=({x,z})=>({x:20-x,z:10-z});
 const chosen=planRobotLowStairApproach({x:6,z:11},stairs,treads.map(o=>({minX:20-o.maxX,maxX:20-o.minX,minZ:10-o.maxZ,maxZ:10-o.minZ})),project);
 assert.ok(chosen);
 assert.ok(chosen.point.x>20,'projected low entrance must not be replaced by origin or high end');
});

test('blocked base does not choose a high/side entry or fall back to partial success',()=>{
 const obstacles=[...treads,{minX:-4,maxX:0,minZ:-4,maxZ:4}];
 assert.equal(planRobotLowStairApproach({x:13,z:0},stairs,obstacles),null);
});

test('editor, mission and server use the directional stair approach, not generic all-sides or arrival claims',()=>{
 const editor=fs.readFileSync(new URL('../js/editor.js',import.meta.url),'utf8');
 const server=fs.readFileSync(new URL('../backend/server.py',import.meta.url),'utf8');
 const robots=fs.readFileSync(new URL('../js/robots.js',import.meta.url),'utf8');
 assert.match(editor,/isStairEntrance\?\s*planRobotLowStairApproach/);
 assert.match(editor,/partial=!approach&&!isStairEntrance/);
 assert.match(editor,/wholePath:true/);
 assert.match(editor,/Low stair entrance inaccessible/);
 assert.match(editor,/destinationPart:'low stair entrance'/);
 assert.match(robots,/mission\.destinationPart/);
 assert.match(server,/def stair_approach_instruction/);
 assert.match(server,/the low entrance at the first step/);
 assert.match(server,/Never claim a stair ascent without a verified ascent task/);
});
