import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
class V{
 constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
 clone(){return new V(this.x,this.y,this.z);}
 toArray(){return [this.x,this.y,this.z];}
 negate(){this.x=-this.x;this.y=-this.y;this.z=-this.z;return this;}
 normalize(){return this;}
 transformDirection(){return this;}
 addScaledVector(n,t){this.x+=n.x*t;this.y+=n.y*t;this.z+=n.z*t;return this;}
 set(x,y,z){Object.assign(this,{x,y,z});return this;}
}
class Geometry{
 setFromPoints(points){this.points=points;return this;}
 setAttribute(name,attr){this[name]=attr;return this;}
 dispose(){this.disposed=true;}
}
class Node{
 constructor(geometry=null,material=null){this.geometry=geometry;this.material=material;this.children=[];}
 add(child){this.children.push(child);}
 traverse(fn){fn(this);for(const child of this.children)child.traverse(fn);}
}
class Material{dispose(){}}
const THREE={Vector3:V,Box3:class{constructor(min,max){this.min=min;this.max=max;}},Plane:class{setFromNormalAndCoplanarPoint(){return this;}},BufferGeometry:Geometry,Float32BufferAttribute:class {constructor(values){this.values=values;}},
 Mesh:Node,Group:Node,Line:Node,MeshBasicMaterial:Material,LineBasicMaterial:Material,DoubleSide:2};
const ids=new Map();
for(const id of ['spatialDrawShield','surfaceDrawPanel','surfaceDrawTitle','surfaceDrawStatus','curveDrawPanel'])ids.set(id,{hidden:true,textContent:''});
const document={getElementById:(id)=>ids.get(id)};
const coords=(axis,start,end)=>({axis,u:(start.x+end.x)/2,v:(start.y+end.y)/2,width:Math.abs(start.x-end.x),height:Math.abs(start.y-end.y)});
const cutCubeGeometry=(p,openings)=>({openings,dispose(){this.disposed=true;}});
const cleanOpenings=(openings)=>openings;
const code=read('js/spatial-editor.js').replace(/^import .+;\n/gm,'').replaceAll('export ','');
const api=new Function('THREE','document','cleanCurve','buildCurveGeometry','sketchPlane','strokePoint','appendStrokePoint','cleanOpenings','cutCubeGeometry','surfaceAxis','rectangleFromSurface',code+'\nreturn {startFaceDrawing,spatialPointer,cancelSpatialDrawing,commitFace};')(
 THREE,document,()=>({}),()=>({}),()=>({}),()=>({}),()=>{},cleanOpenings,cutCubeGeometry,
 (normal)=>['x','y','z'].reduce((best,k)=>Math.abs(normal[k])>Math.abs(normal[best])?k:best,'x'),coords);
function fixture(){
 const canvas={getBoundingClientRect:()=>({left:0,top:0,width:1000,height:1000})};
 const shield=ids.get('spatialDrawShield');shield.setPointerCapture=(id)=>{shield.captured=id;};shield.hasPointerCapture=(id)=>shield.captured===id;shield.releasePointerCapture=()=>{shield.captured=null;};
 const original={old:true,dispose(){this.disposed=true;}};
 const obj={name:'Test cube',geometry:original,userData:{editorKind:'cube',primitive:{width:3,height:3,depth:3},editorId:'c1',openings:[],physics:{mode:'dynamic'}},
 updateMatrixWorld(){},matrixWorld:{clone:()=>({invert:()=>({})})},worldToLocal:p=>p,localToWorld:p=>p};
 let rayPosition=new V(0,0,1.5),saveCount=0,editCount=0;
 const editor={selected:obj,canEdit:()=>true,canTransform:()=>true,
 world:{renderer:{domElement:canvas},camera:{},scene:{add(){},remove(){}},controls:{enabled:true}},
 pointer:{set(x,y){this.x=x;this.y=y;}},raycaster:{setFromCamera(pointer){rayPosition=new V(pointer.x*1.3,pointer.y*1.3,1.5);this.ray={clone:()=>({applyMatrix4:()=>({intersectBox:(box,point)=>point.set(rayPosition.x,rayPosition.y,1.5)})}),intersectPlane:(plane,point)=>{point.set(rayPosition.x,rayPosition.y,1.5);return point;}};},
 intersectObject:()=>[{face:{normal:new V(0,0,1)},point:rayPosition.clone()}]},
 transform:{detach(){},attach(){}},toast(){},physics:{sync(){}},snapshot:()=>({previous:true}),recordEdit(){editCount++;},queueSave(){saveCount++;},select(){},
 cancelSpatialDrawing(){api.cancelSpatialDrawing.call(this);},openChatMediaPicker(mount){this.pickedMount=mount;}};
 return {canvas,shield,obj,editor,original,counts:()=>({saveCount,editCount})};
}
function pointer(editor,target,type,x,y){return api.spatialPointer.call(editor,{target,type,button:0,pointerId:1,clientX:x,clientY:y});}
test('full-view drawing shield receives drag, renders real opening on release, saves only on Enter',()=>{
 const {editor,shield,obj,original,counts}=fixture();
 api.startFaceDrawing.call(editor,'opening');
 assert.equal(shield.hidden,false);
 assert.equal(pointer(editor,shield,'pointerdown',300,300),true);
 pointer(editor,shield,'pointermove',700,650);
 assert.ok(editor.facePreview?.children?.length===2,'translucent fill and contour visible during drag');
 pointer(editor,shield,'pointerup',700,650);
 assert.equal(editor.faceDrawing.phase,'preview');
 assert.notEqual(obj.geometry,original,'the real hole is shown before saving');
 assert.equal(counts().saveCount,0,'no scene writes during preview');
 api.commitFace(editor);
 assert.equal(counts().saveCount,1);
 assert.equal(obj.userData.openings.length,1);
 assert.equal(obj.userData.physics.collider,'trimesh');
 assert.equal(shield.hidden,true);
});
test('click on the drawing shield outside the preview cancels geometry without saving',()=>{
 const {editor,shield,obj,original,counts}=fixture();
 api.startFaceDrawing.call(editor,'opening');
 pointer(editor,shield,'pointerdown',260,250);pointer(editor,shield,'pointermove',720,640);pointer(editor,shield,'pointerup',720,640);
 assert.notEqual(obj.geometry,original);
 pointer(editor,shield,'pointerdown',820,850);
 assert.equal(editor.faceDrawing,null);
 assert.equal(obj.geometry,original);
 assert.equal(counts().saveCount,0);
});
test('media rectangle remains visibly filled after release until Enter launches attachment picker',()=>{
 const {editor,shield,obj,counts}=fixture();
 api.startFaceDrawing.call(editor,'media');
 pointer(editor,shield,'pointerdown',280,280);pointer(editor,shield,'pointermove',680,620);pointer(editor,shield,'pointerup',680,620);
 assert.ok(editor.facePreview.children.length===2);
 assert.equal(editor.faceDrawing.phase,'preview');
 assert.equal(obj.geometry.old,true);
 assert.equal(counts().saveCount,0);
 api.commitFace(editor);
 assert.equal(editor.pickedMount.target,'c1');
 assert.ok(editor.pickedMount.width>.12&&editor.pickedMount.height>.12);
 assert.equal(shield.hidden,true);
});
test('the spatial UI is a passive status hint without an unwanted Confirm button',()=>{
 const html=read('index.html'),css=read('styles.css'),src=read('js/editor.js');
 assert.match(html,/id="spatialDrawShield" hidden/);
 assert.doesNotMatch(html,/id="surfaceConfirm"/);
 assert.match(css,/#spatialDrawShield:not\(\[hidden\]\)/);
 assert.match(css,/#surfaceDrawPanel\.spatial-tool-status/);
 assert.match(src,/pointercancel/);
});
