// SOLVI v0.2.177 — unified interactive infrastructure construction.
// The canvas receives the path; no extra floating window, no cursor-attached
// uncommitted path in the scene, and no saved scene object until finish.
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
// Freehand coordinates remain accurate without exposing hundreds of geometry segments.
// Preserve both ends and significant bends while reducing points to the backend's 80-point limit.
export function simplifyDrawnPath(points,maxPoints=80){
 if(points.length<=maxPoints)return points.map(p=>p.slice());
 const rdp=(tolerance)=>{
  const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;
  const stack=[[0,points.length-1]];
  while(stack.length){
   const [start,end]=stack.pop(),a=points[start],b=points[end];
   const dx=b[0]-a[0],dz=b[1]-a[1],len2=dx*dx+dz*dz;
   let best=tolerance*tolerance,bestIndex=-1;
   for(let j=start+1;j<end;j++){
    const p=points[j],t=len2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/len2)):0;
    const d=(p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dz)**2;
    if(d>best){best=d;bestIndex=j;}
   }
   if(bestIndex>=0){keep[bestIndex]=1;stack.push([start,bestIndex],[bestIndex,end]);}
  }
  return points.filter((_,i)=>keep[i]).map(p=>p.slice());
 };
 let lo=0,hi=100,answer=rdp(hi);
 for(let i=0;i<24;i++){const mid=(lo+hi)/2,result=rdp(mid);if(result.length>maxPoints)lo=mid;else{hi=mid;answer=result;}}
 return answer;
}
function snapshotDraft(d,previousFurniture){return {points:d.points.map(p=>p.slice()),furniture:structuredClone(previousFurniture||d.editTarget.userData.furniture)};}
function restoreDraft(editor,d,state){
 d.points=state.points.map(p=>p.slice());d.drawing=false;d.cursor=null;
 rebuildFurniture(d.editTarget,state.furniture);
 editor.renderFurnitureControls?.(d.editTarget);redraw(editor);
}
export function drawingUndo(editor){
 const d=editor.infrastructureDrawing;if(!d||!d.undoStack.length)return false;
 d.redoStack.push(snapshotDraft(d));restoreDraft(editor,d,d.undoStack.pop());return true;
}
export function drawingRedo(editor){
 const d=editor.infrastructureDrawing;if(!d||!d.redoStack.length)return false;
 d.undoStack.push(snapshotDraft(d));restoreDraft(editor,d,d.redoStack.pop());return true;
}
function saveHistory(d,previousFurniture){
 d.undoStack.push(snapshotDraft(d,previousFurniture));if(d.undoStack.length>100)d.undoStack.shift();d.redoStack.length=0;
}
export function recordInfrastructureDraftChange(editor,previousFurniture){
 const d=editor.infrastructureDrawing;if(!d||!previousFurniture)return false;
 saveHistory(d,previousFurniture);return true;
}
function resetGuide(editor){
 const guide=editor.infrastructureGuide;if(!guide)return;
 editor.world.scene.remove(guide);guide.geometry?.dispose?.();guide.material?.dispose?.();editor.infrastructureGuide=null;
}
function updateGuide(editor){
 const d=editor.infrastructureDrawing;resetGuide(editor);
 // The dashed mouse-to-last-point guide is only a provisional distance hint,
 // never an actual scene wall/fence, and disappears outside the scene viewport.
 if(!d||d.drawing||!d.cursor||!d.points.length||d.mode==='line'&&d.points.length>=2||typeof THREE.LineSegments!=='function')return;
 const a=d.points.at(-1),b=d.cursor;
 if(Math.hypot(a[0]-b[0],a[1]-b[1])<.07)return;
 const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0],.045,a[1]),new THREE.Vector3(b[0],.045,b[1])]);
 geometry.computeLineDistances?.();
 const material=new THREE.LineDashedMaterial({color:0xb3dfe5,dashSize:.24,gapSize:.14,depthTest:false,transparent:true,opacity:.65});
 const guide=new THREE.LineSegments(geometry,material);guide.computeLineDistances?.();guide.renderOrder=180;
 editor.world.scene.add(guide);editor.infrastructureGuide=guide;
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
 const d=editor.infrastructureDrawing;if(!d){resetPreview(editor);resetGuide(editor);return;}
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
  const config={...d.editTarget.userData.furniture,infraType:d.type,infraPoints:simplifyDrawnPath(d.points)};
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
 updateGuide(editor);
 const status=id('infraDrawingStatus'),undo=id('infraDrawingUndo'),redo=id('infraDrawingRedo'),done=id('infraDrawingFinish');
 if(status)status.textContent=d.points.length>=2
  ?`${d.points.length} points · Live construction`
  :d.points.length===1?'1 point · Add the next point'
  :'Click ground to begin drawing';
 if(undo)undo.disabled=d.undoStack.length===0;
 if(redo)redo.disabled=d.redoStack.length===0;
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
 editor.infrastructureDrawing={type,mode,points:[],undoStack:[],redoStack:[],cursor:null,drawing:false,editTarget:obj,isNew:!existing,redraw:()=>redraw(editor),before:existing?editor.snapshot(obj):null,oldFurniture:existing?{...obj.userData.furniture}:null,oldVisibility:obj.visible,previousWindowZ:id('propertiesPanel')?.style.getPropertyValue('--solvi-window-z')||''};
 if(existing)obj.visible=false;
 editor.select(obj);
 id('addMenu').hidden=true;
 id('propertiesPanel').hidden=false;id('propertiesPanel').style.setProperty('--solvi-window-z','250');
 editor.transform.detach();editor.world.controls.enabled=true;
 id('spatialDrawShield').hidden=false;id('spatialDrawShield').classList?.add('solvi-infra-pass-through');
 editor.renderFurnitureControls(obj);redraw(editor);
}
export function infrastructurePointer(editor,e){
 const d=editor.infrastructureDrawing;if(!d)return false;
 const canvas=editor.world.renderer.domElement;
 const sceneTarget=e.target===id('spatialDrawShield')||e.target===canvas;
 // Orbit and zoom remain usable: right/middle mouse, two-finger gestures, and
 // wheel are deliberately never captured by the line-drawing tool.
 if(e.button===1||e.button===2||e.buttons&&e.buttons!==1)return false;
 if(!sceneTarget){
  if(e.type==='pointermove'&&d.cursor){d.cursor=null;resetGuide(editor);}
  if(e.type==='pointerup'||e.type==='pointercancel')d.drawing=false;
  return false;
 }
 if(e.type==='pointercancel'){d.drawing=false;d.cursor=null;resetGuide(editor);return true;}
 if(e.type==='pointermove'){
  const point=groundHit(editor,e);
  d.cursor=point?[point.x,point.z]:null;
  if(d.mode==='freehand'&&d.drawing&&point){
   const prev=d.points.at(-1);
   if(!prev||Math.hypot(prev[0]-point.x,prev[1]-point.z)>.12){
    // Avoid silently stopping after the old 80-point cap. Discard only
    // redundant samples as very long strokes grow, preserving the full path.
    if(d.points.length>=1200)d.points=simplifyDrawnPath(d.points,500);
    d.points.push([point.x,point.z]);redraw(editor);
   }
  }else updateGuide(editor);
  return true;
 }
 if(e.type==='pointerdown'&&e.button===0){
  const pt=groundHit(editor,e);if(!pt)return true;
  d.drawing=d.mode==='freehand';
  const last=d.points.at(-1);
  const canAppend=(d.mode!=='line'||d.points.length<2)&&(!last||Math.hypot(last[0]-pt.x,last[1]-pt.z)>.10);
  if(canAppend||d.drawing){saveHistory(d);if(canAppend)d.points.push([pt.x,pt.z]);}
  d.cursor=null;redraw(editor);
  return true;
 }
 if(e.type==='pointerup'){
  if(d.mode==='freehand'&&d.drawing){
   const pt=groundHit(editor,e),last=d.points.at(-1);
   if(pt&&last&&Math.hypot(last[0]-pt.x,last[1]-pt.z)>.12)d.points.push([pt.x,pt.z]);
  }
  d.drawing=false;d.cursor=null;redraw(editor);return true;
 }
 return false;
}
export function finishInfrastructureDrawing(editor){
 const d=editor.infrastructureDrawing;if(!d||d.points.length<2)return false;
 const raw=cleanInfrastructurePoints(simplifyDrawnPath(d.points)),obj=d.editTarget;
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
 editor.infrastructureDrawing=null;resetPreview(editor);resetGuide(editor);
 if(d.previousWindowZ)id('propertiesPanel')?.style.setProperty('--solvi-window-z',d.previousWindowZ);else id('propertiesPanel')?.style.removeProperty('--solvi-window-z');
 id('spatialDrawShield')?.classList?.remove('solvi-infra-pass-through');
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
