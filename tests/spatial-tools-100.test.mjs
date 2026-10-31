import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeEnvironment} from '../js/scene-environment.js';
const src=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
class Vec3{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
 toArray(){return [this.x,this.y,this.z];}
 clone(){return new Vec3(this.x,this.y,this.z);}
 addScaledVector(o,s){this.x+=o.x*s;this.y+=o.y*s;this.z+=o.z*s;return this;}
 distanceTo(p){return Math.hypot(this.x-p.x,this.y-p.y,this.z-p.z);}
 normalize(){return this;}
}
class Plane{
 setFromNormalAndCoplanarPoint(n,p){this.normal=n;this.point=p;return this;}
 constructor(n=null,d=null){this.normal=n;this.constant=d;}
}
const THREE={Vector3:Vec3,Plane,
 CatmullRomCurve3:class{
  constructor(points){this.points=points;}
  getPointAt(t){const a=this.points[0],b=this.points.at(-1);return new Vec3(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t);}
  computeFrenetFrames(n){return {normals:Array.from({length:n+1},()=>new Vec3(0,1,0)),binormals:Array.from({length:n+1},()=>new Vec3(0,0,1))};}
 },
 Float32BufferAttribute:class{constructor(a,n){this.array=a;this.itemSize=n;}},
 BufferGeometry:class{constructor(){this.attributes={};}setAttribute(k,v){this.attributes[k]=v;return this;}setIndex(v){this.index=v;return this;}computeVertexNormals(){}}
};
function evaluate(name,additional){return new Function('THREE',src(name).replace(/^import .*\n/gm,'').replace(/export /g,'')+'\nreturn '+additional)(THREE);}
const sketch=evaluate('js/curve-sketch.js','{sketchPlane,strokePoint,appendStrokePoint}');
const curve=evaluate('js/curve-geometry.js','{cleanCurve,buildCurveGeometry}');
const floor=evaluate('js/floor-textures.js','{floorPixel,floorStyle,FLOOR_STYLES}');
test('freehand sketch uses a locked screen-facing or world-aligned projection plane',()=>{
 const camera={position:new Vec3(0,2,10),getWorldDirection:(v)=>Object.assign(v,{x:0,y:0,z:-1})};
 const screen=sketch.sketchPlane(camera,'screen',6);
 assert.deepEqual(screen.point.toArray(),[0,2,4]);assert.deepEqual(screen.normal.toArray(),[0,0,-1]);
 const floorPlane=sketch.sketchPlane(camera,'floor',6,1.25);
 assert.deepEqual(floorPlane.normal.toArray(),[0,1,0]);assert.equal(floorPlane.constant,-1.25);
 assert.deepEqual(sketch.sketchPlane(camera,'xy',5,0).normal.toArray(),[0,0,1]);
 assert.deepEqual(sketch.sketchPlane(camera,'yz',5,0).normal.toArray(),[1,0,0]);
});
test('freehand point sampling removes redundant points and bounds complex strokes',()=>{
 const p=[];
 assert.ok(sketch.appendStrokePoint(p,new Vec3(0,0,0)));
 assert.equal(sketch.appendStrokePoint(p,new Vec3(.01,0,0)),false);
 for(let i=1;i<=500;i++)sketch.appendStrokePoint(p,new Vec3(i*.1,0,0));
 assert.ok(p.length<=120);assert.equal(p.at(-1)[0],50);
});
test('open curve cap checkbox generates tube without closing the end rings',()=>{
 const params={points:[[0,0,0],[1,0,0]],offset:0,extrude:.4,bevel:.05,bevelResolution:3,resolution:12};
 const capped=curve.buildCurveGeometry({...params,capEnds:true});
 const open=curve.buildCurveGeometry({...params,capEnds:false});
 const ring=4*(params.bevelResolution+1);
 assert.equal(capped.index.length-open.index.length,ring*6);
 assert.equal(capped.attributes.position.array.length-open.attributes.position.array.length,6);
 assert.equal(curve.cleanCurve({...params,capEnds:false}).capEnds,false);
 assert.equal(curve.cleanCurve(params).capEnds,true);
});
test('seven floor presets are deterministic grayscale textures, not remote assets',()=>{
 assert.equal(floor.floorStyle('nonexistent'),'none');
 for(const type of floor.FLOOR_STYLES.filter(t=>t!=='none')){
  const sample=floor.floorPixel(type,42,36);
  assert.ok(sample>=180&&sample<=260,type+': '+sample);
  assert.equal(sample,floor.floorPixel(type,42,36));
  assert.equal(normalizeEnvironment({floorTexture:type}).floorTexture,type);
 }
 assert.equal(normalizeEnvironment({floorTexture:'fake-url'}).floorTexture,'none');
 assert.ok(floor.floorPixel('tiles',0,32)<floor.floorPixel('tiles',12,40));
});
test('cutout is a preview until confirmation; cancel restores geometry and does not save',()=>{
 const text=src('js/spatial-editor.js');
 assert.match(text,/st\.previewGeometry=replacement/);
 assert.match(text,/st\.originalGeometry=obj\.geometry/);
 assert.match(text,/st\.phase='preview'/);
 assert.match(text,/obj\.userData\.openings=holes/);
 assert.match(text,/face\.object\.geometry=face\.originalGeometry/);
 assert.match(text,/if\(st\.phase==='preview'\)\{this\.cancelSpatialDrawing\(\)/);
 assert.match(text,/editor\.physics\.sync\(obj\);editor\.recordEdit/);
 assert.match(text,/inputTarget\.setPointerCapture\?\./);
 assert.match(text,/editor\.openChatMediaPicker\(mount\)/);
});
test('mounted media target is embedded before initial scene snapshot and is followed in world',()=>{
 const editor=src('js/editor.js'),spatial=src('js/spatial-editor.js');
 assert.match(editor,/if\(mount\)object\.userData\.media\.mount=structuredClone\(mount\)/);
 assert.match(editor,/if\(mount\)\{object\.userData\.physics=\{mode:'off'\};this\.updateMountedMedia\(\)/);
 assert.match(spatial,/target\.updateMatrixWorld\(true\)/);
 assert.match(spatial,/media\.quaternion\.setFromRotationMatrix\(basis\)/);
});
