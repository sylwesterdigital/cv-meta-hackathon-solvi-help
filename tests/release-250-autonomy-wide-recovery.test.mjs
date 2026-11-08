import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stitchRobotWideEye,WIDE_EYE_VIEWS} from '../js/robot-wide-eye.js';
import {creativeSiteRecovery} from '../js/robot-creative-site-recovery.js';
import {findRobotWorksite} from '../js/robot-worksite.js';
const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('wide panorama stitches actual JPEG Blobs, never enclosing frame metadata',async()=>{
 const formerBitmap=globalThis.createImageBitmap,formerDocument=globalThis.document;
 const received=[];
 globalThis.createImageBitmap=async value=>{
  assert.ok(value instanceof Blob,'createImageBitmap must receive frame.blob, not a {yaw,pitch,blob} record');
  received.push(value);
  return {width:2,height:2,close(){}};
 };
 globalThis.document={createElement:()=>({
  width:0,height:0,
  getContext:()=>({
   drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(16).fill(255)}),
   createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}
  }),toBlob:callback=>callback(new Blob([new Uint8Array([0xff,0xd8,0xff,0xd9])],{type:'image/jpeg'}))
 })};
 try{
  const views=WIDE_EYE_VIEWS.map(view=>({...view,blob:new Blob([new Uint8Array([0xff,0xd8,0xff,0xd9])],{type:'image/jpeg'})}));
  const stitched=await stitchRobotWideEye(views,{width:3,height:2});
  assert.ok(stitched instanceof Blob);assert.equal(received.length,6);
  for(let i=0;i<6;i++)assert.equal(received[i],views[i].blob);
 }finally{
  if(formerBitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=formerBitmap;
  if(formerDocument===undefined)delete globalThis.document;else globalThis.document=formerDocument;
 }
});

test('a creative site failure scouts at most twice, without pretending to teleport',()=>{
 assert.equal(creativeSiteRecovery({y:0,scouts:0,now:1000}).action,'scout');
 assert.equal(creativeSiteRecovery({y:0,scouts:1,now:1000}).action,'scout');
 assert.equal(creativeSiteRecovery({y:0,scouts:2,now:1000}).action,'defer');
 const floor=creativeSiteRecovery({y:4.63,scouts:0,now:1000});
 assert.equal(floor.action,'defer');assert.equal(floor.retryAt,121000);
 assert.ok(/upper level/.test(floor.reason));
});

test('expanded site search still requires an actual path and keeps work inside bounded area',()=>{
 const start={x:0,z:0};
 const site=findRobotWorksite(start,[],{width:4,depth:4},{radii:[44]});
 assert.ok(site);assert.ok(site.meters<90);
 assert.ok(Math.hypot(site.site.x,site.site.z)>40);
 const blocker=[{minX:-400,maxX:400,minZ:-400,maxZ:400}];
 assert.equal(findRobotWorksite(start,blocker,{width:4,depth:4},{radii:[44]}),null);
});

test('creative scheduler saves bounded scout state and does not retry the same blocked site every 8 seconds',()=>{
 const code=source('js/robot-autonomy.js');
 assert.match(code,/creativeSiteFailures:run\.creativeSiteFailures/);
 assert.match(code,/creativeSiteScouts:run\.creativeSiteScouts/);
 assert.match(code,/creativeNeedsScout:run\.creativeNeedsScout/);
 assert.match(code,/creativeSiteRecovery\(\{y:bot\.position\.y/);
 assert.match(code,/plan=\{action:'site_scout'/);
 assert.match(code,/creativeSiteBlocked&&run\.groupJobId|!creativeSiteBlocked&&run\.groupJobId/);
 assert.match(code,/run\.creativeRetryAt>Date\.now\(\)/);
});

test('Meta validated proposal audit uses a non-conflicting keyword; previously 502 on every valid action',()=>{
 const code=source('backend/server.py');
 assert.match(code,/audit_event\('robot-autonomy-proposed',room=room_id,robot_id=rid,proposed_action=plan\['action'\]/);
 assert.doesNotMatch(code,/audit_event\('robot-autonomy-proposed'[^\n]*,action=/);
});
