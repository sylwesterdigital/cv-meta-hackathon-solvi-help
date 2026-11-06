import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {robotPosePacket,appendRobotPose,sampleRobotPose} from '../js/robot-motion-sync.js';
const source=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('robot pose packets and interpolation preserve full multi-storey elevation',()=>{
 const bot={position:{x:1,y:12.12,z:-4},rotation:{y:.4},userData:{editorId:'robot-example-1234'}};
 const first=robotPosePacket(bot,10,'walk');
 assert.equal(first.position[1],12.12);
 bot.position={x:2,y:15.12,z:-4};
 const second=robotPosePacket(bot,11,'walk');
 let stream=appendRobotPose(null,{...first,by:'owner'},1000,{x:1,y:12.12,z:-4,yaw:.4});
 stream=appendRobotPose(stream,{...second,by:'owner'},1120);
 const midway=sampleRobotPose(stream,1190,130);
 assert.ok(Math.abs(midway.y-13.62)<.002,`Expected mid-storey interpolation, got ${midway.y}`);
 assert.equal(sampleRobotPose(stream,1430).y,15.12);
});

test('manual keyboard movement also transmits authoritative snapshots without a feedback loop',()=>{
 const editor=source('js/editor.js');
 assert.match(editor,/const moving=manual\|\|Boolean\(bot\.userData\.robotGoal\|\|bot\.userData\.robotMission\)/);
 assert.match(editor,/if\(this\.remoteRobotMotion\.has\(id\)\|\|this\.remoteInput\.has\(id\)\)continue/);
 assert.match(editor,/window\.solviRoomSocket\?\.send\(robotPosePacket\(bot,seq,mode\)\)/);
 assert.match(editor,/window\.solviRoomSocket\?\.send\(\{\.\.\.packetFor\(/);
});

test('receivers use remote X Y Z as authoritative and cannot recompute gravity on another floor',()=>{
 const physics=source('js/scene-physics.js');
 const editor=source('js/editor.js');
 assert.match(physics,/const stream=this\.editor\.remoteRobotMotion\?\.get\(id\)/);
 assert.match(physics,/if\(remotePose\|\|\(!this\.owns\(object\)/);
 assert.match(physics,/body\.setTranslation\(pose,true\);body\.setNextKinematicTranslation\(pose\)/);
 assert.match(physics,/this\.driveRobot\(object,step\);continue/);
 assert.match(editor,/other\.position\.set\(pose\.x,pose\.y,pose\.z\)/);
 assert.match(editor,/if\(!preserveRobotPose\)\{obj\.position\.fromArray/);
});

test('HLS player and SOLVI-only nginx generator are unchanged; wrong Rantlist header requires separate media host fix',()=>{
 const hls=source('js/smart-media-playlist.js');
 const nginx=source('backend/configure-nginx.py');
 assert.match(hls,/each remote media host must permit CORS to https:\/\/solvi\.help/);
 assert.match(nginx,/server_name\\s\+\[\^;\\n\]\*\\bsolvi\\\.help\\b/);
 assert.doesNotMatch(nginx,/rantlist\.me/);
});
