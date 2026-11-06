import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {surfaceHeight,conveyorStep} from '../js/transport-support.js';
import {stairSegments} from '../js/office-stairs-math.js';
import {projectPath,pathAt} from '../js/stair-extensions.js';
const source=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('stair height lookup rejects missing or non-finite segment indexes rather than crashing the frame',()=>{
 const segments=[{top:.3},{top:.6},{top:1}];
 for(const x of [NaN,Infinity,-Infinity,undefined])assert.equal(surfaceHeight(segments,x,3),null);
 for(const total of [NaN,0,-1,Infinity,undefined])assert.equal(surfaceHeight(segments,1,total),null);
 assert.equal(surfaceHeight([],1,3),null);
 assert.equal(surfaceHeight([undefined],1,3),null);
 assert.equal(surfaceHeight(segments,0,3),.3);
 assert.equal(surfaceHeight(segments,1.5,3),.6);
 assert.equal(surfaceHeight(segments,3,3),1);
 assert.equal(surfaceHeight(segments,-5,3),.3);
});

test('non-finite path coordinates from a climbing dismount cannot enter a conveyor segment index',()=>{
 const cfg={points:[[0,0],[4,0]],width:1.6,height:2,steps:8,variant:'escalator',transport:{enabled:true,speed:.5}};
 const segments=stairSegments(cfg);
 assert.equal(projectPath(cfg.points,NaN,0),null);
 assert.equal(projectPath(cfg.points,0,Infinity),null);
 assert.equal(pathAt(cfg.points,NaN),null);
 assert.equal(conveyorStep({x:NaN,y:0,z:0},cfg,segments,.016),null);
 assert.equal(conveyorStep({x:0,y:0,z:0},cfg,[undefined],.016),null);
});

test('a transport marker with invalid saved phase does not throw in the actual stair tick',()=>{
 class Vector3{
  constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
  copy(p){Object.assign(this,{x:p.x,y:p.y,z:p.z});return this;}
  applyMatrix4(){return this;}
  clone(){return new Vector3(this.x,this.y,this.z);}
 }
 const text=source('js/stair-transport.js').replace(/^import .*;\s*$/gm,'').replaceAll('export function ','function ');
 const dependencies={THREE:{Vector3},projectPath,pathAt,stairSegments,surfaceHeight,conveyorStep,
  conveyorSupport:()=>false,conveyorPhase:()=>0,xrConveyorFoot:()=>null,
  updateLiftPanel:()=>{},liftChime:()=>{},moveTransportRider:()=>false,
  safeLiftMotion:()=>null,liftBaseY:()=>0,liftHeightAt:()=>0,liftMotionFinished:()=>false,
  motionSnapshot:()=>null,canCarryLiftRider:()=>false,xrCabinSupport:()=>false,liftTargetHeight:()=>0};
 const tick=new Function(...Object.keys(dependencies),`${text}\nreturn tickStairTransport;`)(...Object.values(dependencies));
 const marker={userData:{transportMarker:true,transportPhase:NaN},position:{set(){throw Error('Invalid marker must never move');}}};
 const device={userData:{editorKind:'stairs',editorId:'stairs-1',stairs:{variant:'escalator',points:[[0,0],[4,0]],width:1.6,height:2,steps:8,transport:{speed:.5}}},
  children:[marker],position:{x:0,y:0,z:0},matrixWorld:{clone(){return {invert(){return {};}};}},updateMatrixWorld(){}};
 const robot={userData:{editorKind:'robot',editorId:'robot-1'},position:{x:NaN,y:2,z:0}};
 const editor={items:[device,robot],physics:{enabled:true,owns:()=>true},world:{renderer:{xr:{isPresenting:false}}}};
 assert.doesNotThrow(()=>tick(editor,.016));
});

test('climbing speed is adjustable per avatar, used for wall and ladder movement, and persists',()=>{
 const editor=source('js/editor.js'),ladder=source('js/office-ladder.js'),robots=source('js/robots.js');
 const html=source('index.html'),backend=source('backend/server.py');
 assert.match(html,/<option value="robotClimbSpeed">Climb<\/option>/);
 assert.match(html,/id="robotClimbSpeed" min="0.2" max="4" step="0.05"/);
 assert.match(editor,/robotClimbSpeed=Number\(climb\.value\)/);
 assert.match(editor,/climbSpeed:o\.userData\.editorKind==='robot'/);
 assert.match(editor,/o\.userData\.robotClimbSpeed=entry\.climbSpeed\?\?1\.25/);
 assert.match(editor,/duplicate\.userData\.robotClimbSpeed=entry\.climbSpeed\?\?1\.25/);
 assert.match(editor,/obj\.userData\.robotClimbSpeed=entry\.climbSpeed\?\?1\.25/);
 assert.match(ladder,/robot\.userData\.robotClimbSpeed\?\?1\.25/);
 assert.match(robots,/Number\(data\.robotClimbSpeed\)\|\|1\.25/);
 assert.match(backend,/Invalid robot climb speed/);
 assert.match(backend,/Invalid climb speed/);
 assert.match(backend,/'turnSpeed','runMultiplier','climbSpeed','backpackEnabled','combat'/);
});
