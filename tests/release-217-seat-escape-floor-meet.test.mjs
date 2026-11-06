import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canMeetRobot,planRobotMeeting,sameRobotFloor} from '../js/robot-social-navigation.js';
import {lifeCandidates} from '../js/robot-life-core.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
class V3{
 constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
 clone(){return new V3(this.x,this.y,this.z);}
}
class Matrix4{copy(){return this;}invert(){return this;}multiply(){return this;}}
class Box3{
 constructor(){this.min=new V3(Infinity,Infinity,Infinity);this.max=new V3(-Infinity,-Infinity,-Infinity);}
 isEmpty(){return this.min.x>this.max.x;}
 union(b){for(const k of ['x','y','z']){this.min[k]=Math.min(this.min[k],b.min[k]);this.max[k]=Math.max(this.max[k],b.max[k]);}return this;}
 setFromObject(item){const b=item.mockBounds;if(!b)return this;this.min=new V3(...b[0]);this.max=new V3(...b[1]);return this;}
}
const {standUp,safeSeatEscape,recoverStandingSeatTrap,seatEscapeOptions}=new Function('THREE',source('js/robot-seating.js').slice(source('js/robot-seating.js').indexOf('export function standClearancePosition(')).replaceAll('export function ','function ')+'\nreturn {standUp,safeSeatEscape,recoverStandingSeatTrap,seatEscapeOptions};')({Vector3:V3,Box3,Matrix4});
function avatar(seated=true){return {position:new V3(0,8.02,0),rotation:{y:1},userData:{editorKind:'robot',editorId:'bot',robotSeated:seated,robotSeatedTarget:'seat'}};}
function seat(){const b={min:new V3(-.7,0,-.65),max:new V3(.7,1,.65),clone(){return this;},applyMatrix4(){return this;}};return {position:new V3(0,8,0),matrixWorld:{},visible:true,userData:{editorId:'seat',editorKind:'furniture',furniture:{variant:'sofa'}},mockBounds:[[-.7,8,-.65],[.7,9,.65]],updateWorldMatrix(){},traverse(cb){cb({matrixWorld:{},geometry:{boundingBox:b}});},worldToLocal(v){return v;},localToWorld(v){return v;},getWorldScale(){return new V3(1,1,1);}};}
function fixture(walls=[]){const bot=avatar();const furniture=seat();let saved=0,updated=0;const editor={items:[furniture,bot,...walls],canEdit:()=>true,physics:{enabled:false,applyEditedPose(){updated++;}},queueSave(){saved++;}};return {bot,furniture,editor,counters:()=>[saved,updated]};}
test('different storeys never count as a real robot encounter',()=>{
 const lower={x:1,y:0,z:1},upper={x:1.3,y:8,z:1};
 assert.equal(sameRobotFloor(lower,upper),false);
 assert.equal(canMeetRobot(lower,upper,[]),false);
 assert.equal(planRobotMeeting(lower,upper,[]),null);
 assert.equal(canMeetRobot({...lower,y:8},upper,[]),false,'Too close is not yet a valid safe stand-off');
 assert.equal(canMeetRobot({x:3,y:8,z:1},upper,[]),true);
});
test('autonomous explorer excludes colleagues on inaccessible different floors',()=>{
 const robot={position:new V3(0,0,0),rotation:{y:0},userData:{editorKind:'robot',editorId:'self'}};
 const peers=[{name:'Upper floor',position:new V3(10,8,0),userData:{editorKind:'robot',editorId:'up'}},
   {name:'Same floor',position:new V3(10,0,1),userData:{editorKind:'robot',editorId:'near'}}];
 const result=lifeCandidates(robot,peers,[],0);
 assert.equal(result.some(x=>x.targetId==='up'),false);
 assert.equal(result.some(x=>x.targetId==='near'),true);
});
test('seated avatar tries alternate side when front of sofa is blocked',()=>{
 const {bot,editor,counters}=fixture([{visible:true,userData:{editorKind:'furniture'},mockBounds:[[-1,7.9,-2],[1,10,-.8]]}]);
 assert.equal(standUp(bot,editor),true);
 assert.ok(Math.hypot(bot.position.x,bot.position.z)>1.2&&bot.position.z>-.65,'Escaped by another side without crossing the obstructed front');
 assert.equal(bot.position.y,8.02,'Upper floor height preserved in mock environment');
 assert.deepEqual(counters(),[1,1]);
});
test('standing inside chair capsule can recover on a real movement attempt, never across a wall',()=>{
 const {bot,editor,counters}=fixture();bot.userData.robotSeated=false;
 assert.equal(recoverStandingSeatTrap(bot,editor),true);
 assert.ok(Math.hypot(bot.position.x,bot.position.z)>1,'Escaped more than half the chair depth');
 assert.deepEqual(counters(),[1,1]);
});
test('fully enclosed seat fails safely without destroying seated state',()=>{
 const {bot,editor,counters}=fixture([
 {visible:true,userData:{editorKind:'wall'},mockBounds:[[-2,7,-2],[2,10,-.8]]},
 {visible:true,userData:{editorKind:'wall'},mockBounds:[[-2,7,.8],[2,10,2]]},
 {visible:true,userData:{editorKind:'wall'},mockBounds:[[-2,7,-2],[-.8,10,2]]},
 {visible:true,userData:{editorKind:'wall'},mockBounds:[[.8,7,-2],[2,10,2]]}
 ]);
 assert.equal(standUp(bot,editor),false);
 assert.equal(bot.userData.robotSeated,true);
 assert.deepEqual(counters(),[0,0]);
});
test('real social tasks and life contacts only use same-height evidence, not generic greetings',()=>{
 const ed=source('js/editor.js'),life=source('js/robot-life.js'),robots=source('js/robots.js');
 assert.match(ed,/differentFloor.*sameRobotFloor/);
 assert.match(robots,/Target on another floor; lift or stairs required/);
 assert.match(life,/workReceipt\?\.status==='completed'/);
 assert.doesNotMatch(life,/I reached the area near \$\{peer.name\}. Do you have a specific verified project/);
 assert.match(ed,/recoverStandingSeatTrap\(robot,this\)/);
});
