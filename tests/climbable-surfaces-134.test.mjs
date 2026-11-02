import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findClip} from '../js/animations.js';

class Vector3{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
 clone(){return new Vector3(this.x,this.y,this.z);}copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}
 add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
 addScaledVector(v,a){this.x+=v.x*a;this.y+=v.y*a;this.z+=v.z*a;return this;}
 normalize(){const n=Math.hypot(this.x,this.y,this.z)||1;this.x/=n;this.y/=n;this.z/=n;return this;}
 lengthSq(){return this.x**2+this.y**2+this.z**2;}
 dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;}
 transformDirection(){return this;}
}
class Box3{
 setFromObject(o){this.min=new Vector3(-.5,o._bottom??0,-.2);this.max=new Vector3(.5,o._top??3,.2);return this;}
 isEmpty(){return false;}
}
class Raycaster{
 constructor(origin,direction,near,far){this.origin=origin;this.direction=direction;this.near=near;this.far=far;}
 intersectObject(o){return o._hits||[];}
}
function modules(){
 const surface=readFileSync(new URL('../js/climbable-surfaces.js',import.meta.url),'utf8')
  .replace(/^import .*;\s*$/gm,'').replaceAll('export function ','function ').replaceAll('export const ','const ');
 const ladder=readFileSync(new URL('../js/office-ladder.js',import.meta.url),'utf8')
  .replace(/^import .*;\s*$/gm,'').replaceAll('export function ','function ');
 return new Function('THREE','wallPresetTexture',`${surface}\n${ladder}\nreturn {canBeClimbable,climbSurfaceProximity,stepLadderRobot,releaseLadder};`)({Vector3,Box3,Raycaster},()=>null);
}
function target({enabled=true,kind='model',normalZ=1,hitDistance=.4,bottom=0,top=3}={}){
 const mesh={isMesh:true,matrixWorld:{}};
 return {position:new Vector3(),rotation:{y:0},userData:{editorKind:kind,editorId:'wall-tree-001',climbable:enabled},
  _bottom:bottom,_top:top,
  _hits:[{object:mesh,face:{normal:new Vector3(0,0,normalZ)},point:new Vector3(0,.78,0),distance:hitDistance}],
  updateWorldMatrix(){},worldToLocal(v){return v;},localToWorld(v){return v;}};
}
function robot(z=.43,y=0){return {position:new Vector3(0,y,z),rotation:{y:0},userData:{robotAnimator:{actions:new Map([['climbLadder',{}]])}}};}

test('Climbing Up Wall takes precedence over Climbing Ladder for every avatar',()=>{
 const clips=[{name:'Climbing Ladder__123'},{name:'Climbing Up Wall__999'}];
 assert.equal(findClip(clips,'climbLadder')?.name,'Climbing Up Wall__999');
 assert.equal(findClip([{name:'Climbing Ladder'}],'climbLadder')?.name,'Climbing Ladder');
 assert.equal(findClip([{name:'Climb'}],'climbLadder')?.name,'Climb');
});
test('only explicitly climbable walls, trees and primitives expose a climb grip',()=>{
 const {canBeClimbable,climbSurfaceProximity}=modules();
 for(const k of ['wall','model','cube','cylinder','sphere'])assert.equal(canBeClimbable(k),true);
 for(const k of ['robot','light','portal','stairs','ladder'])assert.equal(canBeClimbable(k),false);
 assert.equal(climbSurfaceProximity(target({enabled:false}),robot()),null);
 assert.equal(climbSurfaceProximity(target({enabled:true,kind:'portal'}),robot()),null);
 assert.equal(climbSurfaceProximity(target({enabled:true}),robot())?.kind,'surface');
});
test('surface climbing requires a real near-vertical mesh and a front-facing approach',()=>{
 const {climbSurfaceProximity}=modules(),wall=target();
 assert.equal(climbSurfaceProximity(wall,robot())?.topY,3);
 wall._hits[0].face.normal=new Vector3(0,1,0);
 assert.equal(climbSurfaceProximity(wall,robot()),null,'no climb on a flat surface');
 wall._hits[0].face.normal=new Vector3(0,0,-1);
 assert.equal(climbSurfaceProximity(wall,robot()),null,'no attaching to a backwards face');
 wall._hits[0].face.normal=new Vector3(0,0,1);wall._hits[0].distance=1.1;
 assert.equal(climbSurfaceProximity(wall,robot()),null,'no attachment from across a gap');
 const brick=target({top:.2});
 assert.equal(climbSurfaceProximity(brick,robot()),null,'a small floor object cannot be climbed');
});
test('Up/Down on an opted-in wall switches to the same physics-safe climbing state as ladders',()=>{
 const {stepLadderRobot,releaseLadder}=modules(),wall=target(),climber=robot();
 assert.equal(stepLadderRobot(climber,[wall],1,.05),true);
 assert.equal(climber.userData.robotLadderRide?.kind,'surface');
 assert.equal(climber.userData.robotMode,'climbLadder');
 const y=climber.position.y;
 assert.equal(stepLadderRobot(climber,[wall],-1,.05),true);
 assert.ok(climber.position.y<y);
 assert.equal(releaseLadder(climber),true);
 assert.equal(climber.userData.robotFallActive,true);
 assert.equal(stepLadderRobot(climber,[wall],1,.05),false,'Space detaches without instantly remounting');
});
test('top of opted-in tree/wall never dismounts without physical support',()=>{
 const {stepLadderRobot}=modules(),tree=target({top:1.2}),climber=robot(.43,1.15);
 stepLadderRobot(climber,[tree],1,.05);
 for(let i=0;i<10;i++)stepLadderRobot(climber,[tree],1,.05);
 assert.equal(climber.userData.robotMode,'idle');
 assert.ok(climber.userData.robotLadderRide);
 assert.equal(stepLadderRobot(climber,[tree],1,.05,{upperSurface:()=>true}),true);
 assert.equal(climber.userData.robotLadderRide,undefined);
 assert.equal(climber.userData.robotLadderDismount,true);
});
test('Climbable choice persists through creation, duplication, scene and backend saves',()=>{
 const editor=readFileSync(new URL('../js/editor.js',import.meta.url),'utf8');
 const backend=readFileSync(new URL('../backend/server.py',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const physics=readFileSync(new URL('../js/scene-physics.js',import.meta.url),'utf8');
 assert.match(html,/id="objectClimbable"/);
 assert.match(editor,/o\.userData\.climbable===true/);
 assert.match(editor,/duplicate\.userData\.climbable=entry\.climbable===true/);
 assert.match(editor,/o\.userData\.climbable=entry\.climbable===true/);
 assert.match(backend,/'climbable','pickable','transformLocked'/);
 assert.match(backend,/Invalid climbable flag/);
 assert.match(physics,/ride\?\.kind==='surface'/);
});
