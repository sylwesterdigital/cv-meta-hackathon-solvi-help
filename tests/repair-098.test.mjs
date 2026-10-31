import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launchAirPlan,airStep,autoRunAfterHold} from '../js/robot-air-control.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=f=>fs.readFileSync(path.join(root,f),'utf8');
test('Airborne heading remains locked and direction independent of later steering',()=>{
 const plan=launchAirPlan({yaw:0,velocity:3,lateral:0});
 const start={x:1,z:2,yaw:1.2,velocity:3};
 const moved=airStep(start,plan,.05);
 assert.equal(moved.yaw,0);assert.equal(moved.x,1);assert.ok(moved.z>2);
 assert.equal(airStep(moved,plan,.05).yaw,0);
});
test('Idle jumps stay vertical and side-step takeoff locks horizontal vector',()=>{
 const still=launchAirPlan({yaw:2,velocity:0,lateral:0});assert.equal(airStep({x:5,z:8},still,.04).z,8);
 const moving=launchAirPlan({yaw:Math.PI/2,velocity:4});assert.ok(moving.vx>3.9);assert.ok(Math.abs(moving.vz)<1e-10);
});
test('Forward hold initiates running after 2s, Shift immediately, airborne does not',()=>{
 assert.equal(autoRunAfterHold(1999,{walking:true}),false);
 assert.equal(autoRunAfterHold(2000,{walking:true}),true);
 assert.equal(autoRunAfterHold(3000,{walking:true,airborne:true}),false);
 assert.equal(autoRunAfterHold(10,{walking:false,shift:true}),true);
});
test('Chat observers declared, exact room name submitted and stale messages filtered',()=>{
 const s=source('js/studio.js');
 assert.match(s,/let chatAttachmentObserver=null;const chatAttachmentCache=new Map\(\)/);
 assert.match(s,/body:JSON\.stringify\(\{room,exact_name:title,confirm:true\}\)/);
 assert.match(s,/chatClearCutoffs\.get\(room\)/);
 assert.match(s,/filter\(m=>!cutoff\|\|String\(m\.created\|\|''\)>cutoff\)/);
 const b=source('backend/server.py');assert.match(b,/cleared_at=clear_time/);
});
test('Both libraries expose accessible S/M/L view modes',()=>{
 const html=source('index.html');const count=(html.match(/data-gallery-size="l"/g)||[]).length;assert.equal(count,2);
 for(const f of ['js/avatar-gallery.js','js/asset-gallery.js'])assert.match(source(f),/setupLibraryCardSize/);
 const css=source('styles.css');assert.match(css,/data-card-size="s"/);assert.match(css,/data-card-size="m"/);
});
test('Single geometry slider with typed value, Chase Smart in properties, manual drag orbit',()=>{
 const html=source('index.html');assert.ok(html.indexOf('id="smartChaseAngleControl"')>html.indexOf('id="propertiesPanel"'));
 assert.match(source('js/editor.js'),/primitive-property-range/);
 assert.match(source('js/world.js'),/pointermove[\s\S]*syncFollowAfterManualView/);
});
test('Missing GLB animation calls out the absent action once in Brains debug',()=>{
 const src=source('js/robots.js');assert.match(src,/MISSING AVATAR ACTION/);assert.match(src,/robotMissingActions/);
});
