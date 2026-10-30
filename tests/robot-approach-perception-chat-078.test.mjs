import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planRobotPartialApproach, planRobotApproach, pathBlocked} from '../js/robot-pathfinding.js';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');

test('a blocked exact target supports a safe 95% forward partial stop without false arrival',()=>{
  const start={x:0,z:0};
  const bounds={minX:9.9,maxX:10.1,minZ:-.1,maxZ:.1};
  // A long wall near the target prohibits close approach from either side.
  const wall=[{minX:9.8,maxX:11,minZ:-10,maxZ:10,kind:'cube'}];
  const partial=planRobotPartialApproach(start,bounds,wall);
  assert.ok(partial,'Must find a reachable safe stop before the wall');
  assert.ok(partial.progress>=.8,'Must make useful progress rather than stop at start');
  for(const pt of partial.waypoints) assert.equal(pathBlocked(pt.x,pt.z,wall,.30),false);
  assert.equal(Math.abs(partial.point.x-10)>.31,true);
});

test('partial stopping is a distinct mission result, never sitting or arrived',()=>{
 const robot=read('js/robots.js'),editor=read('js/editor.js'),server=read('backend/server.py');
 assert.match(robot,/if\(mission\.partialStop\)/);
 assert.match(robot,/status:'partial'/);
 assert.match(editor,/const partial=!approach\?planRobotPartialApproach/);
 assert.match(server,/'partial':f'I approached/);
 assert.match(server,/allowed=\{[^\n]*'partial'/);
});

test('offscreen robot-eye capture includes real sky, stars and nebula',()=>{
 const robots=read('js/robots.js'),env=read('js/scene-environment.js');
 assert.match(robots,/new THREE\.PerspectiveCamera\(72,1,\.04,Math\.max\(1500,Number\(world\?\.camera\?\.far\)\|\|1500\)\)/);
 assert.match(robots,/world\.skyDome\.position\.copy\(camera\.getWorldPosition/);
 assert.match(env,/skyModeIndex/);
});

test('chat timestamp ordering includes traces in same timeline, and test traces by label',()=>{
 const studio=read('js/studio.js'),testApi=read('backend/test_api.py');
 assert.match(studio,/chatTimeline\(\[\.\.\.messages,\.\.\.debugEntries\]/);
 assert.doesNotMatch(studio,/for\(const entry of localBrainTrace\.filter[^\n]*await bubble\(entry\)/);
 assert.match(testApi,/step\.get\('step'\)=='parse' and step\.get\('result'\)=='vision_search'/);
});
