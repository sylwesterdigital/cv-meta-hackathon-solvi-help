import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {houseGoal} from '../js/robot-construction-api.js';
import {localProjectSequence,chatConstructionInstruction,requestedHomeCount,workRecoveryPlan} from '../js/robot-autonomy-policy.js';
import {cleanAutonomyOrder} from '../js/robot-autonomy-core.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('missing Meta never blocks an explicitly authorised home project, including plural natural language',()=>{
 const goal='@all no rush with building a city but you should start building more homes for new robots';
 assert.equal(houseGoal(goal),true);
 assert.equal(requestedHomeCount(goal),2);
 assert.equal(workRecoveryPlan({goal,allowChanges:true}).action,'build_house');
 assert.equal(workRecoveryPlan({goal,allowChanges:true,completedHouses:['existing-home']}).action,'build_house');
 assert.notEqual(workRecoveryPlan({goal,allowChanges:false}).action,'build_house');
 assert.equal(cleanAutonomyOrder({mode:'local_project'}).mode,'local_project');
});

test('park and picnic proposals are capped and continue by actual placed object IDs',()=>{
 const goal='Build a picnic area';
 assert.deepEqual(localProjectSequence(goal),['table','chair','chair','bottle']);
 assert.equal(workRecoveryPlan({goal,allowChanges:true}).variant,'table');
 assert.equal(workRecoveryPlan({goal,allowChanges:true,projectPlaced:[{id:'table1',variant:'table'}]}).variant,'chair');
 assert.equal(workRecoveryPlan({goal,allowChanges:true,projectPlaced:[{id:'t',variant:'table'},{id:'c1',variant:'chair'},{id:'c2',variant:'chair'}]}).variant,'bottle');
 assert.equal(workRecoveryPlan({goal,allowChanges:true,projectPlaced:[{id:'c1',variant:'chair'},{id:'c2',variant:'chair'},{id:'b',variant:'bottle'}]}).variant,'table');
 assert.notEqual(workRecoveryPlan({goal,allowChanges:false}).action,'build');
 assert.equal(workRecoveryPlan({goal,allowChanges:true,projectPlaced:[{id:'t',variant:'table'},{id:'c1',variant:'chair'},{id:'c2',variant:'chair'},{id:'b',variant:'bottle'}]}).action,'idle');
 assert.deepEqual(localProjectSequence('Create a playground'),['table','chair','chair','stool']);
});

test('only an explicit human @all construction command starts local projects, not an inspirational conversation',()=>{
 assert.ok(chatConstructionInstruction('@all start building more homes for arriving robots'));
 assert.ok(chatConstructionInstruction('@all please build a picnic area'));
 assert.ok(chatConstructionInstruction('@all build a park'));
 assert.equal(chatConstructionInstruction('@all you are free to build a better world with parks, dreams and sunshine'),null);
 assert.equal(chatConstructionInstruction('I built a house earlier'),null);
 assert.equal(chatConstructionInstruction('@Sakk build a house'),null);
 assert.equal(chatConstructionInstruction('@all build nothing'),null);
 const js=read('js/robot-autonomy.js'),studio=read('js/studio.js'),backend=read('backend/server.py');
 assert.match(js,/startChatProjects\(message\)/);
 assert.match(js,/editor\.canEdit\(o\)&&!runs\.has/);
 assert.match(js,/\.slice\(0,3\)/);
 assert.match(js,/await saveOrder\(run,true\)/);
 assert.match(studio,/window\.solviStartChatProjects\?\.\(response\.message\)/);
 assert.match(backend,/projectPlaced.*completedHouses/);
 assert.match(backend,/\('agent','local_project','deliver'/);
});

test('autonomous construction does not reset older realm objects, bypass ownership, fabricate flights or invoke Meta for local project',()=>{
 const js=read('js/robot-autonomy.js'),editor=read('js/editor.js'),backend=read('backend/server.py');
 assert.match(js,/plan=\s*recovery\(run,bot,'Locally authorised construction; no Meta model call'\)/);
 assert.match(js,/if\(!run\.order\.allowChanges\)throw Error\('Scene creation must be enabled/);
 assert.match(editor,/planRobotBuildSite\(robot/);
 assert.match(editor,/continueRobotPatrol\(robot,mission\)/);
 assert.match(editor,/startRobotRecovery\(robot,mission\)/);
 assert.match(editor,/routeRobot\(robot,candidate,\{preserveMission:true,quiet:true\}\)/);
 assert.match(backend,/def valid_robot_work_order\(/);
 assert.doesNotMatch(js,/position\.set\(.*target/);
});

test('real Python command parser distinguishes one-hour patrol, multistage retreat/random turn and casual comments',()=>{
 const script=String.raw`
import ast,re,secrets,json,sys
source=sys.stdin.read()
ns={'re':re,'secrets':secrets,'ROBOT_COMMAND_GUIDE':'guide','robot_voice_catalog':lambda robot:'voices','stair_approach_instruction':lambda target:None,'_red_scene_object':lambda x:False}
fn=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=='plan_robot_command')
exec(compile(ast.Module(body=[fn],type_ignores=[]),'server.py','exec'),ns)
robot={'name':'Sakk','id':'sakk','position':[0,0,0]}
for message in ['@Sakk can you just infinite walk and wonder around for 1 hours?','@all if you stuck just step back 15m, turn random angle and restart','@Sakk please turn random angle','@Sakk I thought the 90 deg turn was bad']:
 command,ack=ns['plan_robot_command'](message,robot,[])
 print(json.dumps({'command':command,'ack':ack}))
`;
 const result=spawnSync('python3',['-c',script],{input:read('backend/server.py'),encoding:'utf8',timeout:20000});
 assert.equal(result.status,0,result.stderr);
 const [patrol,recover,random,comment]=result.stdout.trim().split('\n').map(JSON.parse);
 assert.equal(patrol.command.kind,'patrol');assert.equal(patrol.command.duration_seconds,3600);
 assert.equal(recover.command.kind,'recover_route');assert.equal(recover.command.distance,15);
 assert.equal(random.command.kind,'turn');assert.ok(random.command.degrees>=15&&random.command.degrees<=180);
 assert.equal(comment.command,null);
});
