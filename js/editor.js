import {airStep,autoRunAfterHold} from './robot-air-control.js';
import {confirmAction} from './app-dialogs.js';
import * as THREE from 'three';
import {setupAvatarGallery} from './avatar-gallery.js';
import {setupAssetGallery} from './asset-gallery.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {EditHistory,duplicateElevation,nextDuplicateName} from './edit-history.js';
import {makeRobot,hydrateRobot,robotAction,tickRobots,animateRobots,setRobotDestination,interruptRobotMission,resolveAvatarPath,DEFAULT_ROBOT_AVATAR} from './robots.js';
import {intent,active,packetFor,stepRobotMotion,signedAngle,makeRemoteCorrection,applyRemoteCorrection} from './robot-net.js';
import {makeSceneModel,hydrateSceneModel,invalidateSceneModel,configureSceneModelRenderer,isSceneModelURL,loadSceneAsset} from './scene-models.js';
import {makeSceneMedia,hydrateSceneMedia,disposeSceneMedia,setSceneMediaBacking,toggleSceneMediaPlayback,setSceneMediaMuted,setSceneMediaLoop,setSceneMediaSpatial,syncSceneMediaGroup,sceneMediaMuted,sceneMediaPlaying,sceneMediaKind,showSceneMediaCaptions} from './scene-media.js';
import {ScenePhysics} from './scene-physics.js';
import {PRIMITIVE_FIELDS,sanitisePrimitive,buildPrimitive} from './primitive-properties.js';
import {makeOfficeWall,rebuildOfficeWall,sanitiseWall,simplifyWallPoints,smoothWallPoints,snapWallPoint,wallWorldToLocal,wallSegments,wallPresetTexture} from './office-walls.js';
import {makeOfficeStairs,rebuildOfficeStairs,sanitiseStairs,stairSegments} from './office-stairs.js';
import {tickStairTransport,startLift} from './stair-transport.js';
import {stairGeometryKey} from './stair-extensions.js';
import {planRobotPath,pathBlocked,planRobotApproach,planRobotPartialApproach} from './robot-pathfinding.js';
import {updateRobotPathDebug,trackRobotPathDebug,clearRobotPathDebug,finishRobotPathDebug,clearAllRobotPathDebug} from './robot-path-visuals.js';
import {robotPathVisible} from './robot-debug.js';
import {plannedRouteLength,newMovementTelemetry,sampleMovementTelemetry,missionMovementEvidence,shouldRejectClaimedArrival} from './robot-telemetry.js';
import {physicsOptions} from './physics-options.js';
import {combatSettings,combatForKey,combatClip,combatTimeline,COMBAT_ACTIONS} from './robot-combat.js';
import {animationSpeedSettings} from './animation-tuning.js';
import {isTransformLocked,mayTransform} from './transform-lock.js';
import {OrbitGesture,recoverStaleOrbitPointers} from './orbit-gesture.js';
import {readPreferences} from './preferences.js';
import {sliderToScale,scaleToSlider,linkedScale} from './transform-values.js';
import {cleanCurve,buildCurveGeometry} from './curve-geometry.js';
import {makeEditableText,rebuildText} from './text-geometry.js';
import {cleanText} from './text-parameters.js';
import {cleanOpenings,cutCubeGeometry,surfaceAxis,rectangleFromSurface} from './cube-openings.js';
import {setupSpatialTools,renderCurveControls,startCurveDrawing,startFaceDrawing,spatialPointer,cancelSpatialDrawing,openChatMediaPicker,updateMountedMedia} from './spatial-editor.js';

const kinds=['cube','sphere','cylinder','plane','torus','curve','surface','text','points','light','robot','model','media','wall','stairs'];
const byId=id=>document.getElementById(id);
const material=(color='#8bc3ff')=>new THREE.MeshStandardMaterial({color,roughness:.7,side:THREE.DoubleSide});
const xyz=v=>[+v.x.toFixed(4),+v.y.toFixed(4),+v.z.toFixed(4)];
const makeTexture=(kind)=>{
 if(['concrete','bricks'].includes(kind))return wallPresetTexture(kind);
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
 if(kind==='checker'){ctx.fillStyle='#dae7ef';ctx.fillRect(0,0,256,256);ctx.fillStyle='#748b9d';for(let x=0;x<4;x++)for(let y=0;y<4;y++)if((x+y)%2)ctx.fillRect(x*64,y*64,64,64);}
 else if(kind==='gradient'){const g=ctx.createLinearGradient(0,0,256,256);g.addColorStop(0,'#79d2c1');g.addColorStop(1,'#4c568d');ctx.fillStyle=g;ctx.fillRect(0,0,256,256);}
 else if(kind==='stripes'){ctx.fillStyle='#eee1b6';ctx.fillRect(0,0,256,256);ctx.fillStyle='#526e81';for(let x=-256;x<512;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+55,0);ctx.lineTo(x+310,256);ctx.lineTo(x+255,256);ctx.fill();}}
 else if(kind==='dots'){ctx.fillStyle='#122438';ctx.fillRect(0,0,256,256);ctx.fillStyle='#b3dbe7';for(let x=20;x<256;x+=42)for(let y=20;y<256;y+=42){ctx.beginPath();ctx.arc(x,y,8,0,7);ctx.fill();}}
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
};

function objectFor(kind){
 let object;
 switch(kind){
 case 'cube':object=new THREE.Mesh(new THREE.BoxGeometry(),material());break;
 case 'sphere':object=new THREE.Mesh(new THREE.SphereGeometry(.55,28,18),material());break;
 case 'cylinder':object=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,1.2,32),material());break;
 case 'plane':object=new THREE.Mesh(new THREE.PlaneGeometry(1.7,1.7),material());object.rotation.x=-Math.PI/2;break;
 case 'torus':object=new THREE.Mesh(new THREE.TorusGeometry(.52,.17,15,40),material());break;
 case 'surface':object=new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0,0),new THREE.Vector2(.38,.12),new THREE.Vector2(.48,.48),new THREE.Vector2(.14,1.1)],32),material());break;
 case 'curve':object=new THREE.Mesh(buildCurveGeometry(),material());object.userData.curve=cleanCurve();break;
 case 'points':{const coords=[];for(let i=0;i<95;i++)coords.push((Math.random()-.5)*1.4,Math.random()*1.2,(Math.random()-.5)*1.4);const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));object=new THREE.Points(geo,new THREE.PointsMaterial({color:'#88e1d5',size:.07}));break;}
 case 'text':object=makeEditableText();break;
 case 'robot':object=makeRobot();break;
 case 'model':object=makeSceneModel();break;
 case 'wall':object=makeOfficeWall();break;
 case 'stairs':object=makeOfficeStairs();break;
 case 'media':object=makeSceneMedia();break;
 case 'light':{object=new THREE.Group();const icon=new THREE.Mesh(new THREE.SphereGeometry(.125,12,8),new THREE.MeshBasicMaterial({color:'#ffe3a2',depthTest:false}));icon.userData.lightMarker=true;object.add(icon);setLight(object,{type:'point',intensity:2,range:10,decay:2,color:'#d0efff'});break;}
 default:throw Error('Unsupported kind');
 }
 object.name='New '+kind;object.userData.editorKind=kind;object.userData.editorId=crypto.randomUUID();
 if(kind==='light')object.position.set(0,2.2,0);else object.position.set(0,kind==='plane'?.015:kind==='robot'?0:.8,0);
 object.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 return object;
}


export const LIGHT_TYPES=['point','spot','directional','ambient','hemisphere'];
export function cleanLightSettings(config={}){
 const type=LIGHT_TYPES.includes(config.type)?config.type:'point';
 const n=(key,def,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(config[key]))?Number(config[key]):def));
 const color=(s,fallback)=>typeof s==='string'&&/^#[0-9a-f]{6}$/i.test(s)?s:fallback;
 return {type,intensity:n('intensity',2,0,50),range:n('range',10,0,100),decay:n('decay',2,0,3),angle:n('angle',35,1,89),penumbra:n('penumbra',.2,0,1),color:color(config.color,'#d0efff'),groundColor:color(config.groundColor,'#46566d')};
}
export function setLight(group,settings){
 const d=cleanLightSettings(settings);
 for(const node of [...group.children])if(node.isLight||node.userData.lightTarget){group.remove(node);node.dispose?.();}
 let light;
 switch(d.type){
  case 'spot':light=new THREE.SpotLight(d.color,d.intensity,d.range,THREE.MathUtils.degToRad(d.angle),d.penumbra,d.decay);light.target.position.set(0,-1,-.1);light.target.userData.lightTarget=true;group.add(light.target);break;
  case 'directional':light=new THREE.DirectionalLight(d.color,d.intensity);light.target.position.set(0,-1,-.1);light.target.userData.lightTarget=true;group.add(light.target);break;
  case 'ambient':light=new THREE.AmbientLight(d.color,d.intensity);break;
  case 'hemisphere':light=new THREE.HemisphereLight(d.color,d.groundColor,d.intensity);break;
  default:light=new THREE.PointLight(d.color,d.intensity,d.range,d.decay);
 }
 light.userData.editorLight=true;group.add(light);group.userData.light=d;
 const marker=group.children.find(c=>c.userData.lightMarker);if(marker)marker.material.color.set(d.color);
 return light;
}

function readDeleteConfirmation(){return readPreferences().deleteConfirm!==false;}
export class SceneEditor{
 constructor(world,onToast){
  this.world=world;this.toast=onToast;configureSceneModelRenderer(world.renderer);this.physics=new ScenePhysics(this);this.items=[];this.selected=null;this.revision=0;this.controlMode='scene';this.controlledRobotId=null;
  this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();
  this.history=new EditHistory(120);this.transformBefore=null;
  this.transform=new TransformControls(world.camera,world.renderer.domElement);
  // Recent Three.js exposes TransformControls as an Object3D wrapper plus a helper gizmo.
  world.scene.add(this.transform.getHelper());
  this.transform.addEventListener('dragging-changed',e=>{
   world.editorDragging=Boolean(e.value);
   if(e.value){world.editorGizmoPointer=true;world.controls.enabled=false;}
   else{world.editorGizmoPointer=false;world.cameraOrbitGesture=null;world.controls.enabled=true;}
  });
  this.transform.addEventListener('mouseDown',()=>{this.broadcastEdit(true);this.transformBefore=this.snapshot(this.selected);world.editorDragging=true;world.editorGizmoPointer=true;world.controls.enabled=false;});
  this.transform.addEventListener('mouseUp',()=>{this.broadcastEdit(false);world.editorDragging=false;this.physics.sync(this.selected);this.recordEdit(this.transformBefore,this.snapshot(this.selected));this.transformBefore=null;});
  this.transform.addEventListener('objectChange',()=>{if(!this.canTransform(this.selected))return;if(this.transform.mode==='scale'&&this.selected?.userData.editorKind!=='robot'&&performance.now()-(this.lastScaleColliderSync||0)>180){this.physics.sync(this.selected);this.lastScaleColliderSync=performance.now();}this.updateInspector();this.queueSave(this.selected);});
  window.addEventListener('solvi:robot-model-ready',e=>{if(this.selected?.userData.editorId===e.detail.id)this.updateInspector();});
  this.curveDrawing=null;this.curvePreview=null;this.faceDrawing=null;this.facePreview=null;this.mediaPickerURLs=[];
  this.wallDrawing=null;this.wallPreview=null;this.wallEditTarget=null;this.wallEditOriginal=null;this.wallTextureMediaId="";this.wallSessionHistory=new EditHistory(120);this.wallStateLast=null;this.wallRestoring=false;this.wallPreviewCustom=null;this.wallPreviewTextureId='';this.wallPreviewTextureReq=0;
  this.bulkChecked=new Set();this.editMarkers=new Map();this.lastEditPing=0;this.lightHelper=null;this.setupUI();this.events();this.refreshList();this.avatarGallery=setupAvatarGallery(this);this.assetGallery=setupAssetGallery(this);window.solviEditor=this;world.robotEditor=this;this.pendingSaves=new Map();this.robotKeys=new Set();this.localRobotInput=null;this.lastRobotPacket=0;this.robotPacketSeq=0;this.robotActionSeq=0;this.lastRobotCombat=0;this.remoteActionSequences=new Map();this.remoteInput=new Map();this.remoteCorrections=new Map();this.remoteSequences=new Map();
  window.addEventListener('solvi:robot-task-update',event=>{const detail=event.detail||{},id=detail.robotId;const robot=this.items.find(o=>o.userData.editorId===id);
    if(robot){const audit=missionMovementEvidence(robot.userData.robotTelemetry,robot,robot.userData.robotDebugRoute,detail.status);
      if(audit){detail.routeTelemetry=audit;if(shouldRejectClaimedArrival(audit,detail.status))detail.status='failed';}
      robot.userData.robotTelemetry=null;}
    if(id&&['arrived','partial','failed','blocked','sitting','procedural-sitting','coffee-visit'].includes(detail.status)){finishRobotPathDebug(this.world,id);if(robot?.userData?.robotDebugRoute)robot.userData.robotDebugRoute.finished=true;this.updateRobotDebugStatus?.();}});
 }
 setupUI(){
  const menu=byId('addMenu');menu.hidden=true; // Never auto-open: Shift+A or Add button only.
  const groups=[['Geometry',['cube','sphere','cylinder','plane','torus']],['Office Space',['walls','closed room','stairs','stairs advanced','escalator','moving walkway','lift']],['Curves / surfaces',['curve','draw curve in 3d','surface']],['Text / points',['text','points']],['Media surfaces',['media frame']],['Robots',['robot']],['3D Model · GLB / FBX',['add 3D model']],['Lighting',['point light','spot light','directional light','ambient light','hemisphere light']]];
  menu.replaceChildren();const bar=document.createElement('div');bar.className='drag-handle add-drag';bar.textContent='Add object · Shift+A';const head=document.createElement('div');head.className='add-fixed-head';head.append(bar);const content=document.createElement('div');content.className='add-scroll-content';menu.append(head,content);const search=document.createElement('input');search.id='addSearch';search.placeholder='Search / Enter to add';search.autocomplete='off';search.className='add-search';head.append(search);
  search.addEventListener('keydown',event=>{if(event.key==='Enter'){const first=menu.querySelector('.add-group button:not([hidden])');if(first){event.preventDefault();first.click();}}if(event.key==='Escape')menu.hidden=true;});
  search.addEventListener('input',()=>{for(const button of menu.querySelectorAll('.add-group button'))button.hidden=!button.textContent.toLowerCase().includes(search.value.trim().toLowerCase());});
  for(const [label,options] of groups){const group=document.createElement('div');group.className='add-group';const strong=document.createElement('strong');strong.textContent=label;group.append(strong);
   for(const k of options){const button=document.createElement('button');button.textContent=k[0].toUpperCase()+k.slice(1);button.dataset.objectKind=k;button.onclick=()=>{if(k==='add 3D model'){menu.hidden=true;byId('modelImportFile').click();}else if(k==='media frame'){this.add('media');}else if(k==='walls'){this.startWallDrawing('wall');}else if(k==='closed room'){this.startWallDrawing('wall',true);}else if(k==='stairs'){this.startWallDrawing('stairs');}else if(k==='stairs advanced'){this.startWallDrawing('stairs',false,'advanced');}else if(k==='escalator'){this.startWallDrawing('stairs',false,'escalator');}else if(k==='moving walkway'){this.startWallDrawing('stairs',false,'walkway');}else if(k==='lift'){this.addLift();}else if(k==='draw curve in 3d'){this.startCurveDrawing();}else this.add(k.endsWith(' light')?'light':k,true,k.endsWith(' light')?k.split(' ')[0]:undefined);};group.append(button);}content.append(group);}
  this.setupWallControls();this.setupSpatialTools();this.setupTextGeometryControls();
  const toolbox=byId('toolboxActions');for(const id of ['addObjectButton','objectsButton','avatarsButton','assetsButton'])toolbox.append(byId(id));
  byId('importModelButton').onclick=()=>byId('modelImportFile').click();byId('quickModelImport').onclick=()=>byId('modelImportFile').click();
  byId('modelImportFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(f)await this.importModel(f);e.target.value='';});
  byId('replaceModelGallery').onclick=()=>{const model=this.selected;if(model?.userData.editorKind==='model'&&this.canEdit(model))this.assetGallery.open({replace:model});};
  byId('replaceModelFile').onclick=()=>{if(this.selected?.userData.editorKind==='model'&&this.canEdit(this.selected))byId('replaceModelInput').click();};
  byId('mediaChooseSpeakerModel').onclick=()=>{if(this.selected?.userData.editorKind!=='media'||!this.canEdit(this.selected))return;this.assetGallery?.open({replace:this.selected});};
  byId('mediaPlayPause').onclick=()=>{if(this.selected?.userData.editorKind!=='media')return;const playing=toggleSceneMediaPlayback(this.selected);byId('mediaPlayPause').textContent=playing?'Pause':'Play';};
  byId('mediaMuteToggle').onclick=()=>{if(this.selected?.userData.editorKind!=='media')return;const next=!sceneMediaMuted(this.selected);setSceneMediaMuted(this.selected,next);byId('mediaMuteToggle').textContent=next?'Unmute':'Mute';};
  byId('mediaBacking').onchange=()=>{if(this.selected?.userData.editorKind!=='media'||!this.canEdit(this.selected))return;setSceneMediaBacking(this.selected,byId('mediaBacking').value,this.world);this.queueSave(this.selected);};
  byId('mediaStreamMode').onchange=()=>{if(this.selected?.userData.editorKind!=='media'||!this.canEdit(this.selected))return;this.selected.userData.media.stream=byId('mediaStreamMode').value;hydrateSceneMedia(this.selected,this.world);this.queueSave(this.selected);};
  byId('mediaLoopToggle').onchange=()=>{if(this.selected?.userData.editorKind!=='media'||!this.canEdit(this.selected))return;setSceneMediaLoop(this.selected,byId('mediaLoopToggle').checked);this.queueSave(this.selected);this.updateInspector();};
  byId('mediaRefDistance').onchange=()=>{if(this.selected?.userData.editorKind!=='media'||!this.canEdit(this.selected))return;setSceneMediaSpatial(this.selected,{refDistance:byId('mediaRefDistance').value});this.queueSave(this.selected);};
  byId('mediaMaxDistance').onchange=()=>{if(this.selected?.userData.editorKind!=='media'||!this.canEdit(this.selected))return;setSceneMediaSpatial(this.selected,{maxDistance:byId('mediaMaxDistance').value});this.queueSave(this.selected);};
  byId('mediaAutoplayDistance').onchange=()=>{if(this.selected?.userData.editorKind!=='media'||!this.canEdit(this.selected))return;setSceneMediaSpatial(this.selected,{autoplayDistance:byId('mediaAutoplayDistance').value});this.queueSave(this.selected);};
  byId('mediaConstantVolume').onchange=()=>{if(this.selected?.userData.editorKind!=='media'||!this.canEdit(this.selected))return;setSceneMediaSpatial(this.selected,{constantVolume:byId('mediaConstantVolume').checked});this.queueSave(this.selected);};
  byId('mediaVolume').oninput=()=>{if(this.selected?.userData.editorKind!=='media'||!this.canEdit(this.selected))return;setSceneMediaSpatial(this.selected,{volume:byId('mediaVolume').value});this.queueSave(this.selected);};
  byId('mediaGroup').onchange=()=>{if(this.selected?.userData.editorKind!=='media'||!this.canEdit(this.selected))return;setSceneMediaSpatial(this.selected,{group:byId('mediaGroup').value});this.queueSave(this.selected);};
  byId('mediaSyncGroup').onclick=()=>{if(this.selected?.userData.editorKind!=='media')return;const count=syncSceneMediaGroup(this.selected);byId('mediaSyncStatus').textContent=count?`Synced ${count} source${count===1?'':'s'}.`:'Set a shared group first.';};
  byId('mediaHudPlay')?.addEventListener('click',()=>{if(this.selected?.userData.editorKind!=='media')return;toggleSceneMediaPlayback(this.selected);this.updateInspector();});
  byId('mediaHudCC')?.addEventListener('click',async()=>{const obj=this.selected;if(obj?.userData.editorKind!=='media')return;const media=obj.userData.media;try{let caption=media.caption;if(!caption){const response=await window.solviAPI.req('/api/media/'+encodeURIComponent(media.id)+'/caption');caption=response.text||'';}if(!caption){this.toast('No transcription yet. Select Transcribe in Properties.');return;}obj.userData.captionVisible=!obj.userData.captionVisible;showSceneMediaCaptions(obj,this.world,caption,obj.userData.captionVisible);}catch(e){this.toast(e.message);}});
  byId('mediaTranscribe')?.addEventListener('click',async()=>{const obj=this.selected;if(obj?.userData.editorKind!=='media')return;const button=byId('mediaTranscribe');button.disabled=true;try{const result=await window.solviAPI.req('/api/media/'+encodeURIComponent(obj.userData.media.id)+'/caption',{method:'POST'});obj.userData.media.caption=result.text||'';this.queueSave(obj);byId('mediaTranscriptText').textContent=result.text||'No speech detected';}catch(e){this.toast(e.message);}finally{button.disabled=false;}});
  byId('mediaOrbColor')?.addEventListener('input',e=>{const obj=this.selected;if(!obj||!this.canEdit(obj))return;obj.userData.media.color=e.target.value;if(obj.material?.color)obj.material.color.set(e.target.value);this.queueSave(obj);});
  byId('mediaOrbTexture')?.addEventListener('change',e=>{const obj=this.selected;if(!obj||!this.canEdit(obj))return;const mat=Array.isArray(obj.material)?obj.material[4]:obj.material;if(!mat)return;mat.map?.dispose?.();mat.map=e.target.value==='none'?null:makeTexture(e.target.value);mat.needsUpdate=true;obj.userData.media.orbTexture=e.target.value;this.queueSave(obj);});
  byId('mediaHudMute')?.addEventListener('click',()=>{if(this.selected?.userData.editorKind!=='media')return;setSceneMediaMuted(this.selected,!sceneMediaMuted(this.selected));this.updateInspector();});
  byId('replaceModelInput').onchange=async e=>{const file=e.target.files?.[0],model=this.selected;e.target.value='';if(file&&model?.userData.editorKind==='model'&&this.canEdit(model))await this.assetGallery.upload(file,{replace:model});};
  // Canvas-only listeners miss drags over HUD layers; use the whole document.
  const overlay=byId('sceneDropOverlay');
  let modelDragCancelled=false,dragWatchdog=0,cancelResetTimer=0;
  const stopModelDrag=()=>{overlay.hidden=true;clearTimeout(dragWatchdog);};
  const refreshModelDrag=()=>{clearTimeout(dragWatchdog);dragWatchdog=setTimeout(stopModelDrag,1100);};
  byId('cancelModelDrop').onclick=()=>{modelDragCancelled=true;stopModelDrag();clearTimeout(cancelResetTimer);cancelResetTimer=setTimeout(()=>{modelDragCancelled=false;},1800);};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden){byId('cancelModelDrop').click();}});
  window.addEventListener('blur',stopModelDrag);
  window.addEventListener('focus',stopModelDrag);
  const modelDragging=e=>[...e.dataTransfer?.items||[]].some(i=>i.kind==='file')||e.dataTransfer?.types?.includes('Files');
  document.addEventListener('dragenter',e=>{if(modelDragging(e)){if(!modelDragCancelled&&!e.target?.closest?.('.chat-composer'))overlay.hidden=false;refreshModelDrag();}});
  document.addEventListener('dragover',e=>{if(modelDragging(e)){e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect=modelDragCancelled?'none':'copy';if(!modelDragCancelled&&!e.target?.closest?.('.chat-composer'))overlay.hidden=false;else if(e.target?.closest?.('.chat-composer'))overlay.hidden=true;refreshModelDrag();}});
  document.addEventListener('dragleave',e=>{if(!e.relatedTarget||e.clientX<=0||e.clientY<=0||e.clientX>=innerWidth-1||e.clientY>=innerHeight-1){stopModelDrag();modelDragCancelled=false;}});
  document.addEventListener('drop',async e=>{
    stopModelDrag();const wasCancelled=modelDragCancelled;modelDragCancelled=false;
    if(e.defaultPrevented)return;
    const files=[...e.dataTransfer?.files||[]];if(wasCancelled){e.preventDefault();return;}if(!files.length)return;
    if(e.target?.closest?.('.avatar-gallery,.profile-modal'))return;
    e.preventDefault();e.stopPropagation();const file=files[0],modelFile=files.find(f=>/\.(glb|fbx)$/i.test(f.name));
    this.lastPointer={x:e.clientX,y:e.clientY};
    if(modelFile)return await this.importModel(modelFile);
    if(file.type.startsWith('image/')||file.type.startsWith('video/')||file.type.startsWith('audio/')||file.type==='application/pdf'||file.type==='text/plain')return await window.solviHandleWorldFileDrop?.(file,{x:e.clientX,y:e.clientY,target:e.target});
    return this.toast('Unsupported drop: use chat attachments, images/videos for media surfaces, or .glb/.fbx models');
  });
  window.addEventListener('dragend',()=>{modelDragCancelled=false;stopModelDrag();});

  const toolsPanel=byId('editorToolbox'),toolsLauncher=byId('toolsToggleButton');
  const showTools=visible=>{
    toolsPanel.hidden=false;toolsPanel.classList.toggle('minimized',!visible);localStorage.setItem('solvi-tools-minimized',visible?'0':'1');
    toolsLauncher.setAttribute('aria-expanded',String(visible));
    toolsLauncher.setAttribute('aria-label',visible?'Hide world tools':'Open world tools');
    toolsLauncher.title=visible?'Hide world tools':'Open world tools';
  };
  toolsLauncher.onclick=()=>showTools(toolsPanel.classList.contains('minimized'));
  byId('toolboxMinimize').textContent='';
  byId('toolboxMinimize').onclick=()=>showTools(toolsPanel.classList.contains('minimized'));
  // Old persisted minimize state must not leave a stray title or icon on screen.
  showTools(localStorage.getItem('solvi-tools-minimized')==='0');

  const openMenu=(x,y)=>{menu.hidden=false;menu.style.right='auto';menu.style.left=Math.max(8,Math.min(innerWidth-275,x))+'px';menu.style.top=Math.max(54,Math.min(innerHeight-370,y))+'px';search.value='';for(const b of menu.querySelectorAll('.add-group button'))b.hidden=false;};
  this.showAddMenu=openMenu;
  byId('addObjectButton').onclick=e=>{if(menu.hidden)openMenu(e.clientX+10,e.clientY+10);else menu.hidden=true;};
  document.addEventListener('pointerdown',event=>{if(!menu.hidden&&!menu.contains(event.target)&&!byId('addObjectButton').contains(event.target))menu.hidden=true;});

  const bulkFilter=()=>this.refreshList();
  byId('sceneObjectSearch').addEventListener('input',bulkFilter);
  byId('sceneObjectFilter').addEventListener('change',bulkFilter);
  byId('sceneSelectAll').addEventListener('change',e=>{for(const o of this.visibleSceneItems()){if(this.canEdit(o)){if(e.target.checked)this.bulkChecked.add(o.userData.editorId);else this.bulkChecked.delete(o.userData.editorId);}}this.refreshList();});
  byId('sceneBulkToggle').onclick=()=>{const panel=byId('scenePanel'),active=panel.classList.toggle('bulk-mode');byId('sceneBulkToggle').setAttribute('aria-expanded',String(active));byId('sceneBulkRow').hidden=!active;if(!active)this.bulkChecked.clear();this.refreshList();};
  byId('sceneDeleteSelected').onclick=()=>this.removeBulk(false);
  byId('sceneDeleteAll').onclick=()=>this.removeBulk(true);
  byId('objectsButton').onclick=()=>{
    const panel=byId('scenePanel');panel.hidden=!panel.hidden;panel.classList.remove('minimized');
    if(!panel.hidden)this.refreshList();
  };
  byId('minimizeScenePanel').onclick=()=>{
    // Minimized panels belong in the launcher, not as orphaned floating header buttons.
    byId('scenePanel').hidden=true;byId('scenePanel').classList.remove('minimized');
  };
  byId('closeScenePanel').onclick=()=>byId('scenePanel').hidden=true;
  byId('closeProperties').onclick=()=>{byId('propertiesPanel').hidden=true;this.clearLightHelper();};
  for(const id of ['objectPhysicsMode','objectCollider','objectRestitution','objectFriction'])byId(id).addEventListener('change',()=>{const obj=this.selected;if(!obj||!this.canEdit(obj)||['robot','light'].includes(obj.userData.editorKind))return;obj.userData.physics=physicsOptions({mode:byId('objectPhysicsMode').value,collider:byId('objectCollider').value,friction:byId('objectFriction').value,restitution:byId('objectRestitution').value});this.physics.sync(obj);this.queueSave(obj);this.updateColliderOption();this.updateCombatPhysicsHint();});
  byId('makeObjectPushable').onclick=()=>{
   const obj=this.selected;
   if(!obj||!this.canEdit(obj)||['robot','light'].includes(obj.userData.editorKind))return;
   const before=this.snapshot(obj);
   obj.userData.physics=physicsOptions({...obj.userData.physics,mode:'dynamic',collider:'box'});
   byId('objectPhysicsMode').value='dynamic';byId('objectCollider').value='box';
   this.physics.sync(obj);this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);
   this.updateColliderOption();this.updateCombatPhysicsHint();
   if(!this.physics.enabled)this.toast('Object is now Dynamic. Enable room Physics to make combat impulses work.');
  };
  const surfaceSelect=byId('objectSurfaceProperty'),surfaceValue=byId('objectSurfaceValue'),surfaceRange=byId('objectSurfaceRange');
  const currentSurface=()=>byId(surfaceSelect.value==='restitution'?'objectRestitution':'objectFriction');
  const syncSurface=()=>{const source=currentSurface();const max=surfaceSelect.value==='restitution'?1:2;surfaceValue.max=String(max);surfaceRange.max=String(max);surfaceValue.value=source.value;surfaceRange.value=source.value;surfaceRange.setAttribute('aria-label','Adjust '+surfaceSelect.selectedOptions[0].text);};
  surfaceSelect.onchange=syncSurface;
  const applySurface=value=>{const target=currentSurface();const n=Number(value);if(!Number.isFinite(n)||n<0||n>Number(surfaceValue.max))return;target.value=String(n);syncSurface();target.dispatchEvent(new Event('change',{bubbles:true}));};
  surfaceValue.addEventListener('change',()=>applySurface(surfaceValue.value));surfaceRange.addEventListener('input',()=>applySurface(surfaceRange.value));
  this.syncPhysicsSurface=syncSurface;
  const selector=byId('robotSpeedKind'),activeSpeed=byId('robotSpeedActive'),activeValue=byId('robotSpeedActiveValue');
  const syncRobotSpeed=()=>{const input=byId(selector.value);if(!input)return;
   activeSpeed.min=input.min;activeSpeed.max=input.max;activeSpeed.step=input.step;activeSpeed.value=input.value;
   activeSpeed.setAttribute('aria-label',selector.selectedOptions[0].text+' speed');
   activeValue.textContent=Number(input.value).toFixed(2)+'×';};
  selector.onchange=syncRobotSpeed;
  activeSpeed.oninput=()=>{const input=byId(selector.value);if(!input)return;input.value=activeSpeed.value;
   input.dispatchEvent(new Event('input',{bubbles:true}));syncRobotSpeed();};
  this.syncRobotSpeed=syncRobotSpeed;
  for(const [field,kind] of [['animationWalk','walk'],['animationRun','run'],['animationJump','jump']]){
   byId(field).oninput=()=>{const bot=this.robot();if(!bot||!this.canEdit(bot))return;const speeds=animationSpeedSettings(bot.userData.robotAnimationSpeed);speeds[kind]=Number(byId(field).value);bot.userData.robotAnimationSpeed=animationSpeedSettings(speeds);this.queueSave(bot);};
  }
  const strafe=byId('robotStrafeSpeed');strafe.oninput=()=>{if(!this.selected||!this.canEdit(this.selected))return;this.selected.userData.robotStrafeSpeed=Number(strafe.value);byId('robotStrafeLabel').textContent=Number(strafe.value).toFixed(1)+'×';this.queueSave(this.selected);};
  const turn=byId('robotTurnSpeed');turn.addEventListener('input',()=>{if(!this.selected||!this.canEdit(this.selected))return;this.selected.userData.robotTurnSpeed=Number(turn.value);byId('robotTurnLabel').textContent=Number(turn.value).toFixed(2)+'×';this.queueSave(this.selected);});
  const modeButton=byId('controlModeButton'),robotSelect=byId('controlledRobotSelect'),robotFaces=byId('controlledRobotFaces');
  this.robotPortraitCache=new Map();
  this.controlledRobot=()=>{
   const robot=this.items.find(o=>o.userData.editorId===this.controlledRobotId&&o.userData.editorKind==='robot');
   return robot&&this.canEdit(robot)?robot:null;
  };
  this.cameraTargetRobot=()=>this.controlMode==='robot'?this.controlledRobot():this.robot();
  this.activateControlledRobot=(id)=>{
   const robot=this.items.find(o=>o.userData.editorKind==='robot'&&o.userData.editorId===id&&this.canEdit(o));
   if(!robot)return false;
   this.controlledRobotId=robot.userData.editorId;
   this.controlMode='robot';
   this.robotKeys.clear();this.world.keys.clear();this.localRobotInput=null;
   this.select(robot);this.syncControlSwitcher();return true;
  };
  this.syncControlSwitcher=()=>{
   const robots=this.items.filter(o=>o.userData.editorKind==='robot'&&this.canEdit(o));
   const oldId=this.controlledRobotId;
   const selectedId=this.selected?.userData.editorKind==='robot'&&this.canEdit(this.selected)?this.selected.userData.editorId:null;
   if(!robots.some(o=>o.userData.editorId===oldId)){
    this.controlledRobotId=robots.some(o=>o.userData.editorId===selectedId)?selectedId:robots[0]?.userData.editorId||null;
    this.robotKeys?.clear();this.localRobotInput=null;
    if(!this.controlledRobotId&&this.controlMode==='robot')this.controlMode='scene';
   }
   const id=this.controlledRobotId;
   // Keep a semantic native select for keyboard/assistive access, without visually
   // replacing the portrait picker with a dropdown.
   const signature=robots.map(o=>[o.userData.editorId,o.name,o.userData.robotBrain?.portrait||''].join(':')).join('|');
   if(this.robotFacesSignature!==signature){
    this.robotFacesSignature=signature;
    robotSelect.replaceChildren(...robots.map(o=>new Option(o.name,o.userData.editorId)));
    robotFaces.replaceChildren();
    for(const bot of robots){
     const button=document.createElement('button');button.type='button';button.className='robot-face-choice';button.dataset.robotId=bot.userData.editorId;
     button.title='Control '+bot.name+' with arrow keys';button.setAttribute('aria-label','Control '+bot.name+' with arrow keys');
     const face=document.createElement('span');face.className='robot-face-avatar';face.textContent=bot.name.trim().slice(0,2).toUpperCase()||'R';
     button.append(face);const name=document.createElement('small');name.textContent=bot.name;button.append(name);
     const portrait=bot.userData.robotBrain?.portrait;
     if(portrait&&window.solviAPI?.mediaBlob){
      let request=this.robotPortraitCache.get(portrait);
      if(!request){request=window.solviAPI.mediaBlob(portrait).catch(()=>null);this.robotPortraitCache.set(portrait,request);}
      request.then(url=>{if(url&&button.isConnected&&button.dataset.robotId===bot.userData.editorId){const image=document.createElement('img');image.src=url;image.alt='';face.replaceChildren(image);}});
     }
     button.onclick=()=>this.activateControlledRobot(bot.userData.editorId);
     robotFaces.append(button);
    }
   }
   robotSelect.value=id||'';
   robotSelect.hidden=true;
   robotFaces.hidden=robots.length===0;
   for(const btn of robotFaces.children){const active=btn.dataset.robotId===id&&this.controlMode==='robot';btn.setAttribute('aria-pressed',String(active));btn.classList.toggle('active',active);}
   modeButton.textContent=this.controlMode==='robot'?'Robot control · '+(this.controlledRobot()?.name||''):'Scene control';
   modeButton.setAttribute('aria-pressed',String(this.controlMode==='robot'));
   modeButton.title=this.controlMode==='robot'?'Return arrow keys to camera navigation':'Use arrow keys to control the selected robot portrait';
  };
  modeButton.onclick=()=>{
   if(this.controlMode==='robot'){
    this.controlMode='scene';this.robotKeys?.clear();this.localRobotInput=null;this.world.keys.clear();this.world.setCameraFollowMode('free');
   }else{
    const selectedId=this.selected?.userData.editorKind==='robot'?this.selected.userData.editorId:null;
    const target=selectedId&&this.canEdit(this.selected)?selectedId:this.controlledRobotId;
    if(!this.activateControlledRobot(target))this.toast('No controllable robots in the room');
   }
   this.syncControlSwitcher();
  };
  robotSelect.onchange=()=>this.activateControlledRobot(robotSelect.value);
  this.syncControlSwitcher();
  byId('openRobotBrains').onclick=()=>window.dispatchEvent(new Event('solvi:open-brains'));
  for(const [id,scan] of [['robotEyeFront','front'],['robotEye180','180'],['robotEye360','360']]){byId(id).onclick=()=>{if(!this.robot())return;window.dispatchEvent(new CustomEvent('solvi:robot-eyes-action',{detail:{robotId:this.robot().userData.editorId,scan}}));};}
  const speed=byId('robotSpeed');speed.addEventListener('pointerdown',()=>this.speedBefore=this.snapshot(this.selected));speed.addEventListener('change',()=>{this.recordEdit(this.speedBefore,this.snapshot(this.selected));this.speedBefore=null;});speed.oninput=()=>{if(!this.selected||!this.canEdit(this.selected))return;this.selected.userData.robotSpeed=Number(speed.value);byId('robotSpeedLabel').textContent=Number(speed.value).toFixed(2)+'×';this.queueSave(this.selected);};
  for(const id of ['lightType','lightIntensity','lightRange','lightDecay','lightAngle','lightPenumbra','lightColor','lightGround'])byId(id).addEventListener('change',()=>{const o=this.selected;if(!o||o.userData.editorKind!=='light'||!this.canEdit(o))return;
   const before=this.snapshot(o);setLight(o,{type:byId('lightType').value,intensity:+byId('lightIntensity').value,range:+byId('lightRange').value,decay:+byId('lightDecay').value,angle:+byId('lightAngle').value,penumbra:+byId('lightPenumbra').value,color:byId('lightColor').value,groundColor:byId('lightGround').value});this.refreshLightControls();this.recordEdit(before,this.snapshot(o));this.queueSave(o);});

  const combatList=byId('robotCombatList');
  for(const action of COMBAT_ACTIONS){
   const row=document.createElement('div');row.className='robot-combat-row';
   const label=document.createElement('label');label.textContent=action[0].toUpperCase()+action.slice(1);
   const key=document.createElement('select');key.dataset.combatAction=action;key.dataset.combatField='key';key.setAttribute('aria-label',action+' shortcut');
   key.append(new Option('No key',''));for(const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')key.append(new Option(letter,'Key'+letter));
   const strength=document.createElement('input');strength.dataset.combatAction=action;strength.dataset.combatField='force';strength.setAttribute('aria-label',action+' force');strength.type='number';strength.min='.5';strength.max='20';strength.step='.5';
   const apply=()=>{const robot=this.robot();if(!robot||!this.canEdit(robot))return;const settings=combatSettings(robot.userData.robotCombat);settings[action]={key:key.value,force:Number(strength.value)};robot.userData.robotCombat=combatSettings(settings);this.queueSave(robot);};
   key.onchange=apply;strength.onchange=apply;row.append(label,key,strength);combatList.append(row);
  }
  byId('robotActionSelect').onchange=e=>{if(this.selected&&this.canEdit(this.selected)){robotAction(this.selected,e.target.value);this.queueSave(this.selected);}else this.toast('Only permitted users can control this robot.');};
  fetch('./assets/avatars/catalog.json').then(r=>r.ok?r.json():{avatars:[]}).then(data=>{
   const select=byId('robotAvatar');select.replaceChildren();
   for(const a of data.avatars||[]){const o=new Option(a.label,a.url);o.title=a.description||'';select.add(o);}
   if(!select.options.length)select.add(new Option('SOLVI legacy avatar',DEFAULT_ROBOT_AVATAR));
   if(this.selected?.userData.editorKind==='robot')select.value=this.selected.userData.avatarUrl||DEFAULT_ROBOT_AVATAR;
  }).catch(()=>{});
  byId('robotAvatar').onchange=async e=>{
   if(!this.selected||!this.canEdit(this.selected))return this.toast('Owner only');
   const url=e.target.value;
   if(url!==DEFAULT_ROBOT_AVATAR){try{const response=await fetch(url,{method:'HEAD'});if(!response.ok)throw Error();}catch{this.toast('This avatar is catalogued but not deployed yet. Package the GLB first.');return;}}
   const obj=this.selected,before=this.snapshot(this.selected);obj.userData.avatarUrl=url;obj.userData.robotReady=false;
   for(const child of [...obj.children])if(!child.userData.robotPlaceholder){obj.remove(child);}
   hydrateRobot(obj);this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);
  };
  for(const mode of ['translate','rotate','scale'])byId('transform-'+mode).onclick=()=>{
   if(!this.selected||!this.canTransform(this.selected))return this.toast('Unlock this object to transform it');
   this.transform.setMode(mode);
   this.transform.attach(this.selected); // Explicit manual placement of robots remains possible.
  };
  byId('objectNameInput').onchange=e=>{if(!this.selected||!this.canEdit(this.selected))return;const name=e.target.value.trim().slice(0,100);if(!name)return;const before=this.snapshot(this.selected);this.selected.name=name;byId('objectName').textContent=name;this.recordEdit(before,this.snapshot(this.selected));this.refreshList();this.queueSave(this.selected);};
  byId('deleteObject').onclick=()=>this.remove();
  // One contextual range, bound to the numeric control the user is adjusting.
  // It moves beneath the active row, not alongside nine permanently visible sliders.
  const context=byId('inspectorValueSlider'),range=byId('inspectorActiveRange');
  let activeNumeric=null;
  const activateValue=(number)=>{
   if(!number || !number.matches('input[type="number"]') || !byId('objectInspector').contains(number))return;
   if(number.disabled)return;
   const group=number.closest('.transform-value') || number.closest('label') || number.parentElement;
   if(!group)return;
   activeNumeric=number;
   const text=number.getAttribute('aria-label')||number.closest('label')?.textContent?.trim()||number.id;
   byId('inspectorSliderLabel').textContent=text;
   const field=number.id.match(/^(position|rotation|scale)-[012]$/)?.[1];
   const limits=field==='rotation'?[-180,180,'0.5']:field==='scale'?[0,1000,'1']:field==='position'?[-Math.max(25,this.world.environment?.floorSize/2||25),Math.max(25,this.world.environment?.floorSize/2||25),'0.05']:
      [Number(number.min||0),Number(number.max||100),number.step||'any'];
   if(!field||!limits.every((n,i)=>i===2||Number.isFinite(n))||limits[0]>=limits[1])return;
   range.min=String(limits[0]);range.max=String(limits[1]);range.step=limits[2];
   range.setAttribute('aria-label',text+' slider');
   range.value=String(field==='scale'?scaleToSlider(Number(number.value)):Math.min(limits[1],Math.max(limits[0],Number(number.value)||0)));
   byId('inspectorSliderValue').textContent=number.value;
   const anchor=number.closest('.transform-group') || group;anchor.insertAdjacentElement('afterend',context);context.hidden=false;
  };
  this.activateInspectorValue=activateValue;
  byId('objectInspector').addEventListener('focusin',event=>activateValue(event.target));
  byId('objectInspector').addEventListener('click',event=>{
    if(event.target.matches?.('input[type="number"]'))activateValue(event.target);
  });
  byId('objectInspector').addEventListener('input',event=>{
    if(activeNumeric===event.target)byId('inspectorSliderValue').textContent=activeNumeric.value;
  });
  range.addEventListener('input',()=>{
   if(!activeNumeric||activeNumeric.disabled)return;
   const isScale=activeNumeric.id.startsWith('scale-');activeNumeric.value=isScale?String(Number(sliderToScale(Number(range.value)).toFixed(3))):range.value;
   byId('inspectorSliderValue').textContent=activeNumeric.value;
   // Linked XYZ must update while the pointer moves, not after leaving the slider.
   activeNumeric.dispatchEvent(new Event(isScale?'input':'change',{bubbles:true}));
  });
  range.addEventListener('change',()=>{
   if(activeNumeric?.id.startsWith('scale-'))activeNumeric.dispatchEvent(new Event('change',{bubbles:true}));
  });
  const scaleEditBefore=new WeakMap();
  const syncScaleFields=(obj,changed)=>{
   ['x','y','z'].forEach((key,i)=>{const field=byId('scale-'+i);if(field!==changed)field.value=Number(obj.scale[key].toFixed(4)).toString();});
  };
  for(const field of ['position','rotation','scale'])for(let axis=0;axis<3;axis++){
   const id=`${field}-${axis}`,number=byId(id);
   if(field==='scale'){
    number.addEventListener('focus',()=>{if(this.selected)scaleEditBefore.set(number,this.snapshot(this.selected));});
    number.addEventListener('input',()=>{
     const obj=this.selected,value=Number(number.value);
     if(!obj||!this.canTransform(obj)||!number.value.trim()||!Number.isFinite(value)||value<=0)return;
     if(!scaleEditBefore.has(number))scaleEditBefore.set(number,this.snapshot(obj));
     const axisName=['x','y','z'][axis];
     if(byId('scaleUniform').checked){const next=linkedScale(obj.scale,axisName,value);obj.scale.set(next.x,next.y,next.z);}
     else obj.scale[axisName]=value;
     syncScaleFields(obj,number);
     // Avoid rebuilding Rapier's collider on every keystroke; commit on change.
    });
   }
   number.addEventListener('input',()=>{if(activeNumeric===number){range.value=number.id.startsWith('scale-')?String(scaleToSlider(Number(number.value))):number.value;byId('inspectorSliderValue').textContent=number.value;}});
  }
  for(const field of ['position','rotation','scale'])byId(field+'-reset').onclick=()=>{
   const obj=this.selected;if(!obj||!this.canTransform(obj))return;
   const before=this.snapshot(obj);const neutral=field==='scale'?1:0;
   obj[field].set(neutral,neutral,neutral);this.physics.sync(obj);
   this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);this.updateInspector();
   byId('inspectorValueSlider').hidden=true;
  };
  for(const field of ['position','rotation','scale'])for(let axis=0;axis<3;axis++){
   const el=byId(`${field}-${axis}`);el.onchange=()=>{if(!this.selected||!this.canTransform(this.selected))return;const v=Number(el.value);if(!Number.isFinite(v)||field==='scale'&&v<=0)return;
    const obj=this.selected,before=field==='scale'?(scaleEditBefore.get(el)||this.snapshot(obj)):this.snapshot(obj);
    const vec=obj[field],name=['x','y','z'][axis];
    if(field==='scale'){
     // 'input' already updated the scene, but a programmatic 'change' must work too.
     if(Math.abs(vec[name]-v)>0.00001){if(byId('scaleUniform').checked){const next=linkedScale(vec,name,v);vec.set(next.x,next.y,next.z);}else vec[name]=v;}
     syncScaleFields(obj,el);scaleEditBefore.delete(el);
    }else vec[name]=field==='rotation'?THREE.MathUtils.degToRad(v):v;
    this.physics.sync(obj);this.recordEdit(before,this.snapshot(obj));this.refreshList();this.queueSave(obj);};}
  byId('objectColor').addEventListener('focus',()=>this.colorBefore=this.snapshot(this.selected));byId('objectColor').addEventListener('change',()=>{this.recordEdit(this.colorBefore,this.snapshot(this.selected));this.colorBefore=null;});
  byId('objectColor').oninput=e=>{const obj=this.selected;if(!obj||!this.canEdit(obj)||obj.userData.editorKind==='robot')return;obj.traverse(o=>{if(o.material?.color)o.material.color.set(e.target.value);});this.queueSave(obj);};
  byId('texturePreset').onchange=e=>{const before=this.snapshot(this.selected);this.texture(e.target.value);this.recordEdit(before,this.snapshot(this.selected));};byId('textureUploadButton').onclick=()=>byId('textureUpload').click();
  byId('textureUpload').onchange=async e=>{const file=e.target.files[0];if(!file||!file.type.startsWith('image/')||file.size>5_000_000)return this.toast('Select an image under 5 MB');
   const before=this.snapshot(this.selected);const blob=URL.createObjectURL(file);new THREE.TextureLoader().load(blob,tex=>{tex.colorSpace=THREE.SRGBColorSpace;this.selected.userData.textureName='custom';this.assignTexture(tex);this.recordEdit(before,this.snapshot(this.selected));URL.revokeObjectURL(blob);},undefined,()=>URL.revokeObjectURL(blob));};
  byId('saveScene').onclick=()=>this.save();byId('reloadScene').onclick=()=>this.load();
 }
 setupWallControls(){
  const field=id=>byId(id),panel=field('wallPanel');if(!panel)return;
  field('wallConvertStatic').onclick=()=>this.convertWallToCuttableCubes();
  const extraIds=['stairRailEnabled','stairRailSide','stairRailRods','stairRailHeight','stairRailWidth','stairRailEvery','stairRailMaterial','stairRailTexture','stairRailColor','stairRailOpacity','stairRoofEnabled','stairRoofWalls','stairRoofHeight','stairRoofThickness','stairRoofTexture','stairRoofColor','stairRoofOpacity','stairSupportEnabled','stairSupportSide','stairSupportEvery','stairSupportWidth','stairSupportTexture','stairSupportColor','stairSupportOpacity','stairSurfaceTexture','stairSurfaceMaterial','stairSurfaceColor','stairSurfaceOpacity','stairTransportEnabled','stairTransportSpeed','stairTransportDirection','stairLiftLevels','stairLiftLevelHeight','stairLiftCabinHeight'];
  this.stairExtraIds=extraIds;
  const ranges={wallWidth:[.05,4,.01,'m'],wallHeight:[.2,10,.1,'m'],wallOpacity:[.08,1,.02,'']};
  let active='wallHeight';
  const setActive=id=>{active=id;const input=field(id),slider=field('wallValueSlider'),[min,max,step,unit]=ranges[id];
   slider.min=min;slider.max=max;slider.step=step;slider.value=input.value;
   field('wallSliderLabel').textContent=id.slice(4)+' · '+Number(input.value).toFixed(2)+(unit?' '+unit:'');
  };
  const rerender=()=>{
   if(panel.hidden)return;
   const stairMode=field('stairStepMode').value;const stairData=this.wallDrawing?.points||this.wallEditTarget?.userData?.stairs?.points||[];
   if((this.wallDrawing?.kind==='stairs'||this.wallEditTarget?.userData.editorKind==='stairs')&&stairData.length>=2){const steps=stairSegments(this.readStairOptions(this.wallDrawing?wallWorldToLocal(stairData).points:stairData));field('stairInfo').textContent=steps.length?`${steps.length} steps · ${steps.at(-1).top.toFixed(2)} m`:'';}
   field('stairCount').disabled=stairMode==='fixed';field('stairTread').disabled=stairMode!=='fixed';field('stairRiser').disabled=stairMode!=='fixed';field('wallHeight').disabled=(this.wallDrawing?.kind==='stairs'||this.wallEditTarget?.userData.editorKind==='stairs')&&stairMode==='fixed';
   if(this.wallDrawing){this.drawWallPreview();this.trackWallState();return;}
   const obj=this.wallEditTarget;
   if(obj&&this.canEdit(obj)){
    if(obj.userData.editorKind==='stairs')rebuildOfficeStairs(obj,this.readStairOptions(obj.userData.stairs?.points));
    else rebuildOfficeWall(obj,this.readWallOptions(obj.userData.wall?.points));
    this.physics.sync(obj);
   }
   this.trackWallState();
  };
  for(const id of Object.keys(ranges)){
   const input=field(id);
   input.addEventListener('focus',()=>setActive(id));
   input.addEventListener('input',()=>{setActive(id);if(input.value!==''&&Number.isFinite(input.valueAsNumber))rerender();});
   input.addEventListener('change',()=>{const [min,max]=ranges[id];input.value=Math.min(max,Math.max(min,Number(input.value)||min));setActive(id);rerender();});
  }
  field('wallValueSlider').addEventListener('input',e=>{field(active).value=e.target.value;setActive(active);rerender();});
  for(const id of ['wallTexture','wallSmooth','wallPhysics','wallPreviewMode','wallCeilingHeight','stairStepMode','stairCount','stairTread','stairRiser','stairFloating'])field(id).addEventListener('change',rerender);
  for(const id of extraIds){field(id).addEventListener('change',rerender);if(['number','color'].includes(field(id).type))field(id).addEventListener('input',rerender);}
  field('stairLiftLevels').addEventListener('change',()=>this.refreshLiftLevels());
  field('stairLiftStart').onclick=()=>{const o=this.wallEditTarget;if(!o||o.userData.stairs?.variant!=='lift'||!this.canEdit(o))return;const before=this.snapshot(o);rebuildOfficeStairs(o,this.readStairOptions(o.userData.stairs?.points));o.userData.physics=physicsOptions({mode:'kinematic'});this.physics.sync(o);this.recordEdit(before,this.snapshot(o));this.queueSave(o);startLift(o,Number(field('stairLiftTarget').value));field('stairLiftState').textContent='Travelling to level '+(Number(field('stairLiftTarget').value)+1);};
  field('stairLiftStop').onclick=()=>{const o=this.wallEditTarget;if(o?.userData.stairRuntime){o.userData.stairRuntime.moving=false;field('stairLiftState').textContent='Stopped';}};
  field('wallColor').addEventListener('input',rerender); // Input, not change: update while native colour picker is open.
  for(const id of ['stairCount','stairTread','stairRiser','wallCeilingHeight'])field(id).addEventListener('input',rerender);
  for(const id of ['wallSnap','wallGridStep','wallAngleStep'])field(id).addEventListener('change',()=>this.drawWallPreview());
  field('wallTexture').addEventListener('change',()=>{if(field('wallTexture').value==='custom'&&!this.wallTextureMediaId)field('wallUploadButton').click();});
  field('wallUploadButton').onclick=()=>field('wallTextureUpload').click();
  field('wallTextureUpload').onchange=async event=>{
   const file=event.target.files?.[0];event.target.value='';if(!file)return;
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5_000_000)return this.toast('Upload a PNG, JPEG or WebP image below 5 MB');
   const button=field('wallUploadButton');button.disabled=true;
   try{
    const body=new FormData();body.append('file',file,file.name);
    const result=await window.solviAPI.req('/api/media',{method:'POST',body});
    this.wallTextureMediaId=result.media.id;field('wallTexture').value='custom';this.loadWallDraftTexture(result.media.id);rerender();
   }catch(error){this.toast(error.message||'Texture upload failed');}finally{button.disabled=false;}
  };
  field('wallSmoothNow').onclick=()=>{
   const tolerance=Number(field('wallSmoothStrength').value);
   if(this.wallDrawing){
    const draft=this.wallDrawing;if(draft.points.length<3)return;
    draft.points=smoothWallPoints(draft.points.map(p=>[p.x,p.z]),tolerance).map(([x,z])=>({x,z}));
    draft.cursor=null;this.drawWallPreview();this.trackWallState();
   }else if(this.wallEditTarget&&this.canEdit(this.wallEditTarget)){
    const obj=this.wallEditTarget,wall=obj.userData.wall;
    rebuildOfficeWall(obj,{...wall,points:smoothWallPoints(wall.points,tolerance)});
    // Keep edited points as the input for other property changes.
    rerender();
   }
  };
  field('wallConfirm').onclick=()=>this.confirmWall();
  field('wallFinish').onclick=()=>this.finishWallStroke();
  field('wallUndo').onclick=()=>this.undoWall();
  field('wallRedo').onclick=()=>this.redoWall();
  field('wallCloseLoop').onclick=()=>{if(this.wallDrawing?.points.length>=3){this.wallDrawing.closed=true;this.wallDrawing.finished=true;this.drawWallPreview();this.trackWallState();}};
  field('wallCancel').onclick=()=>this.endWallDrawing();
  field('wallClose').onclick=()=>this.endWallDrawing();
  field('wallDrawMode').onchange=()=>{if(this.wallDrawing){this.wallDrawing.mode=field('wallDrawMode').value;this.wallDrawing.points=[];this.wallDrawing.cursor=null;this.wallDrawing.finished=false;this.wallDrawing.closed=field('wallDrawMode').value==='closed';this.drawWallPreview();this.trackWallState();}};
  this.wallSetActiveSlider=setActive;
 }
 loadWallDraftTexture(id){
  if(!id||this.wallPreviewTextureId===id)return;
  const sequence=++this.wallPreviewTextureReq;this.wallPreviewTextureId=id;
  this.wallPreviewCustom?.dispose();this.wallPreviewCustom=null;
  window.solviAPI?.mediaBlobInfo?.(id).then(info=>{
   new THREE.TextureLoader().load(info.url,texture=>{
    URL.revokeObjectURL(info.url);
    if(sequence!==this.wallPreviewTextureReq){texture.dispose();return;}
    texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    this.wallPreviewCustom=texture;if(this.wallDrawing)this.drawWallPreview();
   },undefined,()=>URL.revokeObjectURL(info.url));
  }).catch(()=>{this.wallPreviewTextureId='';});
 }
 readWallOptions(points=[]){return sanitiseWall({points,closed:!!(this.wallDrawing?.closed||this.wallEditTarget?.userData?.wall?.closed||byId('wallDrawMode').value==='closed'),width:byId('wallWidth').value,height:byId('wallHeight').value,opacity:byId('wallOpacity').value,texture:byId('wallTexture').value==='custom'&&!this.wallTextureMediaId?'plaster':byId('wallTexture').value,textureMediaId:this.wallTextureMediaId,color:byId('wallColor').value,smooth:byId('wallSmooth').checked});}
 readStairOptions(points=[]){
  const get=id=>{const e=byId(id);return e.type==='checkbox'?e.checked:e.type==='number'?Number(e.value):e.value;};
  return sanitiseStairs({points,width:get('wallWidth'),height:get('wallHeight'),opacity:get('wallOpacity'),color:get('wallColor'),stepMode:get('stairStepMode'),steps:get('stairCount'),treadMm:get('stairTread'),riserMm:get('stairRiser'),floating:get('stairFloating'),
   variant:this.wallDrawing?.variant||this.wallEditTarget?.userData.stairs?.variant||'standard',
   surface:{texture:get('stairSurfaceTexture'),material:get('stairSurfaceMaterial'),color:get('stairSurfaceColor'),opacity:get('stairSurfaceOpacity')},
   rail:{enabled:get('stairRailEnabled'),side:get('stairRailSide'),rods:get('stairRailRods'),every:get('stairRailEvery'),height:get('stairRailHeight'),width:get('stairRailWidth'),material:get('stairRailMaterial'),texture:get('stairRailTexture'),color:get('stairRailColor'),opacity:get('stairRailOpacity')},
   roof:{enabled:get('stairRoofEnabled'),walls:get('stairRoofWalls'),height:get('stairRoofHeight'),thickness:get('stairRoofThickness'),texture:get('stairRoofTexture'),color:get('stairRoofColor'),opacity:get('stairRoofOpacity')},
   supports:{enabled:get('stairSupportEnabled'),side:get('stairSupportSide'),every:get('stairSupportEvery'),width:get('stairSupportWidth'),texture:get('stairSupportTexture'),color:get('stairSupportColor'),opacity:get('stairSupportOpacity')},
   transport:{enabled:get('stairTransportEnabled'),speed:get('stairTransportSpeed'),direction:get('stairTransportDirection')==='-1'?-1:1},
   lift:{levels:get('stairLiftLevels'),levelHeight:get('stairLiftLevelHeight'),cabinHeight:get('stairLiftCabinHeight'),target:this.wallEditTarget?.userData.stairs?.lift?.target||0,currentHeight:this.wallEditTarget?.userData.stairs?.lift?.currentHeight||0}
  });
 }
 refreshLiftLevels(){const select=byId('stairLiftTarget');if(!select)return;const previous=select.value;select.replaceChildren();const count=Math.max(2,Math.min(12,Number(byId('stairLiftLevels').value)||2));for(let i=0;i<count;i++){const option=document.createElement('option');option.value=String(i);option.textContent='Level '+(i+1);select.append(option);}select.value=Number(previous)<count?previous:'0';}
 addLift(){
  const lift=objectFor('stairs');const point=this.cameraDropPosition(3.2);
  lift.position.set(point.x,0,point.z);lift.userData.ownerId=window.solviAPI?.auth()?.profile?.id||null;
  rebuildOfficeStairs(lift,{variant:'lift',points:[[0,0],[0,2]],width:1.6,height:3,rail:{enabled:false}});
  lift.name='Lift';lift.userData.physics=physicsOptions({mode:'kinematic'});
  this.items.push(lift);this.world.scene.add(lift);this.physics.sync(lift);this.select(lift);byId('addMenu').hidden=true;this.refreshList();this.recordEdit(null,this.snapshot(lift));this.queueSave(lift);
 }

 wallSessionState(){
  return {points:this.wallDrawing?.points.map(p=>({...p}))||null,finished:this.wallDrawing?.finished||false,closed:this.wallDrawing?.closed||false,mode:this.wallDrawing?.mode||'single',variant:this.wallDrawing?.variant||'standard',
   values:Object.fromEntries(['wallDrawMode','wallWidth','wallHeight','wallOpacity','wallColor','wallTexture','wallPhysics','wallPreviewMode','wallCeilingHeight','wallSnap','wallGridStep','wallAngleStep','wallSmooth','wallSmoothStrength','stairStepMode','stairCount','stairTread','stairRiser','stairFloating',...this.stairExtraIds].map(id=>[id,byId(id).type==='checkbox'?byId(id).checked:byId(id).value])),
   textureMediaId:this.wallTextureMediaId,wallPoints:!this.wallDrawing&&this.wallEditTarget?.userData.editorKind==='wall'?structuredClone(this.wallEditTarget.userData.wall?.points):null};
 }
 trackWallState(){if(this.wallRestoring||byId('wallPanel').hidden)return;const next=this.wallSessionState();if(this.wallStateLast)this.wallSessionHistory.push(this.wallStateLast,next);this.wallStateLast=next;}
 restoreWallSessionState(state){if(!state)return;this.wallRestoring=true;
  for(const [id,value] of Object.entries(state.values)){const input=byId(id);if(input.type==='checkbox')input.checked=value;else input.value=value;}
  this.wallTextureMediaId=state.textureMediaId||'';
  if(this.wallDrawing){Object.assign(this.wallDrawing,{points:state.points||[],finished:state.finished,closed:state.closed,mode:state.mode,variant:state.variant||'standard',cursor:null});this.drawWallPreview();}
  else if(this.wallEditTarget){const obj=this.wallEditTarget;if(obj.userData.editorKind==='stairs')rebuildOfficeStairs(obj,this.readStairOptions(obj.userData.stairs?.points));else rebuildOfficeWall(obj,this.readWallOptions(state.wallPoints||obj.userData.wall?.points));this.physics.sync(obj);}
  this.wallSetActiveSlider?.('wallHeight');this.wallStateLast=state;this.wallRestoring=false;
 }
 undoWall(){const ok=this.wallSessionHistory.undo(wanted=>this.restoreWallSessionState(wanted));if(ok)this.toast('Undo wall');return ok;}
 redoWall(){const ok=this.wallSessionHistory.redo(wanted=>this.restoreWallSessionState(wanted));if(ok)this.toast('Redo wall');return ok;}
 openWallPanel(wall=null){
  if(wall&&wall===this.wallEditTarget&&!byId('wallPanel').hidden)return;
  if(this.wallEditTarget&&this.wallEditTarget!==wall)this.endWallDrawing();
  const panel=byId('wallPanel');panel.hidden=false;this.wallEditTarget=wall;
  const stair=wall?.userData?.editorKind==='stairs'||this.wallDrawing?.kind==='stairs';
  const config=stair?sanitiseStairs(wall?.userData?.stairs||{variant:this.wallDrawing?.variant||'standard'}):sanitiseWall(wall?.userData?.wall||{});
  const variant=stair?config.variant:'standard';
  const title={standard:'Stairs',advanced:'Stairs advanced',escalator:'Escalator',walkway:'Moving walkway',lift:'Lift'}[variant]||'Stairs';
  panel.querySelector('.panel-title strong').textContent=stair?'Office Space · '+title:'Office Space · Walls';
  byId('stairAdvancedFolds').hidden=!stair||variant==='standard';
  byId('stairTransportFold').hidden=!['escalator','walkway','lift'].includes(variant);
  byId('stairLiftFold').hidden=variant!=='lift';
  if(stair){
   const map={stairRailEnabled:config.rail.enabled,stairRailSide:config.rail.side,stairRailRods:config.rail.rods,stairRailHeight:config.rail.height,stairRailWidth:config.rail.width,stairRailEvery:config.rail.every,stairRailMaterial:config.rail.material,stairRailTexture:config.rail.texture,stairRailColor:config.rail.color,stairRailOpacity:config.rail.opacity,
    stairRoofEnabled:config.roof.enabled,stairRoofWalls:config.roof.walls,stairRoofHeight:config.roof.height,stairRoofThickness:config.roof.thickness,stairRoofTexture:config.roof.texture,stairRoofColor:config.roof.color,stairRoofOpacity:config.roof.opacity,
    stairSupportEnabled:config.supports.enabled,stairSupportSide:config.supports.side,stairSupportEvery:config.supports.every,stairSupportWidth:config.supports.width,stairSupportTexture:config.supports.texture,stairSupportColor:config.supports.color,stairSupportOpacity:config.supports.opacity,
    stairSurfaceTexture:config.surface.texture,stairSurfaceMaterial:config.surface.material,stairSurfaceColor:config.surface.color,stairSurfaceOpacity:config.surface.opacity,
    stairTransportEnabled:config.transport.enabled,stairTransportSpeed:config.transport.speed,stairTransportDirection:config.transport.direction,
    stairLiftLevels:config.lift.levels,stairLiftLevelHeight:config.lift.levelHeight,stairLiftCabinHeight:config.lift.cabinHeight};
   for(const [id,value] of Object.entries(map)){const input=byId(id);if(input.type==='checkbox')input.checked=value;else input.value=value;}
   this.refreshLiftLevels();if(variant==='lift')byId('stairLiftTarget').value=String(Math.min(config.lift.target,config.lift.levels-1));
  }

  byId('wallStairOptions').hidden=!stair||variant==='lift';byId('wallMaterialOptions').hidden=stair;byId('wallSmoothingOptions').hidden=stair;
  byId('wallPreviewModeRow').hidden=!!wall;byId('wallCeilingRow').hidden=stair;byId('wallDrawMode').querySelector('option[value=closed]').hidden=stair;
  this.wallTextureMediaId=config.textureMediaId||'';
  this.wallEditOriginal=wall?{object:wall,before:this.snapshot(wall),wall:wall.userData.wall?structuredClone(wall.userData.wall):null,stairs:wall.userData.stairs?structuredClone(wall.userData.stairs):null,physics:structuredClone(wall.userData.physics)}:null;
  for(const [key,id] of [['width','wallWidth'],['height','wallHeight'],['opacity','wallOpacity']])byId(id).value=config[key];
  byId('wallTexture').value=config.texture||'plaster';byId('wallColor').value=config.color;byId('wallSmooth').checked=config.smooth!==false;
  if(stair){byId('stairStepMode').value=config.stepMode;byId('stairCount').value=config.steps;byId('stairTread').value=config.treadMm;byId('stairRiser').value=config.riserMm;byId('stairFloating').checked=config.floating;}
  byId('wallDrawMode').value=stair?'single':config.closed?'closed':'single';
  byId('wallWidth').min=stair?'0.4':'0.05';byId('wallWidth').max=stair?'4':'1.5';byId('wallHeight').min=stair?'0.2':'0.3';
  byId('wallPhysics').value=['escalator','walkway'].includes(variant)?'static':variant==='lift'?'kinematic':(wall?.userData?.physics?.mode||'static');byId('wallPhysics').disabled=['escalator','walkway','lift'].includes(variant);byId('wallDrawMode').disabled=!!wall;
  byId('wallFinish').hidden=!!wall;byId('wallUndo').hidden=false;byId('wallRedo').hidden=false;
  byId('wallSmoothNow').disabled=!wall&&!this.wallDrawing?.points?.length;
  byId('wallConfirm').disabled=!wall;byId('wallConfirm').textContent=wall?'Save '+(stair?'stairs':'wall'):'Create '+(stair?'stairs':'wall');
  byId('wallConvertStatic').hidden=!wall||stair;byId('wallConvertStatic').disabled=!!wall&&!this.canEdit(wall);
  byId('wallStatus').textContent=wall?'Editing selected geometry':'Move pointer over floor to begin';
  byId('wallCloseLoop').hidden=stair||!!wall;this.wallSessionHistory.clear();this.wallStateLast=this.wallSessionState();
  this.wallSetActiveSlider?.('wallHeight');
 }
 convertWallToCuttableCubes(){
  const wall=this.wallEditTarget;
  if(!wall||wall.userData.editorKind!=='wall'||!this.canEdit(wall))return this.toast('Select an editable office wall first');
  // Each wall segment becomes a persistent primitive cube, not a decorative
  // overlay. Cubes use the existing real CSG opening and trimesh collider.
  const data=this.readWallOptions(wall.userData.wall?.points);
  const segments=wallSegments(data);
  if(!segments.length)return this.toast('Wall has no segments');
  if(segments.length>80||this.items.length+segments.length-1>128)return this.toast('The scene is too large to convert these wall sections');
  wall.updateMatrixWorld(true);
  const size=wall.getWorldScale(new THREE.Vector3());
  if(Math.min(Math.abs(size.x),Math.abs(size.y),Math.abs(size.z))<.001)return this.toast('Wall scale must be nonzero');
  const originals=this.snapshot(wall);
  const rotation=wall.getWorldQuaternion(new THREE.Quaternion());
  const parts=[];
  for(const [i,seg] of segments.entries()){
   const cube=objectFor('cube');
   cube.name=(wall.name||'Office wall')+' · '+(i+1);
   cube.userData.ownerId=wall.userData.ownerId;
   cube.userData.primitive=sanitisePrimitive('cube',{width:seg.length,height:data.height,depth:data.width});
   cube.userData.openings=[];
   cube.geometry.dispose();cube.geometry=cutCubeGeometry(cube.userData.primitive,[]);
   cube.position.copy(wall.localToWorld(new THREE.Vector3(seg.x,data.height/2,seg.z)));
   cube.quaternion.copy(rotation).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),seg.yaw));
   cube.scale.copy(size);
   if(cube.material?.color)cube.material.color.set(data.color);
   cube.material.opacity=data.opacity;cube.material.transparent=data.opacity<1;cube.material.roughness=data.texture==='glass'?.14:.82;
   cube.userData.physics=physicsOptions({mode:'static'});
   cube.userData.textureName=['concrete','bricks'].includes(data.texture)?data.texture:'none';
   if(cube.userData.textureName!=='none'){cube.material.map=wallPresetTexture(cube.userData.textureName);cube.material.needsUpdate=true;}
   parts.push(cube);
  }
  // Cancel the editing session before selecting the generated primitives;
  // otherwise the session's original snapshot would restore the old wall.
  this.wallEditOriginal=null;this.endWallDrawing();
  for(const cube of parts){this.items.push(cube);this.world.scene.add(cube);this.physics.sync(cube);this.recordEdit(null,this.snapshot(cube));this.queueSave(cube);}
  this.items=this.items.filter(o=>o!==wall);
  this.world.scene.remove(wall);this.physics.remove(wall.userData.editorId);
  this.recordEdit(originals,null);this.persistRemoval(wall.userData.editorId);
  this.disposeObject(wall);this.select(parts[0]);this.refreshList();
  this.toast(`${parts.length} static wall section(s) · select a face and press O to cut`);
 }
 startWallDrawing(kind='wall',closed=false,variant='standard'){
  this.endWallDrawing();byId('addMenu').hidden=true;
  this.wallDrawing={kind,variant,points:[],cursor:null,mode:closed?'closed':'single',closed,drawing:false,finished:false};
  this.openWallPanel();byId('wallDrawMode').value=closed?'closed':'single';this.wallDrawing.mode=byId('wallDrawMode').value;this.wallStateLast=this.wallSessionState();
  this.world.controls.enabled=false;this.transform.detach();
 }
 endWallDrawing(){
  const original=this.wallEditOriginal;
  if(original&&original.object&&this.items.includes(original.object)){
   if(original.object.userData.editorKind==='stairs')rebuildOfficeStairs(original.object,original.stairs);else rebuildOfficeWall(original.object,original.wall);
   original.object.userData.physics=original.physics;this.physics.sync(original.object);
  }
  this.curveDrawing=null;this.curvePreview=null;this.faceDrawing=null;this.facePreview=null;this.mediaPickerURLs=[];
  this.wallDrawing=null;this.wallEditTarget=null;this.wallEditOriginal=null;this.wallTextureMediaId='';this.wallStateLast=null;this.wallSessionHistory.clear();++this.wallPreviewTextureReq;this.wallPreviewCustom?.dispose();this.wallPreviewCustom=null;this.wallPreviewTextureId='';
  if(this.wallPreview){this.world.scene.remove(this.wallPreview);this.disposeObject(this.wallPreview);this.wallPreview=null;}
  if(byId('wallPanel'))byId('wallPanel').hidden=true;
  this.world.controls.enabled=true;
  if(this.selected&&this.canTransform(this.selected)&&this.selected.userData.editorKind!=='robot')this.transform.attach(this.selected);
 }
 groundPoint(event){
  const canvas=this.world.renderer.domElement,rect=canvas.getBoundingClientRect();
  this.pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
  this.raycaster.setFromCamera(this.pointer,this.world.camera);
  const hit=this.raycaster.intersectObject(this.world.floor)[0];return hit?{x:hit.point.x,z:hit.point.z}:null;
 }
 wallPointer(event){
  if(!this.wallDrawing||!this.world.renderer.domElement.contains(event.target))return false;
  const draft=this.wallDrawing,raw=this.groundPoint(event);if(!raw)return true;
  const anchor=draft.points.at(-1);
  const config={grid:byId('wallSnap').checked,step:Number(byId('wallGridStep').value),angle:draft.mode==='freehand'?0:Number(byId('wallAngleStep').value)};
  const point=snapWallPoint(raw,anchor,config);
  if(event.type==='pointerdown'){
   if(draft.finished)return true;
   if(draft.mode==='freehand'){draft.points=[point];draft.drawing=true;}
   else if(draft.mode==='closed'&&draft.points.length>=3&&Math.hypot(point.x-draft.points[0].x,point.z-draft.points[0].z)<.5){draft.closed=true;draft.finished=true;}
   else if(!anchor||Math.hypot(point.x-anchor.x,point.z-anchor.z)>.05){draft.points.push(point);if(draft.mode==='single'&&draft.points.length>=2)draft.finished=true;}
   draft.cursor=point;this.drawWallPreview();this.trackWallState();
  }else if(event.type==='pointermove'){
   draft.cursor=point;
   if(draft.mode==='freehand'&&draft.drawing&&(!anchor||Math.hypot(point.x-anchor.x,point.z-anchor.z)>.09)&&draft.points.length<150)draft.points.push(point);
   this.drawWallPreview();
  }else if(event.type==='pointerup'&&draft.drawing){draft.drawing=false;draft.finished=true;draft.cursor=point;this.drawWallPreview();this.trackWallState();}
  return true;
 }
 drawWallPreview(){
  const draft=this.wallDrawing;if(!draft)return;
  if(this.wallPreview){this.world.scene.remove(this.wallPreview);this.disposeObject(this.wallPreview);this.wallPreview=null;}
  const preview=new THREE.Group();preview.name='Wall draft · not saved';preview.userData.wallPreview=true;
  const stroke=draft.points.slice();
  if(draft.cursor&&!draft.finished&&draft.mode!=='freehand'&&stroke.length){
   const last=stroke.at(-1);if(Math.hypot(draft.cursor.x-last.x,draft.cursor.z-last.z)>.05)stroke.push(draft.cursor);
  }
  if(stroke.length>=2){
   const local=wallWorldToLocal(stroke);const stairs=draft.kind==='stairs';const options=stairs?this.readStairOptions(local.points):this.readWallOptions(local.points);
   if(!stairs){options.closed=draft.closed;}
   const custom=options.texture==='custom';if(custom){options.texture='plaster';options.textureMediaId='';if(!this.wallPreviewCustom&&this.wallTextureMediaId)this.loadWallDraftTexture(this.wallTextureMediaId);}
   const ghost=stairs?makeOfficeStairs(options):makeOfficeWall(options);ghost.position.set(local.origin.x,0,local.origin.z);
   const solid=byId('wallPreviewMode').value==='solid';
   for(const child of ghost.children){if(solid&&custom&&this.wallPreviewCustom){child.material.map?.dispose();child.material.map=this.wallPreviewCustom.clone();child.material.needsUpdate=true;}if(!solid){child.material?.map?.dispose();child.material?.dispose();child.material=new THREE.MeshBasicMaterial({color:'#55ecf8',transparent:true,opacity:.67,wireframe:true,depthTest:false});}else{child.material.transparent=true;child.material.opacity=Math.min(.72,options.opacity);child.material.depthWrite=false;const edges=new THREE.LineSegments(new THREE.EdgesGeometry(child.geometry),new THREE.LineBasicMaterial({color:'#50f0fc',transparent:true,opacity:.8,depthTest:false}));edges.renderOrder=951;child.add(edges);}child.renderOrder=950;}
   preview.add(ghost);
   const path=new THREE.BufferGeometry().setFromPoints(stroke.map(p=>new THREE.Vector3(p.x,.055,p.z)));
   const line=new THREE.Line(path,new THREE.LineBasicMaterial({color:'#ffffff',depthTest:false}));line.renderOrder=952;preview.add(line);
  }
  if(draft.cursor){
   const marker=new THREE.Mesh(new THREE.RingGeometry(.13,.20,28),new THREE.MeshBasicMaterial({color:'#7df7ff',transparent:true,opacity:1,side:THREE.DoubleSide,depthTest:false}));
   marker.rotation.x=-Math.PI/2;marker.position.set(draft.cursor.x,.08,draft.cursor.z);marker.renderOrder=960;preview.add(marker);
   const cross=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.29,0,0),new THREE.Vector3(.29,0,0),new THREE.Vector3(0,0,-.29),new THREE.Vector3(0,0,.29)]);
   const lines=new THREE.LineSegments(cross,new THREE.LineBasicMaterial({color:'#7df7ff',depthTest:false}));lines.position.copy(marker.position);lines.renderOrder=961;preview.add(lines);
  }
  // Scale references, display-only: 1.70-m person and 2.50-m ceiling marker.
  const ref=draft.points[0]||draft.cursor;
  if(ref){const person=new THREE.Group(),lineMat=new THREE.LineBasicMaterial({color:'#ffd66b',transparent:true,opacity:.85,depthTest:false});
   const path=[[0,0],[0,1.25],[-.23,.9],[0,1.25],[.23,.9],[0,1.25],[0,1.02],[-.16,.04],[0,1.02],[.16,.04]].map(([x,y])=>new THREE.Vector3(x,y,0));
   const stroke=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(path),lineMat);person.add(stroke);
   const head=new THREE.Mesh(new THREE.SphereGeometry(.14,12,8),new THREE.MeshBasicMaterial({color:'#ffd66b',wireframe:true,depthTest:false}));head.position.y=1.56;person.add(head);
   person.position.set(ref.x,.04,ref.z);person.renderOrder=953;preview.add(person);
   if(draft.kind!=='stairs'){
    const elevation=Math.max(2,Math.min(5,Number(byId('wallCeilingHeight').value)||2.5));
    const ceilingPoints=(stroke.length>=2?stroke:[{x:ref.x-.8,z:ref.z},{x:ref.x+.8,z:ref.z}]).map(p=>new THREE.Vector3(p.x,elevation,p.z));
    if(draft.closed&&stroke.length>=3)ceilingPoints.push(ceilingPoints[0].clone());
    const ceiling=new THREE.Line(new THREE.BufferGeometry().setFromPoints(ceilingPoints),new THREE.LineDashedMaterial({color:'#ffbd68',dashSize:.14,gapSize:.08,depthTest:false}));ceiling.computeLineDistances();ceiling.renderOrder=956;preview.add(ceiling);
   }
  }
  this.wallPreview=preview;this.world.scene.add(preview);
  byId('wallConfirm').disabled=draft.points.length<2||(draft.mode==='closed'&&draft.points.length<3);
  byId('wallSmoothNow').disabled=draft.points.length<3;
  byId('wallStatus').textContent=draft.points.length?`${draft.points.length} points${draft.finished?' · ready':''}`:'Click floor to start';
 }
 finishWallStroke(){if(!this.wallDrawing)return;this.wallDrawing.finished=this.wallDrawing.points.length>1;if(this.wallDrawing.mode==='closed'&&this.wallDrawing.points.length>=3)this.wallDrawing.closed=true;this.drawWallPreview();this.trackWallState();}
 confirmWall(){
  const target=this.wallEditTarget;
  if(target){
   if(!this.canEdit(target))return this.toast('Owner only');
   const before=this.wallEditOriginal?.before||this.snapshot(target);
   if(target.userData.editorKind==='stairs')rebuildOfficeStairs(target,this.readStairOptions(target.userData.stairs?.points));
   else rebuildOfficeWall(target,this.readWallOptions(target.userData.wall?.points));
   target.userData.physics=physicsOptions({mode:target.userData.stairs?.variant==='lift'?'kinematic':['escalator','walkway'].includes(target.userData.stairs?.variant)?'static':byId('wallPhysics').value});this.physics.sync(target);
   this.wallEditOriginal=null;this.recordEdit(before,this.snapshot(target));this.queueSave(target);
   this.endWallDrawing();this.toast('Wall updated');return;
  }
  const draft=this.wallDrawing;if(!draft||draft.points.length<2)return;
  let points=draft.points;
  if(draft.mode==='freehand'&&byId('wallSmooth').checked)points=smoothWallPoints(points.map(p=>[p.x,p.z]),Number(byId('wallSmoothStrength').value)).map(([x,z])=>({x,z}));
  if(points.length<2)return this.toast('Draw at least two points');
  const local=wallWorldToLocal(points);const stairs=draft.kind==='stairs';const options=stairs?this.readStairOptions(local.points):this.readWallOptions(local.points);
  if(!stairs)options.closed=draft.closed;const wall=objectFor(stairs?'stairs':'wall');
  wall.position.set(local.origin.x,0,local.origin.z);wall.name=stairs?({advanced:'Stairs advanced',escalator:'Escalator',walkway:'Moving walkway',lift:'Lift'}[options.variant]||'Office stairs'):options.closed?'Closed room':'Office wall';
  wall.userData.ownerId=window.solviAPI?.auth()?.profile?.id||null;
  wall.userData.physics=physicsOptions({mode:stairs&&options.variant==='lift'?'kinematic':stairs&&['escalator','walkway'].includes(options.variant)?'static':byId('wallPhysics').value});if(stairs)rebuildOfficeStairs(wall,options);else rebuildOfficeWall(wall,options);
  this.items.push(wall);this.world.scene.add(wall);this.physics.sync(wall);this.endWallDrawing();
  this.skipNextWallPanel=true;this.select(wall);this.skipNextWallPanel=false;
  this.refreshList();this.recordEdit(null,this.snapshot(wall));this.queueSave(wall);this.toast('Office wall created');
 }
 events(){
  const canvas=this.world.renderer.domElement;let startX,startY;
  window.addEventListener('keydown',e=>{if(!byId('wallPanel')||byId('wallPanel').hidden)return;const cmd=e.ctrlKey||e.metaKey;if(cmd&&e.code==='KeyZ'){e.preventDefault();e.stopImmediatePropagation();e.shiftKey?this.redoWall():this.undoWall();return;}if(cmd&&e.code==='KeyY'){e.preventDefault();e.stopImmediatePropagation();this.redoWall();return;}if(!this.wallDrawing)return;if(e.key==='Escape'){e.preventDefault();this.endWallDrawing();}else if(e.key==='Enter'&&!e.target?.closest?.('input,select,textarea')){e.preventDefault();this.finishWallStroke();}},true);
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])document.addEventListener(type,e=>{if(this.spatialPointer(e)){e.preventDefault();e.stopImmediatePropagation();return;}if(this.wallPointer(e)){e.preventDefault();e.stopPropagation();}},true);
  canvas.addEventListener('dblclick',e=>{if(this.wallDrawing){e.preventDefault();e.stopPropagation();this.finishWallStroke();}},true);
  const orbitGesture=new OrbitGesture();
  this.lastPointer={x:innerWidth/2,y:innerHeight/2};window.addEventListener('pointermove',e=>{if(!document.pointerLockElement)this.lastPointer={x:e.clientX,y:e.clientY};},{passive:true});
  canvas.addEventListener('pointerdown',e=>{
   startX=e.clientX;startY=e.clientY;
   // The first press owns the gesture. Moving over a gizmo cannot steal a camera drag,
   // and touching empty space cannot turn an in-progress transform into an orbit.
   const canOrbit=!this.transform.dragging&&!this.transform.axis&&!this.world.editorDragging&&!this.world.editorGizmoPointer;
   const startedOrbit=orbitGesture.press(e.pointerId,canOrbit);
   this.world.cameraOrbitGesture=startedOrbit;
   this.world.editorGizmoPointer=!startedOrbit;
   // Capture phase: OrbitControls sees the correct enabled state at pointerdown.
   this.world.controls.enabled=startedOrbit&&!this.world.renderer.xr.isPresenting&&document.pointerLockElement!==canvas;
  },true);
  const finishGesture=(event,force=false)=>{
   // Browser/pen drivers can deliver a mouse release with another pointer ID.
   if(!force&&event.pointerType!=='touch'&&event.buttons===0&&!orbitGesture.has(event.pointerId))force=true;
   if(force)orbitGesture.cancel();else orbitGesture.release(event.pointerId);
   this.world.cameraOrbitGesture=orbitGesture.pointers.size?orbitGesture.orbiting:null;
   this.world.controls.enabled=!(this.curveDrawing||this.faceDrawing)&&!this.world.editorDragging&&!this.world.renderer.xr.isPresenting&&document.pointerLockElement!==canvas;
   if(!orbitGesture.pointers.size){
    // Never re-enable orbit on idle hover, including the release frame.
    queueMicrotask(()=>{
     recoverStaleOrbitPointers(this.world.controls,orbitGesture.pointers);
     if(!this.transform.dragging)this.world.editorGizmoPointer=false;
    });
   }
  };
  window.addEventListener('pointerup',e=>finishGesture(e),true);
  window.addEventListener('pointercancel',e=>finishGesture(e),true);
  canvas.addEventListener('lostpointercapture',e=>{
   if(orbitGesture.has(e.pointerId))finishGesture(e);
  });
  canvas.addEventListener('pointermove',e=>{
   if(orbitGesture.orphanedMove(e))finishGesture(e,true);
  },true);
  window.addEventListener('blur',()=>finishGesture(null,true));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finishGesture(null,true);});
  // 1/front, 3/right, 7/top; Ctrl/Meta reverses; 2/4/6/8 orbit steps.
  window.addEventListener('keydown',e=>{
   if(e.target?.closest?.('input,textarea,select,[contenteditable]')||e.altKey||this.world.renderer.xr.isPresenting)return;
   const zoomIn=e.code==='NumpadAdd'||(e.code==='Equal'&&e.shiftKey)||e.key==='+';
   const zoomOut=e.code==='NumpadSubtract'||e.code==='Minus'||e.key==='-';
   if((zoomIn||zoomOut)&&this.selected&&!e.ctrlKey&&!e.metaKey){
     e.preventDefault();this.world.zoomOnSelectedObject(zoomIn?1:-1);return;
   }
   const m=/^(?:Numpad|Digit)([0-9])$/.exec(e.code);
   if(!m||e.shiftKey)return;
   e.preventDefault();this.world.cameraPreset(Number(m[1]),e.ctrlKey||e.metaKey);
  });
  canvas.addEventListener('pointerup',e=>{
   if(this.transform.dragging||this.transform.axis||Math.hypot(e.clientX-startX,e.clientY-startY)>4||this.world.renderer.xr.isPresenting)return;
   this.pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);
   this.raycaster.setFromCamera(this.pointer,this.world.camera);
   const hits=this.raycaster.intersectObjects(this.items,true);
   if(hits.length){let node=hits[0].object;while(node.parent&&!this.items.includes(node))node=node.parent;
    if(this.items.includes(node)){this.select(node);e.solviObjectPicked=true;}}
   else if(this.selected?.userData.editorKind==='robot'&&this.selected?.userData.robotMode!=='idle'){
    const ground=this.raycaster.intersectObject(this.world.floor)[0];if(ground){setRobotDestination(this.selected,ground.point);this.queueSave(this.selected);}}
  },true);
  window.addEventListener('keydown',e=>{
   if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable)return;
   const cmd=e.metaKey||e.ctrlKey;
   if(cmd&&e.code==='KeyZ'){e.preventDefault();e.shiftKey?this.redo():this.undo();return;}
   if(cmd&&e.code==='KeyY'){e.preventDefault();this.redo();return;}
   if(e.metaKey||e.ctrlKey||e.altKey)return;
   if(e.shiftKey&&e.code==='KeyA'){e.preventDefault();if(byId('addMenu').hidden){this.showAddMenu(this.lastPointer.x,this.lastPointer.y);byId('addSearch')?.focus();}else byId('addMenu').hidden=true;}
   else if(this.selected&&e.shiftKey&&e.code==='KeyD'){e.preventDefault();this.duplicate();}
   else if(this.selected&&e.code==='KeyX'){e.preventDefault();this.remove();}
   else if(!e.repeat&&this.controlMode==='robot'&&this.controlledRobot()&&combatForKey(e.code,this.controlledRobot().userData.robotCombat)){e.preventDefault();const bot=this.controlledRobot();this.triggerRobotCombat(bot,combatForKey(e.code,bot.userData.robotCombat));}
   else if(this.controlMode==='robot'&&this.controlledRobot()&&['ShiftLeft','ShiftRight'].includes(e.code)){this.robotKeys.add(e.code);}
   else if(this.controlMode==='robot'&&this.controlledRobot()&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)){e.preventDefault();this.robotKeys.add(e.code);this.world.keys.delete(e.code);if(e.code==='Space'&&!e.repeat){robotAction(this.controlledRobot(),'jump');/* Jump is synchronised through the compact robot-input event. */}else if(e.code!=='Space'){this.controlledRobot().userData.robotGoal=null;}}
   else if(this.selected&&e.code==='KeyO'&&this.selected.userData.editorKind==='cube'){e.preventDefault();this.startFaceDrawing('opening');}
   else if(this.selected&&e.code==='KeyU'&&['cube','plane'].includes(this.selected.userData.editorKind)){e.preventDefault();this.startFaceDrawing('media');}
   else if(this.selected&&['KeyG','KeyR','KeyS'].includes(e.code)){if(!this.canTransform(this.selected)){this.toast('Unlock this object to transform it');return;}this.transform.setMode({KeyG:'translate',KeyR:'rotate',KeyS:'scale'}[e.code]);}
   else if(this.selected&&['Delete','Backspace'].includes(e.key)){e.preventDefault();this.remove();}
  });
  window.addEventListener('keyup',e=>{this.robotKeys.delete(e.code);});
  window.addEventListener('blur',()=>{this.robotKeys.clear();this.walkHeldSince=null;this.broadcastEdit(false);});
 }
 canTransform(obj){return mayTransform(obj,this.canEdit(obj));}
 canEdit(obj){if(!obj)return false;const policy=window.solviRoomPolicy||{objects:'open',robots:'open'};const type=obj.userData.editorKind==='robot'?'robots':'objects';if(policy[type]!=='owned')return true;if(window.solviIsAdmin?.())return true;const uid=window.solviAPI?.auth()?.profile?.id;return !obj.userData.ownerId||obj.userData.ownerId===uid;}
 duplicate(){
  if(!this.selected)return;if(!this.canEdit(this.selected))return this.toast('Owner only');const source=this.selected,entry=this.snapshot(source);if(!entry)return;
  const duplicate=objectFor(entry.kind);if(entry.kind==='text')rebuildText(duplicate,entry.text,()=>{if(this.items.includes(duplicate))this.physics.sync(duplicate);});if(PRIMITIVE_FIELDS[entry.kind]){duplicate.userData.primitive=sanitisePrimitive(entry.kind,entry.primitive);duplicate.geometry.dispose();duplicate.geometry=entry.kind==='cube'?cutCubeGeometry(duplicate.userData.primitive,entry.openings):buildPrimitive(entry.kind,duplicate.userData.primitive);duplicate.userData.openings=cleanOpenings(entry.openings);}duplicate.name=nextDuplicateName(source.name,this.items.map(x=>x.name));duplicate.position.copy(source.position);duplicate.quaternion.copy(source.quaternion);duplicate.scale.copy(source.scale);
  const box=new THREE.Box3().setFromObject(source);
  const measured=box.isEmpty()?0:box.getSize(new THREE.Vector3()).y;
  const height=entry.kind==='robot'?Math.max(1.9,measured):Math.max(.32,measured);
  duplicate.position.y+=duplicateElevation(height);
  if(entry.color&&entry.kind!=='model')duplicate.traverse(mesh=>{if(mesh.material?.color)mesh.material.color.set(entry.color);});
  duplicate.userData.textureName=entry.texture||'none';
  if(entry.texture&&entry.texture!=='none'&&entry.texture!=='custom')duplicate.traverse(mesh=>{if(mesh.material?.isMeshStandardMaterial){mesh.material.map=makeTexture(entry.texture);mesh.material.needsUpdate=true;}});
  if(entry.kind==='curve'){duplicate.userData.curve=cleanCurve(entry.curve);duplicate.geometry.dispose();duplicate.geometry=buildCurveGeometry(duplicate.userData.curve);}if(entry.kind==='media'){duplicate.userData.media=structuredClone(entry.media||{});hydrateSceneMedia(duplicate,this.world);}
  if(entry.kind==='model'){duplicate.userData.modelUrl=entry.model;hydrateSceneModel(duplicate);}
  if(entry.kind==='wall')rebuildOfficeWall(duplicate,entry.wall||{});if(entry.kind==='stairs')rebuildOfficeStairs(duplicate,entry.stairs||{});
  if(entry.kind==='light')setLight(duplicate,entry.light||{});duplicate.userData.robotSpeed=entry.speed??1.8;duplicate.userData.robotStrafeSpeed=entry.strafeSpeed??2.5;duplicate.userData.robotTurnSpeed=entry.turnSpeed??4;duplicate.userData.robotBrain=structuredClone(entry.brain||{});duplicate.userData.robotCombat=combatSettings(entry.combat);duplicate.userData.robotAnimationSpeed=animationSpeedSettings(entry.animationSpeed);duplicate.userData.physics=physicsOptions(entry.physics);duplicate.userData.ownerId=window.solviAPI?.auth()?.profile?.id||null;duplicate.userData.avatarUrl=source.userData.avatarUrl||DEFAULT_ROBOT_AVATAR;this.items.push(duplicate);this.world.scene.add(duplicate);this.physics.sync(duplicate);this.select(duplicate);if(entry.kind==='robot')hydrateRobot(duplicate);this.recordEdit(null,this.snapshot(duplicate));this.queueSave(duplicate);this.toast('Duplicated above original');
 }
 async replaceSpeakerModel(mediaObject,asset){
  if(mediaObject?.userData.editorKind!=='media'||sceneMediaKind(mediaObject.userData.media?.mime)!=='audio'||!this.canEdit(mediaObject))return false;
  mediaObject.userData.media.model=asset.url;hydrateSceneMedia(mediaObject,this.world);this.queueSave(mediaObject);this.toast('Speaker model applied · '+asset.label);return true;
 }
 cameraDropPosition(distance=3.2){
  const direction=this.world.camera.getWorldDirection(new THREE.Vector3()).normalize();
  const camera=this.world.camera.position;
  // Place along the real gaze ray, not projected into the world XZ plane.
  // Move closer if looking down toward the floor to keep the object in sight.
  let forward=distance;
  if(direction.y<-.01&&camera.y+direction.y*forward<.85)forward=Math.max(.65,(camera.y-.85)/(-direction.y));
  const point=camera.clone().addScaledVector(direction,forward);
  point.y=Math.max(.65,point.y);
  return point;
 }
 // compatibility marker: addSceneMedia(media,{backing='white',width=null,height=null}={})
addSceneMedia(media,{backing='white',width=null,height=null,loop=true,refDistance=4,maxDistance=18,autoplayDistance=0,constantVolume=false,group='',shape='speaker',mount=null}={}){const object=objectFor('media');const x=this.lastPointer?.x??innerWidth/2,y=this.lastPointer?.y??innerHeight/2;this.pointer.set(x/innerWidth*2-1,1-y/innerHeight*2);this.raycaster.setFromCamera(this.pointer,this.world.camera);const point=this.cameraDropPosition(3.2);object.position.copy(point);object.userData.ownerId=window.solviAPI?.auth()?.profile?.id||null;object.userData.media={id:media.id,mime:media.mime,name:media.name,backing,stream:'direct',width:width??media.width??null,height:height??media.height??null,loop,muted:false,refDistance,maxDistance,autoplayDistance,constantVolume,group,shape,volume:1,color:'#3c9bd2',author:media.author||window.solviAPI?.auth()?.profile?.name||'User',created:media.created||new Date().toISOString(),caption:''};if(mount)object.userData.media.mount=structuredClone(mount);const kind=sceneMediaKind(media.mime);object.name=(kind==='video'?'Video screen · ':kind==='audio'?'Audio speaker · ':'Picture frame · ')+(media.name||'media');this.items.push(object);this.world.scene.add(object);this.physics.sync(object);hydrateSceneMedia(object,this.world);if(mount){object.userData.physics={mode:'off'};this.updateMountedMedia();this.physics.sync(object);}this.select(object);this.refreshList();this.recordEdit(null,this.snapshot(object));this.queueSave(object);return object;}
 add(kind,showGallery=true,lightType=undefined,persist=true){const object=objectFor(kind);if(kind==='light'&&lightType){setLight(object,{type:lightType});object.name='New '+lightType+' light';}
 const x=this.lastPointer?.x??innerWidth/2,y=this.lastPointer?.y??innerHeight/2;this.pointer.set(x/innerWidth*2-1,1-y/innerHeight*2);this.raycaster.setFromCamera(this.pointer,this.world.camera);const point=this.cameraDropPosition(3.2);object.position.x=point.x;object.position.z=point.z;if(kind!=='robot')object.position.y=Math.max(.8,point.y);
 object.userData.ownerId=window.solviAPI?.auth()?.profile?.id||null;if(PRIMITIVE_FIELDS[kind])object.userData.primitive=sanitisePrimitive(kind);this.items.push(object);this.world.scene.add(object);this.physics.sync(object);this.select(object);byId('addMenu').hidden=true;this.refreshList();if(kind==='robot'){hydrateRobot(object);if(showGallery)this.avatarGallery?.open();}if(kind==='model'&&object.userData.modelUrl)hydrateSceneModel(object);if(kind!=='model'&&persist){this.recordEdit(null,this.snapshot(object));this.queueSave(object);}return object;}
 select(obj){if(this.wallEditTarget&&this.wallEditTarget!==obj)this.endWallDrawing();if(this.selected&&this.selected!==obj)this.broadcastEdit(false);this.clearLightHelper();this.robotKeys?.clear();this.localRobotInput=null;this.selected=obj;
  if(obj?.userData.editorKind==='robot')for(const key of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'])this.world.keys.delete(key);
  // Robots are controlled with arrows, not a permanent transform gizmo.
  if(this.canTransform(obj)&&obj.userData.editorKind!=='robot')this.transform.attach(obj);
  else{this.transform.detach();if(!this.canEdit(obj))this.toast('Read-only object · owned by another user');}
  this.updateInspector();this.refreshList();this.updateRobotDebugStatus();
  if(['wall','stairs'].includes(obj?.userData.editorKind)&&!this.wallDrawing&&!this.skipNextWallPanel)this.openWallPanel(obj);else if(this.wallEditTarget)this.endWallDrawing();
  window.dispatchEvent(new CustomEvent('solvi:properties-robot-selected',{detail:{robotId:obj?.userData.editorKind==='robot'?obj.userData.editorId:null}}));
  // Selection must never move the camera; numpad presets and zoom remain explicit.
  if(obj)this.broadcastEdit(true);}
 updateInspector(){const obj=this.selected;byId('objectInspector').hidden=!obj;byId('inspectorValueSlider').hidden=true;if(obj)byId('propertiesPanel').hidden=false;if(!obj)return;
  this.syncTransformLockControls(obj);
  this.renderPrimitiveControls(obj);this.renderCurveControls(obj);this.renderTextGeometryControls(obj);
  byId('physicsObjectControls').hidden=['robot','light'].includes(obj.userData.editorKind);const phys=physicsOptions(obj.userData.physics);byId('objectPhysicsMode').value=phys.mode;byId('objectCollider').value=phys.collider||'box';this.updateColliderOption();this.updateCombatPhysicsHint();byId('objectRestitution').value=phys.restitution;byId('objectFriction').value=phys.friction;this.syncPhysicsSurface?.();byId('robotControls').hidden=obj.userData.editorKind!=='robot';byId('lightControls').hidden=obj.userData.editorKind!=='light';byId('mediaObjectControls').hidden=obj.userData.editorKind!=='media';if(obj.userData.editorKind==='robot'){byId('robotAvatar').value=obj.userData.avatarUrl||DEFAULT_ROBOT_AVATAR;}
  byId('objectName').textContent=obj.name;byId('objectNameInput').value=obj.name;byId('objectNameInput').disabled=!this.canEdit(obj);
  if(obj.userData.editorKind==='robot')this.refreshRobotActions(obj);
  if(obj.userData.editorKind==='robot'){const settings=combatSettings(obj.userData.robotCombat);for(const el of byId('robotCombatList').querySelectorAll('[data-combat-action]'))el.value=String(settings[el.dataset.combatAction][el.dataset.combatField]);}
  byId('objectAppearance').hidden=['robot','light','model','media','wall'].includes(obj.userData.editorKind);for(const id of ['replaceModelFile','replaceModelGallery']){byId(id).hidden=obj.userData.editorKind!=='model';byId(id).disabled=!this.canEdit(obj); }if(obj.userData.editorKind==='light'){this.refreshLightControls();this.showLightHelper(obj);}if(obj.userData.editorKind==='robot'){byId('robotStrafeSpeed').value=obj.userData.robotStrafeSpeed??2.5;byId('robotStrafeLabel').textContent=Number(obj.userData.robotStrafeSpeed??2.5).toFixed(1)+'×';const factor=obj.userData.robotSpeed??1.8;byId('robotSpeed').value=factor;byId('robotSpeedLabel').textContent=Number(factor).toFixed(2)+'×';const turnFactor=obj.userData.robotTurnSpeed??4;byId('robotTurnSpeed').value=turnFactor;byId('robotTurnLabel').textContent=Number(turnFactor).toFixed(2)+'×';const anim=animationSpeedSettings(obj.userData.robotAnimationSpeed);byId('animationWalk').value=anim.walk;byId('animationRun').value=anim.run;byId('animationJump').value=anim.jump;this.syncRobotSpeed?.();}if(obj.userData.editorKind==='media'){const media=obj.userData.media||{};const kind=sceneMediaKind(media.mime);byId('mediaSourceLabel').textContent=media.name||'Uploaded media';byId('mediaBacking').value=media.backing||'white';byId('mediaStreamMode').value=media.stream||'direct';byId('mediaPlayPause').textContent=sceneMediaPlaying(obj)?'Pause':'Play';byId('mediaMuteToggle').textContent=sceneMediaMuted(obj)?'Unmute':'Mute';byId('mediaLoopToggle').checked=media.loop!==false;byId('mediaRefDistance').value=media.refDistance??4;byId('mediaMaxDistance').value=media.maxDistance??18;byId('mediaAutoplayDistance').value=media.autoplayDistance??0;byId('mediaConstantVolume').checked=media.constantVolume===true;byId('mediaGroup').value=media.group||'';byId('mediaVolume').value=media.volume??1;byId('mediaStreamRow').hidden=kind!=='video';byId('mediaBackingRow').hidden=kind==='audio';byId('mediaAudioFields').hidden=kind!=='audio';byId('mediaOrbAppearance').hidden=media.shape!=='orb';byId('mediaOrbColor').value=media.color||'#3c9bd2';byId('mediaOrbTexture').value=media.orbTexture||'none';byId('mediaTranscriptText').textContent=media.caption||'No transcription yet';this.updateMediaHUDPosition?.();}
  for(const name of ['position','rotation','scale'])['x','y','z'].forEach((axis,i)=>{
    const v=obj[name][axis];byId(`${name}-${i}`).value=name==='rotation'?(THREE.MathUtils.radToDeg(v)).toFixed(1):v.toFixed(2);if(this.activateInspectorValue && !byId('inspectorValueSlider').hidden && byId('inspectorActiveRange') && document.activeElement?.id===`${name}-${i}`)this.activateInspectorValue(document.activeElement);
  });
  const color=obj.material?.color||obj.children.find(c=>c.material?.color)?.material?.color;
  byId('objectColor').value=color?'#'+color.getHexString():'#88bbdd';byId('texturePreset').value=obj.userData.textureName||'none';
 }
 renderPrimitiveControls(obj){
  const section=byId('primitiveProperties'),grid=byId('primitivePropertiesFields'),fields=PRIMITIVE_FIELDS[obj?.userData?.editorKind];
  section.hidden=!fields;grid.replaceChildren();if(!fields)return;
  const kind=obj.userData.editorKind,config=sanitisePrimitive(kind,obj.userData.primitive||{});obj.userData.primitive=config;
  const keys=Object.keys(fields),select=document.createElement('select'),number=document.createElement('input');
  select.className='primitive-property-select';select.setAttribute('aria-label','Geometry property');
  number.type='number';number.className='primitive-property-value';number.setAttribute('aria-label','Selected geometry value');
  const range=document.createElement('input');range.type='range';range.className='primitive-property-range';range.setAttribute('aria-label','Adjust selected geometry property');
  for(const key of keys){const option=document.createElement('option');option.value=key;option.textContent=key.replace(/([A-Z])/g,' $1');select.append(option);}
  let editStart=null;
  const refresh=()=>{editStart=null;const key=select.value,[initial,min,max]=fields[key],value=obj.userData.primitive?.[key]??initial;number.min=range.min=String(min);number.max=range.max=String(max);number.step=range.step=key.toLowerCase().includes('segment')?'1':'0.05';number.value=range.value=String(value);number.disabled=range.disabled=!this.canEdit(obj);};
  const apply=(value,commit)=>{if(!this.canEdit(obj))return;if(!editStart)editStart=this.snapshot(obj);const key=select.value,before=editStart;const next=sanitisePrimitive(kind,{...obj.userData.primitive,[key]:value});const geom=kind==='cube'?cutCubeGeometry(next,obj.userData.openings):buildPrimitive(kind,next);if(!geom)return;
   const old=obj.geometry;obj.geometry=geom;old?.dispose();obj.userData.primitive=next;number.value=range.value=String(next[key]);this.physics.sync(obj);if(commit){this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);editStart=null;}};
  select.onchange=refresh;number.oninput=()=>apply(number.value,false);number.onchange=()=>apply(number.value,true);
  range.oninput=()=>apply(range.value,false);range.onchange=()=>{apply(range.value,true);};
  grid.append(select,number,range);refresh();
 }

 syncTransformLockControls(obj){
  const locked=isTransformLocked(obj),permitted=this.canEdit(obj);
  if(locked&&this.transform.object===obj)this.transform.detach();
  for(const mode of ['translate','rotate','scale']){const button=byId('transform-'+mode);button.disabled=!permitted||locked;button.title=locked?'Unlock object in Objects list before transforming':button.getAttribute('aria-label')||mode;}
  for(const field of ['position','rotation','scale']){
   byId(field+'-reset').disabled=!permitted||locked;
   for(let i=0;i<3;i++)byId(field+'-'+i).disabled=!permitted||locked;
  }
  if(locked)byId('inspectorValueSlider').hidden=true;
 }
 toggleTransformLock(obj){
  if(!obj||!this.canEdit(obj))return this.toast('Only permitted users can lock objects');
  const locked=!isTransformLocked(obj);
  obj.userData.transformLocked=locked;
  if(locked&&this.transform.object===obj){this.transform.detach();this.world.editorGizmoPointer=false;this.world.editorDragging=false;}
  if(obj===this.selected){this.syncTransformLockControls(obj);if(!locked&&obj.userData.editorKind!=='robot')this.transform.attach(obj);}
  this.queueSave(obj);this.refreshList();this.toast(locked?'Transform locked · '+obj.name:'Transform unlocked · '+obj.name);
 }
 updateCombatPhysicsHint(){
  const obj=this.selected,hint=byId('combatObjectPhysicsHint'),make=byId('makeObjectPushable');
  if(!hint||!make)return;
  const eligible=obj&&!['robot','light'].includes(obj.userData.editorKind);
  hint.hidden=!eligible;make.hidden=!eligible||byId('objectPhysicsMode').value==='dynamic';
  if(!eligible)return;
  const mode=byId('objectPhysicsMode').value;
  hint.textContent=mode==='dynamic'?'Pushable: Punch/Kick transfer force when room Physics is on and the attack connects.':
    mode==='off'?'No physics: attacks pass through. Set Dynamic to receive punches and kicks.':
    'Static/kinematic: stays fixed during combat. Use Dynamic if this object should move.';
  make.disabled=!this.canEdit(obj);
 }
 updateColliderOption(){const mode=byId('objectPhysicsMode').value;const selector=byId('objectCollider');selector.disabled=mode!=='static';if(mode!=='static')selector.value='box';byId('colliderHint').hidden=mode!=='static';const status=byId('colliderRuntimeStatus');status.hidden=mode!=='static'||selector.value!=='trimesh';status.textContent=this.selected?.userData.colliderStatus||(this.selected?.userData.editorKind==='model'&&!this.selected?.userData.modelReady?'Waiting for imported model geometry':'Physics must be enabled for collider creation');
  const runtime=byId('physicsRuntimeStatus');runtime.hidden=mode==='off';
  if(mode!=='off'){
    const editorObject=this.selected,id=editorObject?.userData.editorId;
    runtime.textContent=!window.solviRoomPolicy?.physics?'Room physics OFF. Enable Physics in World settings to activate gravity and collisions.':
      !this.physics.enabled||!this.physics.world?'Rapier physics is starting. If this persists, check the browser console and vendor assets.':
      !this.physics.bodies.has(id)?'Physics body not ready. Check the model geometry and scene loading.':
      mode==='dynamic'&&!this.physics.owns(editorObject)?'Dynamic physics simulated by the object owner; this browser displays updates.':
      mode==='dynamic'?'Dynamic body active — gravity, box collider and bouncing enabled. Lift object above the ground to test.':
      mode==='static'?'Static collision body active. Trimesh is supported for static surfaces.':'Kinematic collision body active.';
  }}
 refreshRobotActions(obj){const select=byId('robotActionSelect');select.querySelectorAll('optgroup[data-real-actions]').forEach(n=>n.remove());
  const clips=obj.userData.robotAvailableActions||[];if(clips.length){const group=document.createElement('optgroup');group.label='Model animations';group.dataset.realActions='1';for(const name of clips.slice(0,120))group.append(new Option(name,'clip:'+name));select.append(group);}
  select.value=[...select.options].some(o=>o.value===obj.userData.robotMode)?obj.userData.robotMode:'idle';
 }
  visibleSceneItems(){const term=byId('sceneObjectSearch')?.value?.trim().toLocaleLowerCase()||'';const filter=byId('sceneObjectFilter')?.value||'all';return this.items.filter(o=>(filter==='all'||(filter==='robot')===(o.userData.editorKind==='robot'))&&(!term||(`${o.name} ${o.userData.editorKind}`).toLocaleLowerCase().includes(term)));}
 refreshList(){this.syncControlSwitcher?.();const list=byId('sceneItems');if(!list)return;list.replaceChildren();const visible=this.visibleSceneItems();const ids=new Set(this.items.map(o=>o.userData.editorId));for(const id of this.bulkChecked)if(!ids.has(id))this.bulkChecked.delete(id);
  for(const obj of visible){const row=document.createElement('div');row.className='scene-item-row'+(obj===this.selected?' is-active':'');row.dataset.objectId=obj.userData.editorId;const check=document.createElement('input');check.type='checkbox';check.className='scene-row-check';check.title='Select '+obj.name;check.setAttribute('aria-label','Select '+obj.name);check.checked=this.bulkChecked.has(obj.userData.editorId);check.disabled=!this.canEdit(obj);check.onchange=()=>{if(check.checked)this.bulkChecked.add(obj.userData.editorId);else this.bulkChecked.delete(obj.userData.editorId);this.updateBulkControls();};
   const b=document.createElement('button');b.className='scene-item-name'+(obj===this.selected?' selected':'');b.textContent=`${obj.userData.editorKind} · ${obj.name}`;b.dataset.objectKind=obj.userData.editorKind;b.setAttribute('aria-current',String(obj===this.selected));b.onclick=()=>this.select(obj);
   const lock=document.createElement('button');lock.type='button';lock.className='scene-item-lock';lock.dataset.uiIcon=isTransformLocked(obj)?'lock':'unlock';lock.dataset.locked=String(isTransformLocked(obj));lock.setAttribute('aria-pressed',String(isTransformLocked(obj)));lock.setAttribute('aria-label',(isTransformLocked(obj)?'Unlock ':'Lock ')+obj.name+' transforms');lock.title=(isTransformLocked(obj)?'Unlock':'Lock')+' transforms · '+obj.name;lock.disabled=!this.canEdit(obj);lock.onclick=()=>this.toggleTransformLock(obj);
   const remove=document.createElement('button');remove.className='scene-item-delete';remove.textContent='';remove.dataset.uiIcon='delete';remove.title='Delete '+obj.name;remove.setAttribute('aria-label','Delete '+obj.name);remove.disabled=!this.canEdit(obj);remove.onclick=()=>{this.select(obj);this.remove();};if(byId('scenePanel').classList.contains('bulk-mode'))row.append(check);row.append(b,lock,remove);list.append(row);}
  this.updateBulkControls();}
 updateBulkControls(){const visible=this.visibleSceneItems().filter(o=>this.canEdit(o));const n=this.items.filter(o=>this.bulkChecked.has(o.userData.editorId)&&this.canEdit(o)).length;byId('sceneDeleteSelected').disabled=n===0;byId('sceneDeleteSelected').textContent=`Delete ${n||'selected'}`;byId('sceneDeleteAll').disabled=!this.items.some(o=>this.canEdit(o));byId('sceneSelectAll').checked=visible.length>0&&visible.every(o=>this.bulkChecked.has(o.userData.editorId));byId('sceneSelectAll').indeterminate=visible.some(o=>this.bulkChecked.has(o.userData.editorId))&&!byId('sceneSelectAll').checked;}
 async removeBulk(all){const targets=this.items.filter(o=>this.canEdit(o)&&(all||this.bulkChecked.has(o.userData.editorId)));if(!targets.length)return;
  if(readDeleteConfirmation()&&!await confirmAction(`Delete ${targets.length} ${all?'editable objects from this room':'selected objects'}? This cannot be undone.`,{title:'Delete scene objects',confirmLabel:'Delete',danger:true}))return;
  // Respect ownership on each object and persist each deletion to the room backend.
  for(const o of targets){if(!this.items.includes(o))continue;this.selected=o;await this.remove(true);this.bulkChecked.delete(o.userData.editorId);}this.selected=null;this.updateInspector();this.refreshList();this.toast(`Deleted ${targets.length} objects`);}

 async remove(skipConfirmation=false){if(!this.selected)return;
  const deleting=this.selected;
  if(!skipConfirmation&&readDeleteConfirmation()&&!await confirmAction(`Delete object "${deleting.name}" from the shared scene?`,{title:'Delete scene object',confirmLabel:'Delete',danger:true}))return;
  if(this.selected!==deleting||!this.items.includes(deleting))return;this.clearLightHelper();if(!this.canEdit(this.selected))return this.toast('Owner only');const o=this.selected;const before=this.snapshot(o);if(this.wallEditTarget===o)this.endWallDrawing();this.transform.detach();this.items=this.items.filter(x=>x!==o);this.world.scene.remove(o);this.physics.remove(o.userData.editorId);this.disposeObject(o);this.selected=null;this.updateInspector();byId('propertiesPanel').hidden=true;this.refreshList();this.recordEdit(before,null);this.persistRemoval(o.userData.editorId);}
 texture(name){if(!this.selected||this.selected.userData.editorKind==='robot')return;if(this.canEdit(this.selected))this.selected.userData.textureName=name;this.assignTexture(name==='none'?null:makeTexture(name));}
 assignTexture(tex){if(!this.selected||!this.canEdit(this.selected)||this.selected.userData.editorKind==='robot')return;this.selected.userData.textureName=this.selected.userData.textureName||'custom';this.queueSave(this.selected);this.selected.traverse(o=>{if(o.material?.isMeshStandardMaterial){if(o.material.map&&o.material.map!==tex)o.material.map.dispose();o.material.map=tex;o.material.needsUpdate=true;}});}
  updateMediaHUDPosition(){const hud=byId('mediaInteractionHud');if(!hud)return;const obj=this.selected;if(!obj||obj.userData?.editorKind!=='media'){hud.hidden=true;return;}const pos=obj.getWorldPosition(new THREE.Vector3());pos.y+=0.9;pos.project(this.world.camera);if(pos.z>1){hud.hidden=true;return;}const rect=this.world.renderer.domElement.getBoundingClientRect();const x=(pos.x*.5+.5)*rect.width+rect.left,y=(-pos.y*.5+.5)*rect.height+rect.top;hud.style.left=`${x}px`;hud.style.top=`${y}px`;hud.hidden=false;byId('mediaHudPlay').textContent=sceneMediaPlaying(obj)?'Pause':'Play';byId('mediaHudMute').textContent=sceneMediaMuted(obj)?'Unmute':'Mute';}

  serialize(){return this.items.map(o=>({id:o.userData.editorId,kind:o.userData.editorKind,name:o.name,position:xyz(o.position),rotation:xyz(o.rotation),scale:xyz(o.scale),color:o.material?.color?'#'+o.material.color.getHexString():null,texture:o.userData.textureName||'none',owner:o.userData.ownerId||null,avatar:o.userData.avatarUrl||undefined,light:o.userData.editorKind==='light'?cleanLightSettings(o.userData.light):undefined,physics:['robot','light'].includes(o.userData.editorKind)?undefined:physicsOptions(o.userData.physics),strafeSpeed:o.userData.editorKind==='robot'?(o.userData.robotStrafeSpeed??2.5):undefined,speed:o.userData.editorKind==='robot'?(o.userData.robotSpeed??1.8):undefined,turnSpeed:o.userData.editorKind==='robot'?(o.userData.robotTurnSpeed??4):undefined,combat:o.userData.editorKind==='robot'?combatSettings(o.userData.robotCombat):undefined,animationSpeed:o.userData.editorKind==='robot'?animationSpeedSettings(o.userData.robotAnimationSpeed):undefined,transformLocked:isTransformLocked(o),brain:o.userData.editorKind==='robot'?(o.userData.robotBrain||{}):undefined,model:o.userData.editorKind==='model'?o.userData.modelUrl:undefined,media:o.userData.editorKind==='media'?structuredClone(o.userData.media||{}):undefined,primitive:PRIMITIVE_FIELDS[o.userData.editorKind]?structuredClone(o.userData.primitive||sanitisePrimitive(o.userData.editorKind)):undefined,curve:o.userData.editorKind==='curve'?structuredClone(cleanCurve(o.userData.curve)):undefined,text:o.userData.editorKind==='text'?structuredClone(cleanText(o.userData.text)):undefined,openings:o.userData.editorKind==='cube'?cleanOpenings(o.userData.openings):undefined,wall:o.userData.editorKind==='wall'?structuredClone(o.userData.wall):undefined,stairs:o.userData.editorKind==='stairs'?structuredClone(o.userData.stairs):undefined}));}
 beginSceneReplacement(){this.cancelSpatialDrawing?.();clearAllRobotPathDebug(this.world);this.history.clear();this.clearLightHelper();for(const o of [...this.items]){this.transform.detach();this.world.scene.remove(o);this.disposeObject(o);}this.items=[];this.selected=null;this.controlledRobotId=null;this.robotKeys.clear();this.sceneRestorePhysics=this.physics.enabled;this.physics.clear();byId('propertiesPanel').hidden=true;}
 addSceneEntry(entry){if(!kinds.includes(entry.kind))return;const o=objectFor(entry.kind);o.userData.editorId=entry.id;o.name=entry.name||o.name;o.userData.ownerId=entry.owner||null;o.userData.transformLocked=entry.transformLocked===true;o.userData.avatarUrl=entry.avatar||DEFAULT_ROBOT_AVATAR;o.userData.robotSpeed=entry.speed??1.8;o.userData.robotStrafeSpeed=entry.strafeSpeed??2.5;o.userData.robotTurnSpeed=entry.turnSpeed??4;o.userData.robotBrain=structuredClone(entry.brain||{});o.userData.robotCombat=combatSettings(entry.combat);o.userData.robotAnimationSpeed=animationSpeedSettings(entry.animationSpeed);o.userData.physics=physicsOptions(entry.physics);if(entry.kind==='light')setLight(o,entry.light||{});if(entry.kind==='model')o.userData.modelUrl=entry.model;if(entry.kind==='media')o.userData.media=structuredClone(entry.media||{});if(entry.kind==='curve'){o.userData.curve=cleanCurve(entry.curve);o.geometry.dispose();o.geometry=buildCurveGeometry(o.userData.curve);}if(entry.kind==='text')rebuildText(o,entry.text,()=>{if(this.items.includes(o))this.physics.sync(o);});if(entry.kind==='wall')rebuildOfficeWall(o,entry.wall||{});if(entry.kind==='stairs')rebuildOfficeStairs(o,entry.stairs||{});if(PRIMITIVE_FIELDS[entry.kind]){o.userData.primitive=sanitisePrimitive(entry.kind,entry.primitive);const previous=o.geometry;o.userData.openings=entry.kind==='cube'?cleanOpenings(entry.openings):undefined;o.geometry=entry.kind==='cube'?cutCubeGeometry(o.userData.primitive,o.userData.openings):buildPrimitive(entry.kind,o.userData.primitive);previous?.dispose();}
   o.position.fromArray(entry.position);o.rotation.fromArray(entry.rotation);o.scale.fromArray(entry.scale);
   if(entry.color&&o.material?.color)o.material.color.set(entry.color);
   o.userData.textureName=entry.texture||'none';if(entry.texture&&entry.texture!=='none'&&entry.texture!=='custom')o.traverse(x=>{if(x.material?.isMeshStandardMaterial){x.material.map=makeTexture(entry.texture);x.material.needsUpdate=true;}});
   this.items.push(o);this.world.scene.add(o);if(entry.kind==='robot')hydrateRobot(o);if(entry.kind==='model')hydrateSceneModel(o);if(entry.kind==='media')hydrateSceneMedia(o,this.world);this.physics.sync(o);}
 endSceneReplacement(){this.refreshList();if(this.sceneRestorePhysics)this.physics.setEnabled(true).catch(e=>this.toast('Physics unavailable: '+e.message));}
 apply(data){this.beginSceneReplacement();for(const entry of data)this.addSceneEntry(entry);this.endSceneReplacement();}
 async applyCooperatively(data,stillCurrent){
  // Both disposal and hydration are chunked. Removing a large room in one
  // synchronous loop can stall the Chromium renderer as readily as creating it.
  const batch=10,previous=[...this.items];
  this.cancelSpatialDrawing?.();clearAllRobotPathDebug(this.world);
  this.history.clear();this.clearLightHelper();this.transform.detach();
  this.items=[];this.selected=null;this.sceneRestorePhysics=this.physics.enabled;
  this.physics.clear();byId('propertiesPanel').hidden=true;
  for(let i=0;i<previous.length;i++){
   const old=previous[i];this.world.scene.remove(old);this.disposeObject(old);
   if(i%batch===batch-1)await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  if(!stillCurrent())return false;
  for(let i=0;i<data.length;i++){
   if(!stillCurrent())return false;
   this.addSceneEntry(data[i]);
   if(i%batch===batch-1)await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  if(!stillCurrent())return false;this.endSceneReplacement();return true;
 }

 disposeObject(obj){
  if(obj.userData.editorKind==='wall')obj.userData.wallTextureSource=null;
  if(obj.userData.editorKind==='model'){invalidateSceneModel(obj);return;}
  if(obj.userData.editorKind==='media'){disposeSceneMedia(obj);return;}
  obj.traverse(x=>{x.geometry?.dispose();if(x.material?.map)x.material.map.dispose();x.material?.dispose?.();});
 }
 applyObjectPatch(message){
  const entry=message.object,action=message.action;
  const id=action==='remove'?message.id:entry?.id;
  if(typeof id!=='string'||!id)return;
  const current=this.items.find(obj=>obj.userData.editorId===id);
  if(action==='remove'){
   if(!current)return;this.physics.remove(id);
   if(current===this.selected){this.transform.detach();this.selected=null;byId('propertiesPanel').hidden=true;}
   this.items=this.items.filter(obj=>obj!==current);if(current.userData.editorKind==='robot')clearRobotPathDebug(this.world,id);this.world.scene.remove(current);this.physics.remove(id);this.disposeObject(current);
   this.refreshList();return;
  }
  if(action!=='upsert'||!entry||!kinds.includes(entry.kind))return;
  if(!Array.isArray(entry.position)||!Array.isArray(entry.rotation)||!Array.isArray(entry.scale))return;
  if(current&&current.userData.editorKind!==entry.kind){
   if(this.selected===current){this.selected=null;this.transform.detach();byId('propertiesPanel').hidden=true;}
   this.items=this.items.filter(obj=>obj!==current);if(current.userData.editorKind==='robot')clearRobotPathDebug(this.world,id);this.world.scene.remove(current);this.physics.remove(id);this.disposeObject(current);
  }
  const obj=current?.userData.editorKind===entry.kind?current:objectFor(entry.kind);
  const isNew=obj!==current;
  if(isNew){obj.userData.editorId=id;this.items.push(obj);this.world.scene.add(obj);}
  obj.name=entry.name||obj.name;obj.userData.ownerId=entry.owner||null;obj.userData.transformLocked=entry.transformLocked===true;
  const oldTexture=obj.userData.textureName||'none',newTexture=entry.texture||'none';
  // Scene persistence is a checkpoint, not an animation frame. Never rewind
  // a locally driven or currently predicted remote robot to a stale save.
  const movingRemote=this.remoteInput.get(id);
  const preserveRobotPose=!isNew&&entry.kind==='robot'&&(
    (movingRemote&&performance.now()-movingRemote.received<2400)||
    (this.controlMode==='robot'&&this.selected===obj&&this.canEdit(obj))||
    Boolean(obj.userData.robotImpactVelocity));
  if(!preserveRobotPose){obj.position.fromArray(entry.position);obj.rotation.fromArray(entry.rotation);}
  obj.scale.fromArray(entry.scale);if(entry.kind==='wall'&&JSON.stringify(obj.userData.wall)!==JSON.stringify(entry.wall))rebuildOfficeWall(obj,entry.wall||{});if(entry.kind==='stairs'){if(stairGeometryKey(obj.userData.stairs)!==stairGeometryKey(entry.stairs))rebuildOfficeStairs(obj,entry.stairs||{});else if(entry.stairs)obj.userData.stairs=structuredClone(entry.stairs);}if(entry.kind==='curve'&&JSON.stringify(obj.userData.curve)!==JSON.stringify(cleanCurve(entry.curve))){obj.userData.curve=cleanCurve(entry.curve);obj.geometry.dispose();obj.geometry=buildCurveGeometry(obj.userData.curve);}if(entry.kind==='text'&&(isNew||JSON.stringify(obj.userData.text)!==JSON.stringify(cleanText(entry.text))))rebuildText(obj,entry.text,()=>{if(this.items.includes(obj))this.physics.sync(obj);});if(PRIMITIVE_FIELDS[entry.kind]){const next=sanitisePrimitive(entry.kind,entry.primitive),holes=entry.kind==='cube'?cleanOpenings(entry.openings):[];if(JSON.stringify(obj.userData.primitive)!==JSON.stringify(next)||JSON.stringify(obj.userData.openings||[])!==JSON.stringify(holes)){const prior=obj.geometry;obj.geometry=entry.kind==='cube'?cutCubeGeometry(next,holes):buildPrimitive(entry.kind,next);prior?.dispose();}obj.userData.primitive=next;if(entry.kind==='cube')obj.userData.openings=holes;}
  if(entry.color&&entry.kind!=='model'&&entry.kind!=='media'){obj.traverse(node=>{if(node.material?.color&&node.userData.editorKind!=='robot'){
   if(node.isMesh&&!node.userData.robotPlaceholder&&entry.kind==='robot')return;
   if(node.material.color.getHexString()!==entry.color.slice(1))node.material.color.set(entry.color);
  }});}
  if(oldTexture!==newTexture){
   const texture=newTexture!=='none'&&newTexture!=='custom'?makeTexture(newTexture):null;
   obj.traverse(node=>{if(node.material?.isMeshStandardMaterial&&entry.kind!=='robot'){
    node.material.map?.dispose();node.material.map=texture;node.material.needsUpdate=true;
   }});
   obj.userData.textureName=newTexture;
  }
  const avatar=entry.avatar||DEFAULT_ROBOT_AVATAR;
  if(entry.kind==='light')setLight(obj,entry.light||{});obj.userData.robotSpeed=entry.speed??1.8;obj.userData.robotStrafeSpeed=entry.strafeSpeed??2.5;obj.userData.robotTurnSpeed=entry.turnSpeed??4;obj.userData.robotBrain=structuredClone(entry.brain||{});obj.userData.robotCombat=combatSettings(entry.combat);obj.userData.robotAnimationSpeed=animationSpeedSettings(entry.animationSpeed);obj.userData.physics=physicsOptions(entry.physics);this.physics.sync(obj);
  if(entry.kind==='model'&&(isNew||obj.userData.modelUrl!==entry.model)){if(!isNew)invalidateSceneModel(obj);obj.userData.modelUrl=entry.model;hydrateSceneModel(obj);}
  if(entry.kind==='media'){const incoming=entry.media||obj.userData.media||{};const changed=isNew||JSON.stringify(obj.userData.media)!==JSON.stringify(incoming);if(changed){obj.userData.media=structuredClone(incoming);if(!isNew)disposeSceneMedia(obj);hydrateSceneMedia(obj,this.world);}}
  if(entry.kind==='robot'&&(isNew||obj.userData.avatarUrl!==avatar)){
   obj.userData.avatarUrl=avatar;
   if(!isNew){for(const child of [...obj.children])if(!child.userData.robotPlaceholder)obj.remove(child);
    obj.userData.robotReady=false;}
   hydrateRobot(obj);
  }
  if(this.selected===obj){
   if(isTransformLocked(obj)&&this.transform.object===obj)this.transform.detach();
   if(!isTransformLocked(obj)&&this.canTransform(obj)&&obj.userData.editorKind!=='robot'&&this.transform.object!==obj)this.transform.attach(obj);
   if(byId('propertiesPanel')&&!byId('propertiesPanel').hidden)this.updateInspector();
  }
  this.refreshList();
 }
 acceptRemoteRevision(message){
  const revision=Number(message?.revision)||0;
  if(message?.action&&message?.action!=='bulk'){
   if(revision>this.revision+1){this.load();return;}
   if(revision<=this.revision)return;
   this.revision=revision;this.applyObjectPatch(message);return;
  }
  if(this.world.editorDragging||this.pendingSaves.size){this.toast('Room changed: finish editing, then Load.');return;}
  this.load();
 }
 async load(){const ticket=this.sceneLoadTicket=(this.sceneLoadTicket||0)+1;const api=window.solviAPI;const local=localStorage.getItem('solvi-scene-'+(window.solviRoom||'main')); 
  if(!api?.online){if(local)this.apply(JSON.parse(local));this.toast('Local scene loaded (not shared)');return;}
  try{
   const room=window.solviRoom||'main';
   const data=await api.req('/api/scene?room='+encodeURIComponent(room));
   if(ticket!==this.sceneLoadTicket||room!==(window.solviRoom||'main'))return;this.revision=data.revision;
   if(this.lastLoadedRoom===room&&this.items.length){
    // Merge revisions without destroying every GLB and its animation mixer.
    const next=new Set((data.objects||[]).map(o=>o.id));
    for(const entry of data.objects||[])this.applyObjectPatch({action:'upsert',object:entry});
    for(const old of [...this.items])if(!next.has(old.userData.editorId))this.applyObjectPatch({action:'remove',id:old.userData.editorId});
   }else if(!await this.applyCooperatively(data.objects||[],()=>ticket===this.sceneLoadTicket&&room===(window.solviRoom||'main')))return;
   if(ticket!==this.sceneLoadTicket||room!==(window.solviRoom||'main'))return;
   this.lastLoadedRoom=room;
   this.toast('Shared scene loaded');
  }catch(e){this.toast(e.message);}}
 async save(){const list=this.serialize();const api=window.solviAPI;
  if(!api?.online){localStorage.setItem('solvi-scene-'+(window.solviRoom||'main'),JSON.stringify(list));this.toast('Scene saved locally (not shared)');return;}
  try{const data=await api.req('/api/scene',{method:'PUT',body:JSON.stringify({room:window.solviRoom||'main',revision:this.revision,objects:list})});this.revision=data.revision;this.toast('Shared scene saved');}catch(e){this.toast(e.message);}}

  async importModel(file){
   if(!/\.(glb|fbx)$/i.test(file.name))return this.toast('Select a GLB or FBX model');
   const setting=Number(localStorage.getItem('solvi-model-upload-limit')||5);
   const limit=Math.max(.1,Math.min(20,setting))*1024*1024;
   if(file.size>20*1024*1024)return this.toast('Model exceeds server limit (20 MiB)');
   if(file.size>limit)return this.toast(`Model too large: ${(file.size/1048576).toFixed(2)} MiB; limit ${(limit/1048576).toFixed(2)} MiB`);
   if(!window.solviAPI?.online)return this.toast('Model upload requires the shared server');
   try{
    this.toast('Uploading model…');const form=new FormData();form.append('model',file);
    const result=await window.solviAPI.req('/api/scene/models',{method:'POST',body:form});
    const obj=this.add('model',false);obj.name=result.model.label;obj.userData.modelUrl=result.model.url;
    // Put the file in the room only after upload has succeeded.
    hydrateSceneModel(obj);this.updateInspector();this.refreshList();this.recordEdit(null,this.snapshot(obj));this.queueSave(obj);
    this.toast('3D model added · '+result.model.label);
   }catch(e){this.toast('Model import failed: '+e.message);}
  }
  async replaceSceneModel(obj,asset){
   if(!obj||obj.userData.editorKind!=='model'||!this.items.includes(obj)||!this.canEdit(obj))return false;
   if(!asset||!isSceneModelURL(asset.url))return false;
   if(obj.userData.modelUrl===asset.url)return true;
   try{await loadSceneAsset(asset.url);}catch(error){this.toast('Replacement not loaded: '+error.message);return false;}
   if(!this.items.includes(obj)||!this.canEdit(obj))return false;
   const oldUrl=obj.userData.modelUrl,before=this.snapshot(obj);
   // Remove the previous collision immediately. New geometry is measured after GLB/FBX hydration.
   this.physics.remove(obj.userData.editorId);
   invalidateSceneModel(obj);
   obj.userData.modelUrl=asset.url;
   await hydrateSceneModel(obj);
   if(!obj.userData.modelReady){
    invalidateSceneModel(obj);obj.userData.modelUrl=oldUrl;
    if(oldUrl)await hydrateSceneModel(obj);
    this.toast('Model replacement failed; original retained.');return false;
   }
   if(!this.items.includes(obj))return false;
   this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);
   if(this.selected===obj)this.updateInspector();this.refreshList();
   this.toast('Model replaced · '+(asset.label||'3D asset'));
   return true;
  }
  changeRobotAvatar(obj,url){
   if(!obj||obj.userData.editorKind!=='robot'||!this.canEdit(obj))return;
   if(typeof url!=='string'||!(url.startsWith('./assets/')||/^\/api\/avatars\/[0-9a-f-]+\.glb$/.test(url)))return;
   if(obj.userData.avatarUrl===url)return;
   obj.userData.avatarUrl=url;obj.userData.robotReady=false;
   for(const child of [...obj.children])if(!child.userData.robotPlaceholder){obj.remove(child);}
   hydrateRobot(obj);this.queueSave(obj);
  }
  recordEdit(before,after){this.history.push(before,after);}
  applyHistorySnapshot(wanted,opposite){
   const id=wanted?.id||opposite?.id;if(!id)return;
   const existing=this.items.find(o=>o.userData.editorId===id);
   if(wanted){
    if(existing){const timer=this.pendingSaves.get(id);clearTimeout(timer);this.pendingSaves.delete(id);}
    this.applyObjectPatch({action:'upsert',object:wanted});
    const next=this.items.find(o=>o.userData.editorId===id);
    if(next){this.select(next);this.persistObject(next);}
   }else{
    if(existing){const timer=this.pendingSaves.get(id);clearTimeout(timer);this.pendingSaves.delete(id);}
    this.applyObjectPatch({action:'remove',id});this.persistRemoval(id);
   }
  }
  undo(){if(this.history.undo((wanted,old)=>this.applyHistorySnapshot(wanted,old)))this.toast('Undo');}
  redo(){if(this.history.redo((wanted,old)=>this.applyHistorySnapshot(wanted,old)))this.toast('Redo');}
  snapshot(o){return this.serialize().find(item=>item.id===o?.userData.editorId);}
  queueSave(o){if(!o||!this.canEdit(o))return;const id=o.userData.editorId;clearTimeout(this.pendingSaves.get(id));this.pendingSaves.set(id,setTimeout(()=>{this.pendingSaves.delete(id);this.persistObject(o);},650));}
  async persistObject(o){
    if(!o||!this.items.includes(o)||!this.canEdit(o))return;
    const data=this.snapshot(o),api=window.solviAPI;
    if(!api?.online){localStorage.setItem('solvi-scene-'+(window.solviRoom||'main'),JSON.stringify(this.serialize()));return;}
    try{const result=await api.req('/api/scene/object',{method:'POST',body:JSON.stringify({room:window.solviRoom||'main',action:'upsert',object:data})});this.revision=Math.max(this.revision,result.revision||0);}
    catch(error){this.toast('Save failed: '+error.message);}
  }
  async persistRemoval(id){const api=window.solviAPI;
    if(!api?.online){localStorage.setItem('solvi-scene-'+(window.solviRoom||'main'),JSON.stringify(this.serialize()));return;}
    try{const result=await api.req('/api/scene/object',{method:'POST',body:JSON.stringify({room:window.solviRoom||'main',action:'remove',object:{id}})});this.revision=Math.max(this.revision,result.revision||0);}
    catch(error){this.toast('Remove failed: '+error.message);}
  }
  clearLightHelper(){if(this.lightHelper){this.world.scene.remove(this.lightHelper);this.lightHelper.dispose?.();this.lightHelper=null;}}
  showLightHelper(group){this.clearLightHelper();if(group.userData.editorKind!=='light')return;const light=group.children.find(x=>x.isLight);if(!light)return;
   if(light.isPointLight)this.lightHelper=new THREE.PointLightHelper(light,.3);
   else if(light.isSpotLight)this.lightHelper=new THREE.SpotLightHelper(light);
   else if(light.isDirectionalLight)this.lightHelper=new THREE.DirectionalLightHelper(light,.6);
   if(this.lightHelper)this.world.scene.add(this.lightHelper);
  }
  refreshLightControls(){const d=cleanLightSettings(this.selected?.userData.light||{});for(const [id,v] of Object.entries({lightType:d.type,lightIntensity:d.intensity,lightRange:d.range,lightDecay:d.decay,lightAngle:d.angle,lightPenumbra:d.penumbra,lightColor:d.color,lightGround:d.groundColor}))byId(id).value=v;
   for(const [id,show] of [['lightRangeRow',['point','spot'].includes(d.type)],['lightDecayRow',['point','spot'].includes(d.type)],['lightAngleRow',d.type==='spot'],['lightPenumbraRow',d.type==='spot'],['lightGroundRow',d.type==='hemisphere']])byId(id).hidden=!show;
   if(this.selected&&!byId('propertiesPanel').hidden)this.showLightHelper(this.selected);
  }
  broadcastEdit(active){const o=this.selected;if(o&&this.canEdit(o))window.solviRoomSocket?.send({type:'object-edit',id:o.userData.editorId,editing:active});}
  showRemoteEdit(packet){const id=packet.id;const obj=this.items.find(o=>o.userData.editorId===id);if(!obj)return;const previous=this.editMarkers.get(id);if(previous&&packet.editing){previous.expires=performance.now()+6500;return;}if(previous){this.world.scene.remove(previous.sprite);previous.sprite.material.map?.dispose();previous.sprite.material.dispose();this.editMarkers.delete(id);}if(!packet.editing)return;const canvas=document.createElement('canvas');canvas.width=512;canvas.height=80;const ctx=canvas.getContext('2d');ctx.fillStyle='rgba(8,20,37,.87)';ctx.fillRect(0,0,512,80);ctx.fillStyle='#ffffff';ctx.font='bold 32px sans-serif';ctx.fillText('Editing · '+String(packet.name||'Guest').slice(0,21),12,50);const texture=new THREE.CanvasTexture(canvas);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));sprite.scale.set(2.6,.42,1);this.world.scene.add(sprite);this.editMarkers.set(id,{sprite,expires:performance.now()+6500});}
  tick(dt){
    const clock=performance.now();for(const [id,marker] of this.editMarkers){const item=this.items.find(o=>o.userData.editorId===id);if(!item||clock>marker.expires){this.world.scene.remove(marker.sprite);marker.sprite.material.map?.dispose();marker.sprite.material.dispose();this.editMarkers.delete(id);continue;}const bounds=new THREE.Box3().setFromObject(item);marker.sprite.position.copy(bounds.getCenter(new THREE.Vector3()));marker.sprite.position.y=(bounds.isEmpty()?item.position.y+2:bounds.max.y)+.42;}
    if(this.selected&&this.canEdit(this.selected)&&(this.world.editorDragging||this.robotKeys.size)&&clock-this.lastEditPing>2500){this.broadcastEdit(true);this.lastEditPing=clock;}
    if(this.lightHelper&&!byId('propertiesPanel').hidden){this.lightHelper.visible=!this.world.renderer.xr.isPresenting;this.lightHelper.update?.();}
    if(this.lightHelper&&byId('propertiesPanel').hidden)this.clearLightHelper();
    const previousRobotPositions=new Map(this.items.filter(o=>o.userData.editorKind==='robot').map(o=>[o.userData.editorId,{x:o.position.x,z:o.position.z}]));
    const robot=this.controlledRobot?.(),canControl=this.controlMode==='robot'&&robot&&this.canEdit(robot);
    const rawIntent=intent(this.robotKeys);
    const now=performance.now();
    if(canControl&&rawIntent.f>0){this.walkHeldSince??=now;}else this.walkHeldSince=null;
    const autoRun=autoRunAfterHold(this.walkHeldSince===null?0:now-this.walkHeldSince,{walking:rawIntent.f>0,airborne:!!(robot?.userData.robotJumpActive||robot?.userData.physicsAirborne),shift:!!rawIntent.r});
    const input=canControl?{...rawIntent,r:Number(autoRun),s:robot.userData.robotSpeed??1.8,q:robot.userData.robotStrafeSpeed??2.5,u:robot.userData.robotTurnSpeed??4,j:Number(this.robotKeys.has('Space'))}:{f:0,t:0,r:0,b:0,s:1.8,q:2.5,u:4,j:0};
    // Motion intent belongs to a particular robot, not every avatar in the room.
    for(const item of this.items){if(item.userData.editorKind==='robot')item.userData.robotLocalMotion=false;}
    if(canControl){
      const state={x:robot.position.x,z:robot.position.z,yaw:robot.rotation.y,velocity:robot.userData.robotVelocity||0,steer:robot.userData.robotSteer||0,lateral:robot.userData.robotLateral||0};
      const jumping=!!(robot.userData.robotJumpActive||robot.userData.physicsAirborne);
      const motion=jumping&&robot.userData.robotAirPlan?airStep(state,robot.userData.robotAirPlan,dt):stepRobotMotion(state,input,dt);
      robot.position.x=motion.x;robot.position.z=motion.z;robot.rotation.y=motion.yaw;
      robot.userData.robotVelocity=motion.velocity;robot.userData.robotSteer=motion.steer;robot.userData.robotLateral=motion.lateral;
      robot.userData.robotLocalMotion=active(input)||Math.abs(motion.velocity)>.04||Math.abs(motion.lateral)>.04;
      const walking=Math.abs(motion.velocity)>.04;const strafing=Math.abs(motion.lateral)>.04;
      if(input.f||input.t||input.j)interruptRobotMission(robot);
      if(!robot.userData.robotJumpActive&&robot.userData.jumpVel===undefined&&!robot.userData.physicsAirborne){
       if(!robot.userData.robotMission&&!robot.userData.robotSeated)robot.userData.robotMode=!walking?(strafing?(motion.lateral>0?'strafeLeft':'strafeRight'):'idle'):motion.velocity<0?'walkBackward':(input.r&&motion.velocity>1.4?'run':'walk');
      }
    }
    const previous=this.localRobotInput;
    if(canControl){
      const moving=active(input)||Math.abs(robot.userData.robotVelocity||0)>.04||Math.abs(robot.userData.robotLateral||0)>.04;
      const wasMoving=previous&&(active(previous)||previous.moving);
      const changed=!previous||input.f!==previous.f||input.t!==previous.t||input.r!==previous.r||input.b!==previous.b||input.s!==previous.s||input.q!==previous.q||input.u!==previous.u||input.j!==previous.j;
      if(changed||((moving||wasMoving)&&now-this.lastRobotPacket>140)){
        window.solviRoomSocket?.send({...packetFor(robot.userData.editorId,{...input,j:input.j&&!previous?.j?1:0},robot,!moving&&!input.j),seq:++this.robotPacketSeq});
        this.lastRobotPacket=now;
      }
      if(wasMoving&&!moving){this.queueSave(robot);}
      this.localRobotInput={...input,moving};
    }else this.localRobotInput=null;
    // Remote robots integrate the same acceleration and turn-rate equations.
    for(const [id,remote] of this.remoteInput){
      const other=this.items.find(o=>o.userData.editorId===id);
      if(!other||now-remote.received>2400){this.remoteInput.delete(id);if(other){other.userData.robotRemoteMotion=false;other.userData.robotMode='idle';other.userData.robotVelocity=0;other.userData.robotSteer=0;other.userData.robotLateral=0;}continue;}
      const state={x:other.position.x,z:other.position.z,yaw:other.rotation.y,velocity:other.userData.robotVelocity||0,steer:other.userData.robotSteer||0,lateral:other.userData.robotLateral||0};
      const next=(other.userData.robotJumpActive||other.userData.physicsAirborne)&&other.userData.robotAirPlan?airStep(state,other.userData.robotAirPlan,dt):stepRobotMotion(state,remote,dt);
      other.position.x=next.x;other.position.z=next.z;other.rotation.y=next.yaw;other.userData.robotVelocity=next.velocity;other.userData.robotSteer=next.steer;other.userData.robotLateral=next.lateral;
      other.userData.robotRemoteMotion=Boolean(remote.f||remote.t||Math.abs(next.velocity)>.04||Math.abs(next.lateral)>.04);
      if(!other.userData.robotJumpActive&&other.userData.jumpVel===undefined&&!other.userData.physicsAirborne){other.userData.robotMode=Math.abs(next.velocity)<.04?(Math.abs(next.lateral)>.04?(next.lateral>0?'strafeLeft':'strafeRight'):'idle'):next.velocity<0?'walkBackward':(remote.r&&next.velocity>1.4?'run':'walk');}
    }
    // Smooth server-authoritative corrections without reloading the avatar mesh.
    for(const [id,correction] of this.remoteCorrections){
      const obj=this.items.find(o=>o.userData.editorId===id);
      if(!obj){this.remoteCorrections.delete(id);continue;}
      const next=applyRemoteCorrection({x:obj.position.x,z:obj.position.z,yaw:obj.rotation.y},correction,dt);
      obj.position.x=next.x;obj.position.z=next.z;if(!obj.userData.robotJumpActive&&!obj.userData.physicsAirborne)obj.rotation.y=next.yaw;
      if(next.done)this.remoteCorrections.delete(id);else this.remoteCorrections.set(id,next.residual);
    }
    tickRobots(this.items,dt,Object.assign((o,arrived)=>{
      if(!this.canEdit(o))return;
      // Share autonomous movement while walking, not only its final position.
      if(arrived||o.userData.robotMission&&now-(o.userData.lastMissionSave||0)>900){
        o.userData.lastMissionSave=now;this.queueSave(o);
      }
    },{navigate:(robot,target)=>this.routeRobot(robot,target),recover:(robot,reason)=>this.recoverRobot(robot,reason),push:(robot,other,next,step)=>this.physics.tryPushRobot(robot,other,next,step),retarget:robot=>this.retargetRobot(robot)}));
    this.physics.tick(dt);tickStairTransport(this,dt);this.updateMountedMedia();
    for(const r of this.items){if(r.userData.editorKind!=='robot')continue;const previous=previousRobotPositions.get(r.userData.editorId);if(!previous)continue;const distance=Math.hypot(r.position.x-previous.x,r.position.z-previous.z);r.userData.robotActualSpeed=distance/Math.max(.016,dt);}
    animateRobots(this.items,dt,(actor,kind,force,remote)=>{
      const hits=this.physics.applyCombat(actor,kind,force,remote);
      if(!remote&&this.selected===actor&&['punch','kick'].includes(kind)&&!hits){
        this.toast('No pushable target hit. Set the target to Dynamic, enable room Physics, and face it within reach.');
      }
      return hits;
    });
    for(const item of this.items){if(item.userData.editorKind!=='robot')continue;
      if(item.userData.robotTelemetry&&item.userData.robotMission)sampleMovementTelemetry(item.userData.robotTelemetry,item);
      if(item.userData.robotMission&&this.robotPathDebugVisible(item))trackRobotPathDebug(this.world,item);}
  }
  triggerRobotCombat(robot,action){
    if(!robot||robot.userData.editorKind!=='robot'||!this.canEdit(robot))return false;
    if(!this.physics.enabled||!this.physics.world){this.toast('Enable room Physics to use combat actions');return false;}
    if(robot.userData.robotJumpActive||robot.userData.robotOneShot)return false;
    const now=performance.now();if(now-this.lastRobotCombat<340)return false;
    this.lastRobotCombat=now;const settings=combatSettings(robot.userData.robotCombat),force=settings[action].force;
    this.playRobotCombat(robot,action,force,false);
    // No impulse here: the physical contact occurs at the clip's impact phase.
    window.solviRoomSocket?.send({type:'robot-action',id:robot.userData.editorId,action,force,seq:++this.robotActionSeq});
    return true;
  }
  playRobotCombat(robot,action,force=5,remote=false){
    const last=robot.userData.lastCombatClip||'';
    const clip=combatClip(robot.userData.robotAvailableActions||[],action,last);
    if(clip)robot.userData.lastCombatClip=clip;
    const selectedClip=clip?'clip:'+clip:action==='push'?'push':'wave';
    const timing=combatTimeline(action,robot.userData.robotAnimator?.clipDuration(selectedClip)||0);
    robot.userData.robotOneShot={kind:action,clip:selectedClip,timing,force,remote,
      elapsed:0,duration:timing.duration,impactPhase:timing.impactPhase,impactDone:false};
    robot.userData.robotPlaying=null; // force replay even when alternating the same clip
    robot.userData.robotContactAction=null;
  }
  applyRemoteRobotImpact(packet){this.physics.applyRobotImpact(packet);}
  applyRemoteRobotAction(packet){
    const robot=this.items.find(o=>o.userData.editorId===packet.id&&o.userData.editorKind==='robot');
    if(!robot||!COMBAT_ACTIONS.includes(packet.action))return;
    const seq=Number(packet.seq)||0,prior=this.remoteActionSequences.get(packet.id)||0;
    if(seq&&seq<=prior)return;
    this.remoteActionSequences.set(packet.id,seq);
    this.playRobotCombat(robot,packet.action,packet.force,true);
  }
  applyRobotInput(packet){
    const robot=this.items.find(o=>o.userData.editorId===packet.id&&o.userData.editorKind==='robot');
    if(!robot||(this.selected===robot&&this.canEdit(robot)&&this.robotKeys.size))return;
    // Ignore out-of-order input frames (WebSocket ordering is per connection, but reconnects happen).
    const sequence=Number(packet.seq)||0,prior=this.remoteSequences.get(packet.id);
    const stamp=performance.now();
    if(sequence&&prior&&sequence<=prior.seq&&stamp-prior.at<3000)return;
    if(sequence)this.remoteSequences.set(packet.id,{seq:sequence,at:stamp});
    const x=Number(packet.x),z=Number(packet.z),yaw=Number(packet.yaw);
    if(Number.isFinite(x)&&Number.isFinite(z)&&Number.isFinite(yaw))this.remoteCorrections.set(packet.id,makeRemoteCorrection({x:robot.position.x,z:robot.position.z,yaw:robot.rotation.y},{x,z,yaw}));
    if(packet.m&&(packet.f||packet.t))robot.userData.robotGoal=null;
    if(packet.j&&!robot.userData.jumpVel&&!robot.userData.robotJumpActive)robotAction(robot,'jump');
    if(!packet.m){
      // Decelerate through the same motion integrator instead of stopping at once.
      this.remoteInput.set(packet.id,{f:0,t:0,r:0,b:0,s:packet.s??1.8,q:packet.q??2.5,u:packet.u??4,received:performance.now()});
    }else this.remoteInput.set(packet.id,{f:packet.f,t:packet.t,r:packet.r,b:packet.b,s:packet.s,q:packet.q??2.5,u:packet.u??4,received:performance.now()});
  }
  applyRobotMotion(state){this.applyRobotInput({...state,m:0,x:state.position?.[0],y:state.position?.[1],z:state.position?.[2],yaw:state.rotation?.[1]});}
  // Same live editor geometry drives the minimap and route planner. Footprints
  // are kept clear of robots and furniture; navigation never pushes objects.
  robotPathDebugVisible(robot){return robotPathVisible(robot?.userData?.editorId,sessionStorage);}
  updateRobotDebugStatus(){const label=byId('robotPathDebugStatus'),robot=this.robot();if(!label)return;label.hidden=!robot||!this.robotPathDebugVisible(robot);if(label.hidden)return;const route=robot.userData.robotDebugRoute;label.textContent=!route?'Route debug ready — start a robot walking mission to see its actual planned path.':route.blocked?'No valid route — red attempted destination and obstacle footprints.':route.finished?'Previous route shown briefly after the mission ended.':'Green: A* planned route · cyan: actual travelled trail · red: obstacles · orange: destination; blue shows direction, not camera evidence.';}
  syncRobotPathDebug(){for(const robot of this.items.filter(o=>o.userData.editorKind==='robot')){const route=robot.userData.robotDebugRoute;if(this.robotPathDebugVisible(robot)&&route&&!route.finished)updateRobotPathDebug(this.world,robot,route);else if(!this.robotPathDebugVisible(robot))clearRobotPathDebug(this.world,robot.userData.editorId);}this.updateRobotDebugStatus();}
  navigationObstacles(robot){
    this.world.scene.updateMatrixWorld(true);
    return this.items.filter(o=>o!==robot&&o.visible&&!['light','plane','points','curve'].includes(o.userData.editorKind)).flatMap(o=>{
      if(['wall','stairs'].includes(o.userData.editorKind))return o.children.filter(child=>child.userData.wallSegment||child.userData.stairTread).map((child,i)=>{const b=new THREE.Box3().setFromObject(child);return {minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z,name:(o.name||'Office wall')+' section '+(i+1),kind:'wall',id:o.userData.editorId};});
      // Human-like glTF bounds can swell with animation and accessories. Use a
      // stable feet-centred capsule footprint for other robots instead.
      if(o.userData.editorKind==='robot')return {minX:o.position.x-.38,maxX:o.position.x+.38,minZ:o.position.z-.38,maxZ:o.position.z+.38,name:o.name||'Robot',kind:'robot',id:o.userData.editorId};
      const b=new THREE.Box3().setFromObject(o);
      if(b.isEmpty())return {minX:o.position.x-.33,maxX:o.position.x+.33,minZ:o.position.z-.33,maxZ:o.position.z+.33,name:o.name||'Unnamed object',kind:o.userData.editorKind||'object',id:o.userData.editorId};
      if(b.max.y<robot.position.y+.10||b.min.y>robot.position.y+1.7)return null;
      if(b.max.x-b.min.x>28||b.max.z-b.min.z>28)return null;
      return {minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z,name:o.name||'Unnamed object',kind:o.userData.editorKind||'object',id:o.userData.editorId};
    }).filter(Boolean);
  }
  routeRobot(robot,point){
    const {preserveMission=false,quiet=false}=arguments[2]||{};
    if(!robot||!point)return false;
    const allObstacles=this.navigationObstacles(robot);
    // A robot already standing within another robot's clearance zone must be
    // allowed to depart. Runtime collision still prevents moving further into
    // that robot; all geometry and non-overlapping robots remain obstacles.
    const start={x:robot.position.x,z:robot.position.z};
    const obstacles=allObstacles.filter(o=>o.kind!=='robot'||!pathBlocked(start.x,start.z,[o],.30));
    const distance=Math.hypot(point.x-start.x,point.z-start.z);
    if(distance>600){this.toast('Robot route exceeds 600 m safety limit');return false;}
    const steps=Math.max(1,Math.ceil(distance/18));
    const waypoints=[];let previous=start;
    for(let i=1;i<=steps;i++){
      const target={x:start.x+(point.x-start.x)*i/steps,z:start.z+(point.z-start.z)*i/steps};
      const part=planRobotPath(previous,target,obstacles);
      if(!part?.length||Math.hypot(part.at(-1).x-target.x,part.at(-1).z-target.z)>.12){waypoints.length=0;break;}
      waypoints.push(...part);previous=target;
    }
    if(!waypoints.length){
      robot.userData.robotDebugRoute={start,waypoints:[],obstacles,destination:{x:point.x,z:point.z},blocked:true};
      if(typeof this.robotPathDebugVisible==='function'&&this.robotPathDebugVisible(robot))updateRobotPathDebug(this.world,robot,robot.userData.robotDebugRoute);
      this.updateRobotDebugStatus?.();
      const nearby=obstacles.map(o=>({name:o.name||'Unknown geometry',kind:o.kind||'object',distance:+Math.hypot((o.minX+o.maxX)/2-start.x,(o.minZ+o.maxZ)/2-start.z).toFixed(2)})).sort((a,b)=>a.distance-b.distance).slice(0,8);
      window.dispatchEvent(new CustomEvent('solvi:robot-route',{detail:{robotId:robot.userData.editorId,name:robot.name,status:'blocked',target:robot.userData.robotMission?.targetName||'',obstacles:obstacles.length,waypoints:0,start,destination:{x:point.x,z:point.z},
      taskId:robot.userData.robotMission?.taskId||'',reason:'planner could not find a collision-free path to the requested approach point',nearby_obstacles:nearby,
      plan:{waypoints:[],obstacles}}}));
      if(preserveMission)return false;
      robot.userData.robotGoal=null;robot.userData.robotMode='idle';
      const mission=robot.userData.robotMission;robot.userData.robotMission=null;
      if(mission)window.dispatchEvent(new CustomEvent('solvi:robot-task-update',{detail:{robot:robot.name,robotId:robot.userData.editorId,taskId:mission.taskId,target:mission.targetName,status:'blocked'}}));
      this.toast(`${robot.name}: no collision-free route found`);return false;
    }
    robot.userData.robotWaypoints=waypoints.slice(1);
    robot.userData.robotPathObstacles=obstacles;
    if(!preserveMission)robot.userData.robotRecoveryAttempts=0;
    robot.userData.robotRouteDestination={x:point.x,z:point.z};
    robot.userData.robotDebugRoute={start,waypoints,obstacles,destination:{x:point.x,z:point.z},blocked:false};
    // Initialize this mission's telemetry. Route decisions and AI plans are not movement proof.
    if(typeof newMovementTelemetry==='function'){
      const taskId=robot.userData.robotMission?.taskId||'';
      if(!robot.userData.robotTelemetry||robot.userData.robotTelemetry.taskId!==taskId)robot.userData.robotTelemetry=newMovementTelemetry(robot,taskId);
      const telemetry=robot.userData.robotTelemetry;telemetry.routeSegments++;
      if(preserveMission)telemetry.replans++;
      telemetry.plannedMeters+=plannedRouteLength(start,waypoints);
    }
    if((typeof this.robotPathDebugVisible==='function'?this.robotPathDebugVisible(robot):false))updateRobotPathDebug(this.world,robot,robot.userData.robotDebugRoute);
    else if(typeof clearRobotPathDebug==='function')clearRobotPathDebug(this.world,robot.userData.editorId);
    this.updateRobotDebugStatus?.();
    window.dispatchEvent(new CustomEvent('solvi:robot-route',{detail:{robotId:robot.userData.editorId,name:robot.name,status:'planned',target:robot.userData.robotMission?.targetName||'',obstacles:obstacles.length,waypoints:waypoints.length,
      start,destination:{x:point.x,z:point.z},taskId:robot.userData.robotMission?.taskId||'',
      plannedMeters:typeof plannedRouteLength==='function'?plannedRouteLength(start,waypoints):0,
      plan:{waypoints:waypoints.map(p=>({x:p.x,z:p.z})),obstacles:obstacles.map(o=>({minX:o.minX,maxX:o.maxX,minZ:o.minZ,maxZ:o.maxZ}))}}}));
    setRobotDestination(robot,waypoints[0]);return true;
  }
  // Commands are issued by the authenticated chat endpoint and resolved against
  // the same room scene. The client still checks editable state and targets.
  retargetRobot(robot){
    const mission=robot.userData.robotMission;
    if(!mission||mission.kind!=='go_to'||!this.canEdit(robot))return false;
    const target=this.items.find(o=>o.userData.editorId===mission.targetId&&o.userData.editorKind==='robot');
    if(!target)return false;
    const dx=robot.position.x-target.position.x,dz=robot.position.z-target.position.z;
    const distance=Math.hypot(dx,dz);
    if(distance<=1.85)return false;
    const reroutes=Number(mission.retargets||0);
    if(reroutes>=4){
      robot.userData.robotMission=null;robot.userData.robotGoal=null;robot.userData.robotMode='idle';
      window.dispatchEvent(new CustomEvent('solvi:robot-task-update',{detail:{robot:robot.name,robotId:robot.userData.editorId,taskId:mission.taskId,target:mission.targetName,status:'blocked'}}));return true;
    }
    mission.retargets=reroutes+1;
    const next={x:target.position.x+dx/distance*1.5,z:target.position.z+dz/distance*1.5};
    if(this.routeRobot(robot,next,{preserveMission:true}))return true;
    robot.userData.robotMission=null;robot.userData.robotGoal=null;robot.userData.robotMode='idle';
    window.dispatchEvent(new CustomEvent('solvi:robot-task-update',{detail:{robot:robot.name,robotId:robot.userData.editorId,taskId:mission.taskId,target:mission.targetName,status:'blocked'}}));return true;
  }
  recoverRobot(robot,reason){
    if(!this.canEdit(robot)||!robot.userData.robotMission)return false;
    const attempts=Number(robot.userData.robotRecoveryAttempts||0);
    if(attempts>=3)return false;
    robot.userData.robotRecoveryAttempts=attempts+1;
    const destination=robot.userData.robotRouteDestination;
    if(!destination)return false;
    window.dispatchEvent(new CustomEvent('solvi:robot-recovery',{detail:{robotId:robot.userData.editorId,name:robot.name,reason,attempt:attempts+1}}));
    // Re-read every visible object, including independently moving robots.
    if(this.routeRobot(robot,destination,{preserveMission:true,quiet:true}))return true;
    // A blocked narrow passage may require a short reverse step first. Both legs
    // must be verified by A* before movement starts; never back into obstacles.
    const obstacles=this.navigationObstacles(robot);
    const current={x:robot.position.x,z:robot.position.z};
    const dx=destination.x-current.x,dz=destination.z-current.z;
    const length=Math.hypot(dx,dz)||1;
    for(const side of [0.8,-0.8,1.4,-1.4]){
      const candidate={x:current.x-dx/length*.48-dz/length*side,z:current.z-dz/length*.48+dx/length*side};
      if(pathBlocked(candidate.x,candidate.z,obstacles,.30))continue;
      const first=planRobotPath(current,candidate,obstacles),second=planRobotPath(candidate,destination,obstacles);
      if(!first?.length||!second?.length||Math.hypot(first.at(-1).x-candidate.x,first.at(-1).z-candidate.z)>.12||Math.hypot(second.at(-1).x-destination.x,second.at(-1).z-destination.z)>.12)continue;
      robot.userData.robotWaypoints=[...first.slice(1),...second];
      robot.userData.robotPathObstacles=obstacles;
      setRobotDestination(robot,first[0]);return true;
    }
    return false;
  }
  receiveRobotCommand(command){
    if(!command||command.room!==(window.solviRoom||'main'))return false;
    const robot=this.items.find(x=>x.userData.editorKind==='robot'&&x.userData.editorId===command.robot_id);
    if(!robot||!this.canEdit(robot)){this.toast('Robot command rejected: robot not editable or missing');return false;}
    if(!['stop','wander','random_action','go_to','go_sit','coffee_visit','walk_forward','turn','turn_walk','jump'].includes(command.kind))return false;
    interruptRobotMission(robot);
    if(command.kind==='stop'){clearRobotPathDebug(this.world,robot.userData.editorId);robot.userData.robotDebugRoute=null;this.updateRobotDebugStatus();robot.userData.robotMode='idle';this.queueSave(robot);this.toast(robot.name+' stopped');return true;}
    if(command.kind==='wander'||command.kind==='random_action'){
      const angle=robot.rotation.y+(command.kind==='random_action'?Math.random()*Math.PI*2:Math.PI/3);
      const length=command.kind==='random_action'?1.5+Math.random()*2:2;
      const point={x:robot.position.x+Math.sin(angle)*length,z:robot.position.z+Math.cos(angle)*length};
      robot.userData.robotMission={kind:command.kind,taskId:command.id,targetName:command.target_name||'short walk',repeat:Math.max(1,Math.min(10,Number(command.repeat)||1)),leg:0};
      if(!this.routeRobot(robot,point))return false;this.toast(robot.name+' exploring a short distance');return true;
    }
    if(command.kind==='jump'){
      robotAction(robot,'jump');
      robot.userData.robotMission={kind:'jump',taskId:command.id,targetName:'a jump'};
      this.toast(robot.name+' jumping');return true;
    }
    if(command.kind==='walk_forward'){
      const distance=Number(command.distance);
      if(!Number.isFinite(distance)||distance<.5||distance>600)return false;
      robot.userData.robotMission={kind:'walk_forward',taskId:command.id,targetName:command.target_name||'walk',
        repeat:Math.max(1,Math.min(10,Number(command.repeat)||1)),returnToStart:command.return_to_start===true,
        origin:{x:robot.position.x,z:robot.position.z},leg:0,
        endpoint:{x:robot.position.x+Math.sin(robot.rotation.y)*distance,z:robot.position.z+Math.cos(robot.rotation.y)*distance}};
      if(!this.routeRobot(robot,{x:robot.position.x+Math.sin(robot.rotation.y)*distance,
        z:robot.position.z+Math.cos(robot.rotation.y)*distance}))return false;
      this.toast(robot.name+' moving '+distance+' m');return true;
    }
    if(command.kind==='turn'||command.kind==='turn_walk'){
      const degrees=Number(command.degrees),distance=Number(command.distance);
      if(!Number.isFinite(degrees)||degrees<15||degrees>180||!['left','right'].includes(command.direction)
        ||(command.kind==='turn_walk'&&(!Number.isFinite(distance)||distance<.5||distance>600)))return false;
      const signed=(command.direction==='right'?1:-1)*degrees*Math.PI/180;
      robot.userData.robotMission={kind:command.kind,phase:'turn',taskId:command.id,
        targetName:command.target_name||'turn',targetYaw:robot.rotation.y+signed,
        distance:command.kind==='turn_walk'?distance:0};
      robot.userData.robotMode='idle';robot.userData.robotGoal=null;
      this.toast(robot.name+' turning '+command.direction+' '+degrees+'°');return true;
    }
    const target=this.items.find(x=>x.userData.editorId===command.target_id && x!==robot && x.userData.editorKind!=='light');
    if(!target){this.toast('Robot target no longer exists in this room');return false;}
    this.world.scene.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(target);
    const center=bounds.isEmpty()?target.position.clone():bounds.getCenter(new THREE.Vector3());
    const size=bounds.isEmpty()?new THREE.Vector3(1,1,1):bounds.getSize(new THREE.Vector3());
    // Probe real A* paths to several stand-off points around the target. An
    // occupied near side is not evidence that all other sides are blocked.
    const start={x:robot.position.x,z:robot.position.z};
    const bounds2d={minX:center.x-size.x/2,maxX:center.x+size.x/2,minZ:center.z-size.z/2,maxZ:center.z+size.z/2};
    const obstacles=this.navigationObstacles(robot).filter(o=>o.kind!=='robot'||!pathBlocked(start.x,start.z,[o],.30));
    const approach=planRobotApproach(start,bounds2d,obstacles);
    const partial=!approach?planRobotPartialApproach(start,bounds2d,obstacles):null;
    robot.userData.robotMission={kind:command.kind,taskId:command.id,targetName:target.name,targetId:target.userData.editorId,
      origin:{x:robot.position.x,z:robot.position.z},leg:0,lastTargetCheck:0};
    if(!approach&&!partial){
      const nearby=obstacles.map(o=>({name:o.name||'Unknown object',kind:o.kind||'object',distance:+Math.hypot((o.minX+o.maxX)/2-start.x,(o.minZ+o.maxZ)/2-start.z).toFixed(2)})).sort((a,b)=>a.distance-b.distance).slice(0,8);
      robot.userData.robotDebugRoute={start,waypoints:[],obstacles,destination:{x:center.x,z:center.z},blocked:true};
      if(this.robotPathDebugVisible(robot))updateRobotPathDebug(this.world,robot,robot.userData.robotDebugRoute);
      window.dispatchEvent(new CustomEvent('solvi:robot-route',{detail:{robotId:robot.userData.editorId,name:robot.name,status:'blocked',target:target.name,reason:'No reachable safe approach from any tested side',nearby_obstacles:nearby,obstacles:obstacles.length,waypoints:0,start,destination:{x:center.x,z:center.z},taskId:command.id}}));
      const mission=robot.userData.robotMission;robot.userData.robotMission=null;
      robot.userData.robotGoal=null;robot.userData.robotMode='idle';
      window.dispatchEvent(new CustomEvent('solvi:robot-task-update',{detail:{robot:robot.name,robotId:robot.userData.editorId,taskId:mission.taskId,target:mission.targetName,status:'blocked',reason:'No reachable approach point'}}));
      this.toast(robot.name+': no safe route to any side of '+target.name);return false;
    }
    if(partial){
      const straight=Math.hypot(center.x-start.x,center.z-start.z);
      const progress=Math.max(0,Math.min(1,partial.progress));
      // The task-result API records this as partial, not arrived or seated.
      robot.userData.robotMission.partialStop={target:target.name,progress,remainingMeters:partial.remainingMeters};
      if(!this.routeRobot(robot,partial.point))return false;
      this.toast(`${robot.name}: safe partial route toward ${target.name} (${Math.round(progress*100)}% direct progress; stopping short)`);
      window.dispatchEvent(new CustomEvent('solvi:robot-route',{detail:{robotId:robot.userData.editorId,name:robot.name,status:'partial',target:target.name,
       start,destination:{x:center.x,z:center.z},safeStop:partial.point,progress,remainingMeters:partial.remainingMeters,
       taskId:command.id,reason:'Exact target approach occupied: safely advancing toward the nearest reachable stand-off point'}}));
      return true;
    }
    if(!this.routeRobot(robot,approach.point))return false;
    this.toast(robot.name+' → '+target.name+' (A* chose a reachable approach from multiple sides)');
    return true;
  }
  robot(){return this.selected?.userData.editorKind==='robot'?this.selected:null;}
}

Object.assign(SceneEditor.prototype,{setupSpatialTools,renderCurveControls,startCurveDrawing,startFaceDrawing,spatialPointer,cancelSpatialDrawing,openChatMediaPicker,updateMountedMedia});

SceneEditor.prototype.setupTextGeometryControls=function(){
 const ids=['Content','Font','Size','Extrude','Bevel'];
 for(const key of ids){const el=byId('textGeometry'+key);if(!el)continue;
  const update=()=>{const obj=this.selected;if(obj?.userData.editorKind!=='text'||!this.canEdit(obj))return;
   const before=this.textGeometryEditBefore||this.snapshot(obj);this.textGeometryEditBefore=before;
   const field=key[0].toLowerCase()+key.slice(1);const next={...cleanText(obj.userData.text),[field]:el.value};
   rebuildText(obj,next,()=>{if(this.items.includes(obj))this.physics.sync(obj);});
  };
  el.addEventListener('input',update);el.addEventListener('change',()=>{const obj=this.selected;if(obj?.userData.editorKind!=='text')return;
   const before=this.textGeometryEditBefore;this.textGeometryEditBefore=null;if(before){this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);this.physics.sync(obj);}
  });
 }
};
SceneEditor.prototype.renderTextGeometryControls=function(obj){
 const fold=byId('textProperties');if(!fold)return;fold.hidden=obj?.userData.editorKind!=='text';if(fold.hidden)return;
 const p=cleanText(obj.userData.text);for(const key of ['Content','Font','Size','Extrude','Bevel']){const el=byId('textGeometry'+key);el.value=p[key[0].toLowerCase()+key.slice(1)];el.disabled=!this.canEdit(obj);}
};
