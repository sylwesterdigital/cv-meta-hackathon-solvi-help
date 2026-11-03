import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const file=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

class V3{
 constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
 clone(){return new V3(this.x,this.y,this.z);}
 copy(v){Object.assign(this,{x:v.x,y:v.y,z:v.z});return this;}
 distanceToSquared(v){return (this.x-v.x)**2+(this.y-v.y)**2+(this.z-v.z)**2;}
}
class Euler{setFromQuaternion(q){this.y=q.yaw||0;return this;}}
const SRC=file('js/robot-seating.js');
const followFunction=SRC.slice(SRC.indexOf('export function followFurnitureSeats('),SRC.indexOf('// Convert the robot\'s facing'))
 .replace('export function followFurnitureSeats(','function followFurnitureSeats(');
const makeFollow=standUp=>new Function('THREE','standUp',followFunction+'\nreturn followFurnitureSeats;')({Vector3:V3,Euler,Quaternion:class{}},standUp);
function demo(mode){
 const chair={userData:{editorKind:'furniture',editorId:'chair1234',furniture:{seatMoveMode:mode}},position:new V3(),quaternion:{x:0,y:0,z:0,w:1},scale:new V3(1,1,1),
  updateWorldMatrix(){},localToWorld(v){const theta=this.yaw||0,c=Math.cos(theta),s=Math.sin(theta);return v.copy(new V3(v.x*c+v.z*s+this.position.x,v.y+this.position.y,v.z*c-v.x*s+this.position.z));},getWorldQuaternion(){return {yaw:this.yaw||0}}};
 const robot={position:new V3(),rotation:{y:Math.PI},userData:{editorKind:'robot',robotSeated:true,robotSeatedTarget:'chair1234',robotSeatState:{targetId:'chair1234',local:[0,0,0],yawRelative:Math.PI,slot:0},robotSeatTargetPose:[0,0,0,0,0,0,1,1,1,1]}};
 const counts={pose:0,save:0,stand:0},editor={items:[chair,robot],canEdit:()=>true,queueSave(){counts.save++;},physics:{owns:()=>true,applyEditedPose(){counts.pose++;}}};
 const follow=makeFollow(bot=>{counts.stand++;bot.userData.robotSeated=false;});
 return {chair,robot,editor,counts,follow};
}
test('stickable seated avatar follows furniture translation without losing yaw or seat anchor',()=>{
 const d=demo('follow');d.chair.position.x=1.4;d.chair.position.z=-.8;
 assert.equal(d.follow(d.editor),1);
 assert.equal(d.robot.position.x,1.4);assert.equal(d.robot.position.z,-.8);
 assert.equal(d.robot.rotation.y,Math.PI);assert.equal(d.counts.pose,1);assert.equal(d.counts.save,1);
});
test('rotation carries local sofa anchors and yaw without reshuffling occupant slots',()=>{
 const d=demo('follow');d.robot.userData.robotSeatState.local=[-1,0,0];d.robot.position.x=-1;
 d.chair.yaw=Math.PI/2;d.chair.quaternion.y=Math.sin(Math.PI/4);d.chair.quaternion.w=Math.cos(Math.PI/4);
 assert.equal(d.follow(d.editor),1);
 assert.ok(Math.abs(d.robot.position.x)<.0001);assert.ok(Math.abs(d.robot.position.z-1)<.0001);
 assert.ok(Math.abs(d.robot.rotation.y-Math.PI*1.5)<.0001);
 assert.equal(d.robot.userData.robotSeatState.slot,0);
});
test('non-stickable movement releases the sitter, but stationary chair does not unseat on robot physics drift',()=>{
 const d=demo('stand');d.robot.position.x=.025;
 assert.equal(d.follow(d.editor),1);assert.equal(d.counts.stand,0);
 d.chair.position.x=1.5;
 d.follow(d.editor);assert.equal(d.counts.stand,1);assert.equal(d.robot.userData.robotSeated,false);
});
test('stickable mode updates occupants independently so sofas can carry several robots',()=>{
 const d=demo('follow');const second={position:new V3(-.4,0,0),rotation:{y:Math.PI},userData:{editorKind:'robot',robotSeated:true,robotSeatedTarget:'chair1234',robotSeatState:{targetId:'chair1234',local:[-.4,0,0],yawRelative:Math.PI,slot:1},robotSeatTargetPose:[0,0,0,0,0,0,1,1,1,1]}};
 d.editor.items.push(second);d.chair.position.z=1;
 assert.equal(d.follow(d.editor),2);assert.equal(second.position.x,-.4);assert.equal(second.position.z,1);
 assert.equal(d.counts.pose,2);assert.equal(d.counts.stand,0);
});
test('office chair and single-person furniture always use the cushion centre; sofa allocates unique slots',()=>{
 assert.match(SRC,/localX=0;/);
 assert.match(SRC,/const available=slots\.filter\(s=>!occupiedSlots\.includes\(s\.index\)\)/);
 assert.match(SRC,/if\(!available\.length\)return null/);
 assert.match(SRC,/target\.worldToLocal\(robot\.position\.clone\(\)\)\.toArray\(\)/);
});
test('backend validates persisted seating anchors and selectable furniture movement mode',()=>{
 const script=`import ast,math,re,sys\nsrc=open(sys.argv[1]).read();module=ast.parse(src);functions=['valid_basic_furniture','valid_robot_seating','valid_smart_channels','valid_smart_options'];names={'math':math,'re':re};exec(compile(ast.Module(body=[n for n in module.body if isinstance(n,ast.FunctionDef) and n.name in functions],type_ignores=[]),'<tests>','exec'),names)\nassert names['valid_basic_furniture']({'variant':'officeChair','seatMoveMode':'follow'})\nassert names['valid_basic_furniture']({'variant':'sofa','seatMoveMode':'stand'})\nassert not names['valid_basic_furniture']({'variant':'chair','seatMoveMode':'teleport'})\nassert names['valid_robot_seating']({'targetId':'chair1234','local':[0,0,0],'yawRelative':0.3,'slot':1})\nassert not names['valid_robot_seating']({'targetId':'../escape','local':[0,0,0],'yawRelative':0.3,'slot':1})\nprint('ok')`;
 const result=spawnSync('python3',['-c',script,new URL('../backend/server.py',import.meta.url).pathname],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||result.stdout);
});
test('scene persistence, deletion, realm archive and runtime all know about seating',()=>{
 const editor=file('js/editor.js'),archive=file('backend/realm_archives.py'),geometry=file('js/primitive-properties.js');
 assert.match(editor,/seating:o\.userData\.editorKind==='robot'/);
 assert.match(editor,/followFurnitureSeats\(this\)/);
 assert.match(editor,/add\('seatMoveMode','When furniture moves'/);
 assert.match(archive,/if seat\.get\('targetId'\) in remap/);
 assert.match(geometry,/result\.seatMoveMode=raw\.seatMoveMode/);
});
