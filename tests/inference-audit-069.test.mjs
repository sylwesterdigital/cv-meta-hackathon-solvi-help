import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {plannedRouteLength,newMovementTelemetry,sampleMovementTelemetry,missionMovementEvidence,shouldRejectClaimedArrival} from '../js/robot-telemetry.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('actual route length is computed from successive planner waypoints',()=>{
  assert.equal(plannedRouteLength({x:0,z:0},[{x:3,z:4},{x:6,z:8}]),10);
});
test('client position evidence rejects false arrival and records travelled metres',()=>{
  const robot={position:{x:0,z:0}},state=newMovementTelemetry(robot,'task123'),route={destination:{x:5,z:0}};
  let evidence=missionMovementEvidence(state,robot,route,'arrived');
  assert.equal(evidence.arrivalVerifiedByClientPosition,false);
  assert.equal(shouldRejectClaimedArrival(evidence,'arrived'),true);
  robot.position.x=2;sampleMovementTelemetry(state,robot);
  robot.position.x=4.9;evidence=missionMovementEvidence(state,robot,route,'arrived');
  assert.equal(evidence.actualTravelledMeters,4.9);
  assert.equal(evidence.arrivalVerifiedByClientPosition,true);
  assert.equal(evidence.distanceToRouteEndMeters,.1);
});
test('abrupt scene teleport cannot count as verified physical traversal',()=>{
  const robot={position:{x:0,z:0}},state=newMovementTelemetry(robot,'task456');
  robot.position.x=20;const evidence=missionMovementEvidence(state,robot,{destination:{x:20,z:0}},'arrived');
  assert.equal(evidence.abruptMovementDetected,true);
  assert.equal(evidence.arrivalVerifiedByClientPosition,false);
});
test('Brains has compact copy/download audit UI and exact text payload capture',()=>{
  const html=read('index.html'),css=read('styles.css'),brains=read('js/robot-brains.js'),studio=read('js/studio.js'),server=read('backend/server.py');
  for(const id of ['brainsTraceDetails','brainsCopyLog','brainsDownloadLog','brainsTaskTrace'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(css,/#robotBrainsPanel\{width:min\(540px/);
  assert.match(brains,/robotTraceExport/);assert.match(brains,/robotTraceText/);
  assert.match(brains,/navigator\.clipboard\.writeText/);
  assert.match(studio,/ROUTER \/ PARSER DECISION/);
  assert.match(studio,/EXACT MODEL I\/O/);
  assert.match(server,/'developer':instruction,'user':prompt/);
  assert.match(server,/'response':\{'id':str\(response\.get/);
  assert.match(server,/'model_plan_executes':False/);
});
