import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {planRobotApproach,planRobotPath,pathBlocked} from '../js/robot-pathfinding.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('navigation tries other approaches when a sofa/robot blocks the near side',()=>{
 const bounds={minX:4.5,maxX:5.5,minZ:-.5,maxZ:.5},start={x:0,z:0};
 const obstacle={minX:3.5,maxX:4.6,minZ:-1,maxZ:1};
 const near={x:3.8,z:0};
 assert.equal(pathBlocked(near.x,near.z,[obstacle]),true);
 const approach=planRobotApproach(start,bounds,[obstacle]);
 assert.ok(approach?.waypoints?.length,'an alternate route must exist');
 assert.equal(pathBlocked(approach.point.x,approach.point.z,[obstacle]),false);
 assert.ok(Math.abs(approach.point.z)>.5,'chooses another side of the target');
 let prev=start;
 for(const waypoint of approach.waypoints){
  for(let i=1;i<=20;i++){
   const f=i/20;
   assert.equal(pathBlocked(prev.x+(waypoint.x-prev.x)*f,prev.z+(waypoint.z-prev.z)*f,[obstacle],.28),false);
  }
  prev=waypoint;
 }
});

test('physically surrounded target returns null, not a false arrival',()=>{
 const bounds={minX:3.5,maxX:4.5,minZ:-.5,maxZ:.5};
 const obstacles=[{minX:1,maxX:8,minZ:-4,maxZ:4}];
 assert.equal(planRobotApproach({x:0,z:0},bounds,obstacles),null);
});

test('per-recipient parser separates two independent walking requests and preserves robot as a target',()=>{
 const script=String.raw`import ast,re
p='backend/server.py';tree=ast.parse(open(p).read());fn=next(x for x in tree.body if isinstance(x,ast.FunctionDef) and x.name=='robot_command_clause')
ns={'re':re};exec(compile(ast.Module(body=[fn],type_ignores=[]),p,'exec'),ns)
bots=[{'id':'e','name':'Elox'},{'id':'c','name':'Cybert'}]
f=ns['robot_command_clause']
assert f('@Elox go to Black Sofa and @Cybert follow Elox',bots[0],bots)=='go to Black Sofa'
assert f('@Elox go to Black Sofa and @Cybert follow Elox',bots[1],bots)=='follow Elox'
assert f('@Elox go to @Cybert and stop nearby',bots[0],bots)=='@Elox go to @Cybert and stop nearby'
assert f('@All go to Red Sphere',bots[0],bots)=='@All go to Red Sphere'
`;
 execFileSync('python3',['-c',script],{cwd:new URL('../',import.meta.url),stdio:'pipe'});
});

test('clean thumbnail previews and collapsible robot camera sources',()=>{
 const ui=source('js/ui-controls.js'),attachments=source('js/chat-attachments.js'),styles=source('styles.css'),studio=source('js/studio.js');
 assert.match(ui,/closest\?\.\('\.chat-attachment'\)/);
 assert.match(attachments,/menuButton\.textContent='⋯'/);
 assert.match(styles,/#chatFeed \.chat-attachment \.chat-image-open::before/);
 assert.match(studio,/View \$\{mids\.length-1\} camera source frames/);
 assert.match(studio,/chat-panorama-attachment/);
});

test('failed route telemetry identifies nearby scene object names without falsely claiming they blocked the route',()=>{
 const editor=source('js/editor.js'),studio=source('js/studio.js');
 assert.match(editor,/nearby_obstacles:nearby/);
 assert.match(editor,/No reachable safe approach from any tested side/);
 assert.match(studio,/NEARBY OBSTACLE FOOTPRINTS \(NOT PROVEN BLOCKERS\)/);
 assert.match(editor,/feet-centred capsule footprint/);
});
