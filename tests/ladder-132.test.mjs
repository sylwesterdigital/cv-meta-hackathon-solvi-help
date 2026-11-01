import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readFileSync} from 'node:fs';

function loadedLadder(){
 const source=fs.readFileSync(new URL('../js/office-ladder.js',import.meta.url),'utf8')
  .replace(/^import .*;\s*$/gm,'').replaceAll('export function ','function ');
 class Vector3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} clone(){return new Vector3(this.x,this.y,this.z);} copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}}
 class Group{constructor(){this.children=[];this.userData={};this.name='';this.position=new Vector3();this.scale=new Vector3(1,1,1);this.rotation={y:0};}
   add(x){this.children.push(x);}remove(x){this.children=this.children.filter(y=>y!==x);}
   updateMatrixWorld(){}
   worldToLocal(p){p.x-=this.position.x;p.y-=this.position.y;p.z-=this.position.z;const c=Math.cos(-this.rotation.y),s=Math.sin(-this.rotation.y);const x=p.x,z=p.z;p.x=(c*x-s*z)/this.scale.x;p.z=(s*x+c*z)/this.scale.z;p.y/=this.scale.y;return p;}
   localToWorld(p){const c=Math.cos(this.rotation.y),s=Math.sin(this.rotation.y);const x=p.x*this.scale.x,z=p.z*this.scale.z;p.x=this.position.x+c*x-s*z;p.z=this.position.z+s*x+c*z;p.y=this.position.y+p.y*this.scale.y;return p;}
 }
 class BoxGeometry{constructor(w,h,d){this.parameters={width:w,height:h,depth:d};}dispose(){}}
 class Mesh{constructor(geometry,material){this.geometry=geometry;this.material=material;this.position=new Vector3();this.userData={};}}
 class MeshStandardMaterial{constructor(config){this.config=config;}dispose(){}}
 const THREE={Vector3,Group,BoxGeometry,Mesh,MeshStandardMaterial};
 return new Function('THREE','wallPresetTexture','climbSurfaceProximity',source+'\nreturn {sanitiseLadder,ladderRungHeights,makeLadder,rebuildLadder,ladderProximity,ladderClimbStep,stepLadderRobot,releaseLadder};')(THREE,()=>null,()=>null);
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
 assert.match(html,/id="ladderWidth"/);assert.match(html,/id="ladderHeight"/);
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
 assert.ok(Math.abs(robot.position.z-.44)<1e-8);
});

test('back-face approach climbs instead of being rejected by a one-sided trigger',()=>{
 const {makeLadder,stepLadderRobot}=loadedLadder();
 const ladder=makeLadder();ladder.userData.editorId='ladder-back';
 const robot={position:{x:0,y:0,z:-.95,clone(){return {...this};},copy(p){Object.assign(this,p);}},rotation:{y:0},userData:{}};
 assert.equal(stepLadderRobot(robot,[ladder],1,1/60),true);
 assert.equal(robot.userData.robotLadderRide.side,-1);
 assert.ok(Math.abs(robot.position.z+.44)<1e-8);
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
 assert.match(editor,/if\(obj\.userData\.robotLadderRide\)\{this\.remoteCorrections\.delete\(id\);continue;\}/);
});
