import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {observationTarget,matchesObservationTarget,frameTargetScore,pickTargetViews} from '../js/target-view-filter.js';
import {observationPlan} from '../js/robot-observation.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const position=(x,y,z)=>({x,y,z});
const pose=(yaw)=>({position:position(0,1.62,0),quaternion:{x:0,y:Math.sin((180+yaw)*Math.PI/360),z:0,w:Math.cos((180+yaw)*Math.PI/360)},fov:72,width:512,height:512});
test('target parser recognizes furniture requests without filtering generic room descriptions',()=>{
 assert.deepEqual(observationTarget('Paris, find a chair'),{families:['chair'],colors:[],phrase:'chair'});
 assert.equal(observationTarget('Paris look around and tell me what you see'),null);
 assert.equal(matchesObservationTarget('chair1o',observationTarget('find chair')),true);
 assert.equal(matchesObservationTarget('PInk Sofa',observationTarget('find Pink Sofa and sit on Red Sofa')),true);
 assert.equal(matchesObservationTarget('Red Sofa',observationTarget('find Pink Sofa and sit on Red Sofa')),true);
 assert.equal(matchesObservationTarget('Blue Sofa',observationTarget('find Pink Sofa')),false);
});
test('prefilter keeps only head-camera directions pointing toward a nearby chair',()=>{
 const views=observationPlan('look around'),poses=views.map(view=>pose(view.yaw));
 const candidate={position:position(0,1,5),radius:.45};
 const selected=pickTargetViews(views,poses,[candidate],3);
 assert(selected.length>0&&selected.length<=3);
 assert(selected.some(v=>v.view.yaw===0));
 assert(selected.every(v=>[0,60,300].includes(v.view.yaw)));
 assert(frameTargetScore(pose(180),candidate)<0);
});
test('target scan discards irrelevant frames before uploads and Muse; all-negative returns qualified answer',()=>{
 const studio=source('js/studio.js'),server=source('backend/server.py'),brains=source('js/robot-brains.js');
 assert.match(studio,/if\(target&&!proactive&&!scenePrefilter\)/);
 assert.match(studio,/if\(!\(detection\.result\?\.boxes\|\|\[\]\)\.length\)/);
 assert.match(studio,/pickTargetViews\(plan,poses,candidates,3\)/);
 assert.match(studio,/if\(target&&ids\.length>=3\)break/);
 assert.match(brains,/pickTargetViews\(directions,poses,candidates,3\)/);
 assert.match(server,/not paths:\s*\n\s*answer=/);
 assert.match(server,/TARGET SEARCH: Respond ONLY about/);
 assert.match(server,/Ignore unrelated objects; do NOT list all directions/);
 assert.doesNotMatch(server,/Examine ALL images before answering/);
 assert.match(server,/I completed the requested route for/);
});
