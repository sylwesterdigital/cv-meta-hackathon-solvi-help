// SOLVI v0.2.175 — infrastructure drawing lives in the normal Properties panel.
// The canvas receives the path; no extra floating window, no cursor-attached
// phantom segment, and no saved scene object until the path is finished.
// As each committed point arrives, draw the ACTUAL textured geometry, not a line.
import * as THREE from 'three';
import {cleanInfrastructurePoints,infrastructureParts} from './procedural-infrastructure.js';
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
 const preview=editor.infrastructurePreview;if(!preview)return;
 editor.world.scene.remove(preview);
 const disposedGeo=new Set(),disposedMat=new Set(),disposedTex=new Set();
 preview.traverse?.(part=>{
  const geo=part.geometry;
  if(geo&&!disposedGeo.has(geo)){disposedGeo.add(geo);geo.dispose?.();}
  const materials=Array.isArray(part.material)?part.material:[part.material];
  for(const mat of materials){
   if(!mat||disposedMat.has(mat))continue;
   disposedMat.add(mat);
   for(const tex of [mat.map,mat.normalMap,mat.bumpMap,mat.roughnessMap]){
    if(tex&&!disposedTex.has(tex)){disposedTex.add(tex);tex.dispose?.();}
   }
   mat.dispose?.();
  }
 });
 editor.infrastructurePreview=null;
}
function redraw(editor){
 const d=editor.infrastructureDrawing;if(!d){resetPreview(editor);return;}
 // Freehand gestures can deliver hundreds of pointer events per second.
 // Limit expensive textured-geometry rebuilds while dragging; pointerup
 // still renders the complete committed geometry immediately.
 if(d.mode==='freehand'&&d.drawing&&d.points.length>=3){
  const now=performance.now();
  if(now-(d.lastPreviewAt||0)<70)return;
  d.lastPreviewAt=now;
 }
 resetPreview(editor);
 // A point is never joined to the mouse cursor. Only confirmed points build
 // the object, so users immediately see their actual wall/fence/road geometry.
 if(d.points.length>=2){
  const group=new THREE.Group();group.name='Infrastructure construction preview';
  const config={...d.editTarget.userData.furniture,infraType:d.type,infraPoints:d.points.map(point=>point.slice())};
  try{
   for(const part of infrastructureParts(config)){
    part.userData.infrastructurePreview=true;
    group.add(part);
   }
   // Preview is drawn where it will stand in the world: no wrong centre offsets.
   group.position.set(0,0,0);
   group.traverse?.(part=>{if(part.isMesh){part.frustumCulled=false;}});
   editor.world.scene.add(group);editor.infrastructurePreview=group;
  }catch(error){
   console.warn('Infrastructure preview unavailable:',error);
   // A transient WebGL material error must not interrupt the drawing session.
   for(const child of [...group.children]){child.geometry?.dispose?.();child.material?.dispose?.();}
  }
 }
 const status=id('infraDrawingStatus'),undo=id('infraDrawingUndo'),done=id('infraDrawingFinish');
 if(status)status.textContent=d.points.length>=2
  ?`${d.points.length} placed points · Live construction · Change settings or Finish to save`
  :d.points.length===1?'1 point placed · Click the next point to construct the object'
  :'Click the ground to place the first point';
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
 editor.infrastructureDrawing={type,mode,points:[],drawing:false,editTarget:obj,isNew:!existing,redraw:()=>redraw(editor),before:existing?editor.snapshot(obj):null,oldFurniture:existing?{...obj.userData.furniture}:null,oldVisibility:obj.visible,previousWindowZ:id('propertiesPanel')?.style.getPropertyValue('--solvi-window-z')||''};
 if(existing)obj.visible=false;
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
  if((d.mode!=='line'||d.points.length<2)&&(!last||Math.hypot(last[0]-pt.x,last[1]-pt.z)>.10)&&d.points.length<80)d.points.push([pt.x,pt.z]);
  redraw(editor);
  // A single line also stays editable until Finish. Never auto-save after 2 clicks.
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
 const before=d.isNew?null:d.before;
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
 }else{
  if(!d.isNew&&!keepTarget){
   // Undo transient Inspector changes, not merely the drawn line. No room save.
   rebuildFurniture(d.editTarget,d.oldFurniture);
   d.editTarget.visible=d.oldVisibility;
   editor.physics.sync(d.editTarget);
  }else if(keepTarget){d.editTarget.visible=true;}
  if(editor.selected&&editor.canTransform(editor.selected)&&editor.selected.userData.editorKind!=='robot')editor.transform.attach(editor.selected);
 }
 if(editor.selected?.userData?.furniture?.variant==='infrastructure')editor.renderFurnitureControls(editor.selected);
}
