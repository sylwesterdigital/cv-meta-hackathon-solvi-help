import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addressedCreativeRobot,validateRobotDesign} from '../js/robot-creative-design.js';
import {cleanAutonomyOrder} from '../js/robot-autonomy-core.js';
const source=f=>readFileSync(new URL(f,import.meta.url),'utf8');
const robotList=[{id:'r-albert',name:'Albert',kind:'robot'},{id:'r-viola',name:'Viola',kind:'robot'}];
const part=(kind='sphere',color='#ed79be')=>({kind,label:'body',color,offset:{x:0,y:0,z:0},size:{width:1,height:1,depth:1}});
test('novel nouns are not hardcoded in the authorization grammar',()=>{
 for(const noun of ['yellow submarine','pink sphere','twelve-sided lighthouse','floating robot sculpture','fantasy ice castle']){
  const result=addressedCreativeRobot(`@Albert please create a ${noun} now`,robotList);
  assert.equal(result?.robotId,'r-albert');assert.match(result.goal,new RegExp(noun));
 }
 assert.equal(addressedCreativeRobot('@Albert you are free to built anything else',robotList)?.robotId,'r-albert');
 assert.equal(addressedCreativeRobot('@Viola ok, create that mini mockup now',robotList)?.robotId,'r-viola');
 assert.equal(addressedCreativeRobot('@Albert do not build a sphere',robotList),null);
 assert.equal(addressedCreativeRobot('@Albert what did you build yesterday?',robotList),null);
 assert.equal(addressedCreativeRobot('@Albert maybe we can talk about architecture',robotList),null);
});
test('same-name robots cannot be addressed ambiguously; names and IDs are separate',()=>{
 const robots=[{id:'r1',name:'New robot',kind:'robot'},{id:'r2',name:'New robot',kind:'robot'}];
 assert.equal(addressedCreativeRobot('@New robot please create a sphere',robots),null);
 assert.equal(addressedCreativeRobot('@Albert please build a bridge',robotList)?.robotId,'r-albert');
 assert.equal(addressedCreativeRobot('@Albert please build a bridge',robots),null);
});
test('validated design allows original geometry but rejects scripts, invalid shapes and oversized plans',()=>{
 const plan={name:'submarine from Muse',site_distance:30,parts:[part('sphere','#f4d44d'),part('cylinder','#f4d44d')]};
 const ok=validateRobotDesign(plan);
 assert.equal(ok?.name,'submarine from Muse');assert.equal(ok.distance,30);assert.equal(ok.parts.length,2);
 assert.equal(validateRobotDesign({...plan,execute:'fetch("/api/scene")'}),null);
 assert.equal(validateRobotDesign({...plan,parts:[{...part(),kind:'javascript'}]}),null);
 assert.equal(validateRobotDesign({...plan,parts:[{...part(),size:{width:40,height:1,depth:1}}]}),null);
 assert.equal(validateRobotDesign({...plan,parts:Array(13).fill(part())}),null);
 assert.equal(validateRobotDesign({...plan,parts:[{...part(),offset:{x:Infinity,y:0,z:0}}]}),null);
 assert.equal(validateRobotDesign({...plan,site_distance:60}),null);
});
test('local creative flag persists when sanitized, but never permits a model command in other modes',()=>{
 const base={mode:'local_project',robotId:'r-albert',room:'main-room-hq',goal:'@Albert please create a submarine',variant:'creative',allowChanges:true};
 assert.equal(cleanAutonomyOrder(base).variant,'creative');
 assert.equal(cleanAutonomyOrder({...base,mode:'deliver'}).variant,'chair');
});
test('creative planner is owned by saved human order, scoped to current realm, and verified before receipts',()=>{
 const server=source('../backend/server.py'),runtime=source('../js/robot-autonomy.js'),editor=source('../js/editor.js');
 for(const text of ['@app.post(\'/api/robots/autonomy/design\')','SELECT order_json,state_json,enabled FROM robot_work_orders WHERE room_id=? AND robot_id=? AND user_id=?','parse_design(meta_output_text(response))','validate_design(state.get(\'creativePlan\'))'])assert.ok(server.includes(text),text);
 assert.ok(runtime.includes("run.order.variant==='creative'"));
 assert.ok(runtime.includes('await saveOrder(run,true); // commit fixed design BEFORE placing the first part'));
 assert.ok(runtime.includes("run.room===room()"));
 assert.ok(editor.includes('createRobotCreativePart(robot,part'));
 assert.ok(editor.includes("object.name=kind==='robot'?'Robot-'"));
});
