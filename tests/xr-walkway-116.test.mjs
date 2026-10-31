import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sanitiseStairs,stairSegments} from '../js/office-stairs-math.js';
import {conveyorStep,xrConveyorFoot} from '../js/transport-support.js';
const source=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const s=sanitiseStairs({points:[[0,0],[4,0]],variant:'walkway',width:2,height:0.2,steps:12,transport:{speed:1,direction:1,enabled:true,controlsEnabled:true,controlsSide:'left'}});
const segments=stairSegments(s);
test('XR tread carrying takes virtual standing feet instead of head height',()=>{
 assert.deepEqual(xrConveyorFoot({x:1,y:1.84,z:0},.14),{x:1,y:.14,z:0});
 assert.deepEqual(xrConveyorFoot({x:1,y:13.84,z:0},12.14),{x:1,y:12.14,z:0});
 assert.equal(xrConveyorFoot({x:1,y:7,z:0},.14),null);
 assert.equal(xrConveyorFoot({x:1,y:1.84,z:0},NaN),null);
});
test('flat walkway carries forward and back, never moving people outside width/height',()=>{
 const go=conveyorStep({x:1,y:.14,z:0},s,segments,.05);
 assert.ok(go);assert.ok(go.x>.049&&go.x<.051);assert.equal(go.z,0);assert.ok(Math.abs(go.y)<1e-6);
 const reverse={...s,transport:{...s.transport,direction:-1}};
 assert.ok(conveyorStep({x:1,y:.14,z:0},reverse,segments,.05).x<0);
 assert.equal(conveyorStep({x:1,y:.14,z:2},s,segments,.05),null);
 assert.equal(conveyorStep({x:1,y:2,z:0},s,segments,.05),null);
 assert.equal(conveyorStep({x:4,y:.14,z:0},s,segments,.05).x,0);
});
test('XR escalator follows the tread height and supports the upper landing',()=>{
 const escalator=sanitiseStairs({...s,variant:'escalator',height:2,steps:8});
 const flight=stairSegments(escalator);
 const offset=conveyorStep({x:.7,y:flight[1].top,z:0},escalator,flight,.05);
 assert.ok(offset);assert.ok(offset.x>0);assert.ok(Number.isFinite(offset.y));
});
test('optional endpoint controls persist in config, with legacy opt-out default',()=>{
 assert.equal(s.transport.controlsEnabled,true);assert.equal(s.transport.controlsSide,'left');
 assert.equal(sanitiseStairs({points:s.points,variant:'walkway'}).transport.controlsEnabled,false);
 assert.equal(sanitiseStairs({points:s.points,variant:'walkway',transport:{controlsEnabled:true,controlsSide:'wrong'}}).transport.controlsSide,'right');
 assert.equal(sanitiseStairs({points:s.points,variant:'walkway',transport:{changedAt:Infinity}}).transport.changedAt,0);
});
test('in-world transport controls route pointer and WebXR through same action',()=>{
 const office=source('js/office-stairs.js'),editor=source('js/editor.js'),world=source('js/world.js'),live=source('js/live.js');
 assert.match(office,/for\(const end of \[0,1\]\)/);assert.match(office,/transportAction=action/);
 assert.match(editor,/hitTransportButton\(raycaster\)/);assert.match(editor,/activateTransportButton\(button\)/);
 assert.match(editor,/applyRemoteTransportControl\(packet\)/);
 assert.match(world,/hitTransportButton\?\.\(this\.raycaster\)/);assert.match(world,/activateTransportButton\(selection\.liftButton\)/);
 assert.match(live,/conveyor-control/);
});
test('the XR reference moves in 3D for walkway riders and not for spectators',()=>{
 const sourceText=source('js/stair-transport.js');
 assert.match(sourceText,/xrConveyorFoot\(head,world\.xrStandingSurfaceY\)/);
 assert.match(sourceText,/conveyorStep\(localFoot,cfg,segments,step\)/);
 assert.match(sourceText,/world\.shiftXRViewer\(\{x:movement\.x,y:movement\.y,z:movement\.z\}\)/);
 assert.match(sourceText,/movement\.length\(\)<\.25/);
 assert.match(sourceText,/!xrCarried/);
});
test('transport socket command validates owner and timestamp, and saved payload remains bounded',()=>{
 const server=source('backend/server.py');
 assert.match(server,/elif msg\.get\('type'\)=='conveyor-control'/);
 assert.match(server,/may_edit\(uid,device,room_policy\(room_id\),ws_admin_enabled\(\)\)/);
 assert.match(server,/abs\(stamp-time\.time\(\)\*1000\)>15000/);
 assert.match(server,/controlsEnabled/);
 const html=source('index.html');
 assert.match(html,/id="stairTransportControlsEnabled"/);assert.match(html,/id="stairTransportControlsSide"/);
});

test('stale saved conveyor state cannot override a newer received command',()=>{
 const editor=source('js/editor.js'),runtime=source('js/stair-transport.js');
 assert.match(editor,/latest>\(Number\(entry\.stairs\?\.transport\?\.changedAt\)\|\|0\)/);
 assert.match(editor,/incomingStairs=\{\.\.\.entry\.stairs,transport:structuredClone\(previous\)\}/);
 assert.match(runtime,/if\(transport\.enabled!==false\)runtime\.phase=conveyorPhase/);
});
