import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const drawing=read('js/infrastructure-drawing.js');
const src=drawing.replace(/^import .*;\s*$/gm,'').replace(/export (const|function|class) /g,'$1 ');
const material={dispose(){},map:{dispose(){}}};
class Group {constructor(){this.children=[];this.position={set(){}};}add(x){this.children.push(x);}traverse(fn){fn(this);for(const p of this.children)fn(p);}}
class Vector3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}}
class Plane{constructor(n,c){this.normal=n;this.constant=c;}}
const THREE={Group,Vector3,Plane};
const ids=new Map();
for(const key of ['addMenu','propertiesPanel','spatialDrawShield','infraDrawingStatus','infraDrawingUndo','infraDrawingRedo','infraDrawingFinish'])
 ids.set(key,{hidden:false,disabled:false,style:{setProperty(){},getPropertyValue(){return ''},removeProperty(){}},classList:{add(){},remove(){}},textContent:''});
const document={getElementById:id=>ids.get(id)};
const fakeParts=()=>[{userData:{},isMesh:true,geometry:{dispose(){}},material}];
const rebuildFurniture=(obj,p)=>{obj.userData.furniture=structuredClone(p);};
const api=new Function('THREE','document','cleanInfrastructurePoints','infrastructureParts','rebuildFurniture',
 `${src}\nreturn {startInfrastructureDrawing,infrastructurePointer,finishInfrastructureDrawing,cancelInfrastructureDrawing,drawingUndo,drawingRedo,recordInfrastructureDraftChange,simplifyDrawnPath};`)(
 THREE,document,p=>p,fakeParts,rebuildFurniture);
function fixture(){
 const canvas={getBoundingClientRect(){return {left:0,top:0,right:900,bottom:700,width:900,height:700};}};
 const obj={name:'Road',userData:{editorId:'edit-id',furniture:{variant:'infrastructure',infraType:'road',infraWidth:7.2}},visible:true,position:{set(){}},updateMatrixWorld(){}};
 const editor={items:[obj],world:{renderer:{domElement:canvas},camera:{updateMatrixWorld(){}},controls:{enabled:true},scene:{add(){},remove(){}}},
  raycaster:{setFromCamera(){},ray:{x:0,z:0,intersectPlane(_p,v){v.x=this.x;v.z=this.z;return v;}}},pointer:{set(){}},
  transform:{attach(){},detach(){}},physics:{sync(){},remove(){}},
  add(){return obj;},select(v){this.selected=v;},refreshList(){},updateInspector(){},disposeObject(){},renderFurnitureControls(){},toast(){},snapshot(o){return {furniture:structuredClone(o.userData.furniture)};},recordEdit(){},queueSave(){},canTransform(){return false;}}
 return {editor,obj,canvas};
}
function pointer(editor,canvas,type,x,z,extra={}){
 Object.assign(editor.raycaster.ray,{x,z});
 return api.infrastructurePointer(editor,{type,target:canvas,button:0,clientX:200,clientY:200,...extra});
}
test('construction undo/redo always changes active drawing, including a furniture setting',()=>{
 const {editor,obj,canvas}=fixture();api.startInfrastructureDrawing(editor,'road','polyline',obj);
 pointer(editor,canvas,'pointerdown',0,0);
 pointer(editor,canvas,'pointerdown',6,0);
 assert.equal(editor.infrastructureDrawing.points.length,2);
 assert.ok(api.drawingUndo(editor));assert.equal(editor.infrastructureDrawing.points.length,1);
 assert.ok(api.drawingRedo(editor));assert.equal(editor.infrastructureDrawing.points.length,2);
 const old=structuredClone(obj.userData.furniture);obj.userData.furniture.infraWidth=10;
 api.recordInfrastructureDraftChange(editor,old);
 assert.ok(api.drawingUndo(editor));assert.equal(obj.userData.furniture.infraWidth,7.2);
 assert.ok(api.drawingRedo(editor));assert.equal(obj.userData.furniture.infraWidth,10);
 api.cancelInfrastructureDrawing(editor);
});
test('freehand does not stop after 80 points, and preserves last point when simplified',()=>{
 const {editor,canvas}=fixture();api.startInfrastructureDrawing(editor,'road','freehand');
 pointer(editor,canvas,'pointerdown',0,0);
 for(let i=1;i<320;i++)pointer(editor,canvas,'pointermove',i*.12,Math.sin(i*.16)*2);
 pointer(editor,canvas,'pointerup',38,1);
 assert.ok(editor.infrastructureDrawing.points.length>80);
 const reduced=api.simplifyDrawnPath(editor.infrastructureDrawing.points,80);
 assert.ok(reduced.length<=80);
 assert.deepEqual(reduced[0],editor.infrastructureDrawing.points[0]);
 assert.deepEqual(reduced.at(-1),editor.infrastructureDrawing.points.at(-1));
 assert.ok(api.drawingUndo(editor));assert.equal(editor.infrastructureDrawing.points.length,0);
 api.cancelInfrastructureDrawing(editor);
});
test('right mouse camera orbit is never consumed and drawing keeps controls enabled',()=>{
 const {editor,canvas}=fixture();api.startInfrastructureDrawing(editor,'fence','polyline');
 assert.equal(editor.world.controls.enabled,true);
 assert.equal(api.infrastructurePointer(editor,{target:canvas,type:'pointerdown',button:2,buttons:2}),false);
 api.cancelInfrastructureDrawing(editor);
});
test('one dashed temporary guide and one Properties panel are used',()=>{
 assert.match(drawing,/new THREE\.LineDashedMaterial/);
 assert.match(drawing,/new THREE\.LineSegments/);
 assert.match(drawing,/editor\.world\.controls\.enabled=true/);
 assert.match(read('styles.css'),/solvi-infra-pass-through/);
 assert.match(read('js/editor.js'),/drawingRedo\(this\)/);
 assert.match(read('js/editor.js'),/recordInfrastructureDraftChange\(this,old\?\.furniture\)/);
 assert.match(read('js/editor.js'),/if\(k==='infraWidth'&&\['fence','pathWall'\]/);
});
test('comic bubbles use supplied SVG, safe text and bounded time and no bundled proprietary font',async()=>{
 const {comicBubbleDuration,comicBubbleText}=await import('../js/robot-comic-bubbles.js');
 assert.equal(comicBubbleText('  HELLO   WORLD  '),'HELLO WORLD');
 assert.equal(comicBubbleText('x'.repeat(300)).length,300);
 assert.ok(comicBubbleDuration('abc')<=23000);
 for(let i=1;i<=3;i++)assert.ok(fs.existsSync(new URL(`../assets/ui-icons/speech-bubble-${i}.svg`,import.meta.url)));
 assert.match(read('js/studio.js'),/installRobotComicBubbles\(world\)/);
 assert.match(read('styles.css'),/solvi-comic-balloon/);
 for(const item of ['acmesa.TTF','acmesai.TTF','acmesab.TTF'])assert.equal(fs.existsSync(new URL(`../assets/${item}`,import.meta.url)),false);
});
test('robot wedging recovery requires an airborne vertical stall and restores idle',()=>{
 const source=read('js/scene-physics.js');
 assert.match(source,/state\.wedgedFor>1\.25&&state\.lastSafePose/);
 assert.match(source,/Math\.abs\(resolved\.y-p\.y\)<\.008/);
 assert.match(source,/object\.userData\.robotFallActive=false/);
});
