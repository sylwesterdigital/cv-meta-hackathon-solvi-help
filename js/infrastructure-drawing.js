// SOLVI v0.2.173 — draw one line, a polyline or a freehand infrastructure path on the ground.
import * as THREE from 'three';
import {cleanInfrastructurePoints} from './procedural-infrastructure.js';
import {rebuildFurniture} from './primitive-properties.js';

const id=name=>document.getElementById(name);
function groundHit(editor,e){
 const rect=editor.world.renderer.domElement.getBoundingClientRect();
 if(!rect.width||!rect.height)return null;
 editor.pointer.set(2*(e.clientX-rect.left)/rect.width-1,1-2*(e.clientY-rect.top)/rect.height);
 editor.world.camera.updateMatrixWorld?.(true);
 editor.raycaster.setFromCamera(editor.pointer,editor.world.camera);
 return editor.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
}
function ensurePanel(){
 let el=id('infraDrawPanel');if(el)return el;
 el=document.createElement('section');el.id='infraDrawPanel';el.className='infra-draw-panel';el.hidden=true;
 el.innerHTML=`<div class="infra-draw-title">Draw infrastructure <button type="button" id="infraDrawCancel" aria-label="Cancel drawing">×</button></div>
 <div class="infra-draw-field"><label for="infraDrawType">Type</label><select id="infraDrawType"><option value="road">Road / motorway</option><option value="footpath">Footpath / pavement</option><option value="curb">Curb</option><option value="fence">Fence</option><option value="hedge">Plant hedge</option><option value="pathWall">Wall</option></select></div>
 <div class="infra-draw-field"><label for="infraDrawMode">Path</label><select id="infraDrawMode"><option value="line">Single line</option><option value="polyline" selected>Multi-line / polyline</option><option value="freehand">Freehand</option></select></div>
 <div class="infra-draw-field infra-draw-inline"><label><input id="infraDrawSmooth" type="checkbox"> Smooth bends</label><label><input id="infraDrawClose" type="checkbox"> Close path</label></div>
 <p id="infraDrawStatus" class="infra-draw-status">Click the ground to start · Enter to finish</p>
 <div class="infra-draw-actions"><button type="button" id="infraDrawUndo">Undo point</button><button type="button" id="infraDrawSave">Create</button></div>`;
 document.body.append(el);
 return el;
}
function resetPreview(editor){
 if(!editor.infrastructurePreview)return;
 const old=editor.infrastructurePreview;editor.world.scene.remove(old);old.geometry?.dispose?.();old.material?.dispose?.();editor.infrastructurePreview=null;
}
function redraw(editor){
 resetPreview(editor);const d=editor.infrastructureDrawing;if(!d)return;
 const points=d.points.map(([x,z])=>new THREE.Vector3(x,.045,z));
 if(d.cursor&&points.length)points.push(new THREE.Vector3(d.cursor.x,.045,d.cursor.z));
 if(points.length>=2){
  if(id('infraDrawClose')?.checked&&d.points.length>=3&&!d.cursor)points.push(points[0].clone());
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x9eeab9,depthTest:false}));
  line.renderOrder=250;editor.world.scene.add(line);editor.infrastructurePreview=line;
 }
 const n=d.points.length,status=id('infraDrawStatus'),save=id('infraDrawSave');
 if(status)status.textContent=n?`${n} points · Enter to create · Esc to cancel`:'Click ground to set points · drag in freehand mode';
 if(save)save.disabled=n<2;
}
export function startInfrastructureDrawing(editor,type='road',mode='polyline',editTarget=null){
 if(editor.infrastructureDrawing)cancelInfrastructureDrawing(editor);
 if(editor.vegetationDrawing)editor.vegetationDrawing&&editor.vegetationDrawing.redraw?.();
 editor.cancelSpatialDrawing?.();editor.endWallDrawing?.();
 // The independent drawing tool keeps its own transient points until a successful save.
 const panel=ensurePanel(),selected=id('infraDrawType'),method=id('infraDrawMode');
 selected.value=type;method.value=mode;
 editor.infrastructureDrawing={type,mode,points:[],cursor:null,drawing:false,editTarget:editTarget?.userData?.furniture?.variant==='infrastructure'?editTarget:null};
 panel.hidden=false;
 id('addMenu').hidden=true;editor.transform.detach();editor.world.controls.enabled=false;
 id('spatialDrawShield').hidden=false;
 id('infraDrawCancel').onclick=()=>cancelInfrastructureDrawing(editor);
 id('infraDrawUndo').onclick=()=>{editor.infrastructureDrawing?.points.pop();redraw(editor);};
 id('infraDrawSave').onclick=()=>finishInfrastructureDrawing(editor);
 selected.onchange=()=>{if(editor.infrastructureDrawing)editor.infrastructureDrawing.type=selected.value;};
 method.onchange=()=>{if(editor.infrastructureDrawing){editor.infrastructureDrawing.mode=method.value;editor.infrastructureDrawing.points=[];redraw(editor);}};
 id('infraDrawClose').onchange=()=>redraw(editor);
 redraw(editor);
}
export function infrastructurePointer(editor,e){
 const d=editor.infrastructureDrawing;if(!d)return false;
 const panel=id('infraDrawPanel');if(panel?.contains(e.target)||e.target?.closest?.('button,input,select,textarea,[role=dialog]'))return false;
 if(e.type==='pointercancel'){d.drawing=false;return true;}
 if(e.type==='pointermove'){
  const pt=groundHit(editor,e);if(!pt)return true;
  if(d.mode==='freehand'&&d.drawing){const prev=d.points.at(-1);if(!prev||Math.hypot(prev[0]-pt.x,prev[1]-pt.z)>.23){if(d.points.length<80)d.points.push([pt.x,pt.z]);}}
  d.cursor=pt;redraw(editor);return true;
 }
 if(e.type==='pointerdown'&&e.button===0){
  const pt=groundHit(editor,e);if(!pt)return true;
  d.drawing=true;
  const last=d.points.at(-1);
  if(!last||Math.hypot(last[0]-pt.x,last[1]-pt.z)>.11){if(d.points.length<80)d.points.push([pt.x,pt.z]);}
  if(d.mode==='line'&&d.points.length===2){finishInfrastructureDrawing(editor);return true;}
  d.cursor=null;redraw(editor);return true;
 }
 if(e.type==='pointerup'){
  d.drawing=false;
  if(d.mode==='freehand'&&d.points.length>2)d.cursor=null;
  redraw(editor);return true;
 }
 return true;
}
export function finishInfrastructureDrawing(editor){
 const d=editor.infrastructureDrawing;if(!d||d.points.length<2)return false;
 const raw=cleanInfrastructurePoints(d.points);
 const oldTarget=d.editTarget&&editor.items.includes(d.editTarget)&&editor.canEdit(d.editTarget)?d.editTarget:null;
 const xs=raw.map(p=>p[0]),zs=raw.map(p=>p[1]);
 const origin=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...zs)+Math.max(...zs))/2];
 // A redraw updates the existing object, preserving its rotation and scale.
 // Convert new ground points through the object's full inverse world transform.
 oldTarget?.updateMatrixWorld(true);
 const pivotY=oldTarget?.getWorldPosition?.(new THREE.Vector3()).y??0;
 const points=oldTarget?raw.map(([x,z])=>{
  const local=oldTarget.worldToLocal(new THREE.Vector3(x,pivotY,z));return [local.x,local.z];
 }):raw.map(([x,z])=>[x-origin[0],z-origin[1]]);
 const p={variant:'infrastructure',infraType:d.type,infraPoints:points,infraSmooth:Boolean(id('infraDrawSmooth')?.checked),infraClose:Boolean(id('infraDrawClose')?.checked),...(oldTarget?{}:{infraStyle:editor.infrastructureDefaultStyle||'plank',infraLanes:editor.infrastructureDefaultRoadLanes||2,infraWidth:editor.infrastructureDefaultRoadLanes===4?15:d.type==='road'?7.2:d.type==='footpath'?2:d.type==='hedge'?1.15:d.type==='curb'?.25:.18})};
 if(points.reduce((s,[x,z],i)=>i?s+Math.hypot(x-points[i-1][0],z-points[i-1][1]):0,0)<.15)return false;
 const before=oldTarget?editor.snapshot(oldTarget):null;
 cancelInfrastructureDrawing(editor);
 const obj=oldTarget||editor.add('furniture',false,undefined,false,'infrastructure');if(!obj)return false;
 rebuildFurniture(obj,{...(oldTarget?obj.userData.furniture:{}),...p});
 if(!oldTarget)obj.position.set(origin[0],0,origin[1]);
 obj.name={road:'Road',footpath:'Footpath',curb:'Curb',fence:'Fence',hedge:'Hedge',pathWall:'Wall'}[p.infraType]||'Infrastructure';
 obj.userData.physics={mode:'static'};
 editor.physics.sync(obj);editor.select(obj);editor.refreshList();
 editor.recordEdit(before,editor.snapshot(obj));editor.queueSave(obj);
 editor.toast(obj.name+' created · '+points.length+' points');return true;
}
export function cancelInfrastructureDrawing(editor){
 if(!editor.infrastructureDrawing)return;
 editor.infrastructureDrawing=null;editor.infrastructureDefaultStyle='plank';editor.infrastructureDefaultRoadLanes=null;resetPreview(editor);
 const el=id('infraDrawPanel');if(el)el.hidden=true;
 if(!editor.vegetationDrawing&&!editor.wallDrawing&&id('spatialDrawShield'))id('spatialDrawShield').hidden=true;
 editor.world.controls.enabled=true;
 if(editor.selected&&editor.canTransform(editor.selected)&&editor.selected.userData.editorKind!=='robot')editor.transform.attach(editor.selected);
}
