import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readFileSync} from 'node:fs';

function loadedLadder(){
 const source=fs.readFileSync(new URL('../js/office-ladder.js',import.meta.url),'utf8')
  .replace(/^import .*;\s*$/gm,'').replaceAll('export function ','function ');
 class Vector3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} clone(){return new Vector3(this.x,this.y,this.z);} copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}}
 class Group{constructor(){this.children=[];this.userData={};this.name='';this.position=new Vector3();this.scale=new Vector3(1,1,1);this.rotation={x:0,y:0,z:0};}
   add(x){this.children.push(x);}remove(x){this.children=this.children.filter(y=>y!==x);}
   updateMatrixWorld(){}
   worldToLocal(p){p.x-=this.position.x;p.y-=this.position.y;p.z-=this.position.z;
     const cy=Math.cos(this.rotation.y),sy=Math.sin(this.rotation.y),cx=Math.cos(this.rotation.x),sx=Math.sin(this.rotation.x);
     const x=cy*p.x-sy*p.z,z=sy*p.x+cy*p.z;
     const y=cx*p.y+sx*z;
     p.z=(-sx*p.y+cx*z)/this.scale.z;p.y=y/this.scale.y;p.x=x/this.scale.x;return p;}
   localToWorld(p){const cx=Math.cos(this.rotation.x),sx=Math.sin(this.rotation.x),cy=Math.cos(this.rotation.y),sy=Math.sin(this.rotation.y);
     const x=p.x*this.scale.x,y=p.y*this.scale.y,z=p.z*this.scale.z;
     const xx=x,yy=cx*y-sx*z,zz=sx*y+cx*z;
     p.x=this.position.x+cy*xx+sy*zz;p.y=this.position.y+yy;p.z=this.position.z-sy*xx+cy*zz;return p;}
 }
 class BoxGeometry{constructor(w,h,d){this.parameters={width:w,height:h,depth:d};}dispose(){}}
 class Mesh{constructor(geometry,material){this.geometry=geometry;this.material=material;this.position=new Vector3();this.userData={};}}
 class MeshStandardMaterial{constructor(config){this.config=config;}dispose(){}}
 const THREE={Vector3,Group,BoxGeometry,Mesh,MeshStandardMaterial};
 return new Function('THREE','wallPresetTexture','climbSurfaceProximity',source+'\nreturn {sanitiseLadder,ladderRungHeights,makeLadder,rebuildLadder,ladderProximity,ladderClimbPose,ladderClimbStep,stepLadderRobot,releaseLadder};')(THREE,()=>null,()=>null);
}
test('ladder object includes two rails, adjustable rungs and retained material',()=>{
 const {makeLadder,rebuildLadder,ladderRungHeights}=loadedLadder();
 const ladder=makeLadder({width:1.5,height:3.4,rungSpacing:.3,color:'#abcdef',texture:'concrete'});
 assert.equal(ladder.children.length,ladderRungHeights(ladder.userData.ladder).length+2);
 assert.equal(ladder.userData.ladder.color,'#abcdef');
 assert.equal(ladder.children[0].geometry.parameters.height,3.4);
 assert.equal(ladder.children[1].position.x,.75);
 const changed=rebuildLadder(ladder,{width:2,height:5,rungMode:'count',rungs:12,texture:'metal'});
 assert.equal(changed.rungs,12);assert.equal(ladder.children.length,14);assert.equal(ladder.children[0].position.x,-1);
});
test('ladder geometry is bounded against invalid user input',()=>{
 const {sanitiseLadder,ladderClimbStep}=loadedLadder();
 assert.equal(sanitiseLadder({width:900,height:700,rungSpacing:0,rungs:-8}).width,4);
 assert.equal(sanitiseLadder({height:700}).height,40);
 assert.equal(sanitiseLadder({rungMode:'nope'}).rungMode,'spacing');
 assert.equal(sanitiseLadder({color:'bad'}).color,'#a5b9c8');
 assert.equal(ladderClimbStep(2,1,.2,5),2.075);
 assert.equal(ladderClimbStep(.01,-1,.5,5),0);
 assert.equal(ladderClimbStep(4.99,1,.5,5),5);
});
test('robot climbs up, down and stays idle at unsupported top',()=>{
 const {makeLadder,stepLadderRobot}=loadedLadder();
 const ladder=makeLadder({height:2.1});ladder.userData.editorId='ladder-123';
 const robot={position:{x:0,y:0,z:.45,clone(){return {...this};},copy(p){Object.assign(this,p);}},rotation:{y:0},userData:{robotAnimator:{actions:new Map([['climbLadder',{}]])}}};
 assert.equal(stepLadderRobot(robot,[ladder],1,.05),true);
 assert.equal(robot.userData.robotMode,'climbLadder');assert.equal(robot.rotation.y,Math.PI);
 const previous=robot.position.y;
 assert.equal(stepLadderRobot(robot,[ladder],-1,.05),true);assert.ok(robot.position.y<previous);
 for(let i=0;i<100;i++)stepLadderRobot(robot,[ladder],1,.05);
 assert.equal(robot.position.y,2.1);assert.equal(robot.userData.robotMode,'idle');
 assert.ok(robot.userData.robotLadderRide,'no upper platform must not release a visitor in midair');
});
test('jump detaches from ladder and restores gravity without jump impulse',()=>{
 const {makeLadder,stepLadderRobot,releaseLadder}=loadedLadder();
 const ladder=makeLadder();ladder.userData.editorId='ladder-124';
 const robot={position:{x:0,y:.4,z:.4,clone(){return {...this};},copy(p){Object.assign(this,p);}},rotation:{y:0},userData:{}};
 assert.equal(stepLadderRobot(robot,[ladder],1,.05),true);
 assert.equal(releaseLadder(robot),true);
 assert.equal(robot.userData.robotLadderRide,undefined);
 assert.equal(robot.userData.robotFallActive,true);
 assert.equal(stepLadderRobot(robot,[ladder],1,.05),false,'cannot immediately reattach during a jump');
});
test('top exit requires a real reachable platform',()=>{
 const {makeLadder,stepLadderRobot}=loadedLadder();
 const ladder=makeLadder({height:2});ladder.userData.editorId='ladder-125';
 const robot={position:{x:0,y:1.95,z:.4,clone(){return {...this};},copy(p){Object.assign(this,p);}},rotation:{y:0},userData:{}};
 stepLadderRobot(robot,[ladder],1,.05);
 let calls=0;
 const result=stepLadderRobot(robot,[ladder],1,.05,{upperSurface:()=>{calls++;return true;}});
 assert.equal(result,true);assert.equal(calls,1);
 assert.equal(robot.userData.robotLadderDismount,true);
 assert.equal(robot.userData.robotLadderRide,undefined);
 assert.equal(robot.userData.robotMode,'idle');
});
test('ladder interface saves, restores, validates and only uses proper +/- controls',()=>{
 const editor=readFileSync(new URL('../js/editor.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const physics=readFileSync(new URL('../js/scene-physics.js',import.meta.url),'utf8');
 const backend=readFileSync(new URL('../backend/server.py',import.meta.url),'utf8');
 const anim=readFileSync(new URL('../js/animations.js',import.meta.url),'utf8');
 const controls=readFileSync(new URL('../js/ui-controls.js',import.meta.url),'utf8');
 assert.match(editor,/'stairs advanced','ladder','escalator'/);
 assert.match(editor,/case 'ladder':object=makeLadder/);
 assert.match(editor,/ladder:o\.userData\.editorKind==='ladder'/);
 assert.match(editor,/if\(entry\.kind==='ladder'\)rebuildLadder/);
 assert.match(editor,/stepLadderRobot\(robot,this\.items,input\.f,dt/);
 assert.match(editor,/releaseLadder\(bot\)/);
 assert.match(html,/id="ladderWidth"/);assert.match(html,/id="ladderHeight"/);assert.match(html,/id="ladderAdhesion"/);
 assert.match(html,/id="ladderRungs"/);assert.match(html,/id="ladderRungSpacing"/);
 assert.match(html,/id="ladderTexture"/);assert.match(html,/id="ladderColor"/);
 assert.match(html,/assets\/ui-icons\/portrait-minus\.svg/);
 assert.match(html,/assets\/ui-icons\/portrait-plus\.svg/);
 assert.doesNotMatch(html,/Off: explore without object settings/);
 assert.match(controls,/robot-face-size-actions/);
 assert.match(physics,/object\.userData\.robotLadderRide/);
 assert.match(physics,/landAtLadderTop\(/);
 assert.match(backend,/def valid_office_ladder/);
 assert.match(backend,/not valid_office_ladder\(obj\.get\('ladder'\)\)/);
 assert.match(anim,/climbLadder:\['climbing up wall','climb up wall','climbing wall'/);
});

test('Arrow Up recognises an approaching ladder before the capsule contacts its rungs',()=>{
 const {makeLadder,ladderProximity,stepLadderRobot}=loadedLadder();
 const ladder=makeLadder();ladder.userData.editorId='ladder-approach';
 const robot={position:{x:0,y:0,z:1,clone(){return {...this};},copy(p){Object.assign(this,p);}},rotation:{y:Math.PI},userData:{}};
 assert.equal(ladderProximity(ladder,robot)?.side,1);
 assert.equal(stepLadderRobot(robot,[ladder],1,1/60),true);
 assert.equal(robot.userData.robotLadderRide?.id,'ladder-approach');
 assert.equal(robot.userData.robotLadderRide?.side,1);
 assert.ok(Math.abs(robot.position.z-.30)<1e-8);
});

test('back-face approach climbs instead of being rejected by a one-sided trigger',()=>{
 const {makeLadder,stepLadderRobot}=loadedLadder();
 const ladder=makeLadder();ladder.userData.editorId='ladder-back';
 const robot={position:{x:0,y:0,z:-.95,clone(){return {...this};},copy(p){Object.assign(this,p);}},rotation:{y:0},userData:{}};
 assert.equal(stepLadderRobot(robot,[ladder],1,1/60),true);
 assert.equal(robot.userData.robotLadderRide.side,-1);
 assert.ok(Math.abs(robot.position.z+.30)<1e-8);
 assert.equal(robot.rotation.y,0);
});

test('a collision-stopped character can attach from either face without needing to penetrate the ladder',()=>{
 const {makeLadder,stepLadderRobot}=loadedLadder();
 const ladder=makeLadder();ladder.userData.editorId='ladder-contact';
 const robot={position:{x:0,y:0,z:-.36,clone(){return {...this};},copy(p){Object.assign(this,p);}},rotation:{y:1.4},userData:{}};
 assert.equal(stepLadderRobot(robot,[ladder],1,1/60),true);
 assert.equal(robot.userData.robotLadderRide.side,-1);
});

test('ladder entry retains safe left/right location along a wide ladder',()=>{
 const {makeLadder,stepLadderRobot}=loadedLadder();
 const ladder=makeLadder({width:3});ladder.userData.editorId='ladder-wide';
 const robot={position:{x:.8,y:0,z:.75,clone(){return {...this};},copy(p){Object.assign(this,p);}},rotation:{y:Math.PI},userData:{}};
 assert.equal(stepLadderRobot(robot,[ladder],1,1/60),true);
 assert.ok(Math.abs(robot.position.x-.8)<1e-8);
 assert.ok(Math.abs(robot.userData.robotLadderRide.x-.8)<1e-8);
});

test('a distant or sideways passer-by is not pulled onto a ladder',()=>{
 const {makeLadder,stepLadderRobot}=loadedLadder();
 const ladder=makeLadder();ladder.userData.editorId='ladder-no-snap';
 const robot={position:{x:0,y:0,z:1.6,clone(){return {...this};},copy(p){Object.assign(this,p);}},rotation:{y:Math.PI},userData:{}};
 assert.equal(stepLadderRobot(robot,[ladder],1,1/60),false);
 robot.position.z=1.0;robot.rotation.y=Math.PI/2;
 assert.equal(stepLadderRobot(robot,[ladder],1,1/60),false);
 robot.rotation.y=Math.PI;robot.position.x=2;
 assert.equal(stepLadderRobot(robot,[ladder],1,1/60),false);
});

test('top dismount detects a supporting platform on the opposite face from the entry',()=>{
 const src=readFileSync(new URL('../js/scene-physics.js',import.meta.url),'utf8');
 assert.match(src,/const exitSide=ride\?\.side===-1\?1:-1/);
 assert.match(src,/new THREE\.Vector3\(x,cfgHeight\+\.55,z\)/);
 assert.match(src,/object\.userData\.robotLadderRide/);
});


test('multiplayer position corrections cannot pull an attached avatar off a ladder',()=>{
 const editor=readFileSync(new URL('../js/editor.js',import.meta.url),'utf8');
 assert.match(editor,/if\(obj\.userData\.robotLadderRide\|\|obj\.userData\.robotSeated\)\{this\.remoteCorrections\.delete\(id\);continue;\}/);
});

test('climbing speed changes actual ascent and descent rate with safe bounds',()=>{
 const {ladderClimbStep,makeLadder,stepLadderRobot}=loadedLadder();
 assert.equal(ladderClimbStep(1,1,.05,8,.5),1.025);
 assert.equal(ladderClimbStep(1,-1,.05,8,3),.85);
 assert.equal(ladderClimbStep(1,1,.05,8),1.0625);
 assert.equal(ladderClimbStep(1,1,.05,8,Number.NaN),1.0625);
 assert.equal(ladderClimbStep(1,1,.05,8,50),1.2);
 const ladder=makeLadder({height:8});ladder.userData.editorId='ladder-speed-test';
 const robot={position:{x:0,y:1,z:.44,clone(){return {...this};},copy(p){Object.assign(this,p);}},rotation:{y:Math.PI},userData:{robotClimbSpeed:.5}};
 assert.equal(stepLadderRobot(robot,[ladder],1,.05),true);
 const y=robot.position.y;
 assert.ok(Math.abs(y-1.025)<1e-7);
 robot.userData.robotClimbSpeed=3;
 assert.equal(stepLadderRobot(robot,[ladder],1,.05),true);
 assert.ok(Math.abs(robot.position.y-y-.15)<1e-7);
 assert.equal(stepLadderRobot(robot,[ladder],-1,.05),true);
 assert.ok(Math.abs(robot.position.y-y)<1e-7);
});

test('ladder adhesion positions the avatar at a controllable rung-plane distance from either side',()=>{
 const {makeLadder,stepLadderRobot,sanitiseLadder}=loadedLadder();
 assert.equal(sanitiseLadder({}).adhesion,.30);
 assert.equal(sanitiseLadder({adhesion:-5}).adhesion,.12);
 assert.equal(sanitiseLadder({adhesion:3}).adhesion,.85);
 assert.equal(sanitiseLadder({adhesion:NaN}).adhesion,.30);
 const ladder=makeLadder({adhesion:.19});ladder.userData.editorId='adhesion-test';
 const robot=(z,yaw)=>({position:new (class{constructor(){this.x=0;this.y=0;this.z=z;}clone(){return {...this};}copy(v){Object.assign(this,v);}})(),rotation:{y:yaw},userData:{}});
 const front=robot(.8,Math.PI);const back=robot(-.8,0);
 assert.equal(stepLadderRobot(front,[ladder],1,.05),true);
 assert.equal(stepLadderRobot(back,[ladder],1,.05),true);
 assert.ok(Math.abs(front.position.z-.19)<1e-7);
 assert.ok(Math.abs(back.position.z+.19)<1e-7);
 ladder.userData.ladder.adhesion=.55;
 stepLadderRobot(front,[ladder],1,.05);
 assert.ok(Math.abs(front.position.z-.55)<1e-7,'changes apply to attached avatars immediately');
});

test('inclined and yaw-rotated ladders tilt the robot along the actual ladder axis',()=>{
 const {makeLadder,ladderClimbPose,stepLadderRobot,releaseLadder}=loadedLadder();
 const ladder=makeLadder({adhesion:.22});ladder.userData.editorId='incline-test';
 ladder.rotation.x=12*Math.PI/180;ladder.rotation.y=.7;
 const front=ladder.localToWorld(new (class{constructor(){this.x=0;this.y=.7;this.z=.5;}})());
 const robot={position:{...front,clone(){return {...this};},copy(p){Object.assign(this,p);}},rotation:{y:ladderClimbPose(ladder,1).yaw},userData:{}};
 assert.equal(stepLadderRobot(robot,[ladder],1,.05),true);
 assert.ok(Math.abs(robot.userData.robotLadderVisualPitch+12*Math.PI/180)<1e-7,'front face leans with incline');
 const contact=ladder.worldToLocal({...robot.position});
 assert.ok(Math.abs(contact.z-.22)<1e-7,'adhesion is in the rotated ladder coordinate space');
 assert.ok(Math.abs(robot.rotation.y-ladderClimbPose(ladder,1).yaw)<1e-7);
 const reverse=ladderClimbPose(ladder,-1);
 assert.ok(Math.abs(reverse.pitch-12*Math.PI/180)<1e-7,'opposite face reverses pitch');
 assert.equal(releaseLadder(robot),true);
 assert.equal(robot.userData.robotLadderVisualPitch,0,'detaching straightens the avatar');
});

test('adhesion UI, backend compatibility and visual-only tilt do not rotate the physics capsule',()=>{
 const editor=readFileSync(new URL('../js/editor.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const robots=readFileSync(new URL('../js/robots.js',import.meta.url),'utf8');
 const physics=readFileSync(new URL('../js/scene-physics.js',import.meta.url),'utf8');
 const backend=readFileSync(new URL('../backend/server.py',import.meta.url),'utf8');
 assert.match(html,/id="ladderAdhesion"[^>]*min="0.12" max="0.85"/);
 assert.match(editor,/adhesion:byId\('ladderAdhesion'\)\.value/);
 assert.match(editor,/adhesion:'ladderAdhesion'/);
 assert.match(robots,/robotLadderVisualPitch/);
 assert.match(robots,/avatarVisual\.rotation\.order='YXZ'/);
 assert.doesNotMatch(physics,/robotLadderVisualPitch/);
 assert.match(backend,/if 'adhesion' in ladder/);
 assert.match(backend,/not \.12<=value<=\.85/);
});

test('avatar render model tilts along the ladder without rotating the robot root, then straightens after release',()=>{
 const src=readFileSync(new URL('../js/robots.js',import.meta.url),'utf8');
 const code=src.slice(src.indexOf('export function animateRobots(')).replace('export function animateRobots(','function animateRobots(');
 const animate=new Function('permittedRobotLocomotion','continuousGaitMode','animationSpeedSettings',
  `${code}\nreturn animateRobots;`)(()=>true,(_data,mode)=>mode,()=>({walk:1,run:1,jump:1}));
 for(const yaw of [0,Math.PI]){
  const visual={userData:{robotVisual:true},rotation:{x:0,y:yaw,z:0},position:{y:0},children:[]};
  const robot={rotation:{x:0,y:1,z:0},children:[visual],userData:{editorKind:'robot',robotMode:'climbLadder',robotLadderRide:{id:'ladder'},robotLadderVisualPitch:-.21,robotLadderSpeed:1,
   robotAnimator:{actions:new Map([['climbLadder',{}]]),play(){},setPlaybackSpeed(){},setClimbDescending(){},update(){}}}};
  animate([robot],.08);
  const expected=yaw===0?-.21:.21;
  assert.ok(Math.abs(visual.rotation.x-expected)<1e-10,'model pitch matches ladder in world space');
  assert.equal(robot.rotation.x,0,'physics/root is not rotated');
  delete robot.userData.robotLadderRide;robot.userData.robotLadderVisualPitch=0;
  animate([robot],.08);
  assert.ok(Math.abs(visual.rotation.x)<1e-10,'avatar straightens after release');
 }
});
