import * as THREE from 'three';
import {cleanCurve,buildCurveGeometry} from './curve-geometry.js';
import {sketchPlane,strokePoint,appendStrokePoint} from './curve-sketch.js';
import {cleanOpenings,cutCubeGeometry,surfaceAxis,rectangleFromSurface} from './cube-openings.js';
const $=id=>document.getElementById(id);
const v3=p=>new THREE.Vector3(...p);
const coordinates=(axis,u,v,side)=>axis==='x'?new THREE.Vector3(side,v,u):axis==='y'?new THREE.Vector3(u,side,v):new THREE.Vector3(u,v,side);
function disposePreview(editor,key){const mesh=editor[key];if(mesh){editor.world.scene.remove(mesh);mesh.traverse(n=>{n.geometry?.dispose?.();if(n.material){for(const m of Array.isArray(n.material)?n.material:[n.material])m.dispose?.();}});editor[key]=null;}}
function readCurve(editor){return cleanCurve(editor.selected?.userData?.curve);}
function rebuildCurve(editor,obj,params){const previous=obj.geometry;obj.geometry=buildCurveGeometry(params);previous?.dispose();obj.userData.curve=cleanCurve(params);editor.physics.sync(obj);}
export function setupSpatialTools(){
 $('curveDrawCancel').onclick=()=>this.cancelSpatialDrawing();
 $('curveDrawUndo').onclick=()=>{const d=this.curveDrawing;if(d?.points.length){d.points.pop();drawCurvePreview(this);}};
 $('curveDrawSave').onclick=()=>finishCurve(this);
 for(const id of ['curvePlane','curveDepth','curveElevation'])$(id).onchange=()=>{
  const d=this.curveDrawing;if(!d)return;
  if(d.points.length){$('curveDrawingStatus').textContent='Finish or cancel the current stroke before changing its plane';return;}
  d.plane=sketchPlane(this.world.camera,$('curvePlane').value,+$('curveDepth').value,+$('curveElevation').value,d.object?.position);
  $('curveDepth').disabled=$('curvePlane').value!=='screen';$('curveElevation').disabled=$('curvePlane').value!=='floor';
 };
 $('chatMediaClose').onclick=()=>hideMediaPicker(this);
 $('chatMediaPicker').addEventListener('pointerdown',event=>{if(event.target===$('chatMediaPicker'))hideMediaPicker(this);});
 $('chatMediaSearch').oninput=()=>{for(const node of $('chatMediaResults').children)node.hidden=!node.dataset.search.includes($('chatMediaSearch').value.toLowerCase());};
 window.addEventListener('keydown',e=>{
  if(!(this.curveDrawing||this.faceDrawing)||e.target?.closest?.('input,select,textarea,[contenteditable]'))return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.cancelSpatialDrawing();}
  if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();this.curveDrawing?finishCurve(this):commitFace(this);}
  if(e.key==='Backspace'&&this.curveDrawing){e.preventDefault();this.curveDrawing.points.pop();drawCurvePreview(this);}
 },true);
}
export function renderCurveControls(obj){
 const fold=$('curveProperties');if(!fold)return;const curve=obj?.userData?.editorKind==='curve';fold.hidden=!curve;
 if(!curve)return;
 if(this.curveUIObject===obj)return;
 this.curveUIObject=obj;
 const sel=$('curvePropertyKey'),number=$('curvePropertyNumber'),range=$('curvePropertyRange');
 const fields={offset:[-3,3,.025],extrude:[.01,5,.01],bevel:[0,1,.005],bevelResolution:[1,12,1],resolution:[8,250,1]};
 const sync=()=>{const [min,max,step]=fields[sel.value];const value=readCurve(this)[sel.value];number.min=range.min=min;number.max=range.max=max;number.step=range.step=step;number.value=range.value=value;number.disabled=range.disabled=!this.canEdit(obj);};
 sel.onchange=sync;let before=null;
 const setValue=()=>{if(!this.canEdit(obj))return;if(!before)before=this.snapshot(obj);const params={...readCurve(this),[sel.value]:Number(number.value)};rebuildCurve(this,obj,params);range.value=readCurve(this)[sel.value];};
 number.oninput=()=>setValue();range.oninput=()=>{number.value=range.value;setValue();};
 const done=()=>{if(before){this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);before=null;}};
 number.onchange=done;range.onchange=done;
 const caps=$('curveCapEnds');caps.checked=readCurve(this).capEnds;caps.disabled=!this.canEdit(obj);
 caps.onchange=()=>{if(!this.canEdit(obj))return;const before=this.snapshot(obj);rebuildCurve(this,obj,{...readCurve(this),capEnds:caps.checked});this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);};
 $('curveEditPoints').onclick=()=>{if(this.selected===obj&&this.canEdit(obj))this.startCurveDrawing(obj);};
 $('curvePointCount').textContent=readCurve(this).points.length+' control points';sync();
}
export function startCurveDrawing(existing=null){
 this.cancelSpatialDrawing();const obj=existing?.userData.editorKind==='curve'?existing:null;
 const plane=sketchPlane(this.world.camera,$('curvePlane').value,+$('curveDepth').value,+$('curveElevation').value,obj?.position);
 this.curveDrawing={object:obj,points:[],cursor:null,drawing:false,plane};$('curveDrawPanel').hidden=false;$('addMenu').hidden=true;this.transform.detach();this.world.controls.enabled=false;$('spatialDrawShield').hidden=false;
 $('curveDepth').disabled=$('curvePlane').value!=='screen';$('curveElevation').disabled=$('curvePlane').value!=='floor';
 $('curveDrawingStatus').textContent='Drag on the scene to sketch; release to preview · Enter saves · Esc cancels';drawCurvePreview(this);
}
function drawCurvePreview(editor){
 disposePreview(editor,'curvePreview');const d=editor.curveDrawing;if(!d)return;
 const group=new THREE.Group(),pts=d.points.map(v3);
 if(d.cursor&&d.drawing&&(!pts.length||pts.at(-1).distanceTo(d.cursor)>.002))pts.push(d.cursor.clone());
 if(pts.length>=2){const path=new THREE.CatmullRomCurve3(pts);const g=new THREE.TubeGeometry(path,Math.min(180,Math.max(12,pts.length*2)),.015,5,false);group.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:'#6ee9fc',depthTest:false,transparent:true,opacity:.9})));}
 if(d.points.length){const dot=new THREE.Mesh(new THREE.SphereGeometry(.055,8,6),new THREE.MeshBasicMaterial({color:'#e6f2ff',depthTest:false}));dot.position.fromArray(d.points[0]);group.add(dot);}
 group.name='Freehand 3D curve · unsaved';editor.curvePreview=group;editor.world.scene.add(group);
 $('curveDrawSave').disabled=d.points.length<2;
 if(d.points.length)$('curveDrawingStatus').textContent=d.drawing?`${d.points.length} points · drawing on locked ${$('curvePlane').selectedOptions[0]?.textContent} plane`:`${d.points.length} points · release complete · Enter to save, Esc to discard`;
}
function finishCurve(editor){const state=editor.curveDrawing;if(!state||state.points.length<2||state.drawing)return;
 const obj=state.object||editor.add('curve',false,undefined,false);if(!obj)return;
 const before=state.object?editor.snapshot(obj):null;
 const origin=state.object?obj.position.clone():v3(state.points[0]);
 const pts=state.points.map(p=>state.object?obj.worldToLocal(v3(p)).toArray():v3(p).sub(origin).toArray());
 if(!state.object)obj.position.copy(origin);
 const next=cleanCurve({...obj.userData.curve,points:pts});rebuildCurve(editor,obj,next);
 if(!state.object)obj.name='Freehand Curve';
 editor.cancelSpatialDrawing();editor.select(obj);editor.refreshList();editor.recordEdit(before,editor.snapshot(obj));editor.queueSave(obj);editor.curveUIObject=null;editor.renderCurveControls(obj);editor.toast('Curve saved · '+pts.length+' points');
}
export function startFaceDrawing(mode){
 const obj=this.selected;
 if(!obj||!this.canEdit(obj)||!['cube','plane'].includes(obj.userData.editorKind)||(mode==='opening'&&obj.userData.editorKind!=='cube'))return this.toast('Select an editable cube for a cutout, or cube/plane for media');
 this.cancelSpatialDrawing();this.faceDrawing={mode,object:obj,start:null,end:null,axis:null,side:null,phase:'drawing',previewGeometry:null,originalGeometry:null,pendingOpening:null,mount:null};$('surfaceDrawPanel').hidden=false;
 $('surfaceDrawTitle').textContent=mode==='opening'?'Cut rectangular opening · O':'Attach chat media · U';$('surfaceDrawStatus').textContent='Drag on '+obj.name+' · release to preview · Enter saves · Esc cancels';this.transform.detach();this.world.controls.enabled=false;$('spatialDrawShield').hidden=false;
}
function surfaceHit(editor,e,first=false){
 const st=editor.faceDrawing,obj=st.object,rect=editor.world.renderer.domElement.getBoundingClientRect();
 editor.pointer.set((e.clientX-rect.left)/rect.width*2,1-(e.clientY-rect.top)/rect.height*2);editor.raycaster.setFromCamera(editor.pointer,editor.world.camera);
 if(first){const hit=editor.raycaster.intersectObject(obj,false)[0];if(!hit?.face)return null;const normal=hit.face.normal.clone().normalize();st.axis=surfaceAxis(normal);st.side=Math.sign(normal[st.axis])||1;return obj.worldToLocal(hit.point.clone());}
 if(!st.start)return null;
 obj.updateMatrixWorld(true);const size=obj.userData.primitive||{},axis=st.axis,side=st.side;
 const bound=axis==='x'?(Number(size.width)||1)/2:axis==='y'?(Number(size.height)||1)/2:obj.userData.editorKind==='plane'?0:(Number(size.depth)||1)/2;
 const n=new THREE.Vector3(axis==='x'?side:0,axis==='y'?side:0,axis==='z'?side:0).transformDirection(obj.matrixWorld);
 const facePoint=obj.localToWorld(new THREE.Vector3(axis==='x'?bound*side:0,axis==='y'?bound*side:0,axis==='z'?bound*side:0));
 const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(n,facePoint),point=new THREE.Vector3();if(!editor.raycaster.ray.intersectPlane(plane,point))return null;return obj.worldToLocal(point);
}
function drawFacePreview(editor){
 disposePreview(editor,'facePreview');const st=editor.faceDrawing;if(!st?.start||!st?.end)return;
 const axis=st.axis,a=st.start,b=st.end,side=st.side,obj=st.object;
 const uvA=axis==='x'?[a.z,a.y]:axis==='y'?[a.x,a.z]:[a.x,a.y],uvB=axis==='x'?[b.z,b.y]:axis==='y'?[b.x,b.z]:[b.x,b.y];
 const [loU,hiU]=[Math.min(uvA[0],uvB[0]),Math.max(uvA[0],uvB[0])],[loV,hiV]=[Math.min(uvA[1],uvB[1]),Math.max(uvA[1],uvB[1])];
 const pt=(u,v)=>obj.localToWorld(coordinates(axis,u,v,axis==='x'?(obj.userData.primitive?.width||1)/2*side:axis==='y'?(obj.userData.primitive?.height||1)/2*side:obj.userData.editorKind==='plane'?0:(obj.userData.primitive?.depth||1)/2*side).addScaledVector(new THREE.Vector3(axis==='x'?side:0,axis==='y'?side:0,axis==='z'?side:0),.025));
 const points=[pt(loU,loV),pt(hiU,loV),pt(hiU,hiV),pt(loU,hiV),pt(loU,loV)];
 const group=new THREE.Group();
 const fillGeometry=new THREE.BufferGeometry();const corners=[points[0],points[1],points[2],points[0],points[2],points[3]];
 fillGeometry.setAttribute('position',new THREE.Float32BufferAttribute(corners.flatMap(p=>p.toArray()),3));
 const fill=new THREE.Mesh(fillGeometry,new THREE.MeshBasicMaterial({color:st.mode==='opening'?'#ffcf67':'#66e6ff',side:THREE.DoubleSide,depthTest:false,depthWrite:false,transparent:true,opacity:.23}));
 fill.renderOrder=998;group.add(fill);
 const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:st.mode==='opening'?'#ffcf67':'#62f3ff',depthTest:false,transparent:true,opacity:1}));line.renderOrder=999;group.add(line);
 editor.facePreview=group;editor.world.scene.add(group);
}
function previewFace(editor){const st=editor.faceDrawing;if(!st?.start||!st.end)return;const obj=st.object;
 const rect=rectangleFromSurface(st.axis,st.start,st.end),p=obj.userData.primitive||{};
 if(rect.width<.12||rect.height<.12){$('surfaceDrawStatus').textContent='Drag at least 12 cm wide and high';return;}
 const axes=st.axis==='x'?['depth','height']:st.axis==='y'?['width','depth']:['width','height'];
 const sizes=axes.map(key=>Number(p[key])||1);
 if(sizes.some(v=>v<=.16)){$('surfaceDrawStatus').textContent='Surface too small for this rectangle';return;}
 rect.width=Math.max(.1,Math.min(rect.width,sizes[0]-.04));rect.height=Math.max(.1,Math.min(rect.height,sizes[1]-.04));
 rect.u=Math.max(-sizes[0]/2+rect.width/2+.01,Math.min(sizes[0]/2-rect.width/2-.01,rect.u));
 rect.v=Math.max(-sizes[1]/2+rect.height/2+.01,Math.min(sizes[1]/2-rect.height/2-.01,rect.v));
 if(st.mode==='opening'){
  if((obj.userData.openings||[]).length>=8){$('surfaceDrawStatus').textContent='Maximum eight openings per cube';return;}
  const holes=cleanOpenings([...obj.userData.openings||[],rect]);
  const replacement=cutCubeGeometry(obj.userData.primitive,holes);st.previewGeometry=replacement;
  st.originalGeometry=obj.geometry;obj.geometry=replacement;st.pendingOpening=holes; // real visible through-hole immediately, but not saved yet
  disposePreview(editor,'facePreview');
  $('surfaceDrawStatus').textContent='Hole preview · Enter to keep · Esc or click elsewhere to undo';
 }else{
  const local=coordinates(st.axis,rect.u,rect.v,st.axis==='x'?(p.width||1)/2*st.side:st.axis==='y'?(p.height||1)/2*st.side:obj.userData.editorKind==='plane'?0:(p.depth||1)/2*st.side);
  const normal=new THREE.Vector3(st.axis==='x'?st.side:0,st.axis==='y'?st.side:0,st.axis==='z'?st.side:0);
  st.mount={target:obj.userData.editorId,localPoint:local.toArray(),localNormal:normal.toArray(),width:rect.width,height:rect.height};
  $('surfaceDrawStatus').textContent='Frame preview · Enter to choose chat media · Esc or click elsewhere to undo';
 }
 st.phase='preview';
}
function commitFace(editor){const st=editor.faceDrawing;if(st?.phase!=='preview')return;
 const obj=st.object;
 if(st.mode==='opening'&&st.pendingOpening){
  // Snapshot before applying the persistent model, even though preview geometry is already visible.
  const before=editor.snapshot(obj),holes=st.pendingOpening;
  obj.geometry=st.previewGeometry;st.originalGeometry?.dispose();st.originalGeometry=null;obj.userData.openings=holes;st.previewGeometry=null;
  obj.userData.physics={...obj.userData.physics,mode:'static',collider:'trimesh'};
  editor.physics.sync(obj);editor.recordEdit(before,editor.snapshot(obj));editor.queueSave(obj);
  editor.cancelSpatialDrawing();editor.select(obj);editor.toast('Opening confirmed and saved');return;
 }
 if(st.mode==='media'&&st.mount){const mount=structuredClone(st.mount);editor.cancelSpatialDrawing();editor.openChatMediaPicker(mount);}
}
export function spatialPointer(event){
 const canvas=this.world.renderer.domElement,shield=$('spatialDrawShield');
 // A dedicated viewport hit layer captures drags even over SOLVI HUD elements.
 // Retain canvas support for tests and legacy callers.
 const inputTarget=event.target===shield?shield:event.target===canvas||canvas.contains(event.target)?canvas:null;
 if(!inputTarget)return false;
 if(event.type==='pointercancel'){
  if(this.faceDrawing||this.curveDrawing)this.cancelSpatialDrawing();
  return true;
 }
 const pointFromEvent=()=>{const box=canvas.getBoundingClientRect();this.pointer.set((event.clientX-box.left)/box.width*2,1-(event.clientY-box.top)/box.height*2);this.raycaster.setFromCamera(this.pointer,this.world.camera);return strokePoint(this.raycaster.ray,this.curveDrawing.plane);};
 if(this.curveDrawing){
  const d=this.curveDrawing;
  if(event.type==='pointerdown'&&event.button===0){
   const p=pointFromEvent();if(!p)return true;
   d.points=[];d.drawing=true;d.cursor=p;appendStrokePoint(d.points,p);inputTarget.setPointerCapture?.(event.pointerId);drawCurvePreview(this);
  }else if(event.type==='pointermove'&&d.drawing){
   const p=pointFromEvent();if(p){d.cursor=p;appendStrokePoint(d.points,p);drawCurvePreview(this);}
  }else if(event.type==='pointerup'&&d.drawing){
   const p=pointFromEvent();appendStrokePoint(d.points,p);d.cursor=null;d.drawing=false;
   if(inputTarget.hasPointerCapture?.(event.pointerId))inputTarget.releasePointerCapture(event.pointerId);
   drawCurvePreview(this);
  }
  return true;
 }
 const st=this.faceDrawing;if(!st)return false;
 if(event.type==='pointerdown'){
  if(st.phase==='preview'){this.cancelSpatialDrawing();return true;} // click anywhere to dismiss an unconfirmed sketch
  if(event.button!==0)return true;
  const p=surfaceHit(this,event,true);if(!p){$('surfaceDrawStatus').textContent='Start drawing directly on the selected object face';return true;}
  st.start=p;st.end=p;inputTarget.setPointerCapture?.(event.pointerId);drawFacePreview(this);return true;
 }
 if(event.type==='pointermove'&&st.start&&st.phase==='drawing'){st.end=surfaceHit(this,event)||st.end;drawFacePreview(this);return true;}
 if(event.type==='pointerup'&&st.start&&st.phase==='drawing'){
  st.end=surfaceHit(this,event)||st.end;
  if(inputTarget.hasPointerCapture?.(event.pointerId))inputTarget.releasePointerCapture(event.pointerId);
  drawFacePreview(this);previewFace(this);return true;
 }
 return true;
}
export function cancelSpatialDrawing(){
 const face=this.faceDrawing;
 if(face?.previewGeometry){face.object.geometry=face.originalGeometry;face.previewGeometry.dispose();face.previewGeometry=null;face.originalGeometry=null;}
 this.curveDrawing=null;this.faceDrawing=null;disposePreview(this,'curvePreview');disposePreview(this,'facePreview');
 if($('spatialDrawShield'))$('spatialDrawShield').hidden=true;
 if($('curveDrawPanel'))$('curveDrawPanel').hidden=true;if($('surfaceDrawPanel'))$('surfaceDrawPanel').hidden=true;
 this.world.controls.enabled=true;
 if(this.selected&&this.canTransform(this.selected)&&this.selected.userData.editorKind!=='robot')this.transform.attach(this.selected);
}
function hideMediaPicker(editor){$('chatMediaPicker').hidden=true;editor.pendingSurfaceMount=null;editor.mediaPickerURLs?.forEach(url=>URL.revokeObjectURL(url));editor.mediaPickerURLs=[];}
export async function openChatMediaPicker(mount){
 const windowEl=$('chatMediaPicker'),grid=$('chatMediaResults');this.pendingSurfaceMount=mount;hideMediaPicker(this);this.pendingSurfaceMount=mount;grid.replaceChildren();windowEl.hidden=false;
 $('chatMediaSearch').value='';$('chatMediaStatus').textContent='Loading attachments posted to this realm…';
 const selectedRoom=window.solviRoom||'main';
 try{
  const response=await window.solviAPI.req('/api/media/room?room='+encodeURIComponent(selectedRoom));if(window.solviRoom!==selectedRoom||windowEl.hidden)return;
  const assets=(response.media||[]).filter(asset=>asset&&typeof asset.id==='string'&&/^(image|video|audio)\//.test(asset.mime||''));
  $('chatMediaStatus').textContent=assets.length?`${assets.length} media attachments · select a file`:'No chat media in this realm';
  for(const asset of assets){const card=document.createElement('button');card.type='button';card.className='chat-media-card';card.dataset.search=(asset.name+' '+asset.mime+' '+asset.author).toLowerCase();
   const thumb=document.createElement('span');thumb.className='chat-media-thumb';thumb.textContent=asset.mime.startsWith('audio/')?'Audio':asset.mime.startsWith('video/')?'Video':'Image';
   const label=document.createElement('span');label.className='chat-media-name';label.textContent=asset.name||asset.mime;card.append(thumb,label);grid.append(card);
   card.onclick=()=>{if(window.solviRoom!==selectedRoom)return hideMediaPicker(this);const target=this.items.find(o=>o.userData.editorId===mount.target);if(!target||!this.canEdit(target)){this.toast('Original surface is no longer editable');hideMediaPicker(this);return;}
    const media=this.addSceneMedia({...asset,author:asset.author},{backing:'white',width:asset.width||null,height:asset.height||null,shape:'speaker',mount});
    this.toast('Chat media mounted on '+target.name);hideMediaPicker(this);};
   if(asset.mime.startsWith('image/')&&this.mediaPickerURLs.length<80){window.solviAPI.mediaBlobInfo(asset.id).then(info=>{if(!card.isConnected||windowEl.hidden){URL.revokeObjectURL(info.url);return;}this.mediaPickerURLs.push(info.url);const image=document.createElement('img');image.alt='';image.loading='lazy';image.src=info.url;thumb.replaceChildren(image);}).catch(()=>{});}
  }
 }catch(error){if(!windowEl.hidden)$('chatMediaStatus').textContent='Media list failed: '+error.message;}
}
export function updateMountedMedia(){
 for(const media of this.items){if(media.userData.editorKind!=='media')continue;const mount=media.userData.media?.mount;if(!mount)continue;
  const target=this.items.find(o=>o.userData.editorId===mount.target);if(!target)continue;target.updateMatrixWorld(true);
  const local=v3(mount.localPoint),normal=v3(mount.localNormal).normalize();
  if(target.userData.editorKind==='cube') {
   const axis=surfaceAxis(normal),size=target.userData.primitive||{};
   local[axis]=(axis==='x'?size.width:axis==='y'?size.height:size.depth)/2*Math.sign(normal[axis]);
  }
  media.position.copy(target.localToWorld(local.addScaledVector(normal,.045)));
  const axis=surfaceAxis(normal),worldScale=target.getWorldScale(new THREE.Vector3());
  const u=axis==='x'?new THREE.Vector3(0,0,1):new THREE.Vector3(1,0,0);
  const v=axis==='y'?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
  const transformedNormal=normal.clone().transformDirection(target.matrixWorld);
  u.transformDirection(target.matrixWorld);v.transformDirection(target.matrixWorld);
  if(new THREE.Vector3().crossVectors(u,v).dot(transformedNormal)<0)u.negate();
  const basis=new THREE.Matrix4().makeBasis(u,v,transformedNormal);
  media.quaternion.setFromRotationMatrix(basis);
  const factorU=axis==='x'?worldScale.z:worldScale.x,factorV=axis==='y'?worldScale.z:worldScale.y;
  media.scale.set(mount.width*Math.abs(factorU),mount.height*Math.abs(factorV),1);
 }
}
