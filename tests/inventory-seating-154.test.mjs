import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.document={getElementById:()=>null};
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
class V{
 constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
 clone(){return new V(this.x,this.y,this.z);}
 copy(p){Object.assign(this,{x:p.x,y:p.y,z:p.z});return this;}
 set(x,y,z){Object.assign(this,{x,y,z});return this;}
 add(v){return this.set(this.x+v.x,this.y+v.y,this.z+v.z);}
 addScaledVector(v,n){return this.set(this.x+v.x*n,this.y+v.y*n,this.z+v.z*n);}
 sub(v){return this.set(this.x-v.x,this.y-v.y,this.z-v.z);}
 distanceToSquared(v){return (this.x-v.x)**2+(this.y-v.y)**2+(this.z-v.z)**2;}
 applyQuaternion(q){const c=Math.cos(q.yaw||0),s=Math.sin(q.yaw||0);return this.set(this.x*c+this.z*s,this.y,this.z*c-this.x*s);}
}
class Q{constructor(yaw=0){this.yaw=yaw;}
 invert(){this.yaw=-this.yaw;return this;}
 multiply(q){this.yaw+=q.yaw;return this;}
}
class B{
 constructor(){this.min=null;this.max=null;}
 setFromObject(o){return Object.assign(this,{min:o.bounds.min.clone(),max:o.bounds.max.clone()});}
 clone(){const b=new B();b.min=this.min?.clone();b.max=this.max?.clone();return b;}
 isEmpty(){return !this.min||!this.max;}
 getSize(o){return o.set(this.max.x-this.min.x,this.max.y-this.min.y,this.max.z-this.min.z);}
 makeEmpty(){this.min=this.max=null;return this;}
 union(b){this.min=b.min.clone();this.max=b.max.clone();return this;}
 getCenter(o){return o.set((this.min.x+this.max.x)/2,(this.min.y+this.max.y)/2,(this.min.z+this.max.z)/2);}
}
class Matrix4{copy(){return this;}invert(){return this;}multiply(){return this;}}
class Raycaster{constructor(origin){this.origin=origin;}intersectObject(){return [{face:{normal:new V(0,1,0)},object:{isMesh:true,matrixWorld:{}},point:new V(this.origin.x,.5,this.origin.z)}];}}
V.prototype.transformDirection=function(){return this;};B.prototype.applyMatrix4=function(){return this;};
const THREE={Vector3:V,Quaternion:Q,Box3:B,Matrix4,Raycaster};
const seatCode=read('js/robot-seating.js').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
const {seatPlan,takeSeat,standUp}=new Function('THREE',seatCode+'\nreturn {seatPlan,takeSeat,standUp}')(THREE);
const invCode=read('js/robot-inventory.js').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
const {RobotInventory,cleanInventory,cleanStorage}=new Function('THREE','canBePickable','pickableTarget',invCode+'\nreturn {RobotInventory,cleanInventory,cleanStorage}')(THREE,()=>true,()=>null);
const id='robot-12345678';
function object(editorKind,editorId,inventory,position=new V()){
 return {name:editorId,visible:true,position,bounds:{min:new V(-.2,0,-.2),max:new V(.2,.4,.2)},removeFromParent(){},rotation:{y:0},userData:{editorKind,editorId,pickable:true,inventory,physics:{mode:'static'}},updateWorldMatrix(){},parent:null};
}
function fixture(){const robot=object('robot',id,{category:'world',size:'pocket',consumable:false});robot.children=[];
 const events=[],physics={enabled:true,remove:x=>events.push(['remove',x]),sync:o=>events.push(['sync',o.userData.editorId]),applyEditedPose:o=>events.push(['pose',o.userData.editorId])};
 const editor={items:[robot],physics,canEdit:()=>true,queueSave:o=>events.push(['save',o.userData.editorId]),persistRemoval:id=>events.push(['removeSaved',id]),toast(){},disposeObject(){}};
 const manager=new RobotInventory(editor);return {robot,editor,manager,events};}

test('inventory validator preserves categories and rejects malformed storage references',()=>{
 assert.deepEqual(cleanInventory(),{category:'world',size:'pocket',consumable:false});
 assert.deepEqual(cleanStorage({type:'worn',holderId:id,slot:'front'}),{type:'worn',holderId:id,slot:'front'});
 assert.equal(cleanStorage({type:'bag',bagId:'../bad'}),null);
 assert.equal(cleanStorage({type:'worn',holderId:id,slot:'head'}),null);
 assert.equal(cleanInventory({category:'food',size:'bag',consumable:true}).consumable,true);
});
test('two wearable backpacks use front/back slots and items remain in the bag when dropped',()=>{
 const f=fixture();const bag=object('cube','bag-12345678',{category:'backpack',size:'bag',consumable:false});
 const bag2=object('cube','bag-22222222',{category:'backpack',size:'bag',consumable:false});
 const tool=object('cube','tool-12345678',{category:'tool',size:'bag',consumable:false});
 f.editor.items.push(bag,bag2,tool);
 assert.equal(f.manager.collect(f.robot,tool),false,'large tools need a worn backpack');
 assert.equal(f.manager.collect(f.robot,bag),true);
 assert.equal(bag.userData.storage.slot,'back');
 assert.equal(f.manager.collect(f.robot,bag2),true);
 assert.equal(bag2.userData.storage.slot,'front');
 assert.equal(f.manager.collect(f.robot,tool),true);
 assert.deepEqual(tool.userData.storage,{type:'bag',bagId:'bag-12345678'});
 assert.equal(tool.visible,false);
 assert.equal(f.manager.drop(f.robot,bag),true);
 assert.equal(bag.userData.storage,undefined);
 assert.deepEqual(tool.userData.storage,{type:'bag',bagId:'bag-12345678'},'contents must stay in that bag');
 assert.equal(f.manager.collect(f.robot,bag),true);
 assert.ok(f.manager.entries(f.robot).includes(tool));
 assert.equal(f.manager.moveBag(f.robot,bag),false,'cannot occupy another backpack’s front slot');
});
test('pocket item can transfer to backpack and back and optional food use removes scene identity',()=>{
 const f=fixture(),bag=object('cube','bag-12345678',{category:'backpack',size:'bag',consumable:false}),food=object('cube','food-12345678',{category:'food',size:'pocket',consumable:true});
 f.editor.items.push(bag,food);
 assert.equal(f.manager.collect(f.robot,food),true);assert.equal(food.userData.storage.type,'pocket');
 assert.equal(f.manager.transfer(f.robot,food),false,'bag required');
 assert.equal(f.manager.collect(f.robot,bag),true);
 assert.equal(f.manager.transfer(f.robot,food),true);assert.equal(food.userData.storage.type,'bag');
 assert.equal(f.manager.transfer(f.robot,food),true);assert.equal(food.userData.storage.type,'pocket');
 assert.equal(f.manager.use(f.robot,food),true);assert.ok(!f.editor.items.includes(food));
 assert.ok(f.events.some(x=>x[0]==='removeSaved'&&x[1]==='food-12345678'));
});
function chair(angle=0){const position=new V(0,0,0);
 const bounds={min:new V(-.5,0,-.5),max:new V(.5,1,.5)};
 return {position,bounds,matrixWorld:{},userData:{editorKind:'furniture',editorId:'chair-12345678',furniture:{variant:'chair',seatHeight:.46}},updateWorldMatrix(){},getWorldQuaternion:()=>new Q(angle),worldToLocal(v){v.sub(position).applyQuaternion(new Q(-angle));return v;},localToWorld(v){return v.applyQuaternion(new Q(angle)).add(position);},traverse(fn){fn({geometry:{boundingBox:new B().setFromObject({bounds})},matrixWorld:{}});}};}
test('chair seats align to its front edge under rotation and standing retains that rotation',()=>{
 const a=chair(0),robot={position:new V(0,0,-.8),rotation:{y:0},userData:{editorKind:'robot',robotAvailableActions:['Sitting']}};
 const plan=seatPlan(a,robot.position);assert.ok(plan);assert.equal(plan.height,.46);
 assert.ok(Math.abs(plan.yaw-Math.PI)<.001);assert.ok(Math.abs(plan.spot.z+.15)<.001);
 let pose=0;const editor={canEdit:()=>true,queueSave(){},physics:{applyEditedPose(){pose++;}}};
 assert.equal(takeSeat(robot,a,editor),true);assert.equal(robot.userData.robotSeated,true);assert.equal(robot.userData.robotMode,'clip:Sitting');
 assert.equal(pose,1);assert.equal(standUp(robot,editor),true);assert.equal(robot.rotation.y,Math.PI);
 const turned=chair(Math.PI/2),robot2={position:new V(-.8,0,0),rotation:{y:0},userData:{editorKind:'robot',robotAvailableActions:[]}};
 assert.ok(seatPlan(turned,robot2.position));assert.equal(takeSeat(robot2,turned,editor),true);
 assert.ok(Math.abs(robot2.rotation.y+Math.PI/2)<.001);
 assert.equal(robot2.userData.robotSitPose,'procedural');
});
test('scene persistence and backend validate new inventory metadata, drop and archive remapping',()=>{
 const editor=read('js/editor.js'),physics=read('js/scene-physics.js'),server=read('backend/server.py'),archive=read('backend/realm_archives.py');
 assert.match(editor,/storage:canBePickable\(/);assert.match(editor,/this\.inventory\.reconcile\(\)/);
 assert.match(physics,/object\.userData\.carriedBy\|\|object\.userData\.storage/);
 assert.match(server,/def valid_inventory_item/);assert.match(server,/def valid_inventory_storage/);
 assert.match(server,/\('pickup','throw','drop'\)/);
 assert.match(archive,/reference='bagId' if storage\.get\('type'\)=='bag' else 'holderId'/);
 assert.match(read('index.html'),/id="robotInventoryItems"/);
});
