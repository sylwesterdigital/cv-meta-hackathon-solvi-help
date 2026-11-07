import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {creativeBuildIntent,groupCreativeIntent,namedCreativeIntent,creativeBlueprint,creativeProjectTag,creativeRole,nextCreativeIndex} from '../js/robot-creative-builder.js';
const source=name=>readFileSync(new URL(name,import.meta.url),'utf8');
test('human-authorised creative requests include typo and named 1m yellow cube',()=>{
 const mega='@All hey robots, can you mess around and start building procedural mega strcutures please.';
 assert.equal(groupCreativeIntent(mega),mega);
 const yellow='@Albert do yo uhave access to procedural API creation, like can you create and add a yellow cube 1m to the scene at the front of you right now?';
 assert.equal(namedCreativeIntent(yellow,'Albert'),yellow);
 assert.equal(namedCreativeIntent(yellow,'Viola'),null);
 assert.equal(groupCreativeIntent('@all how is everyone?'),null);
 assert.equal(groupCreativeIntent('@all do not build mega structures'),null);
 assert.equal(groupCreativeIntent('@all maybe we could build towers'),null);
 assert.equal(groupCreativeIntent('@all can you build a megastructure?'),'@all can you build a megastructure?');
});
test('plans have finite bounded parameters, distinct roles, and one stable completion index',()=>{
 const designs=[0,1,2].map(role=>creativeBlueprint('Build procedural mega structures',role));
 assert.deepEqual(designs.map(d=>d.name),['skyline tower','colonnaded sky arch','canopy pavilion']);
 for(const d of designs){
  assert.equal(d.parts.length,8);
  assert.equal(nextCreativeIndex(d.parts,[]),0);
  assert.equal(nextCreativeIndex(d.parts,d.parts.map((p,index)=>({index,id:'object'+index}))),-1);
  for(const part of d.parts){
   assert.match(part.color,/^#[0-9a-f]{6}$/);
   assert.ok(Object.values(part.offset).every(Number.isFinite));
   assert.ok(Object.values(part.size).every(n=>Number.isFinite(n)&&n>0&&n<=7));
   assert.ok(part.offset.y>=0&&part.offset.y+part.size.height<=12);
  }
 }
 const cube=creativeBlueprint('create and add a yellow cube 1m in front of you');
 assert.equal(cube.parts.length,1);assert.equal(cube.parts[0].color,'#f4d44d');
 assert.deepEqual(cube.parts[0].size,{width:1,height:1,depth:1});
 assert.equal(creativeRole('human:2'),2);
 assert.equal(creativeProjectTag('xyz:1'),'xyz:1');
});
test('creative dispatch and real editor persistence are connected to group receipt',()=>{
 const runtime=source('../js/robot-autonomy.js');
 const editor=source('../js/editor.js');
 const backend=source('../backend/server.py');
 const studio=source('../js/studio.js');
 const html=source('../index.html');
 assert.match(runtime,/groupCreativeIntent\(message\.text\)/);
 assert.match(runtime,/namedCreativeIntent\(message\.text,o\.name\)/);
 assert.match(runtime,/action:'creative_build'/);
 assert.match(runtime,/!creativeBuildIntent\(order\.goal\)/);
 assert.match(runtime,/await editor\.persistObject\?\.\(object,run\.room\)/);
 assert.match(runtime,/await saveOrder\(run,true\)/);
 assert.match(runtime,/outcome:'completed'/);
 assert.match(editor,/createRobotCreativePart\(robot,part/);
 assert.match(editor,/this\.physics\.sync\(obj\)/);
 assert.match(editor,/const avatar=new THREE\.Box3\(/);
 assert.match(editor,/this\.queueSave\(obj\)/);
 assert.match(backend,/elif task\['kind'\] in \('local_build','creative_build'\)/);
 assert.match(backend,/if outcome=='completed' and task\['kind'\]=='creative_build'/);
 assert.match(backend,/count=group_creative_part_count\(task\['source_text'\]\)/);
 assert.match(backend,/object_row\.get\('owner'\)!=user\['id'\]/);
 assert.match(studio,/else if\(!\(work>0\)\)await reactToRobotMessage/);
 assert.ok(html.includes('./js/robot-creative-builder.js'));
});
