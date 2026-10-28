import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('bulk selection hidden by default; checks inserted only in bulk mode',()=>{
 const h=file('index.html'),js=file('js/editor.js'),css=file('styles.css');
 assert.match(h,/id="sceneBulkRow"[^>]*hidden/);assert.match(h,/id="sceneBulkToggle"/);
 assert.match(js,/classList\.contains\('bulk-mode'\)/);assert.match(css,/#scenePanel #sceneBulkRow\[hidden\]\{display:none!important\}/);
});
test('vector inspector uses single-row XYZ and only one reset per group',()=>{
 const h=file('index.html');for(const kind of ['position','rotation','scale']){
  for(let i=0;i<3;i++)assert.match(h,new RegExp(`id="${kind}-${i}"`));
  assert.match(h,new RegExp(`id="${kind}-reset"`));
  assert.doesNotMatch(h,new RegExp(`id="${kind}-[012]-reset"`));
 } assert.equal((h.match(/class="transform-axis-row"/g)||[]).length,3);
});
test('one robot speed slider controls three persisted settings',()=>{
 const h=file('index.html'),j=file('js/editor.js');
 assert.match(h,/id="robotSpeedActive"/);assert.match(h,/id="robotSpeedKind"/);
 for(const id of ['robotSpeed','robotStrafeSpeed','robotTurnSpeed'])assert.match(h,new RegExp(`id="${id}"`));
 assert.match(j,/this\.syncRobotSpeed=syncRobotSpeed/);assert.match(j,/dispatchEvent\(new Event\('input'/);
});
test('composer auto undocks on drag and robot eye is actual robot chat media',()=>{
 const j=file('js/studio.js');const s=file('backend/server.py');
 assert.match(j,/move\.setPointerCapture\(e\.pointerId\)/);
 assert.match(j,/composer\.classList\.add\('composer-floating'\)/);
 assert.match(j,/solvi-composer-pos/);
 assert.match(j,/'\/api\/robots\/eyes'/);
 assert.match(s,/@app\.post\('\/api\/robots\/eyes'\)/);
 assert.match(s,/speaker_override/);
});
test('robot conversation has actual spatial context, short name matching, opt-in initiatives',()=>{
 const s=file('backend/server.py'),h=file('index.html');
 for(const v of ['spatial_context','room_objects','utc_time','robot_pose','meta_output_text(response)','ROBOT_INITIATIVE_LAST','@app.post(\'/api/robots/initiative\')'])assert.ok(s.includes(v),v);
 assert.match(h,/id="brainsInitiative"/);assert.match(file('js/robot-brains.js'),/initiative:\$\('brainsInitiative'\)\.checked/);
});
