import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chooseSurfacePlacement,placementFitsTriangulatedSurface} from '../js/smart-placement-math.js';

// Run the actual scene-placement module under a minimal Three geometry facade;
// no WebGL, canvas, network or browser assets are required for this regression.
class V3 {
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
 set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
 normalize(){const d=Math.hypot(this.x,this.y,this.z)||1;this.x/=d;this.y/=d;this.z/=d;return this;}
 applyMatrix4(m){this.x+=m?.x||0;this.y+=m?.y||0;this.z+=m?.z||0;return this;}
 project(camera){this.x=(this.x-camera.position.x)/4;this.y=(this.y-camera.position.y+1.25)/4;this.z=0;return this;}
}
class B3 {
 setFromObject(object){
  if(object.baseBox){this.min={x:object.baseBox.min.x+object.position.x,y:object.baseBox.min.y+object.position.y,z:object.baseBox.min.z+object.position.z};
   this.max={x:object.baseBox.max.x+object.position.x,y:object.baseBox.max.y+object.position.y,z:object.baseBox.max.z+object.position.z};}
  else {this.min={...object.bounds.min};this.max={...object.bounds.max};}
  return this;
 }
 isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z;}
 getSize(target){return target.set(this.max.x-this.min.x,this.max.y-this.min.y,this.max.z-this.min.z);}
 getCenter(target){return target.set((this.max.x+this.min.x)/2,(this.max.y+this.min.y)/2,(this.max.z+this.min.z)/2);}
}
const THREE={Vector3:V3,Box3:B3};
const source=fs.readFileSync(new URL('../js/scene-placement.js',import.meta.url),'utf8');
const moduleSource=source.replace(/^import .*;\s*$/gm,'').replace(/^export function /gm,'function ');
const placement=new Function('THREE','chooseSurfacePlacement','chooseSmartPlacement','placementFitsTriangulatedSurface',
 'groundIntersection','infrastructureSegments','infrastructureNavigationFootprints',moduleSource+
 '\nreturn {smartPlacementSupports,smartPlacementObstacles,positionNewSmartly};')(
 THREE,chooseSurfacePlacement,()=>({x:1,z:1}),placementFitsTriangulatedSurface,
 ()=>({x:2,y:0,z:0}),()=>[],()=>[]);
const rect=(x0,z0,x1,z1)=>[{x:x0,z:z0},{x:x1,z:z0},{x:x1,z:z1},{x:x0,z:z1}];
function ceiling(y,rectangles=[[-3,-3,3,3]]){
 const vertices=[];
 for(const [x0,z0,x1,z1] of rectangles){vertices.push(
  [x0,0,z0],[x1,0,z0],[x1,0,z1],
  [x0,0,z0],[x1,0,z1],[x0,0,z1]);}
 const flat=vertices.flat();
 return {visible:true,isMesh:true,userData:{wallCeiling:true},
  matrixWorld:{y},geometry:{getAttribute:()=>({count:vertices.length,getX:i=>flat[i*3],getY:i=>flat[i*3+1],getZ:i=>flat[i*3+2]}),index:null},
  bounds:{min:{x:-3,y:y-.18,z:-3},max:{x:3,y,z:3}}};
}
const wall=(x0,z0,x1,z1,y=6)=>({visible:true,isMesh:true,userData:{wallSegment:true},
 bounds:{min:{x:x0,y,z:z0},max:{x:x1,y:y+3,z:z1}}});
const room=(meshes)=>({visible:true,userData:{editorKind:'wall',editorId:'room-3-floor'},
 children:meshes,updateMatrixWorld(){},traverse(fn){fn(this);for(const mesh of meshes)fn(mesh);}});
const camera={position:new V3(2.1,8.2,2.1),updateMatrixWorld(){},getWorldDirection:v=>v.set(0,-.6,-1)};
const project=p=>({x:(p.x-camera.position.x)/4,y:(p.y-camera.position.y+1.25)/4,z:0});
const chair=()=>({visible:true,userData:{editorKind:'furniture',furniture:{variant:'chair'}},
 position:new V3(),baseBox:{min:{x:-.35,y:0,z:-.35},max:{x:.35,y:.85,z:.35}},
 updateMatrixWorld(){}});

test('a ceiling of a procedural upper storey is a floor support, not an entire-room collider exemption',()=>{
 const building=room([ceiling(6),wall(-.15,-3,.15,3)]);
 const supports=placement.smartPlacementSupports([building]);
 assert.equal(supports.length,1);
 assert.equal(supports[0].kind,'floor');assert.equal(supports[0].topY,6);
 const obstacles=placement.smartPlacementObstacles([building]);
 assert.equal(obstacles.length,2);
 assert.equal(obstacles[0].sourceId,supports[0].id);
 assert.notEqual(obstacles[1].sourceId,supports[0].id,'room wall must not be ignored with floor collider');
 const found=chooseSurfacePlacement({camera:camera.position,footprint:{width:.7,depth:.7,height:.85},
  supports,obstacles,project,maxCameraDistance:15});
 assert.ok(found,'placement inside the upper room should succeed');
 assert.ok(found.groundY>=6&&found.groundY<6.05);
 assert.ok(found.x>.50,'cannot place through the central wall');
});

test('the actual new-furniture path places a chair on the third floor rather than at ground Y=0',()=>{
 const building=room([ceiling(6),wall(-.15,-3,.15,3)]),object=chair();
 assert.equal(placement.positionNewSmartly(object,{camera,items:[building]}),true);
 assert.ok(object.position.y>6&&object.position.y<6.1,`incorrect elevation ${object.position.y}`);
 assert.ok(object.position.x>.50);
});

test('lift holes reject unsupported furniture footprints even when all four corners appear inside the room',()=>{
 const ring=ceiling(6,[[-3,-3,-1,3],[1,-3,3,3],[-1,-3,1,-1],[-1,1,1,3]]);
 const [support]=placement.smartPlacementSupports([room([ring])]);
 assert.ok(support?.triangles?.length>=8);
 assert.equal(placementFitsTriangulatedSurface(0,0,.6,.6,support),false);
 assert.equal(placementFitsTriangulatedSurface(0,0,3,3,support),false);
 assert.equal(placementFitsTriangulatedSurface(-2,0,.6,.6,support),true);
});

test('a full upper room never falls back to putting furniture on the ground beneath it',()=>{
 const occupied={visible:true,userData:{editorKind:'furniture',furniture:{variant:'sofa'}},
  bounds:{min:{x:-3,y:6,z:-3},max:{x:3,y:7.3,z:3}}};
 const building=room([ceiling(6)]),object=chair();
 assert.equal(placement.positionNewSmartly(object,{camera,items:[building,occupied]}),false);
});

test('no support is invented for sheer walls or steep roof slopes',()=>{
 const roomOnly=room([wall(-3,-.12,3,.12)]);
 assert.deepEqual(placement.smartPlacementSupports([roomOnly]),[]);
 const pitched=ceiling(6);pitched.bounds.max.y=8;
 assert.deepEqual(placement.smartPlacementSupports([room([pitched])]),[]);
});

test('release keeps the object creation, preset, and scene save paths unchanged',()=>{
 const editor=fs.readFileSync(new URL('../js/editor.js',import.meta.url),'utf8');
 assert.match(editor,/placeSmartNewObject\(obj\)/);
 assert.match(editor,/placeSmartNewObject\(object\)/);
 assert.match(source,/node\.userData\?\.wallCeiling===true/);
 assert.match(source,/elevatedUnderCamera/);
});
