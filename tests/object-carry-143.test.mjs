import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

class V3{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
 copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}
 clone(){return new V3(this.x,this.y,this.z);}
 add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
 addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;}
 set(x,y,z){Object.assign(this,{x,y,z});return this;}
 sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
 get length(){return Math.hypot(this.x,this.y,this.z);}
 applyAxisAngle(a,angle){const x=this.x,z=this.z;this.x=x*Math.cos(angle)+z*Math.sin(angle);this.z=z*Math.cos(angle)-x*Math.sin(angle);return this;}
}
class Box{
 setFromObject(o){const s=o._bounds||{x:.25,y:.4,z:.25};this.min=new V3(o.position.x-s.x,o.position.y,o.position.z-s.z);this.max=new V3(o.position.x+s.x,o.position.y+s.y,o.position.z+s.z);return this;}
 isEmpty(){return false;}
 getSize(v){return v.copy(new V3(this.max.x-this.min.x,this.max.y-this.min.y,this.max.z-this.min.z));}
 getCenter(v){return v.copy(new V3((this.max.x+this.min.x)/2,(this.max.y+this.min.y)/2,(this.max.z+this.min.z)/2));}
}
const THREE={Vector3:V3,Box3:Box};
const source=fs.readFileSync(new URL('../js/object-carry.js',import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
const exports=new Function('THREE',source+'\nreturn {ObjectCarry,pickableTarget,canBePickable,pickUpClip,throwImpulse,findRightHand,cleanThrowSettings};')(THREE);
function fixture({facing=true,kind='cube'}={}){
 const packets=[],sync=[],remove=[],saves=[],impulses=[];
 const robot={position:new V3(0,0,0),rotation:{y:0},parent:{},children:[],updateWorldMatrix(){},userData:{editorKind:'robot',editorId:'robot-0001',robotAvailableActions:['Picking Up','Lifting','Throw'],robotAnimator:{clipDuration:()=>.62}}};
 const item={position:new V3(0,0,facing?1:-1),updateWorldMatrix(){},quaternion:{setFromAxisAngle(){return this;}},userData:{editorKind:kind,editorId:'object-0001',pickable:true,physics:{mode:'static'}}};
 const physics={enabled:true,owns:()=>true,remove(id){remove.push(id);},sync(obj){sync.push(obj.userData.physics.mode);},applyEditedPose(){},bodies:new Map([['object-0001',{applyImpulse(impulse){impulses.push(impulse);}}]])};
 const editor={items:[robot,item],physics,canEdit:()=>true,queueSave(obj){saves.push(obj);},toast:()=>{}};
 globalThis.window={solviRoomSocket:{send(data){packets.push(data);}}};
 const carry=new exports.ObjectCarry(editor);
 return {robot,item,editor,carry,packets,sync,remove,saves,impulses};
}
test('pickable is opt-in, restricted to suitable scene objects and targets in front',()=>{
 assert.equal(exports.canBePickable('robot'),false);assert.equal(exports.canBePickable('portal'),false);
 assert.equal(exports.canBePickable('model'),true);assert.equal(exports.canBePickable('furniture'),true);
 const f=fixture();assert.equal(exports.pickableTarget(f.robot,f.editor.items),f.item);
 f.item.userData.pickable=false;assert.equal(exports.pickableTarget(f.robot,f.editor.items),null);
 const behind=fixture({facing:false});assert.equal(exports.pickableTarget(behind.robot,behind.editor.items),null);
 const huge=fixture();huge.item._bounds={x:3,y:2,z:3};assert.equal(exports.pickableTarget(huge.robot,huge.editor.items),null);
 const flat=fixture();flat.item._bounds={x:.25,y:0,z:.25};assert.equal(exports.pickableTarget(flat.robot,flat.editor.items),flat.item,'a thin primitive plane is pickable');
});
test('pickup plays authored Lifting once, attaches at hand and holds without persisting a temporary physics mode',()=>{
 const {robot,item,carry,remove,saves,packets}=fixture();
 assert.equal(exports.pickUpClip(robot.userData.robotAvailableActions,'pickUp'),'clip:Picking Up');
 assert.equal(exports.pickUpClip(robot.userData.robotAvailableActions,'liftCarry'),'clip:Lifting');
 assert.equal(carry.pickup(robot),true);
 assert.equal(robot.userData.robotCarry.stage,'pickup');
 assert.equal(item.userData.carriedBy,undefined);
 carry.tick(.1);carry.tick(.1);carry.tick(.1);carry.tick(.1);
 assert.equal(item.userData.carriedBy,robot.userData.editorId);
 assert.deepEqual(remove,['object-0001']);
 assert.equal(item.userData.physics.mode,'static');
 assert.equal(item.userData.carryOrigin.position.z,1);
 assert.equal(saves.length,0,'pickup must never persist a temporary carried transform');
 carry.tick(.1);carry.tick(.1);carry.tick(.1);
 assert.equal(robot.userData.robotCarry.stage,'hold');
 assert.equal(packets[0].action,'pickup');
});
test('throw releases at the animation swing phase with dynamic Rapier impulse and saves the result',()=>{
 const {robot,item,carry,sync,saves,packets,impulses}=fixture();
 carry.pickup(robot);for(let i=0;i<8;i++)carry.tick(.1);
 assert.equal(carry.throw(robot),true);assert.equal(robot.userData.robotCarry.stage,'throw');
 assert.equal(item.userData.carriedBy,robot.userData.editorId,'retain the prop until the arm reaches the release frame');
 for(let i=0;i<6;i++)carry.tick(.1);
 assert.equal(item.userData.carriedBy,undefined);
 assert.equal(item.userData.physics.mode,'dynamic');
 assert.equal(item.userData.carryOrigin,undefined);
 assert.ok(impulses[0]?.y>0);assert.ok(impulses[0]?.z>0);
 assert.equal(sync.at(-1),'dynamic');assert.equal(saves.length,1);
 assert.equal(packets.at(-1).action,'throw');
 assert.ok(Number.isFinite(packets.at(-1).x));
 for(let i=0;i<5;i++)carry.tick(.1);
 assert.equal(robot.userData.robotCarry,null);
});
test('carrier removal releases a held object instead of leaving a non-colliding ghost',()=>{
 const f=fixture();f.carry.pickup(f.robot);for(let i=0;i<8;i++)f.carry.tick(.1);
 f.editor.items=[f.item];f.carry.tick(.016);
 assert.equal(f.item.userData.carriedBy,undefined);
 assert.equal(f.item.userData.physics.mode,'dynamic');
 assert.equal(f.sync.at(-1),'dynamic');
});
test('right-hand metacarpal and proximal finger joints outrank wrist and left hand',()=>{
 const f=fixture();
 const bone=name=>({name,isBone:true,getWorldPosition(vec){return vec.copy(new V3(.8,1.5,.3));}});
 const left=bone('mixamorigLeftHand'),finger=bone('mixamorigRightHandMiddle1'),right=bone('mixamorigRightHand');
 f.robot.children.push({userData:{robotVisual:true},traverse(cb){for(const obj of [left,finger,right])cb(obj);}});
 assert.equal(exports.findRightHand(f.robot),finger);
 const metacarpal=bone('mixamorigRightHandMiddleMetacarpal');
 f.robot.children[0].traverse=cb=>{for(const obj of [left,finger,right,metacarpal])cb(obj);};
 assert.equal(exports.findRightHand(f.robot),metacarpal);
 f.carry.pickup(f.robot);for(let i=0;i<7;i++)f.carry.tick(.1);
 assert.ok(Math.abs(f.item.position.x-.8)<.01,'held object centre follows the right palm');
});
test('permissions, missing assets, and remote packets fail closed',()=>{
 const f=fixture();f.editor.physics.owns=()=>false;
 assert.equal(f.carry.pickup(f.robot),false);
 f.editor.physics.owns=()=>true;
 f.item.userData.editorKind='model';f.item.userData.modelReady=false;
 assert.equal(f.carry.pickup(f.robot),false);
 f.item.userData.modelReady=true;
 assert.equal(f.carry.pickup(f.robot),true);
 f.carry.remotePacket({id:f.robot.userData.editorId,target:'other-0001',action:'throw'});
 assert.equal(f.robot.userData.robotCarry.stage,'pickup');
});
test('source wires I/O through exploration mode, captures physics and validates server broadcasts',()=>{
 const editor=fs.readFileSync(new URL('../js/editor.js',import.meta.url),'utf8');
 const server=fs.readFileSync(new URL('../backend/server.py',import.meta.url),'utf8');
 const live=fs.readFileSync(new URL('../js/live.js',import.meta.url),'utf8');
 const archive=fs.readFileSync(new URL('../backend/realm_archives.py',import.meta.url),'utf8');
 assert.match(editor,/Object\.hasOwn\(ROBOT_KEY_ACTIONS,e\.code\)/);
 assert.match(fs.readFileSync(new URL('../js/robot-shortcut-help.js',import.meta.url),'utf8'),/KeyI:.*KeyO:.*KeyJ:.*KeyB:/);
 assert.match(editor,/pickable:canBePickable\(/);
 assert.match(editor,/carryOrigin\?\.position\|\|o\.position/);
 assert.match(editor,/duplicate\.userData\.pickable=entry\.pickable/);
 assert.match(server,/Invalid pickable flag/);
 assert.match(server,/elif msg\.get\('type'\)=='object-carry'/);
 assert.match(live,/applyRemoteCarry/);
 assert.match(archive,/'pickable'/);
});

test('Lifting is the only pickup action, and completes before hand-hold without looping',()=>{
 const f=fixture();const requested=[];
 f.robot.userData.robotAnimator.clipDuration=(clip)=>{requested.push(clip);return .72;};
 assert.equal(f.carry.pickup(f.robot),true);
 assert.deepEqual(requested,['clip:Lifting'],'Picking Up must never be requested');
 assert.equal(f.robot.userData.robotCarry.duration,.72);
 for(let i=0;i<8;i++)f.carry.tick(.1);
 assert.equal(f.robot.userData.robotCarry.stage,'hold');
 assert.equal(f.item.userData.carriedBy,f.robot.userData.editorId);
 assert.equal(f.robot.userData.robotPlaying,null,'ready to transition to locomotion');
});

test('holding an object resumes Idle, Walk and Run instead of looping Lifting',()=>{
 const file=fs.readFileSync(new URL('../js/robots.js',import.meta.url),'utf8');
 const start=file.indexOf('export function animateRobots(');
 assert.ok(start>0);
 const animate=new Function('performance','combatPhase','landingClipFor','permittedRobotLocomotion','continuousGaitMode','animationSpeedSettings','gaitCadence',
  file.slice(start).replace(/^export /gm,'')+'\nreturn animateRobots;')(
    {now:()=>1000},()=>0,(k)=>k,()=>true,(_data,mode)=>mode,()=>({walk:1,run:1,jump:1}),()=>1);
 const f=fixture();const played=[];
 f.robot.userData.robotMode='idle';
 f.robot.userData.robotActualSpeed=3;
 f.robot.userData.robotAnimator={actions:new Map([['liftCarry',{}],['throwObject',{}],['idle',{}],['walk',{}],['run',{}]]),play(kind){played.push(kind);},update(){},setPlaybackSpeed(){},clipDuration:()=>.62};
 assert.equal(f.carry.pickup(f.robot),true);
 animate([f.robot],.08);
 assert.equal(played.at(-1),'liftCarry');
 for(let i=0;i<9;i++)f.carry.tick(.1);
 animate([f.robot],.08);
 assert.equal(played.at(-1),'idle');
 f.robot.userData.robotMode='walk';f.robot.userData.robotPlaying=null;
 animate([f.robot],.08);
 assert.equal(played.at(-1),'walk','carrying must allow walking');
 f.robot.userData.robotMode='run';f.robot.userData.robotPlaying=null;
 animate([f.robot],.08);
 assert.equal(played.at(-1),'run','carrying must allow running');
 assert.equal(f.item.userData.carriedBy,f.robot.userData.editorId,'object stays in hand while moving');
});

test('O detaches at release phase from the hand BEFORE dynamic physics and launches forward',()=>{
 const f=fixture();f.carry.pickup(f.robot);for(let i=0;i<9;i++)f.carry.tick(.1);
 const order=[];
 f.editor.physics.sync=obj=>{order.push(['sync',obj.userData.carriedBy,obj.position.y]);};
 f.editor.physics.bodies.set(f.item.userData.editorId,{
  mass:()=>2,setLinvel(){order.push(['velocity-reset']);},applyImpulse(v){order.push(['impulse',v]);}
 });
 assert.equal(f.carry.throw(f.robot),true);
 assert.equal(f.item.userData.carriedBy,f.robot.userData.editorId,'must remain attached during the arm wind-up');
 f.carry.tick(.1);f.carry.tick(.1);f.carry.tick(.1);f.carry.tick(.1);
 assert.equal(f.item.userData.carriedBy,undefined,'must detach at the release moment');
 assert.ok(f.item.position.y+.2>=1.19,'geometric centre launches at hand height, not floor');
 assert.equal(order[0][0],'sync');
 assert.equal(order[0][1],undefined,'dynamic body cannot be constructed while attached');
 assert.equal(order[1][0],'velocity-reset');
 assert.equal(order[2][0],'impulse');
 assert.ok(order[2][1].z>order[2][1].y*2,'forward throw rather than upward lob');
 assert.equal(f.robot.userData.robotCarry.stage,'throw');
 assert.equal(f.packets.at(-1).action,'throw');
});

test('remote throw detaches at authoritative release position, without local impulse',()=>{
 const f=fixture();f.carry.pickup(f.robot,true,f.item.userData.editorId);
 for(let i=0;i<9;i++)f.carry.tick(.1);
 f.carry.remotePacket({action:'throw',id:f.robot.userData.editorId,target:f.item.userData.editorId,x:4,y:2.3,z:8});
 assert.equal(f.item.userData.carriedBy,undefined);
 assert.deepEqual([f.item.position.x,f.item.position.y,f.item.position.z],[4,2.3,8]);
 assert.equal(f.item.userData.physics.mode,'dynamic');
 assert.equal(f.impulses.length,0,'remote clients cannot apply duplicate throw forces');
});

test('Lifting, like Throw, is a non-looping authored animation',()=>{
 const animations=fs.readFileSync(new URL('../js/animations.js',import.meta.url),'utf8');
 assert.match(animations,/oneShot=\['pickUp','liftCarry','throwObject'/);
 assert.match(animations,/action\.setLoop\(oneShot\?this\.THREE\.LoopOnce:this\.THREE\.LoopRepeat/);
});

test('throw tuning rejects nonfinite settings but preserves finite aim/delay values',()=>{
 assert.deepEqual(exports.cleanThrowSettings(),{angle:12,height:0,direction:0,delay:55,pickupDelay:55,pickupSpeed:1,throwSpeed:1,force:3.1});
 assert.deepEqual(exports.cleanThrowSettings({angle:NaN,height:Infinity,direction:180,delay:-4}),{angle:12,height:0,direction:180,delay:-4,pickupDelay:55,pickupSpeed:1,throwSpeed:1,force:3.1});
 const f=fixture();f.robot.userData.robotThrowSettings={angle:35,height:.3,direction:90,delay:80};
 f.carry.pickup(f.robot);for(let i=0;i<9;i++)f.carry.tick(.1);
 f.carry.throw(f.robot);const state=f.robot.userData.robotCarry;
 assert.equal(state.releaseAt,.62*.8);
 for(let i=0;i<4;i++)f.carry.tick(.1);
 assert.equal(f.item.userData.carriedBy,f.robot.userData.editorId,'80% delay has not elapsed');
 for(let i=0;i<2;i++)f.carry.tick(.1);
 assert.equal(f.item.userData.carriedBy,undefined);
 assert.ok(f.item.position.y>1.25,'height added to palm position after the object pivot offset');
 const impulse=f.impulses[0];assert.ok(impulse.x>1.5,'direction offset turns throw to robot right');
 assert.ok(Math.abs(impulse.z)<.1,'90-degree yaw should remove forward Z component');
 assert.ok(impulse.y>1,'35-degree elevation produces an upward component');
});
test('throw release follows live animated metacarpal rather than pickup wrist position',()=>{
 const f=fixture();let palmX=.3;
 const wrist={name:'RightHand',isBone:true,getWorldPosition(p){return p.copy(new V3(0,1.2,.1));}};
 const bone={name:'RightHandMiddleMetacarpal',isBone:true,getWorldPosition(p){return p.copy(new V3(palmX,1.7,.1));}};
 f.robot.children.push({userData:{robotVisual:true},traverse(fn){fn(wrist);fn(bone);}});
 f.carry.pickup(f.robot);for(let i=0;i<9;i++)f.carry.tick(.1);
 const before=f.item.position.x;palmX=.75;
 f.carry.throw(f.robot);f.carry.tick(.12);
 assert.ok(f.item.position.x>before+.35,'held prop tracks the moving hand during Throw');
 for(let i=0;i<5;i++)f.carry.tick(.12);
 assert.ok(f.item.position.x>.7,'release position is computed at the live metacarpal during the swing');
});
test('robot inspector has compact throw tuning saved per avatar and backend + archive accept it',()=>{
 const editor=fs.readFileSync(new URL('../js/editor.js',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const backend=fs.readFileSync(new URL('../backend/server.py',import.meta.url),'utf8');
 const archive=fs.readFileSync(new URL('../backend/realm_archives.py',import.meta.url),'utf8');
 for(const id of ['robotThrowAngle','robotThrowHeight','robotThrowDirection','robotThrowDelay'])assert.match(html,new RegExp(`id="${id}"`));
 assert.match(html,/id="robotThrowSettings" class="stair-fold"/);
 assert.match(editor,/throwSettings:o\.userData\.editorKind==='robot'/);
 assert.match(editor,/robotThrowSettings=cleanThrowSettings\(entry\.throwSettings\)/);
 assert.match(backend,/def valid_robot_throw_settings\(settings\):/);
 assert.match(backend,/Invalid throw settings/);
 assert.match(archive,/'throwSettings'/);
});


test('Lifting attaches at configurable pickup delay, not fixed halfway',()=>{
 const f=fixture();f.robot.userData.robotThrowSettings={pickupDelay:80};
 f.carry.pickup(f.robot);
 assert.equal(f.robot.userData.robotCarry.attachAt,.62*.8);
 for(let i=0;i<4;i++)f.carry.tick(.1);
 assert.equal(f.item.userData.carriedBy,undefined,'reaching hand must not grasp before 80% of Lifting');
 f.carry.tick(.1);
 assert.equal(f.item.userData.carriedBy,f.robot.userData.editorId,'hand closes at configured pickup point');
 for(let i=0;i<2;i++)f.carry.tick(.1);
 assert.equal(f.robot.userData.robotCarry.stage,'hold');
 assert.equal(f.editor.physics.enabled,true);
});

test('temporary test sphere starts held at the palm, throws into physics, and is never persisted or broadcast',()=>{
 const f=fixture();
 class TestMesh{
  constructor(geo,mat){this.geometry=geo;this.material=mat;this.userData={};this.position=new V3();this.quaternion={setFromAxisAngle(){}};this.scale={x:1,y:1,z:1,setScalar(n){this.x=n;this.y=n;this.z=n;}};this.parent=null;}
 }
 THREE.Mesh=TestMesh;
 THREE.SphereGeometry=class{dispose(){}};
 THREE.MeshStandardMaterial=class{dispose(){}};
 const scene={add(o){o.parent=this;},remove(o){o.parent=null;}};
 f.editor.world={scene};
 assert.equal(f.carry.testSphere(f.robot),true);
 const sphere=f.editor.items.at(-1);
 assert.equal(sphere.userData.temporaryCarryTest,true);
 assert.equal(sphere.userData.carriedBy,f.robot.userData.editorId);
 assert.equal(f.robot.userData.robotCarry.stage,'hold','no pickup animation needed for a test sphere');
 assert.ok(sphere.scale.x<.2,'sphere is visually small');
 assert.equal(f.carry.throw(f.robot),true);
 for(let i=0;i<6;i++)f.carry.tick(.1);
 assert.equal(sphere.userData.carriedBy,undefined);
 assert.equal(sphere.userData.physics.mode,'dynamic');
 assert.equal(f.saves.length,0,'temporary test prop must never trigger a scene save');
 assert.equal(f.packets.length,0,'temporary test prop must never create room carry packets');
 for(let i=0;i<125;i++)f.carry.tick(.1);
 assert.equal(f.editor.items.includes(sphere),false,'expired test sphere removed from the scene');
 assert.equal(sphere.parent,null);
});

test('temporary props are excluded from persistence and replicated physics streams',()=>{
 const editor=fs.readFileSync(new URL('../js/editor.js',import.meta.url),'utf8');
 const physics=fs.readFileSync(new URL('../js/scene-physics.js',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(editor,/serialize\(\)\{return this\.items\.filter\(o=>!o\.userData\.temporaryCarryTest\)/);
 assert.match(editor,/queueSave\(o\)\{if\(!o\|\|o\.userData\.temporaryCarryTest/);
 assert.match(physics,/!object\.userData\.temporaryCarryTest&&awake/);
 assert.match(html,/id="robotPickupDelay"/);
 assert.match(html,/id="robotTestThrowSphere"/);
});

// v0.2.147: hand-action playback, mass-scaled impulse strength and opt-in aiming preview.
test('per-avatar animation speed changes pickup and release timing without looping the held pose',()=>{
 const f=fixture();f.robot.userData.robotThrowSettings={pickupSpeed:2,throwSpeed:2,pickupDelay:50,delay:60,force:6};
 assert.equal(f.carry.pickup(f.robot),true);
 assert.ok(Math.abs(f.robot.userData.robotCarry.duration-.31)<.001);
 f.carry.tick(.12);assert.equal(f.item.userData.carriedBy,undefined);
 f.carry.tick(.12);assert.equal(f.item.userData.carriedBy,f.robot.userData.editorId);
 f.carry.tick(.12);assert.equal(f.robot.userData.robotCarry.stage,'hold');
 assert.equal(f.carry.throw(f.robot),true);
 const throwState=f.robot.userData.robotCarry;
 assert.ok(Math.abs(throwState.duration-.31)<.001);
 assert.ok(Math.abs(throwState.releaseAt-.186)<.001);
 f.carry.tick(.12);assert.equal(f.item.userData.carriedBy,f.robot.userData.editorId);
 f.carry.tick(.12);assert.equal(f.item.userData.carriedBy,undefined);
 assert.ok(f.impulses.at(-1).z>=5.8,'configurable launch force increases the forward impulse');
 f.carry.tick(.12);assert.equal(f.robot.userData.robotCarry,null);
});

test('predicted guide follows the actual release velocity and gravity, clips ground and collisions',()=>{
 const guideExports=new Function('THREE',source+'\nreturn {predictThrowPath,throwImpulse};')(THREE);
 const cfg={force:5,angle:20,direction:15};
 const origin={x:0,y:1.5,z:0};const yaw=15*Math.PI/180;
 const points=guideExports.predictThrowPath(origin,yaw,cfg);
 assert.ok(points.length>5);
 const vel=guideExports.throwImpulse(yaw,5,20);
 assert.ok(Math.abs(points[1].x-vel.x*.075)<.00001);
 assert.ok(Math.abs(points[1].y-(origin.y+vel.y*.075-.5*9.81*.075**2))<.00001);
 assert.ok(Math.abs(points[1].z-vel.z*.075)<.00001);
 assert.equal(points.at(-1).y,0,'predicted arc stops at the ground');
 let checked=0;
 const blocked=guideExports.predictThrowPath(origin,yaw,cfg,(a,b)=>{checked++;return checked===3?{x:b.x,y:b.y,z:b.z}:null;});
 assert.equal(blocked.length,4,'guide ends at first collided wall or ceiling');
 assert.deepEqual(guideExports.predictThrowPath({x:NaN,y:1,z:0},0,cfg),[]);
});

test('temporary preview uses physics ray hits, does not persist and can be toggled off',()=>{
 const f=fixture();f.editor.selected=f.robot;
 class Ray{constructor(origin,direction){this.origin=origin;this.direction=direction;}}
 f.editor.physics.runtime={Ray};
 f.editor.physics.colliders=new Map([[f.robot.userData.editorId,{robot:true}]]);
 f.editor.physics.world={castRay(ray,distance,_solid,_filters,_groups,excluded){
  assert.ok(excluded.robot);
  return {timeOfImpact:Math.min(.035,distance)};
 }};
 const result=f.carry.collisionOnSegment(f.robot,{x:0,y:1,z:0},{x:0,y:1,z:3});
 assert.ok(result&&Math.abs(result.z-.035)<.00001);
 f.editor.physics.world.castRay=()=>({timeOfImpact:NaN});
 assert.equal(f.carry.collisionOnSegment(f.robot,{x:0,y:1,z:0},{x:0,y:1,z:3}),null);
 f.carry.toggleTrajectory(true);assert.equal(f.carry.trajectoryEnabled,true);
 f.carry.toggleTrajectory(false);assert.equal(f.carry.trajectoryEnabled,false);
 assert.equal(f.saves.length,0,'preview never saves scene or avatar state');
 assert.equal(f.packets.length,0,'preview never broadcasts a multiplayer event');
});

test('inspector, animation clock and server validator expose speed, force and live guide controls',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const editor=fs.readFileSync(new URL('../js/editor.js',import.meta.url),'utf8');
 const robotSource=fs.readFileSync(new URL('../js/robots.js',import.meta.url),'utf8');
 const backend=fs.readFileSync(new URL('../backend/server.py',import.meta.url),'utf8');
 for(const id of ['robotPickupSpeed','robotThrowSpeed','robotThrowForce','robotThrowTrajectory'])assert.match(html,new RegExp(`id="${id}"`));
 assert.match(editor,/carry\.toggleTrajectory\(e\.target\.checked\)/);
 assert.match(robotSource,/data\.robotCarry\.settings\?\.pickupSpeed/);
 assert.match(robotSource,/data\.robotCarry\.settings\?\.throwSpeed/);
 assert.match(backend,/key in \('pickupSpeed','throwSpeed'\) and value<=0/);
 assert.doesNotMatch(backend,/\('force',1\.2,10\)/);
 assert.deepEqual(exports.cleanThrowSettings({force:Infinity,pickupSpeed:7,throwSpeed:-1}),{
  angle:12,height:0,direction:0,delay:55,pickupDelay:55,pickupSpeed:7,throwSpeed:1,force:3.1});
});

test('guide builds a visible transient line and marker and cleans up GPU resources',()=>{
 const prior={};for(const k of ['BufferGeometry','BufferAttribute','Line','LineBasicMaterial','SphereGeometry','Mesh','MeshBasicMaterial'])prior[k]=THREE[k];
 let disposed=0;
 class BufferAttribute{constructor(array,itemSize){this.array=array;this.itemSize=itemSize;}setXYZ(i,x,y,z){this.array.set([x,y,z],i*3);}}
 class BufferGeometry{setAttribute(k,v){this[k]=v;}getAttribute(k){return this[k];}setDrawRange(start,count){this.count=count;}dispose(){disposed++;}}
 class Material{constructor(data){this.data=data;}dispose(){disposed++;}}
 class Object3D{constructor(geometry,material){this.geometry=geometry;this.material=material;this.visible=true;this.position=new V3();this.userData={};this.parent=null;}}
 try{
  Object.assign(THREE,{BufferGeometry,BufferAttribute,Line:class extends Object3D{},LineBasicMaterial:Material,SphereGeometry:class{dispose(){disposed++;}},Mesh:class extends Object3D{},MeshBasicMaterial:Material});
  const f=fixture();f.editor.selected=f.robot;
  f.editor.world={scene:{add(o){o.parent=this;},remove(o){o.parent=null;}}};
  f.carry.toggleTrajectory(true);f.carry.updateTrajectory(.2);
  assert.equal(f.carry.trajectoryLine.visible,true);
  assert.equal(f.carry.trajectoryEnd.visible,true);
  assert.ok(f.carry.trajectoryLine.geometry.count>5);
  assert.ok(f.carry.trajectoryEnd.position.y>=0);
  f.carry.toggleTrajectory(false);
  assert.equal(f.carry.trajectoryLine.visible,false);
  f.carry.clearTrajectory();
  assert.equal(f.carry.trajectoryLine,null);
  assert.ok(disposed>=4);
  assert.equal(f.saves.length,0);
 }finally{for(const [k,v] of Object.entries(prior)){if(v===undefined)delete THREE[k];else THREE[k]=v;}}
});

test('I drop places a held object at floor height and restores Rapier without an impulse',()=>{
 const f=fixture();assert.equal(f.carry.pickup(f.robot),true);for(let i=0;i<8;i++)f.carry.tick(.1);
 assert.equal(f.carry.drop(f.robot),true);
 assert.equal(f.robot.userData.robotCarry,null);
 assert.equal(f.item.userData.carriedBy,undefined);
 assert.equal(f.item.userData.physics.mode,'dynamic');
 assert.ok(Math.abs(f.item.position.y)<.001);
 assert.equal(f.packets.at(-1).action,'drop');
 assert.equal(f.saves.length,1);
 assert.equal(f.impulses.length,0,'placing must not launch the object');
});
