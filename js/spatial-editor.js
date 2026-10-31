import * as THREE from 'three';
import {cleanCurve,buildCurveGeometry} from './curve-geometry.js';
import {cleanOpenings,cutCubeGeometry,surfaceAxis,rectangleFromSurface} from './cube-openings.js';
import {hydrateSceneMedia} from './scene-media.js';
const $=id=>document.getElementById(id);
const v3=p=>new THREE.Vector3(...p);
const coordinates=(axis,u,v,side)=>axis==='x'?new THREE.Vector3(side,v,u):axis==='y'?new THREE.Vector3(u,side,v):new THREE.Vector3(u,v,side);
function disposePreview(editor,key){const mesh=editor[key];if(mesh){editor.world.scene.remove(mesh);mesh.traverse(n=>{n.geometry?.dispose?.();if(n.material){for(const m of Array.isArray(n.material)?n.material:[n.material])m.dispose?.();}});editor[key]=null;}}
function readCurve(editor){return cleanCurve(editor.selected?.userData?.curve);}
function rebuildCurve(editor,obj,params){const previous=obj.geometry;obj.geometry=buildCurveGeometry(params);previous?.dispose();obj.userData.curve=cleanCurve(params);editor.physics.sync(obj);}
export function setupSpatialTools(){
 $('curveDrawCancel').onclick=()=>this.cancelSpatialDrawing();
 $('curveDrawUndo').onclick=()=>{if(this.curveDrawing?.points.length){this.curveDrawing.points.pop();drawCurvePreview(this);}};
 $('curveDrawSave').onclick=()=>finishCurve(this);
 $('curveDepth').oninput=()=>{if(this.curveDrawing)drawCurvePreview(this);};
 $('curveElevation').oninput=()=>{if(this.curveDrawing)drawCurvePreview(this);};
 $('surfaceCancel').onclick=()=>this.cancelSpatialDrawing();
 $('chatMediaClose').onclick=()=>hideMediaPicker(this);
 $('chatMediaSearch').oninput=()=>{for(const node of $('chatMediaResults').children)node.hidden=!node.dataset.search.includes($('chatMediaSearch').value.toLowerCase());};
 window.addEventListener('keydown',e=>{
  if(!this.curveDrawing||e.target?.closest?.('input,select,textarea,[contenteditable]'))return;
  if(e.key==='Escape'){e.preventDefault();this.cancelSpatialDrawing();}
  if(e.key==='Enter'){e.preventDefault();finishCurve(this);}
  if(e.key==='Backspace'){e.preventDefault();this.curveDrawing.points.pop();drawCurvePreview(this);}
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
 $('curveEditPoints').onclick=()=>{if(this.selected===obj&&this.canEdit(obj))this.startCurveDrawing(obj);};
 $('curvePointCount').textContent=readCurve(this).points.length+' control points';sync();
}
export function startCurveDrawing(existing=null){
 this.cancelSpatialDrawing();const obj=existing?.userData.editorKind==='curve'?existing:null;
 const points=obj?cleanCurve(obj.userData.curve).points.map(p=>obj.localToWorld(v3(p)).toArray()):[];
 this.curveDrawing={object:obj,points,cursor:null};$('curveDrawPanel').hidden=false;$('addMenu').hidden=true;this.world.controls.enabled=false;
 $('curveDrawingStatus').textContent=obj?'Editing existing curve control points · click to add':'Click in 3D view to place points; change depth or elevation per point';drawCurvePreview(this);
}
function drawCurvePreview(editor){
 disposePreview(editor,'curvePreview');const d=editor.curveDrawing;if(!d)return;
 const group=new THREE.Group(),pts=d.points.map(v3);
 if(d.cursor)pts.push(d.cursor.clone());
 if(pts.length>=2){const path=new THREE.CatmullRomCurve3(pts);const g=new THREE.TubeGeometry(path,Math.min(160,Math.max(16,pts.length*10)),.018,5,false);group.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:'#6ee9fc',depthTest:false,transparent:true,opacity:.85})));}
 for(const p of d.points)group.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),new THREE.MeshBasicMaterial({color:'#e6f2ff',depthTest:false})),{position:v3(p)}));
 if(d.cursor){const dot=new THREE.Mesh(new THREE.SphereGeometry(.085,8,6),new THREE.MeshBasicMaterial({color:'#58edff',depthTest:false}));dot.position.copy(d.cursor);group.add(dot);}
 group.name='3D curve sketch · unsaved';editor.curvePreview=group;editor.world.scene.add(group);$('curveDrawingStatus').textContent=d.points.length+' points · Enter or Save to finish';$('curveDrawSave').disabled=d.points.length<2;
}
function finishCurve(editor){const state=editor.curveDrawing;if(!state||state.points.length<2)return;
 const obj=state.object||editor.add('curve',false);if(!obj)return;
 const before=state.object?editor.snapshot(obj):null;
 const origin=state.object?obj.position.clone():v3(state.points[0]);
 const pts=state.points.map(p=>obj===state.object?obj.worldToLocal(v3(p)).toArray():v3(p).sub(origin).toArray());
 if(!state.object)obj.position.copy(origin);
 const next=cleanCurve({...obj.userData.curve,points:pts});rebuildCurve(editor,obj,next);
 if(!state.object)obj.name='3D Curve';
 editor.cancelSpatialDrawing();editor.select(obj);editor.refreshList();editor.recordEdit(before,editor.snapshot(obj));editor.queueSave(obj);editor.curveUIObject=null;editor.renderCurveControls(obj);editor.toast('3D curve saved');
}
export function startFaceDrawing(mode){
 const obj=this.selected;
 if(!obj||!this.canEdit(obj)||!['cube','plane'].includes(obj.userData.editorKind)||(mode==='opening'&&obj.userData.editorKind!=='cube'))return this.toast('Choose an editable cube for a cutout, or cube/plane for media');
 this.cancelSpatialDrawing();this.faceDrawing={mode,object:obj,start:null,end:null,axis:null,side:null};$('surfaceDrawPanel').hidden=false;
 $('surfaceDrawTitle').textContent=mode==='opening'?'Cut rectangular opening · O':'Attach chat media · U';$('surfaceDrawStatus').textContent='Drag a rectangle on a flat face of '+obj.name;this.transform.detach();this.world.controls.enabled=false;
}
function surfaceHit(editor,e,first=false){
 const state=editor.faceDrawing,obj=state.object,rect=editor.world.renderer.domElement.getBoundingClientRect();
 editor.pointer.set((e.clientX-rect.left)/rect.width*2,1-(e.clientY-rect.top)/rect.height*2);editor.raycaster.setFromCamera(editor.pointer,editor.world.camera);
 if(first){const hit=editor.raycaster.intersectObject(obj,false)[0];if(!hit||!hit.face)return null;const normal=hit.face.normal.clone().normalize();state.axis=surfaceAxis(normal);state.side=Math.sign(normal[state.axis])||1;return obj.worldToLocal(hit.point.clone());}
 if(!state.start)return null;
 obj.updateMatrixWorld(true);const size=obj.userData.primitive||{},axis=state.axis,side=state.side;const bound=axis==='x'?(Number(size.width)||1)/2:axis==='y'?(Number(size.height)||1)/2:obj.userData.editorKind==='plane'?0:(Number(size.depth)||1)/2;
 const n=new THREE.Vector3(axis==='x'?side:0,axis==='y'?side:0,axis==='z'?side:0).transformDirection(obj.matrixWorld);
 const facePoint=obj.localToWorld(new THREE.Vector3(axis==='x'?bound*side:0,axis==='y'?bound*side:0,axis==='z'?bound*side:0));
 const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(n,facePoint),point=new THREE.Vector3();if(!editor.raycaster.ray.intersectPlane(plane,point))return null;return obj.worldToLocal(point);
}
function drawFacePreview(editor){
 disposePreview(editor,'facePreview');const st=editor.faceDrawing;if(!st?.start||!st?.end)return;
 const axis=st.axis,a=st.start,b=st.end,side=st.side,obj=st.object;
 const uvA=axis==='x'?[a.z,a.y]:axis==='y'?[a.x,a.z]:[a.x,a.y],uvB=axis==='x'?[b.z,b.y]:axis==='y'?[b.x,b.z]:[b.x,b.y];
 const [loU,hiU]=[Math.min(uvA[0],uvB[0]),Math.max(uvA[0],uvB[0])],[loV,hiV]=[Math.min(uvA[1],uvB[1]),Math.max(uvA[1],uvB[1])];
 const pt=(u,v)=>obj.localToWorld(coordinates(axis,u,v,axis==='x'?(obj.userData.primitive?.width||1)/2*side:axis==='y'?(obj.userData.primitive?.height||1)/2*side:obj.userData.editorKind==='plane'?0:(obj.userData.primitive?.depth||1)/2*side).addScaledVector(new THREE.Vector3(axis==='x'?side:0,axis==='y'?side:0,axis==='z'?side:0),.024));
 const points=[pt(loU,loV),pt(hiU,loV),pt(hiU,hiV),pt(loU,hiV),pt(loU,loV)];const g=new THREE.BufferGeometry().setFromPoints(points);
 const line=new THREE.Line(g,new THREE.LineBasicMaterial({color:st.mode==='opening'?'#ffcf67':'#62f3ff',depthTest:false,transparent:true,opacity:1}));line.renderOrder=999;editor.facePreview=line;editor.world.scene.add(line);
}
export function spatialPointer(event){
 const canvas=this.world.renderer.domElement;if(!canvas.contains(event.target))return false;
 if(this.curveDrawing){
  if(!['pointerdown','pointermove'].includes(event.type))return true;
  const rect=canvas.getBoundingClientRect();this.pointer.set((event.clientX-rect.left)/rect.width*2,1-(event.clientY-rect.top)/rect.height*2);this.raycaster.setFromCamera(this.pointer,this.world.camera);
  const d=Math.max(1,Math.min(30,Number($('curveDepth').value)||4)),elev=Number($('curveElevation').value)||0;
  const point=this.raycaster.ray.at(d,new THREE.Vector3());point.y+=elev;
  if(event.type==='pointerdown'){if(this.curveDrawing.points.length<120)this.curveDrawing.points.push(point.toArray());}else this.curveDrawing.cursor=point;
  drawCurvePreview(this);return true;
 }
 const state=this.faceDrawing;if(!state)return false;
 if(event.type==='pointerdown'){
  const p=surfaceHit(this,event,true);if(!p)return true;state.start=p;state.end=p;drawFacePreview(this);return true;
 }
 if(event.type==='pointermove'){if(state.start){state.end=surfaceHit(this,event)||state.end;drawFacePreview(this);}return true;}
 if(event.type==='pointerup'&&state.start){state.end=surfaceHit(this,event)||state.end;finishFace(this);return true;}
 return true;
}
function finishFace(editor){const st=editor.faceDrawing;if(!st)return;const obj=st.object;
 const rect=rectangleFromSurface(st.axis,st.start,st.end);
 if(rect.width<.12||rect.height<.12){$('surfaceDrawStatus').textContent='Drag at least 12 cm in each direction';return;}
 // Clamp the rectangle to the source face so opening geometry cannot extend beyond the object.
 const p=obj.userData.primitive||{},axes=st.axis==='x'?['depth','height']:st.axis==='y'?['width','depth']:['width','height'];
 const sizes=axes.map(key=>Number(p[key])||1);
 rect.width=Math.max(.1,Math.min(rect.width,sizes[0]-.04));rect.height=Math.max(.1,Math.min(rect.height,sizes[1]-.04));
 rect.u=Math.max(-sizes[0]/2+rect.width/2+.01,Math.min(sizes[0]/2-rect.width/2-.01,rect.u));rect.v=Math.max(-sizes[1]/2+rect.height/2+.01,Math.min(sizes[1]/2-rect.height/2-.01,rect.v));
 if(st.mode==='opening'){
  const before=editor.snapshot(obj),holes=cleanOpenings([...obj.userData.openings||[],rect]);if(holes.length>(obj.userData.openings?.length||0)){
   const old=obj.geometry;obj.geometry=cutCubeGeometry(obj.userData.primitive,holes);old.dispose();obj.userData.openings=holes;
   // A box collider would block the window; use an exact static trimesh.
   obj.userData.physics={...obj.userData.physics,mode:'static',collider:'trimesh'};editor.physics.sync(obj);editor.recordEdit(before,editor.snapshot(obj));editor.queueSave(obj);
   editor.toast('Through-opening cut · static trimesh collider');
  }editor.cancelSpatialDrawing();editor.select(obj);return;
 }
 const local=coordinates(st.axis,rect.u,rect.v,st.axis==='x'?(p.width||1)/2*st.side:st.axis==='y'?(p.height||1)/2*st.side:obj.userData.editorKind==='plane'?0:(p.depth||1)/2*st.side);
 const normal=new THREE.Vector3(st.axis==='x'?st.side:0,st.axis==='y'?st.side:0,st.axis==='z'?st.side:0);
 st.mount={target:obj.userData.editorId,localPoint:local.toArray(),localNormal:normal.toArray(),width:rect.width,height:rect.height};
 editor.openChatMediaPicker(st.mount);editor.faceDrawing=null;$('surfaceDrawPanel').hidden=true;disposePreview(editor,'facePreview');editor.world.controls.enabled=true;
}
export function cancelSpatialDrawing(){
 this.curveDrawing=null;this.faceDrawing=null;disposePreview(this,'curvePreview');disposePreview(this,'facePreview');
 if($('curveDrawPanel'))$('curveDrawPanel').hidden=true;if($('surfaceDrawPanel'))$('surfaceDrawPanel').hidden=true;
 this.world.controls.enabled=true;
 if(this.selected&&this.canTransform(this.selected)&&this.selected.userData.editorKind!=='robot')this.transform.attach(this.selected);
}
function hideMediaPicker(editor){$('chatMediaPicker').hidden=true;editor.mediaPickerURLs?.forEach(url=>URL.revokeObjectURL(url));editor.mediaPickerURLs=[];}
export async function openChatMediaPicker(mount){
 const windowEl=$('chatMediaPicker'),grid=$('chatMediaResults');this.pendingSurfaceMount=mount;grid.replaceChildren();windowEl.hidden=false;
 $('chatMediaSearch').value='';$('chatMediaStatus').textContent='Loading attachments posted to this realm…';
 try{
  const response=await window.solviAPI.req('/api/media/room?room='+encodeURIComponent(window.solviRoom||'main'));const assets=response.media||[];
  $('chatMediaStatus').textContent=assets.length?`${assets.length} media attachments · select a file`:'No chat media in this realm';
  for(const asset of assets){const card=document.createElement('button');card.type='button';card.className='chat-media-card';card.dataset.search=(asset.name+' '+asset.mime+' '+asset.author).toLowerCase();
   const thumb=document.createElement('span');thumb.className='chat-media-thumb';thumb.textContent=asset.mime.startsWith('audio/')?'Audio':asset.mime.startsWith('video/')?'Video':'Image';
   const label=document.createElement('span');label.className='chat-media-name';label.textContent=asset.name||asset.mime;card.append(thumb,label);grid.append(card);
   card.onclick=()=>{const target=this.items.find(o=>o.userData.editorId===mount.target);if(!target||!this.canEdit(target)){this.toast('Original surface is no longer editable');hideMediaPicker(this);return;}
    const media=this.addSceneMedia({...asset,author:asset.author},{backing:'white',width:asset.width||null,height:asset.height||null,shape:'speaker'});
    media.userData.media.mount=structuredClone(mount);media.scale.set(mount.width,mount.height,1);media.userData.physics={mode:'off'};
    this.updateMountedMedia();this.physics.sync(media);this.queueSave(media);hideMediaPicker(this);this.toast('Chat media attached to '+target.name);};
   if(asset.mime.startsWith('image/')&&this.mediaPickerURLs.length<80){window.solviAPI.mediaBlobInfo(asset.id).then(info=>{if(!card.isConnected){URL.revokeObjectURL(info.url);return;}this.mediaPickerURLs.push(info.url);const image=document.createElement('img');image.alt='';image.loading='lazy';image.src=info.url;thumb.replaceChildren(image);}).catch(()=>{});}
  }
 }catch(error){$('chatMediaStatus').textContent='Media list failed: '+error.message;}
}
export function updateMountedMedia(){
 for(const media of this.items){if(media.userData.editorKind!=='media')continue;const mount=media.userData.media?.mount;if(!mount)continue;
  const target=this.items.find(o=>o.userData.editorId===mount.target);if(!target)continue;
  const local=v3(mount.localPoint),normal=v3(mount.localNormal).normalize();
  if(target.userData.editorKind==='cube') {
   const axis=surfaceAxis(normal),size=target.userData.primitive||{};
   local[axis]=(axis==='x'?size.width:axis==='y'?size.height:size.depth)/2*Math.sign(normal[axis]);
  }
  media.position.copy(target.localToWorld(local.addScaledVector(normal,.045)));
  // Face-local U/V axes preserve the rectangle aspect even on non-uniformly scaled objects.
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
