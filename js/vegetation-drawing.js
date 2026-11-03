// Draw bounded ground polygons on the existing SOLVI canvas. No scene data is
// written before Save/Enter; unfinished lines are temporary only.
import * as THREE from 'three';
import {cleanPlotPoints} from './procedural-vegetation.js';
import {rebuildFurniture} from './primitive-properties.js';
const $=id=>document.getElementById(id);
function groundPoint(editor,event){
 const canvas=editor.world.renderer.domElement,rect=canvas.getBoundingClientRect();
 if(!rect.width||!rect.height)return null;
 editor.pointer.set(2*(event.clientX-rect.left)/rect.width-1,1-2*(event.clientY-rect.top)/rect.height);
 editor.world.camera.updateMatrixWorld?.(true);
 editor.raycaster.setFromCamera(editor.pointer,editor.world.camera);
 const point=new THREE.Vector3();
 return editor.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),point)?point:null;
}
function releasePreview(editor){
 const prev=editor.vegetationPreview;if(!prev)return;
 editor.world.scene.remove(prev);prev.geometry?.dispose();prev.material?.dispose();editor.vegetationPreview=null;
}
function redraw(editor){
 releasePreview(editor);const d=editor.vegetationDrawing;if(!d)return;
 const vertices=d.points.map(([x,z])=>new THREE.Vector3(x,.03,z));
 if(d.cursor&&vertices.length)vertices.push(new THREE.Vector3(d.cursor.x,.03,d.cursor.z));
 if(vertices.length>1){
  const array=[...vertices];if(d.points.length>=3&&!d.cursor)array.push(new THREE.Vector3(...[d.points[0][0],.03,d.points[0][1]]));
  editor.vegetationPreview=new THREE.Line(new THREE.BufferGeometry().setFromPoints(array),new THREE.LineBasicMaterial({color:0x7ae3a1,depthTest:false}));
  editor.vegetationPreview.renderOrder=200;editor.world.scene.add(editor.vegetationPreview);
 }
 const count=d.points.length,status=$('vegetationDrawStatus'),save=$('vegetationDrawSave');
 if(status)status.textContent=count?`${count} corners · click to continue, Enter to auto-close and save`:'Click ground to place vertices · Enter closes the boundary';
 if(save)save.disabled=count<3;
}
export function startVegetationPlot(editor,variant='groundPlot',scatterMode='forest'){
 if(editor.vegetationDrawing)cancelVegetationPlot(editor);
 editor.cancelSpatialDrawing?.();editor.endWallDrawing?.();
 editor.vegetationDrawing={variant,scatterMode,points:[],cursor:null,redraw:()=>redraw(editor)};
 const panel=$('vegetationDrawPanel');if(panel)panel.hidden=false;
 $('addMenu').hidden=true;editor.transform.detach();editor.world.controls.enabled=false;
 $('spatialDrawShield').hidden=false;redraw(editor);
}
export function vegetationPointer(editor,event){
 const d=editor.vegetationDrawing;if(!d)return false;
 const target=event.target;
 if(target?.closest?.('#vegetationDrawPanel,button,input,select,textarea,[role=dialog]'))return false;
 if(event.type==='pointercancel')return true;
 if(event.type==='pointermove'){
  const point=groundPoint(editor,event);d.cursor=point;redraw(editor);return true;
 }
 if(event.type==='pointerdown'&&event.button===0){
  const point=groundPoint(editor,event);if(!point)return true;
  const previous=d.points.at(-1);
  if(d.points.length>=3&&Math.hypot(point.x-d.points[0][0],point.z-d.points[0][1])<.28){finishVegetationPlot(editor);return true;}
  if(!previous||Math.hypot(previous[0]-point.x,previous[1]-point.z)>.12){
   if(d.points.length<80)d.points.push([point.x,point.z]);
  }
  d.cursor=null;redraw(editor);return true;
 }
 return true;
}
export function finishVegetationPlot(editor){
 const d=editor.vegetationDrawing;if(!d||d.points.length<3)return;
 const minx=Math.min(...d.points.map(p=>p[0])),maxx=Math.max(...d.points.map(p=>p[0]));
 const minz=Math.min(...d.points.map(p=>p[1])),maxz=Math.max(...d.points.map(p=>p[1]));
 if((maxx-minx)*(maxz-minz)<.04){editor.toast('Draw a larger closed area');return;}
 const origin=[(minx+maxx)/2,(minz+maxz)/2];
 const points=cleanPlotPoints(d.points.map(([x,z])=>[x-origin[0],z-origin[1]]));
 const smooth=Boolean($('vegetationDrawSmooth')?.checked);
 cancelVegetationPlot(editor);
 const obj=editor.add('furniture',false,undefined,false,d.variant);if(!obj)return;
 const before=null;
 rebuildFurniture(obj,{...obj.userData.furniture,plotPoints:points,plotSmooth:smooth,scatterMode:d.scatterMode});
 obj.position.set(origin[0],0,origin[1]);obj.name=d.variant==='cropBed'?'Vegetable bed':d.variant==='waterPatch'?'Lake / puddle':d.variant==='vegetationArea'?(d.scatterMode==='brushwood'?'Brushwood patch':'Forest / orchard patch'):'Grass & soil plot';
 obj.userData.physics={mode:['groundPlot','cropBed','waterPatch'].includes(d.variant)?'static':'off'};
 editor.physics.sync(obj);editor.select(obj);editor.refreshList();
 editor.recordEdit(before,editor.snapshot(obj));editor.queueSave(obj);
 editor.toast('Saved '+obj.name+' · '+points.length+' boundary points');
}
export function cancelVegetationPlot(editor){
 if(!editor.vegetationDrawing)return;
 editor.vegetationDrawing=null;releasePreview(editor);
 if($('vegetationDrawPanel'))$('vegetationDrawPanel').hidden=true;
 if($('spatialDrawShield'))$('spatialDrawShield').hidden=true;
 editor.world.controls.enabled=true;
 if(editor.selected&&editor.canTransform(editor.selected)&&editor.selected.userData.editorKind!=='robot')editor.transform.attach(editor.selected);
}
