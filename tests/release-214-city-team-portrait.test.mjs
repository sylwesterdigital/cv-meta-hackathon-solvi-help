import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cityTeamIntent,cityRoles,cityRoleGoal,cityRoleTarget,cityTeamState,cityMilestoneCount} from '../js/robot-city-team.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('explicit @all city orders create differentiated actual work roles; casual talk never does',()=>{
 assert.equal(cityTeamIntent('@all start building more homes')?.homes,true);
 assert.deepEqual(cityRoles(cityTeamIntent('@all start building more homes'),3),['housing','housing','housing']);
 assert.deepEqual(cityRoles(cityTeamIntent('@all start building more roads'),3),['road','footpath','road']);
 assert.deepEqual(cityRoles(cityTeamIntent('@all start building a city with homes roads parks'),5),['housing','road','footpath','commons','housing']);
 for(const bad of ['@Hoe just talking about homes','@all how is life?','I like homes and parks','@all do you know a park?', '@all roads are blocked'])assert.equal(cityTeamIntent(bad),null,bad);
 assert.equal(cityRoleGoal('road'),'Build two short public roads for the city team');
 assert.equal(cityRoleTarget('commons'),4);
});
test('role state is bounded and project receipt counts use actual persisted scene IDs',()=>{
 const team=cityTeamState({role:'footpath',id:'town-42',anchor:{x:5,z:-9},label:'Builders'});
 assert.equal(team.role,'footpath');assert.equal(cityTeamState({role:'admin',anchor:{x:5,z:0}}),null);
 assert.equal(cityTeamState({role:'road',anchor:{x:Infinity,z:0}}),null);
 assert.equal(cityMilestoneCount('road',{teamBuilt:[{id:'real-road-1',variant:'road'}]}),1);
 assert.equal(cityMilestoneCount('housing',{completedHouses:['wall-1','wall-2']}),2);
});
test('road and footpath use procedural geometry, real worksite and queue-save with ownership',()=>{
 const editor=read('js/editor.js'),autonomy=read('js/robot-autonomy.js'),server=read('backend/server.py');
 for(const x of ['createRobotInfrastructure(robot,type=',"variant:'infrastructure'",'infraPoints:[[-length/2,0],[length/2,0]]','footprintClear(at','this.recordEdit(null,this.snapshot(obj))','this.queueSave(obj)','this.canEdit(robot)'])assert.ok(editor.includes(x),x);
 for(const x of ["if(plan.action==='build_infrastructure')",'run.teamBuilt.push','cityMilestoneCount','startCityTeam','CITY ROLE ASSIGNED','startChatProjects','team:run.team','teamBuilt:run.teamBuilt'])assert.ok(autonomy.includes(x),x);
 assert.ok(server.includes("'team','teamBuilt'"));assert.ok(server.includes("'build_infrastructure'"));
 assert.ok(read('index.html').includes('id="autonomyCityTeam"'));
});
test('portrait mic uses a single tiny tinted masked icon at the bottom; only border pulses',()=>{
 const css=read('styles.css');
 assert.match(css,/\.robot-face-speaking::before[\s\S]*?bottom:5%!important/);
 assert.ok(css.includes("background:#fb75c6!important"));
 assert.ok(css.includes("mask:url('./assets/ui-icons/mic.svg') center/contain no-repeat"));
 assert.ok(css.includes('robot-face-choice.robot-face-speaking::after{border-color:'));
});
test('autonomous peer speech no longer sends repeated generic prompts every 10 minutes',()=>{
 const life=read('js/robot-life.js');assert.ok(life.includes('>5400000'));
 assert.ok(!life.includes('What have you actually discovered or tried here? Suggest one safe experiment we can verify.'));
});
