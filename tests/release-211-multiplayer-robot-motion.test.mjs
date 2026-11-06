import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {robotPosePacket,validatedPose,appendRobotPose,sampleRobotPose} from '../js/robot-motion-sync.js';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const snap=(x,z,mode='walk',seq=1,yaw=0)=>({type:'robot-motion',by:'controller',id:'robot_example_12',mode,seq,position:[x,0,z],rotation:[0,yaw,0]});

test('network packet sends owner coordinates, yaw, gait, sequence, and no scene mutations',()=>{
 const bot={position:{x:1.23456,y:0,z:2.34567},rotation:{y:1.24158},userData:{editorId:'robot_example_12'}};
 assert.deepEqual(robotPosePacket(bot,12,'walk'),{type:'robot-motion',id:'robot_example_12',seq:12,position:[1.235,0,2.346],rotation:[0,1.2416,0],mode:'walk'});
 assert.equal(robotPosePacket(bot,13,'malicious').mode,'idle');
 assert.equal(validatedPose({...snap(0,0),position:[NaN,0,0]}),null);
 assert.equal(validatedPose({...snap(0,0),seq:-1}),null);
 assert.equal(validatedPose({...snap(0,0),mode:'unknown'}),null);
});
test('interpolates every animation frame between actual owner path points, including turns',()=>{
 let stream=appendRobotPose(null,snap(0,0,'walk',1,0),1000,{x:0,y:0,z:0,yaw:0});
 stream=appendRobotPose(stream,snap(0,1,'walk',2,0),1120,{x:0,y:0,z:0,yaw:0});
 stream=appendRobotPose(stream,snap(1,1,'walk',3,Math.PI/2),1240,{x:0,y:0,z:0,yaw:0});
 const first=sampleRobotPose(stream,1190,130); // t=1060: halfway along original segment
 assert.ok(Math.abs(first.z-.5)<.02&&Math.abs(first.x)<.02,JSON.stringify(first));
 const bend=sampleRobotPose(stream,1310,130); // t=1180: halfway along second segment
 assert.ok(Math.abs(bend.x-.5)<.02&&Math.abs(bend.z-1)<.02,JSON.stringify(bend));
 assert.ok(Math.abs(bend.yaw-Math.PI/4)<.02);
 assert.equal(bend.mode,'walk');assert.equal(bend.moving,true);
});
test('idle packet ends movement without slow ghost drift or a forced teleport',()=>{
 let stream=appendRobotPose(null,snap(0,0),1000,{x:0,y:0,z:0,yaw:0});
 stream=appendRobotPose(stream,snap(0,1,'walk',2),1120);
 stream=appendRobotPose(stream,snap(0,1,'idle',3),1240);
 const stop=sampleRobotPose(stream,1450,145);
 assert.equal(stop.z,1);assert.equal(stop.mode,'idle');assert.equal(stop.moving,false);
 assert.equal(sampleRobotPose(stream,2600,145).mode,'idle');
});
test('out-of-order position samples cannot rewind a live robot',()=>{
 let stream=appendRobotPose(null,snap(0,0,'walk',10),1000);
 stream=appendRobotPose(stream,snap(0,1,'walk',12),1110);
 const ignored=appendRobotPose(stream,snap(100,100,'walk',11),1120);
 assert.equal(ignored,stream);
 assert.equal(sampleRobotPose(stream,1300).z,1);
});
test('reconnecting after a gap resets the stream; far checkpoints do not invent lines through walls',()=>{
 let stream=appendRobotPose(null,snap(30,30,'walk',4),1000,{x:0,y:0,z:0,yaw:0});
 assert.equal(stream.frames.length,1); // no fictional 42m straight motion
 stream=appendRobotPose(stream,{...snap(10,2,'walk',1),by:'new-controller'},4000,{x:10,y:0,z:2,yaw:0});
 assert.equal(stream.frames.at(-1).x,10);
 assert.ok(stream.frames.every(f=>f.x===10));
});
test('renderer uses motion snapshots while manual input keeps predictive integrator',()=>{
 const editor=read('js/editor.js'),live=read('js/live.js'),backend=read('backend/server.py');
 assert.match(editor,/this\.remoteRobotMotion\.set\(state\.id,stream\)/);
 assert.match(editor,/sampleRobotPose\(stream,now\)/);
 assert.match(editor,/window\.solviRoomSocket\?\.send\(robotPosePacket\(bot,seq,mode\)\)/);
 assert.match(editor,/this\.remoteRobotMotion\.delete\(packet\.id\)/);
 assert.match(editor,/this\.remoteInput\.set\(packet\.id,/);
 assert.match(editor,/performance\.now\(\)-this\.remoteRobotMotion\.get\(id\)\.received<2300/);
 assert.match(editor,/now-\(o\.userData\.lastMissionSave\|\|0\)>5000/);
 assert.match(live,/applyRobotMotion\(m\)/);
 assert.match(backend,/last_robot_motion\[identifier\]=clock/);
 assert.match(backend,/'seq':seq/);
 assert.match(backend,/may_edit\(uid,controlled,room_policy\(room_id\),ws_admin_enabled\(\)\)/);
});
