import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {namedRoomFurnishingInstruction,namedWorkContinuation,promisedRoomFurnishing,
 roomFurnishingSequence,enclosedRoomFootprint} from '../js/robot-room-furnishing.js';
import {workRecoveryPlan} from '../js/robot-autonomy-policy.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const src=p=>readFileSync(resolve(root,p),'utf8');
test('Lea misspelt general furniture request produces a bounded executable bed/table job',()=>{
 const original='@Lea yo uare free to add to this house more furnutures';
 assert.equal(namedRoomFurnishingInstruction(original,'Lea'),original);
 assert.deepEqual(roomFurnishingSequence(original),['bed','table']);
 assert.equal(workRecoveryPlan({goal:original,allowChanges:true}).variant,'bed');
 assert.equal(workRecoveryPlan({goal:original,allowChanges:true,projectPlaced:[{variant:'bed',id:'saved-bed'}]}).variant,'table');
 assert.equal(namedRoomFurnishingInstruction(original,'Ania'),null);
 assert.equal(namedRoomFurnishingInstruction('@Lea I love to see furniture here','Lea'),null);
 assert.equal(namedRoomFurnishingInstruction('@Lea do not add furniture here','Lea'),null);
 assert.equal(namedRoomFurnishingInstruction('@Lea can you discuss adding furniture?','Lea'),null);
});
test('An authenticated instruction to follow through is distinct from arbitrary bot speech',()=>{
 assert.equal(namedWorkContinuation('@Lea but I see you staying and doing nothing, please do what you said earlier.','Lea'),true);
 assert.equal(namedWorkContinuation('@Lea please continue the furnishing','Lea'),true);
 assert.equal(namedWorkContinuation('@Lea do not do what you promised earlier','Lea'),false);
 assert.equal(namedWorkContinuation('@Choka please do what you said earlier','Lea'),false);
 assert.equal(namedWorkContinuation('@Lea I remember the table you said earlier','Lea'),false);
 const now=Date.now();const recent=[{role:'assistant',speaker:'Lea',created:new Date(now-90000).toISOString(),text:"Yay thank you! I'll add a cozy bed and table."}];
 assert.deepEqual(promisedRoomFurnishing(recent,'Lea',now),['bed','table']);
 assert.deepEqual(promisedRoomFurnishing(recent,'Ania',now),[]);
 assert.deepEqual(promisedRoomFurnishing(recent,'Lea',now+60*60*1000),[]);
 assert.deepEqual(promisedRoomFurnishing([{...recent[0],text:'I already placed a bed and table.'}],'Lea',now),[]);
});
test('Ground-level enclosed room footprint requires a whole clear polygon, not just a centre point',()=>{
 const room=[[0,0],[6,0],[6,5],[0,5]];
 assert.equal(enclosedRoomFootprint(room,[[1,1],[2,1],[2,2],[1,2]],.22),true);
 assert.equal(enclosedRoomFootprint(room,[[-.1,1],[2,1],[2,2],[-.1,2]],.22),false);
 assert.equal(enclosedRoomFootprint(room,[[.1,1],[2,1],[2,2],[.1,2]],.22),false);
 assert.equal(enclosedRoomFootprint([],[[1,1],[2,1],[2,2],[1,2]]),false);
 assert.equal(enclosedRoomFootprint([[0,0],[1,0],[0,1]],[[.9,.9],[1,.9],[1,1],[.9,1]]),false);
});
test('Actual editor tools, permission checks, and persisted receipts remain the only scene mutation path',()=>{
 const code=src('js/robot-autonomy.js'),editor=src('js/editor.js'),chat=src('js/studio.js');
 assert.match(code,/namedWorkContinuation\(message\.text,o\.name\)/);
 assert.match(code,/promisedRoomFurnishing\(messages,followUp\.name/);
 assert.match(code,/saveOrder\(run,true\)/);
 assert.match(code,/ROOM FURNISHING ASSIGNED/);
 assert.match(code,/WORK ORDER REMINDED/);
 assert.match(code,/editor\.planRobotRoomFurnishing\?\.\(bot,variant\)/);
 assert.match(code,/await editor\.persistObject\?\.\(item,run\.room\)/);
 assert.match(code,/if\(!acknowledged\)throw Error/);
 assert.match(editor,/o\.userData\.wall\?\.closed===true/);
 assert.match(editor,/enclosedRoomFootprint\(/);
 assert.match(editor,/this\.navigationObstacles\(robot\)/);
 assert.match(editor,/roomGroundY/);
 assert.match(chat,/window\.solviStartChatProjects\?\.\(response\.message\)/);
});
