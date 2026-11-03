import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const code=read('js/infrastructure-drawing.js').replace(/^import .*;\s*$/gm,'').replace(/export (const|function|class) /g,'$1 ');
const previewConfigs=[];
const fakeParts=config=>{
 previewConfigs.push(structuredClone(config));
 return [{userData:{},isMesh:true,geometry:{dispose(){this.disposed=true;}},material:{map:{dispose(){this.disposed=true;}},dispose(){this.disposed=true;}}}];
};
class Group{
 constructor(){this.children=[];this.position={set(x,y,z){this.x=x;this.y=y;this.z=z;}};this.name='';}
 add(child){this.children.push(child);}
 traverse(fn){fn(this);for(const child of this.children)fn(child);}
}
class Vector3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}}
class Plane{constructor(normal,constant){this.normal=normal;this.constant=constant;}}
const THREE={Group,Vector3,Plane};
const elements=new Map();
for(const id of ['addMenu','propertiesPanel','spatialDrawShield','infraDrawingStatus','infraDrawingUndo','infraDrawingFinish']){
 elements.set(id,{hidden:true,disabled:false,textContent:'',style:{setProperty(){},removeProperty(){},getPropertyValue(){return '';}}});
}
const document={getElementById:id=>elements.get(id)||null};
function rebuildFurniture(obj,config){obj.userData.furniture={...config};}
const api=new Function('THREE','document','cleanInfrastructurePoints','infrastructureParts','rebuildFurniture',`${code}\nreturn {startInfrastructureDrawing,infrastructurePointer,finishInfrastructureDrawing,cancelInfrastructureDrawing};`)(
 THREE,document,pts=>pts,fakeParts,rebuildFurniture
);
function editorForPreview(){
 const canvas={getBoundingClientRect:()=>({left:0,top:0,right:500,bottom:400,width:500,height:400})};
 const sceneObjects=new Set();
 const obj={userData:{editorId:'draft-test',furniture:{variant:'infrastructure',infraType:'road',infraWidth:7.2,infraLanes:2}},visible:true,
  name:'Infrastructure',position:{set(x,y,z){Object.assign(this,{x,y,z});}},scale:{},rotation:{}};
 const editor={items:[obj],selected:null,world:{renderer:{domElement:canvas},camera:{updateMatrixWorld(){}},controls:{enabled:true},scene:{add(o){sceneObjects.add(o);},remove(o){sceneObjects.delete(o);}}},
  pointer:{set(){}},raycaster:{ray:{intersectPlane(plane,v){v.x=this.testX;v.z=this.testZ;return v;}},setFromCamera(){}},
  physics:{sync(){},remove(){}},transform:{detach(){},attach(){}},
  add(){return obj;},select(v){this.selected=v;},renderFurnitureControls(){},refreshList(){},updateInspector(){},disposeObject(){},
  recordEdit(){this.recorded=true;},queueSave(){this.saved=true;},snapshot(o){return {kind:'furniture',furniture:o.userData.furniture};},toast(){},canTransform(){return false;}};
 return {editor,obj,canvas,sceneObjects};
}
test('committed ground points generate real 3D infrastructure mesh instead of a 2D line',()=>{
 const {editor,sceneObjects}=editorForPreview();
 api.startInfrastructureDrawing(editor,'pathWall','polyline');
 assert.ok(!editor.infrastructurePreview);
 editor.infrastructureDrawing.points=[[0,0],[6,0]];
 editor.infrastructureDrawing.redraw();
 const group=editor.infrastructurePreview;
 assert.ok(group instanceof Group);
 assert.equal(group.name,'Infrastructure construction preview');
 assert.equal(group.children.length,1);
 assert.ok(sceneObjects.has(group));
 assert.equal(previewConfigs.at(-1).infraType,'pathWall');
 assert.deepEqual(previewConfigs.at(-1).infraPoints,[[0,0],[6,0]]);
 assert.equal(elements.get('infraDrawingStatus').textContent.includes('Live construction'),true);
 const oldPart=group.children[0];
 editor.infrastructureDrawing.editTarget.userData.furniture.infraHeight=3.4;
 editor.infrastructureDrawing.redraw();
 assert.equal(previewConfigs.at(-1).infraHeight,3.4);
 assert.ok(oldPart.geometry.disposed);
 assert.ok(oldPart.material.disposed);
 api.cancelInfrastructureDrawing(editor);
 assert.equal(editor.infrastructurePreview,null);
 assert.ok(!editor.recorded&&!editor.saved);
});
test('polyline pointer movement never invents a phantom segment; finish persists exact points',()=>{
 const {editor,canvas,obj}=editorForPreview();
 api.startInfrastructureDrawing(editor,'road','polyline');
 const event=(type,x,z)=>({type,clientX:100,clientY:100,target:canvas,button:0,testX:x,testZ:z});
 // Simulate the ground raycast projection for each event.
 const press=(x,z)=>{editor.raycaster.ray.testX=x;editor.raycaster.ray.testZ=z;api.infrastructurePointer(editor,event('pointerdown',x,z));};
 press(0,0);assert.equal(editor.infrastructureDrawing.points.length,1);
 editor.raycaster.ray.testX=9;editor.raycaster.ray.testZ=9;
 api.infrastructurePointer(editor,event('pointermove',9,9));
 assert.equal(editor.infrastructureDrawing.points.length,1);
 press(6,0);
 assert.equal(editor.infrastructureDrawing.points.length,2);
 assert.equal(previewConfigs.at(-1).infraPoints.length,2);
 assert.ok(api.finishInfrastructureDrawing(editor));
 assert.equal(editor.infrastructureDrawing,null);
 assert.equal(obj.visible,true);
 assert.equal(obj.userData.physics.mode,'static');
 assert.ok(editor.saved&&editor.recorded);
});
test('single-line also waits for user to inspect 3D preview and click Finish',()=>{
 const {editor,canvas}=editorForPreview();
 api.startInfrastructureDrawing(editor,'fence','line');
 const click=(x,z)=>{editor.raycaster.ray.testX=x;editor.raycaster.ray.testZ=z;api.infrastructurePointer(editor,{type:'pointerdown',target:canvas,clientX:20,clientY:20,button:0});};
 click(0,0);click(4,0);
 assert.equal(editor.infrastructureDrawing.points.length,2);
 click(10,0);assert.equal(editor.infrastructureDrawing.points.length,2);
 assert.ok(editor.infrastructurePreview instanceof Group);
 assert.equal(editor.saved,undefined);
 api.cancelInfrastructureDrawing(editor);
 assert.equal(editor.infrastructureDrawing,null);
});
test('drawing uses actual generated parts and has no line-only Three.Line guide',()=>{
 assert.match(read('js/infrastructure-drawing.js'),/for\(const part of infrastructureParts\(config\)\)/);
 assert.doesNotMatch(read('js/infrastructure-drawing.js'),/new THREE\.Line\(/);
 assert.match(read('js/editor.js'),/activeInfrastructureDraw\?\.redraw\?\.\(\)/);
 assert.match(read('js/editor.js'),/this\.infrastructureDrawing\.redraw\?\.\(\)/);
});
test('existing saved infrastructure restores original settings and visibility if redraw is cancelled',()=>{
 const {editor,obj}=editorForPreview();
 const before=structuredClone(obj.userData.furniture);
 api.startInfrastructureDrawing(editor,'road','polyline',obj);
 assert.equal(obj.visible,false,'existing road is replaced by live construction preview');
 obj.userData.furniture.infraWidth=15;
 editor.infrastructureDrawing.points=[[0,0],[7,2]];
 editor.infrastructureDrawing.redraw();
 assert.equal(previewConfigs.at(-1).infraWidth,15);
 api.cancelInfrastructureDrawing(editor);
 assert.equal(obj.visible,true);
 assert.deepEqual(obj.userData.furniture,before);
 assert.ok(!editor.saved&&!editor.recorded);
});
