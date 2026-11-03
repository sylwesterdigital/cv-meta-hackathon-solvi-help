// SOLVI v0.2.174 — infrastructure drawing lives in the normal Properties panel.
// The canvas receives the path; no extra floating window, no cursor-attached
// phantom segment, and no saved scene object until the path is finished.
import * as THREE from 'three';
import {cleanInfrastructurePoints} from './procedural-infrastructure.js';
import {rebuildFurniture} from './primitive-properties.js';

const id=name=>document.getElementById(name);
function groundHit(editor,e){
 const rect=editor.world.renderer.domElement.getBoundingClientRect();
 if(!rect.width||!rect.height||e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)return null;
 editor.pointer.set(2*(e.clientX-rect.left)/rect.width-1,1-2*(e.clientY-rect.top)/rect.height);
 editor.world.camera.updateMatrixWorld?.(true);
 editor.raycaster.setFromCamera(editor.pointer,editor.world.camera);
 return editor.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
}
function resetPreview(editor){
 const old=editor.infrastructurePreview;if(!old)return;
 editor.world.scene.remove(old);old.geometry?.dispose?.();old.material?.dispose?.();editor.infrastructurePreview=null;
}
function redraw(editor){
 resetPreview(editor);const d=editor.infrastructureDrawing;if(!d)return;
 // A preview is never attached to pointer movement: only committed vertices.
 const pts=d.points.map(([x,z])=>new THREE.Vector3(x,.05,z));
 if(pts.length>=2){
  if(d.editTarget?.userData?.furniture?.infraClose&&pts.length>=3)pts.push(pts[0].clone());
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x8ce7bb,depthTest:false}));
  line.renderOrder=250;editor.world.scene.add(line);editor.infrastructurePreview=line;
 }
 const status=id('infraDrawingStatus'),undo=id('infraDrawingUndo'),done=id('infraDrawingFinish');
 if(status)status.textContent=d.points.length?`${d.points.length} placed points · Enter / Finish to save · Esc to cancel`:'Click the ground to add the first point';
 if(undo)undo.disabled=d.points.length===0;
 if(done)done.disabled=d.points.length<2;
}
export function startInfrastructureDrawing(editor,type='road',mode='polyline',editTarget=null){
 if(editor.infrastructureDrawing)cancelInfrastructureDrawing(editor);
 editor.cancelSpatialDrawing?.();editor.endWallDrawing?.();
 // A new object is just an invisible, unsaved inspector draft, so settings are
 // available before the first point. Existing objects retain their scene IDs.
 const existing=editTarget?.userData?.furniture?.variant==='infrastructure'&&editor.items.includes(editTarget);
 const obj=existing?editTarget:editor.add('furniture',false,undefined,false,'infrastructure');
 if(!obj)return;
 if(!existing){
  const config={...obj.userData.furniture,infraType:type,infraStyle:editor.infrastructureDefaultStyle||'plank',
   infraLanes:editor.infrastructureDefaultRoadLanes||2,
   infraWidth:type==='road'?(editor.infrastructureDefaultRoadLanes===4?15:7.2):type==='footpath'?2:type==='hedge'?1.15:type==='curb'?.25:.18};
  rebuildFurniture(obj,config);obj.visible=false;obj.userData.physics={mode:'off'};editor.physics.remove(obj.userData.editorId);
  obj.name={road:'Road',footpath:'Footpath',curb:'Curb',fence:'Fence',hedge:'Hedge',pathWall:'Wall'}[type]||'Infrastructure';
  editor.infrastructureDefaultStyle=null;editor.infrastructureDefaultRoadLanes=null;
 }
 editor.infrastructureDrawing={type,mode,points:[],drawing:false,editTarget:obj,isNew:!existing,redraw:()=>redraw(editor),previousWindowZ:id('propertiesPanel')?.style.getPropertyValue('--solvi-window-z')||''};
 editor.select(obj);
 id('addMenu').hidden=true;
 id('propertiesPanel').hidden=false;id('propertiesPanel').style.setProperty('--solvi-window-z','250');
 editor.transform.detach();editor.world.controls.enabled=false;
 id('spatialDrawShield').hidden=false;
 editor.renderFurnitureControls(obj);redraw(editor);
}
export function infrastructurePointer(editor,e){
 const d=editor.infrastructureDrawing;if(!d)return false;
 // Never capture controls or move a ghost segment over the Properties window.
 const sceneTarget=e.target===id('spatialDrawShield')||e.target===editor.world.renderer.domElement;
 if(!sceneTarget){if(e.type==='pointerup'||e.type==='pointercancel')d.drawing=false;return false;}
 if(e.type==='pointercancel'){d.drawing=false;return true;}
 if(e.type==='pointermove'){
  if(d.mode==='freehand'&&d.drawing){
   const pt=groundHit(editor,e);if(!pt)return true;
   const prev=d.points.at(-1);if((!prev||Math.hypot(prev[0]-pt.x,prev[1]-pt.z)>.2)&&d.points.length<80){
    d.points.push([pt.x,pt.z]);redraw(editor);
   }
  }
  return true;
 }
 if(e.type==='pointerdown'&&e.button===0){
  const pt=groundHit(editor,e);if(!pt)return true;
  d.drawing=d.mode==='freehand';
  const last=d.points.at(-1);
  if((!last||Math.hypot(last[0]-pt.x,last[1]-pt.z)>.10)&&d.points.length<80)d.points.push([pt.x,pt.z]);
  redraw(editor);
  if(d.mode==='line'&&d.points.length===2)finishInfrastructureDrawing(editor);
  return true;
 }
 if(e.type==='pointerup'){
  if(d.mode==='freehand'&&d.drawing){
   const pt=groundHit(editor,e),last=d.points.at(-1);
   if(pt&&last&&Math.hypot(last[0]-pt.x,last[1]-pt.z)>.15&&d.points.length<80)d.points.push([pt.x,pt.z]);
  }
  d.drawing=false;redraw(editor);return true;
 }
 return true;
}
export function finishInfrastructureDrawing(editor){
 const d=editor.infrastructureDrawing;if(!d||d.points.length<2)return false;
 const raw=cleanInfrastructurePoints(d.points),obj=d.editTarget;
 if(!obj||!editor.items.includes(obj)||raw.length<2)return false;
 const distance=raw.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-raw[i][0],p[1]-raw[i][1]),0);
 if(distance<.15)return false;
 const xs=raw.map(p=>p[0]),zs=raw.map(p=>p[1]);
 const origin=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...zs)+Math.max(...zs))/2];
 const before=d.isNew?null:editor.snapshot(obj);
 let points;
 if(d.isNew){points=raw.map(([x,z])=>[x-origin[0],z-origin[1]]);obj.position.set(origin[0],0,origin[1]);}
 else{
  obj.updateMatrixWorld(true);const y=obj.getWorldPosition(new THREE.Vector3()).y;
  points=raw.map(([x,z])=>{const local=obj.worldToLocal(new THREE.Vector3(x,y,z));return[local.x,local.z];});
 }
 rebuildFurniture(obj,{...obj.userData.furniture,infraPoints:points});
 obj.visible=true;obj.userData.physics={mode:'static'};
 cancelInfrastructureDrawing(editor,{keepTarget:true});
 editor.physics.sync(obj);editor.select(obj);editor.refreshList();
 editor.recordEdit(before,editor.snapshot(obj));editor.queueSave(obj);
 editor.toast(obj.name+' · path saved · '+points.length+' points');return true;
}
export function cancelInfrastructureDrawing(editor,{keepTarget=false}={}){
 const d=editor.infrastructureDrawing;if(!d)return;
 editor.infrastructureDrawing=null;resetPreview(editor);
 if(d.previousWindowZ)id('propertiesPanel')?.style.setProperty('--solvi-window-z',d.previousWindowZ);else id('propertiesPanel')?.style.removeProperty('--solvi-window-z');
 if(id('spatialDrawShield')&&!editor.vegetationDrawing&&!editor.wallDrawing)id('spatialDrawShield').hidden=true;
 editor.world.controls.enabled=true;
 if(d.isNew&&!keepTarget){
  const obj=d.editTarget;editor.transform.detach();
  editor.items=editor.items.filter(x=>x!==obj);
  editor.world.scene.remove(obj);editor.physics.remove(obj.userData.editorId);
  editor.disposeObject?.(obj);if(editor.selected===obj)editor.selected=null;
  editor.updateInspector();editor.refreshList();
  id('propertiesPanel').hidden=true;
 }else if(editor.selected&&editor.canTransform(editor.selected)&&editor.selected.userData.editorKind!=='robot')editor.transform.attach(editor.selected);
 if(editor.selected?.userData?.furniture?.variant==='infrastructure')editor.renderFurnitureControls(editor.selected);
}
