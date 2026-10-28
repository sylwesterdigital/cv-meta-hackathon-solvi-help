import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planRobotPath,pathBlocked} from '../js/robot-pathfinding.js';
import {observationPlan} from '../js/robot-observation.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('A* finds a collision-clear route around a chair, never cuts a corner',()=>{
 const obstacles=[{minX:1.5,maxX:2.5,minZ:-.75,maxZ:.75}];
 const path=planRobotPath({x:0,z:0},{x:4,z:0},obstacles,{cell:.45,clearance:.30});
 assert.ok(path?.length>2,JSON.stringify(path));
 assert.ok(path.some(p=>Math.abs(p.z)>.95));
 let from={x:0,z:0};for(const p of path){
  for(let t=0.08;t<=1.000001;t+=.08){const a=Math.min(t,1);
   const x=from.x+(p.x-from.x)*a,z=from.z+(p.z-from.z)*a;
   assert.equal(pathBlocked(x,z,obstacles,.29),false,`path crosses chair at ${x},${z}`);
  }from=p;
 }
 assert.ok(Math.hypot(path.at(-1).x-4,path.at(-1).z)<.7);
});
test('A* avoids robot footprint, and rejects impossible occupied route',()=>{
 const robot={minX:.95,maxX:1.45,minZ:-.45,maxZ:.45};
 const path=planRobotPath({x:0,z:0},{x:3,z:0},[robot]);
 assert.ok(path?.some(p=>Math.abs(p.z)>.75));
 const impossible=[{minX:-3,maxX:3,minZ:-3,maxZ:3}];
 assert.equal(planRobotPath({x:0,z:0},{x:7,z:0},impossible),null);
});
test('Properties contain one collapsible Transform, real eye scans and icon-only controls',()=>{
 const html=read('index.html'),css=read('styles.css'),editor=read('js/editor.js'),brains=read('js/robot-brains.js');
 for(const id of ['robotTransformDetails','propertyGrid','inspectorValueSlider','robotEyesDetails','robotEyeFront','robotEye180','robotEye360','captureBrainsHemisphere'])assert.match(html,new RegExp('id="'+id+'"'));
 for(const icon of ['move','rotate','scale'])assert.match(html,new RegExp('data-ui-icon="'+icon+'"'));
 assert.match(css,/#propertiesPanel #inspectorValueSlider #inspectorActiveRange/);
 assert.match(css,/html\[data-button-labels='icon'\] #propertiesPanel #propertyGrid button\.transform-reset/);
 assert.doesNotMatch(html,/↑ forward · ↓ reverse/);
 assert.match(editor,/planRobotPath/);
 assert.match(editor,/solvi:robot-eyes-action/);
 assert.match(brains,/sweepRobotEyes\(180\)/);
 assert.match(read('backend/server.py'),/blocked.*without crossing an occupied or blocked area/);
});

test('180-degree spoken request captures seven genuine directional views; 360 keeps eight',()=>{
 assert.deepEqual(observationPlan('Jessica, look around 180 degrees').map(p=>p.yaw),[-90,-60,-30,0,30,60,90]);
 assert.equal(observationPlan('Paris, look around 360 degrees').length,8);
 const brains=read('js/robot-brains.js'),api=read('backend/server.py'),map=read('js/minimap.js');
 assert.match(brains,/manual:true,question:/);
 assert.match(brains,/api\.req\('\/api\/robots\/vision-reply'/);
 assert.match(api,/manual=data\.get\('manual'\) is True/);
 assert.match(api,/if manual and \(proactive or message_id\)/);
 assert.match(api,/if key in ROBOT_VISION_MESSAGES:return json_error/);
 assert.match(map,/selected\.userData\.robotWaypoints/);
});
