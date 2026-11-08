import {airStep,autoRunAfterHold} from './robot-air-control.js';
import {confirmAction,textEntry} from './app-dialogs.js';
import * as THREE from 'three';
import {setupAvatarGallery} from './avatar-gallery.js';
import {setupAssetGallery} from './asset-gallery.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {EditHistory,duplicateElevation,nextDuplicateName} from './edit-history.js';
import {makeRobot,hydrateRobot,robotAction,tickRobots,animateRobots,setRobotDestination,interruptRobotMission,resolveAvatarPath,sittingClip,DEFAULT_ROBOT_AVATAR} from './robots.js';
import {intent,active,packetFor,stepRobotMotion,signedAngle,makeRemoteCorrection,applyRemoteCorrection} from './robot-net.js';
import {makeSceneModel,hydrateSceneModel,invalidateSceneModel,configureSceneModelRenderer,isSceneModelURL,loadSceneAsset} from './scene-models.js';
import {validateSceneSnapshot} from './scene-snapshot-guard.js';
import {makeSceneMedia,hydrateSceneMedia,disposeSceneMedia,setSceneMediaBacking,toggleSceneMediaPlayback,setSceneMediaMuted,setSceneMediaLoop,setSceneMediaSpatial,syncSceneMediaGroup,sceneMediaMuted,sceneMediaPlaying,sceneMediaKind,showSceneMediaCaptions} from './scene-media.js';
import {ScenePhysics} from './scene-physics.js';
import {PRIMITIVE_FIELDS,sanitisePrimitive,buildPrimitive,FURNITURE_TYPES,BASIC_PROP_TYPES,FURNITURE_NUMERIC,sanitiseFurniture,makeFurniture,rebuildFurniture} from './primitive-properties.js';
import {TOOL_TYPES} from './procedural-tools.js';
import {STATEFUL_PROPS,FRIDGE_ITEM_TYPES,fridgeLayout,fridgeSlotPose,canStoreInFridge,propInteractionOf,nextPropOpen} from './interactive-props.js';
import {syncEquipmentMedia,disposeEquipmentMedia,playEquipmentChannel,nextSpeakerChannel} from './equipment-media.js';
import {smartScreenClick,openSmartChannel,parseChannel,cleanChannels,fetchIPTVPlaylist,safeIPTVPlaylistURL,cleanSmartOptions} from './smart-media-playlist.js';
import {makeOfficeWall,rebuildOfficeWall,sanitiseWall,simplifyWallPoints,smoothWallPoints,snapWallPoint,wallWorldToLocal,wallSegments,wallPresetTexture} from './office-walls.js';
import {enclosedRoomFootprint} from './robot-room-furnishing.js';
import {makeOfficeStairs,rebuildOfficeStairs,updateLiftPanel,updateConveyorControls,sanitiseStairs,stairSegments} from './office-stairs.js';
import {tickStairTransport,startLift,stopLift} from './stair-transport.js';
import {liftHeightAt,liftBaseY,legacyLiftBaseY,safeLiftMotion} from './lift-sync.js';
import {attachControlSwitcherDrag} from './control-switcher-drag.js';
import {isEditMode} from './edit-mode.js';
import {makeLadder,rebuildLadder,sanitiseLadder,stepLadderRobot,releaseLadder} from './office-ladder.js';
import {liftButtonRequest} from './lift-panel-state.js';
import {stairGeometryKey} from './stair-extensions.js';
import {makePortal,rebuildPortal} from './portal-geometry.js';
import {cleanPortal,pairedPortal,resizePortalAperture} from './portal-core.js';
import {portalPairEntries} from './portal-preset-data.js';
import {tickPortals,activatePortalButton} from './portal-transport.js';
import {planRobotPath,planRobotTravelRoute,pathBlocked,planRobotApproach,planRobotPartialApproach,robotRouteCheckpoints} from './robot-pathfinding.js';
import {smoothRobotWaypoints} from './robot-path-smoothing.js';
import {cleanSceneCollection,collectionOf,groupSceneItems,memberDisplayName,creativeCollectionTitle,findSceneObjectRow} from './scene-collections.js';
import {robotPosePacket,appendRobotPose,sampleRobotPose} from './robot-motion-sync.js';
import {planRobotMeeting,canMeetRobot,sameRobotFloor,remainingRouteBlocked} from './robot-social-navigation.js';
import {findRobotWorksite,footprintClear} from './robot-worksite.js';
import {infrastructureSegments} from './procedural-infrastructure.js';
import {infrastructureNavigationFootprints} from './robot-infrastructure-obstacles.js';
import {planRobotLowStairApproach} from './robot-stair-approach.js';
import {updateRobotPathDebug,trackRobotPathDebug,clearRobotPathDebug,finishRobotPathDebug,clearAllRobotPathDebug} from './robot-path-visuals.js';
import {robotPathVisible} from './robot-debug.js';
import {plannedRouteLength,newMovementTelemetry,sampleMovementTelemetry,missionMovementEvidence,shouldRejectClaimedArrival} from './robot-telemetry.js';
import {physicsOptions} from './physics-options.js';
import {canBeClimbable} from './climbable-surfaces.js';
import {RobotInventory,cleanInventory,cleanStorage,cleanWearAttachment} from './robot-inventory.js';
import {isToolObject,cleanToolGripProfile,toolGripProfile,toolRigBones,GRIP_BONES} from './held-equipment.js';
import {TOOL_ACTIVITIES,resolveToolAnimation,cleanToolAnimationName,digAheadPoint,validDigTarget} from './tool-activities.js';
import {bindRobotShortcutHelp,ROBOT_KEY_ACTIONS} from './robot-shortcut-help.js';
import {seatPlan,takeSeat,standUp,recoverStandingSeatTrap,followFurnitureSeats,restoreSeatedRobots,repairLoadedRobotElevation} from './robot-seating.js';
import {canBePickable,ObjectCarry,cleanThrowSettings,editThrowSetting,pickableTarget} from './object-carry.js';
import {combatSettings,combatForKey,combatClip,combatTimeline,COMBAT_ACTIONS} from './robot-combat.js';
import {animationSpeedSettings} from './animation-tuning.js';
import {isTransformLocked,mayTransform} from './transform-lock.js';
import {OrbitGesture,recoverStaleOrbitPointers} from './orbit-gesture.js';
import {readPreferences} from './preferences.js';
import {sliderToScale,scaleToSlider,linkedScale} from './transform-values.js';
import {inspectorSliderRow} from './inspector-slider-layout.js';
import {cleanCurve,buildCurveGeometry} from './curve-geometry.js';
import {makeEditableText,rebuildText} from './text-geometry.js';
import {cleanText} from './text-parameters.js';
import {cleanOpenings,cutCubeGeometry,surfaceAxis,rectangleFromSurface} from './cube-openings.js';
import {setupSpatialTools,renderCurveControls,startCurveDrawing,startFaceDrawing,spatialPointer,cancelSpatialDrawing,openChatMediaPicker,updateMountedMedia} from './spatial-editor.js';
import {setupObjectPresets} from './object-presets.js';
import {startVegetationPlot,vegetationPointer,finishVegetationPlot,cancelVegetationPlot} from './vegetation-drawing.js';
import {startInfrastructureDrawing,infrastructurePointer,finishInfrastructureDrawing,cancelInfrastructureDrawing,drawingUndo,drawingRedo,recordInfrastructureDraftChange} from './infrastructure-drawing.js';
import {VEGETATION_TYPES} from './procedural-vegetation.js';
import {WALKABLE_NATURE_AREAS,natureNavigationFootprints} from './robot-nature-navigation.js';
import {canPreset,presetEntry} from './object-preset-data.js';
import {centreGroundFromCamera,positionNewOnGround,positionNewSmartly,smartPlacementObstacles} from './scene-placement.js';
import {houseBlueprint,houseWallSettings} from './robot-construction-api.js';

const kinds=['cube','sphere','cylinder','plane','torus','curve','surface','text','points','light','robot','model','media','wall','stairs','ladder','portal','furniture'];
const byId=id=>document.getElementById(id);
const material=(color='#8bc3ff')=>new THREE.MeshStandardMaterial({color,roughness:.7,side:THREE.DoubleSide});
const xyz=v=>[+v.x.toFixed(4),+v.y.toFixed(4),+v.z.toFixed(4)];
const makeTexture=(kind)=>{
 if(['concrete','bricks','wood','marble','granite'].includes(kind))return wallPresetTexture(kind);
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
 case 'ladder':object=makeLadder();object.userData.physics=physicsOptions({mode:'static'});break;
 case 'furniture':object=makeFurniture();object.userData.physics=physicsOptions({mode:'static'});break;
 case 'portal':object=makePortal();break;
 case 'media':object=makeSceneMedia();break;
 case 'light':{object=new THREE.Group();const icon=new THREE.Mesh(new THREE.SphereGeometry(.125,12,8),new THREE.MeshBasicMaterial({color:'#ffe3a2',depthTest:false}));icon.userData.lightMarker=true;object.add(icon);setLight(object,{type:'point',intensity:2,range:10,decay:2,color:'#d0efff'});break;}
 default:throw Error('Unsupported kind');
 }
 object.userData.editorKind=kind;object.userData.editorId=crypto.randomUUID();object.name=kind==='robot'?'Robot-'+object.userData.editorId.slice(0,8):'New '+kind;
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
  this.world=world;this.toast=onToast;configureSceneModelRenderer(world.renderer);this.physics=new ScenePhysics(this);this.carry=new ObjectCarry(this);this.inventory=new RobotInventory(this);this.items=[];this.selected=null;this.lastSmartPlacement=null;this.revision=0;this.controlMode='scene';this.controlledRobotId=null;
  this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();
  this.history=new EditHistory(120);this.transformBefore=null;this.collectionExpanded=new Set();this.collectionTarget=null;this.collectionDrag=null;this.activeCollectionId=null;
  this.transform=new TransformControls(world.camera,world.renderer.domElement);
  // Recent Three.js exposes TransformControls as an Object3D wrapper plus a helper gizmo.
  world.scene.add(this.transform.getHelper());
  this.transform.addEventListener('dragging-changed',e=>{
   world.editorDragging=Boolean(e.value);
   if(e.value){world.editorGizmoPointer=true;world.controls.enabled=false;}
   else{world.editorGizmoPointer=false;world.cameraOrbitGesture=null;world.controls.enabled=true;}
  });
  this.transform.addEventListener('mouseDown',()=>{if(this.collectionTarget){this.beginCollectionDrag();world.editorDragging=true;world.editorGizmoPointer=true;world.controls.enabled=false;return;}this.broadcastEdit(true);this.transformBefore=this.snapshot(this.selected);world.editorDragging=true;world.editorGizmoPointer=true;world.controls.enabled=false;});
  this.transform.addEventListener('mouseUp',()=>{if(this.collectionTarget){this.endCollectionDrag();world.editorDragging=false;return;}this.broadcastEdit(false);world.editorDragging=false;this.physics.sync(this.selected);this.recordEdit(this.transformBefore,this.snapshot(this.selected));this.transformBefore=null;});
  this.transform.addEventListener('objectChange',()=>{if(this.collectionTarget){this.applyCollectionDrag();return;}if(!this.canTransform(this.selected))return;followFurnitureSeats(this);if(this.transform.mode==='scale'&&this.selected?.userData.editorKind!=='robot'&&performance.now()-(this.lastScaleColliderSync||0)>180){this.physics.sync(this.selected);this.lastScaleColliderSync=performance.now();}this.updateInspector();this.queueSave(this.selected);});
  window.addEventListener('solvi:robot-model-ready',e=>{if(this.selected?.userData.editorId===e.detail.id)this.updateInspector();if(this.items.some(o=>o.userData?.editorId===e.detail.id&&o.userData.robotSeated))restoreSeatedRobots(this);});
  this.vegetationDrawing=null;this.vegetationPreview=null;this.curveDrawing=null;this.curvePreview=null;this.faceDrawing=null;this.facePreview=null;this.mediaPickerURLs=[];
  this.wallDrawing=null;this.wallPreview=null;this.wallEditTarget=null;this.wallEditOriginal=null;this.wallTextureMediaId="";this.wallSessionHistory=new EditHistory(120);this.wallStateLast=null;this.wallRestoring=false;this.wallPreviewCustom=null;this.wallPreviewTextureId='';this.wallPreviewTextureReq=0;
  this.inventory.bind();this.robotShortcuts=bindRobotShortcutHelp(()=>this.controlledRobot?.()||this.robot?.());this.bulkChecked=new Set();this.editMarkers=new Map();this.lastEditPing=0;this.lightHelper=null;this.setupUI();this.events();
  window.addEventListener('solvi:edit-mode-changed',e=>{
   if(!e.detail?.enabled){this.clearCollectionTarget();this.transform.detach();this.world.editorGizmoPointer=false;this.world.editorDragging=false;this.endWallDrawing?.();}
   else if(isEditMode()&&this.selected&&this.canTransform(this.selected)&&this.selected.userData.editorKind!=='robot')this.transform.attach(this.selected);
   this.updateInspector();this.refreshList();
  });this.refreshList();this.avatarGallery=setupAvatarGallery(this);this.assetGallery=setupAssetGallery(this);this.objectPresets=setupObjectPresets(this);window.solviEditor=this;world.robotEditor=this;this.pendingSaves=new Map();this.dirtyGenerations=new Map();this.inFlightSaves=new Map();this.retrySaveCounts=new Map();this.pendingRemovals=new Set();this.robotKeys=new Set();this.localRobotInput=null;this.lastRobotPacket=0;this.robotPacketSeq=0;this.robotActionSeq=0;this.lastRobotCombat=0;this.remoteActionSequences=new Map();this.remoteInput=new Map();this.remoteCorrections=new Map();this.remoteSequences=new Map();this.remoteRobotMotion=new Map();this.sentRobotMotion=new Map();
  window.addEventListener('solvi:robot-task-update',event=>{const detail=event.detail||{},id=detail.robotId;const robot=this.items.find(o=>o.userData.editorId===id);
    if(robot){const audit=missionMovementEvidence(robot.userData.robotTelemetry,robot,robot.userData.robotDebugRoute,detail.status);
      if(audit){detail.routeTelemetry=audit;if(shouldRejectClaimedArrival(audit,detail.status))detail.status='failed';}
      robot.userData.robotTelemetry=null;}
    if(id&&['arrived','partial','failed','blocked','sitting','procedural-sitting','coffee-visit'].includes(detail.status)){finishRobotPathDebug(this.world,id);if(robot?.userData?.robotDebugRoute)robot.userData.robotDebugRoute.finished=true;this.updateRobotDebugStatus?.();}});
 }
 setupUI(){
  const menu=byId('addMenu');menu.hidden=true; // Never auto-open: Shift+A or Add button only.
  const groups=[['Geometry',['cube','sphere','cylinder','plane','torus']],['Office Space',['walls','closed room','stairs','stairs advanced','ladder','escalator','moving walkway','lift']],['Basic furnitures',['table','chair','officeChair','stool','armchair','sofa','bed','cabinet']],['Basic props',BASIC_PROP_TYPES],['Tools',TOOL_TYPES],['Equipment',['tv','monitor','miniComputer','keyboard','trackpad','mouse','printer','laptop','fridge','bin','backpack','sunbed','deckChair','beachUmbrella','lamp','speaker']],['Portals',['paired portal']],['Curves / surfaces',['curve','draw curve in 3d','surface']],['Text / points',['text','points']],['Media surfaces',['media frame']],['Robots',['robot']],['3D Model · GLB / FBX',['add 3D model']],['Lighting',['point light','spot light','directional light','ambient light','hemisphere light']],['Outdoor infrastructure',['draw wall line','draw plank fence','draw mesh fence','draw rod fence','draw hedge','draw curb','draw footpath','draw road','draw motorway']],['Nature & cultivation',['tree','shrub','vegetationArea','groundPlot','cropBed','waterPatch','draw forest / orchard area','draw brushwood area','draw grass / soil plot','draw vegetable bed','draw water / lake patch']]];
  menu.replaceChildren();const bar=document.createElement('div');bar.className='drag-handle add-drag';bar.textContent='Add object · Shift+A';const head=document.createElement('div');head.className='add-fixed-head';head.append(bar);const content=document.createElement('div');content.className='add-scroll-content';menu.append(head,content);const search=document.createElement('input');search.id='addSearch';search.placeholder='Search / Enter to add';search.autocomplete='off';search.className='add-search';head.append(search);
  const openPresets=document.createElement('button');openPresets.type='button';openPresets.className='add-presets-shortcut';openPresets.textContent='Presets · saved objects';openPresets.onclick=()=>{menu.hidden=true;this.objectPresets?.open();};head.append(openPresets);
  search.addEventListener('keydown',event=>{if(event.key==='Enter'){const first=menu.querySelector('.add-group button:not([hidden])');if(first){event.preventDefault();first.click();}}if(event.key==='Escape')menu.hidden=true;});
  search.addEventListener('input',()=>{for(const button of menu.querySelectorAll('.add-group button'))button.hidden=!button.textContent.toLowerCase().includes(search.value.trim().toLowerCase());});
  for(const [label,options] of groups){const group=document.createElement('div');group.className='add-group';const strong=document.createElement('strong');strong.textContent=label;group.append(strong);
   for(const k of options){const button=document.createElement('button');button.textContent=k[0].toUpperCase()+k.slice(1);button.dataset.objectKind=k;button.onclick=()=>{if(k==='add 3D model'){menu.hidden=true;byId('modelImportFile').click();}else if(k==='media frame'){this.add('media');}else if(k==='walls'){this.startWallDrawing('wall');}else if(k==='closed room'){this.startWallDrawing('wall',true);}else if(k==='stairs'){this.startWallDrawing('stairs');}else if(k==='stairs advanced'){this.startWallDrawing('stairs',false,'advanced');}else if(k==='escalator'){this.startWallDrawing('stairs',false,'escalator');}else if(k==='moving walkway'){this.startWallDrawing('stairs',false,'walkway');}else if(k==='lift'){this.addLift();}else if(FURNITURE_TYPES.includes(k)){this.add('furniture',true,undefined,true,k);}else if(k==='paired portal'){this.addPortalPair();}else if(k==='draw curve in 3d'){this.startCurveDrawing();}else if(k==='draw forest / orchard area'){startVegetationPlot(this,'vegetationArea','forest');}else if(k==='draw brushwood area'){startVegetationPlot(this,'vegetationArea','brushwood');}else if(k==='draw grass / soil plot'){startVegetationPlot(this,'groundPlot');}else if(k==='draw vegetable bed'){startVegetationPlot(this,'cropBed');}else if(k==='draw water / lake patch'){startVegetationPlot(this,'waterPatch');}else if(k.startsWith('draw ')){const infra={ 'draw wall line':'pathWall','draw plank fence':'fence','draw mesh fence':'fence','draw rod fence':'fence','draw hedge':'hedge','draw curb':'curb','draw footpath':'footpath','draw road':'road','draw motorway':'road'}[k];if(infra){if(k==='draw mesh fence')this.infrastructureDefaultStyle='mesh';else if(k==='draw rod fence')this.infrastructureDefaultStyle='rods';else if(k==='draw motorway')this.infrastructureDefaultRoadLanes=4;else this.infrastructureDefaultStyle='plank';startInfrastructureDrawing(this,infra);}}else this.add(k.endsWith(' light')?'light':k,true,k.endsWith(' light')?k.split(' ')[0]:undefined);};group.append(button);}content.append(group);}
  this.setupFurnitureControls();this.setupLadderControls();this.setupWallControls();this.setupSpatialTools();
  window.addEventListener('keydown',e=>{
   if(!this.infrastructureDrawing||e.target?.closest?.('input,textarea,select,[contenteditable]'))return;
   const cmd=e.metaKey||e.ctrlKey;
   if(cmd&&(e.code==='KeyZ'||e.code==='KeyY')){
    e.preventDefault();e.stopImmediatePropagation();
    if(e.code==='KeyY'||e.shiftKey)drawingRedo(this);else drawingUndo(this);
    return;
   }
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancelInfrastructureDrawing(this);}
   else if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();finishInfrastructureDrawing(this);}
  },true);
  for(const [id,handler] of [['vegetationDrawCancel',()=>cancelVegetationPlot(this)],['vegetationDrawUndo',()=>{this.vegetationDrawing?.points.pop();this.vegetationDrawing&&this.vegetationDrawing.redraw();}],['vegetationDrawSave',()=>finishVegetationPlot(this)]]){const button=byId(id);if(button)button.onclick=handler;}
  window.addEventListener('keydown',e=>{if(!this.vegetationDrawing||e.target?.closest?.('input,textarea,select,[contenteditable]'))return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancelVegetationPlot(this);}else if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();finishVegetationPlot(this);}},true);this.setupTextGeometryControls();this.setupPortalControls();
  const toolbox=byId('toolboxActions');for(const id of ['addObjectButton','objectsButton','avatarsButton','assetsButton'])toolbox.append(byId(id));toolbox.append(byId('presetsButton'));
  byId('presetsButton').onclick=()=>{byId('addMenu').hidden=true;this.objectPresets?.open();};
  byId('importModelButton').onclick=()=>byId('modelImportFile').click();byId('quickModelImport').onclick=()=>byId('modelImportFile').click();
  byId('modelImportFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(f)await this.importModel(f);e.target.value='';});
  byId('replaceModelGallery').onclick=()=>{const model=this.selected;if(model?.userData.editorKind==='model'&&this.canEdit(model))this.assetGallery.open({replace:model});};
  byId('replaceModelFile').onclick=()=>{if(this.selected?.userData.editorKind==='model'&&this.canEdit(this.selected))byId('replaceModelInput').click();};
  byId('mediaChooseSpeakerModel').onclick=()=>{if(this.selected?.userData.editorKind!=='media'||!this.canEdit(this.selected))return;this.assetGallery?.open({replace:this.selected});};
  byId('mediaPlayPause').onclick=()=>{if(this.selected?.userData.editorKind!=='media')return;const playing=toggleSceneMediaPlayback(this.selected);byId('mediaPlayPause').textContent=playing?'Pause':'Play';};
  byId('mediaMuteToggle').onclick=()=>{if(this.selected?.userData.editorKind!=='media')return;const next=!sceneMediaMuted(this.selected);setSceneMediaMuted(this.selected,next);byId('mediaMuteToggle').textContent=next?'Unmute':'Mute';};
  byId('mediaBacking').onchange=()=>{if(this.selected?.userData.editorKind!=='media'||!this.canEdit(this.selected))return;setSceneMediaBacking(this.selected,byId('mediaBacking').value,this.world);this.queueSave(this.selected);};
  byId('mediaSmartChannelControls')?.addEventListener('click',event=>{const action=event.target.closest('button')?.dataset.smartAction;if(action)this.smartChannelAction(action,byId('mediaSmartChannelControls'),'media');});
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
  byId('sceneGroupSelected').onclick=()=>this.groupBulkSelection();
  byId('objectsButton').onclick=()=>{
    const panel=byId('scenePanel');panel.hidden=!panel.hidden;panel.classList.remove('minimized');
    if(!panel.hidden)this.refreshList();
  };
  byId('minimizeScenePanel').onclick=()=>{
    // Minimized panels belong in the launcher, not as orphaned floating header buttons.
    byId('scenePanel').hidden=true;byId('scenePanel').classList.remove('minimized');
  };
  byId('closeScenePanel').onclick=()=>byId('scenePanel').hidden=true;
  byId('closeProperties').onclick=()=>{if(this.infrastructureDrawing)cancelInfrastructureDrawing(this);byId('propertiesPanel').hidden=true;byId('inspectorValueSlider').hidden=true;this.clearLightHelper();};
  byId('objectPickable').addEventListener('change',()=>{const obj=this.selected;if(!obj||!this.canEdit(obj)||!canBePickable(obj.userData.editorKind))return;const before=this.snapshot(obj);if(obj.userData.storage&&!byId('objectPickable').checked){byId('objectPickable').checked=true;this.toast('Drop the stored item before disabling Pickable');return;}obj.userData.pickable=byId('objectPickable').checked;this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);this.updateInspector();});
  byId('objectInventoryCategory')?.addEventListener('change',()=>{
   const obj=this.selected;if(!obj||!this.canEdit(obj)||!obj.userData.pickable)return;
   const before=this.snapshot(obj);obj.userData.inventory=cleanInventory({...obj.userData.inventory,category:byId('objectInventoryCategory').value});
   this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);this.updateInspector();
  });
  for(const id of ['objectInventorySize','objectInventoryConsumable'])byId(id)?.addEventListener('change',()=>{
   const obj=this.selected;if(!obj||!this.canEdit(obj)||!obj.userData.pickable)return;
   const before=this.snapshot(obj);obj.userData.inventory=cleanInventory({...obj.userData.inventory,size:byId('objectInventorySize').value,consumable:byId('objectInventoryConsumable').checked});
   this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);
  });
  byId('toolGripHand')?.addEventListener('change',e=>{
   this.toolGripEditingHand=e.target.value==='left'?'left':'right';this.renderToolGripControls(this.selected);
  });
  byId('toolGripDetails')?.addEventListener('change',e=>{
   const obj=this.selected,field=e.target?.dataset?.gripField;
   if(!obj||!field||!isToolObject(obj)||!this.canEdit(obj)||!obj.userData.pickable)return;
   const hand=this.toolGripEditingHand==='left'?'left':'right',before=this.snapshot(obj);
   const cfg=obj.userData.furniture||{},grip=cleanToolGripProfile(obj.userData.inventory?.grip?.[hand],cfg.variant,cfg.handleLength,hand);
   if(field==='bone')grip.bone=e.target.value;
   else if(field==='followRotation')grip.followRotation=e.target.checked;
   else if(['position','rotation','anchor'].includes(field))grip[field][Number(e.target.dataset.axis)]=Number(e.target.value);
   const clean=cleanToolGripProfile(grip,cfg.variant,cfg.handleLength,hand);
   obj.userData.inventory=cleanInventory({...obj.userData.inventory,grip:{...obj.userData.inventory?.grip,[hand]:clean}});
   this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);this.inventory.tick();this.renderToolGripControls(obj);
  });
  byId('toolActionClip')?.addEventListener('change',e=>{
   const obj=this.selected;if(!obj||!isToolObject(obj)||!this.canEdit(obj))return;
   const before=this.snapshot(obj),value=cleanToolAnimationName(e.target.value);
   obj.userData.inventory=cleanInventory({...obj.userData.inventory,actionClip:value});
   this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);this.renderToolGripControls(obj);
  });
  byId('toolGripReset')?.addEventListener('click',()=>{
   const obj=this.selected,hand=this.toolGripEditingHand==='left'?'left':'right';
   if(!obj||!isToolObject(obj)||!this.canEdit(obj))return;
   const before=this.snapshot(obj),grip={...obj.userData.inventory?.grip};delete grip[hand];
   const inventory={...obj.userData.inventory};if(Object.keys(grip).length)inventory.grip=grip;else delete inventory.grip;
   obj.userData.inventory=cleanInventory(inventory);this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);this.inventory.tick();this.renderToolGripControls(obj);
  });
  byId('wearableAttachmentDetails')?.addEventListener('change',e=>{
   const obj=this.selected,field=e.target?.dataset?.wearField;if(!obj||!field||!this.canEdit(obj))return;
   const before=this.snapshot(obj),attachment=cleanWearAttachment(obj.userData.inventory?.attachment);
   if(field==='bone')attachment.bone=e.target.value;
   else if(field==='followRotation')attachment.followRotation=e.target.checked;
   else if(field==='position'||field==='rotation')attachment[field][Number(e.target.dataset.axis)]=Number(e.target.value);
   obj.userData.inventory=cleanInventory({...obj.userData.inventory,attachment:cleanWearAttachment(attachment)});
   this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);
  });
  byId('objectFollowHandRotation').addEventListener('change',()=>{const obj=this.selected;if(!obj||!this.canEdit(obj)||!canBePickable(obj.userData.editorKind))return;const before=this.snapshot(obj);obj.userData.followHandRotation=byId('objectFollowHandRotation').checked;this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);});
  byId('objectClimbable').addEventListener('change',()=>{const obj=this.selected;if(!obj||!this.canEdit(obj)||!canBeClimbable(obj.userData.editorKind))return;const before=this.snapshot(obj);obj.userData.climbable=byId('objectClimbable').checked;this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);});
  for(const id of ['objectPhysicsMode','objectCollider','objectRestitution','objectFriction'])byId(id).addEventListener('change',()=>{const obj=this.selected;if(!obj||!this.canEdit(obj)||['robot','light'].includes(obj.userData.editorKind))return;obj.userData.physics=physicsOptions({mode:byId('objectPhysicsMode').value,collider:byId('objectCollider').value,friction:byId('objectFriction').value,restitution:byId('objectRestitution').value});this.physics.sync(obj);this.queueSave(obj);this.updateColliderOption();this.updateCombatPhysicsHint();});
  byId('makeObjectPushable').onclick=()=>{
   const obj=this.selected;
   if(!obj||!this.canEdit(obj)||['robot','light'].includes(obj.userData.editorKind))return;
   const before=this.snapshot(obj);
   obj.userData.physics=physicsOptions({...obj.userData.physics,mode:'dynamic'});
   byId('objectPhysicsMode').value='dynamic';byId('objectCollider').value=obj.userData.physics.collider||'box';
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
   activeValue.textContent=Number(input.value).toFixed(2)+(selector.value==='robotClimbSpeed'?' m/s':'×');};
  selector.onchange=syncRobotSpeed;
  activeSpeed.oninput=()=>{const input=byId(selector.value);if(!input)return;input.value=activeSpeed.value;
   input.dispatchEvent(new Event('input',{bubbles:true}));syncRobotSpeed();};
  this.syncRobotSpeed=syncRobotSpeed;
  for(const [field,kind] of [['animationWalk','walk'],['animationRun','run'],['animationJump','jump']]){
   byId(field).oninput=()=>{const bot=this.robot();if(!bot||!this.canEdit(bot))return;const speeds=animationSpeedSettings(bot.userData.robotAnimationSpeed);speeds[kind]=Number(byId(field).value);bot.userData.robotAnimationSpeed=animationSpeedSettings(speeds);this.queueSave(bot);};
  }
  // Commit valid values as they are entered; a later inspector refresh must not
  // overwrite a focused field before its browser "change"/blur event fires.
  const throwEditBefore=new WeakMap();
  for(const [key,id] of [['angle','robotThrowAngle'],['height','robotThrowHeight'],['direction','robotThrowDirection'],['delay','robotThrowDelay'],['pickupDelay','robotPickupDelay'],['pickupSpeed','robotPickupSpeed'],['throwSpeed','robotThrowSpeed'],['force','robotThrowForce']]){
   const field=byId(id);
   field.addEventListener('focus',()=>{
    const bot=this.selected;
    if(bot?.userData.editorKind!=='robot'||!this.canEdit(bot))return;
    throwEditBefore.set(field,{robotId:bot.userData.editorId,snapshot:this.snapshot(bot)});
    this.throwEditingRobotId=bot.userData.editorId;
   });
   field.addEventListener('input',()=>{
    const bot=this.selected;
    if(bot?.userData.editorKind!=='robot'||!this.canEdit(bot))return;
    const next=editThrowSetting(bot.userData.robotThrowSettings,key,field.value);
    if(!next)return; // Partial values (including empty strings) are still being typed.
    bot.userData.robotThrowSettings=next;
    this.queueSave(bot);
   });
   field.addEventListener('change',()=>{
    const bot=this.selected;
    if(bot?.userData.editorKind!=='robot'||!this.canEdit(bot))return;
    const prior=throwEditBefore.get(field);
    const before=prior?.robotId===bot.userData.editorId?prior.snapshot:this.snapshot(bot);
    const next=editThrowSetting(bot.userData.robotThrowSettings,key,field.value);
    if(next)bot.userData.robotThrowSettings=next;
    field.value=cleanThrowSettings(bot.userData.robotThrowSettings)[key];
    const after=this.snapshot(bot);
    if(JSON.stringify(before)!==JSON.stringify(after))this.recordEdit(before,after);
    if(next)this.queueSave(bot);
   });
   field.addEventListener('blur',()=>{
    throwEditBefore.delete(field);
    if(this.throwEditingRobotId===this.selected?.userData.editorId)this.throwEditingRobotId=null;
   });
  }
  byId('robotThrowTrajectory').addEventListener('change',e=>this.carry.toggleTrajectory(e.target.checked));
  byId('robotTestThrowSphere').addEventListener('click',()=>{
   const robot=this.selected;
   if(!robot||robot.userData.editorKind!=='robot'||!this.canEdit(robot))return;
   if(!this.carry.testSphere(robot))this.toast('Select a free avatar and enable room Physics to test a sphere');
  });
  const runMultiplier=byId('robotRunMultiplier');runMultiplier.oninput=()=>{if(!this.selected||this.selected.userData.editorKind!=='robot'||!this.canEdit(this.selected))return;this.selected.userData.robotRunMultiplier=Number(runMultiplier.value);this.queueSave(this.selected);};
  const strafe=byId('robotStrafeSpeed');strafe.oninput=()=>{if(!this.selected||!this.canEdit(this.selected))return;this.selected.userData.robotStrafeSpeed=Number(strafe.value);byId('robotStrafeLabel').textContent=Number(strafe.value).toFixed(1)+'×';this.queueSave(this.selected);};
  const turn=byId('robotTurnSpeed');turn.addEventListener('input',()=>{if(!this.selected||!this.canEdit(this.selected))return;this.selected.userData.robotTurnSpeed=Number(turn.value);byId('robotTurnLabel').textContent=Number(turn.value).toFixed(2)+'×';this.queueSave(this.selected);});
  const climb=byId('robotClimbSpeed');climb.addEventListener('input',()=>{if(!this.selected||this.selected.userData.editorKind!=='robot'||!this.canEdit(this.selected))return;this.selected.userData.robotClimbSpeed=Number(climb.value);byId('robotClimbLabel').textContent=Number(climb.value).toFixed(2)+' m/s';this.queueSave(this.selected);});
  const modeButton=byId('controlModeButton'),robotSelect=byId('controlledRobotSelect'),robotFaces=byId('controlledRobotFaces');
  attachControlSwitcherDrag(byId('controlSwitcher'));
  const switcher=byId('controlSwitcher');
  // Optional smooth routes only affect NEW A* plans. The default remains the
  // original, already verified robot route. Never smooth manual key controls.
  const smoothWalkToggle=byId('smoothRobotWalks'),eyesToggle=byId('showRobotEyes');
  try{this.smoothRobotPathsEnabled=localStorage.getItem('solvi-smooth-robot-walks-v1')==='1';}
  catch{this.smoothRobotPathsEnabled=false;}
  smoothWalkToggle.checked=this.smoothRobotPathsEnabled;
  smoothWalkToggle.onchange=()=>{
   this.smoothRobotPathsEnabled=smoothWalkToggle.checked;
   try{localStorage.setItem('solvi-smooth-robot-walks-v1',this.smoothRobotPathsEnabled?'1':'0');}catch{}
  };
  const eyePanel=byId('robotEyePreview'),eyeImage=byId('robotEyePreviewImage');
  const eyeName=byId('robotEyePreviewName'),eyeTime=byId('robotEyePreviewTime');
  let eyesEnabled=true,eyeURL=null,displayedBlob=null;
  const eyeFrames=new Map();
  try{eyesEnabled=localStorage.getItem('solvi-robot-eyes-preview-v1')!=='0';}catch{}
  eyesToggle.checked=eyesEnabled;
  const clearEyeImage=()=>{
   if(eyeURL)URL.revokeObjectURL(eyeURL);
   eyeURL=null;displayedBlob=null;eyeImage.hidden=true;eyeImage.removeAttribute('src');
  };
  const updateEyePreview=()=>{
   const robot=this.items.find(o=>o.userData.editorKind==='robot'&&o.userData.editorId===this.controlledRobotId&&this.canEdit(o));
   eyePanel.hidden=!eyesEnabled||!robot;
   if(eyePanel.hidden){clearEyeImage();return;}
   eyeName.textContent=robot.name+' · last real eye view';
   const frame=eyeFrames.get(robot.userData.editorId);
   if(!frame||frame.room!==String(window.solviRoom||'')){
    clearEyeImage();eyeTime.textContent='No camera frame captured in this realm';eyeTime.removeAttribute('datetime');return;
   }
   if(displayedBlob!==frame.blob){
    clearEyeImage();eyeURL=URL.createObjectURL(frame.blob);eyeImage.src=eyeURL;eyeImage.hidden=false;displayedBlob=frame.blob;
   }
   const seconds=Math.max(0,Math.floor((Date.now()-frame.at)/1000));
   const age=seconds<60?`${seconds}s ago`:seconds<3600?`${Math.floor(seconds/60)}m ago`:`${Math.floor(seconds/3600)}h ago`;
   eyeTime.textContent=`${age} · ${frame.label}`;
   eyeTime.dateTime=new Date(frame.at).toISOString();
   eyePanel.title=`${robot.name}: head-camera JPEG captured ${new Date(frame.at).toLocaleString()} · ${frame.label}. This is the last capture, not a live stream.`;
  };
  eyesToggle.onchange=()=>{
   eyesEnabled=eyesToggle.checked;
   try{localStorage.setItem('solvi-robot-eyes-preview-v1',eyesEnabled?'1':'0');}catch{}
   updateEyePreview();
  };
  window.addEventListener('solvi:robot-eye-frame',event=>{
   const frame=event.detail;
   if(!frame?.robotId||!frame?.blob?.size||frame.room!==String(window.solviRoom||''))return;
   eyeFrames.set(frame.robotId,frame);updateEyePreview();
  });
  window.addEventListener('solvi:room-changed',()=>{eyeFrames.clear();clearEyeImage();updateEyePreview();});
  window.addEventListener('pagehide',clearEyeImage);
  setInterval(()=>{if(!eyePanel.hidden)updateEyePreview();},15000);
  const speakingPortrait=e=>{
   const name=String(e.detail?.name||'').toLocaleLowerCase();
   for(const button of robotFaces.children){const bot=this.items.find(o=>o.userData.editorId===button.dataset.robotId);
    const active=e.detail?.active===true&&bot?.name.toLocaleLowerCase()===name;
    button.classList.toggle('robot-face-speaking',active);button.setAttribute('data-speaking',String(active));
    if(active)button.title=bot.name+' is speaking';
   }
  };
  window.addEventListener('solvi:robot-speaking',speakingPortrait);
  window.addEventListener('solvi:room-changed',()=>{for(const button of robotFaces.children)button.classList.remove('robot-face-speaking');});
  const faceSizeKey='solvi-robot-face-size-v1';
  let faceSize=50;
  try{faceSize=Math.max(32,Math.min(84,Number(localStorage.getItem(faceSizeKey))||50));}catch{}
  const setFaceSize=(size)=>{faceSize=Math.max(32,Math.min(84,size));switcher.style.setProperty('--robot-face-size',faceSize+'px');
   byId('robotFacesSmaller').disabled=faceSize<=32;byId('robotFacesLarger').disabled=faceSize>=84;
   try{localStorage.setItem(faceSizeKey,String(faceSize));}catch{}
  };
  byId('robotFacesSmaller').onclick=()=>setFaceSize(faceSize-6);
  byId('robotFacesLarger').onclick=()=>setFaceSize(faceSize+6);
  setFaceSize(faceSize);
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
   const robotMode=this.controlMode==='robot';
   const modeName=robotMode?(this.controlledRobot()?.name||'Robot'):'Scene';
   const modeIcon=robotMode?'control':'scene';
   if(modeButton.dataset.switcherMode!==modeIcon||modeButton.dataset.switcherName!==modeName){
    const icon=document.createElement('img');icon.className='solvi-switcher-icon';icon.src=`./assets/ui-icons/switch-${modeIcon}.svg`;icon.alt='';
    const label=document.createElement('span');label.className='solvi-switcher-label';label.textContent=modeName;
    modeButton.replaceChildren(icon,label);modeButton.dataset.switcherMode=modeIcon;modeButton.dataset.switcherName=modeName;
   }
   modeButton.setAttribute('aria-label',robotMode?`Control ${modeName}; click to control scene`:'Scene control; click to control robot');
   modeButton.setAttribute('aria-pressed',String(robotMode));
   modeButton.title=robotMode?'Return arrow keys to scene navigation':'Control selected robot with arrow keys';
   updateEyePreview();
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
   if(this.collectionTarget){if(!this.canMoveCollection(this.collectionTarget.members))return this.toast('Collection has locked or read-only items');this.transform.setMode(mode);this.transform.attach(this.collectionTarget.pivot);return;}
   if(!this.selected||!this.canTransform(this.selected))return this.toast('Unlock this object to transform it');
   this.transform.setMode(mode);
   this.transform.attach(this.selected); // Explicit manual placement of robots remains possible.
  };
  byId('objectNameInput').onchange=e=>{if(!this.selected||!this.canEdit(this.selected))return;const name=e.target.value.trim().slice(0,100);if(!name)return;const before=this.snapshot(this.selected);this.selected.name=name;byId('objectName').textContent=name;this.recordEdit(before,this.snapshot(this.selected));this.refreshList();this.queueSave(this.selected);};
  byId('deleteObject').onclick=()=>this.remove();
  // The one contextual range is a non-reflowing popover underneath the active
  // numeric ROW. Never insert it into the three-column furniture grid: doing so
  // moves neighbouring inputs every time the numeric focus changes.
  const context=byId('inspectorValueSlider'),range=byId('inspectorActiveRange');
  let activeNumeric=null;
  if(context.parentElement!==document.body)document.body.append(context);
  const positionValueSlider=()=>{
   // This one control always floats below the FULL active row. It never
   // participates in the furniture 3-column grid or the Transform XYZ grid.
   if(context.hidden||!activeNumeric?.isConnected){context.hidden=true;return;}
   const bounds=inspectorSliderRow(activeNumeric,byId('furniturePropertiesFields'));
   const viewportWidth=document.documentElement.clientWidth||window.innerWidth;
   const viewportHeight=document.documentElement.clientHeight||window.innerHeight;
   const width=Math.max(160,Math.min(bounds.width,viewportWidth-16));
   const left=Math.max(8,Math.min(viewportWidth-width-8,bounds.left));
   const height=Math.max(64,context.getBoundingClientRect().height||70);
   let top=bounds.bottom+6;
   // If the active row is at the bottom of the window, use the space above.
   if(top+height>viewportHeight-8)top=Math.max(8,bounds.top-height-6);
   context.style.left=`${left}px`;context.style.top=`${top}px`;context.style.width=`${width}px`;
  };
  window.addEventListener('resize',positionValueSlider);
  // Capturing scroll handles the inspector's own scroll container as well as
  // browser/OS scrolling; the layout of every input remains unchanged.
  document.addEventListener('scroll',positionValueSlider,true);
  window.addEventListener('pointermove',event=>{if(!context.hidden&&event.buttons)positionValueSlider();},true);
  document.addEventListener('pointerdown',event=>{
   if(!context.hidden&&!context.contains(event.target)&&!event.target?.matches?.('input[type=number]'))context.hidden=true;
 },true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')context.hidden=true;},true);
  const activateValue=(number)=>{
   if(!number || !number.matches('input[type="number"]') || !byId('objectInspector').contains(number))return;
   if(number.disabled)return;
   // Both furniture/vegetation and Transform XYZ share the SAME wide slider.
   const group=number.closest('.transform-value') || number.closest('label') || number.parentElement;
   if(!group)return;
   activeNumeric=number;
   this.inspectorSliderSession={id:this.selected?.userData.editorId,key:number.dataset.furnitureParam||number.id,furniture:!!number.dataset.furnitureParam};
   const text=number.getAttribute('aria-label')||number.closest('label')?.textContent?.trim()||number.id;
   byId('inspectorSliderLabel').textContent=text;
   const field=number.id.match(/^(position|rotation|scale)-[012]$/)?.[1];
   const limits=field==='rotation'?[-180,180,'0.5']:field==='scale'?[0,1000,'1']:field==='position'?[-Math.max(25,this.world.environment?.floorSize/2||25),Math.max(25,this.world.environment?.floorSize/2||25),'0.05']:
      [Number(number.min||0),Number(number.max||100),number.step||'any'];
   if(!limits.every((n,i)=>i===2||Number.isFinite(n))||limits[0]>=limits[1])return;
   range.min=String(limits[0]);range.max=String(limits[1]);range.step=limits[2];
   range.setAttribute('aria-label',text+' slider');
   range.value=String(field==='scale'?scaleToSlider(Number(number.value)):Math.min(limits[1],Math.max(limits[0],Number(number.value)||0)));
   byId('inspectorSliderValue').textContent=number.value;
   context.hidden=false;
   positionValueSlider();
  };
  this.activateInspectorValue=activateValue;
  // Reconnect to the new input when a scene transform refresh rebuilds the
  // inspector. This avoids losing the slider in the middle of a drag/commit.
  this.restoreInspectorValue=()=>{
   const token=this.inspectorSliderSession;
   if(context.hidden||!token||token.id!==this.selected?.userData.editorId)return;
   const number=token.furniture
     ?[...byId('furniturePropertiesFields').querySelectorAll('input[type=number]')].find(field=>field.dataset.furnitureParam===token.key)
     :byId(token.key);
   if(!number||number.disabled){context.hidden=true;return;}
   activateValue(number);
  };
  byId('objectInspector').addEventListener('focusin',event=>activateValue(event.target));
  byId('objectInspector').addEventListener('click',event=>{
    if(event.target.matches?.('input[type="number"]'))activateValue(event.target);
  });
  byId('objectInspector').addEventListener('input',event=>{
   if(activeNumeric!==event.target)return;
   byId('inspectorSliderValue').textContent=activeNumeric.value;
   // Typing in furniture fields keeps the shared slider in sync just as
   // typing in position/rotation/scale does.
   if(activeNumeric.dataset.furnitureParam&&Number.isFinite(Number(activeNumeric.value)))range.value=activeNumeric.value;
  });
  range.addEventListener('input',()=>{
   if(!activeNumeric||activeNumeric.disabled)return;
   const isScale=activeNumeric.id.startsWith('scale-');activeNumeric.value=isScale?String(Number(sliderToScale(Number(range.value)).toFixed(3))):range.value;
   byId('inspectorSliderValue').textContent=activeNumeric.value;
   // Linked XYZ must update while the pointer moves, not after leaving the slider.
   const furniture=Boolean(activeNumeric.dataset.furnitureParam);
   // Preview a furniture value while dragging; do not create a separate
   // history/save entry on every pointer movement.
   activeNumeric.dispatchEvent(new Event(isScale||furniture?'input':'change',{bubbles:true}));
  });
  range.addEventListener('change',()=>{
   if(activeNumeric?.id.startsWith('scale-')||activeNumeric?.dataset.furnitureParam)
    activeNumeric.dispatchEvent(new Event('change',{bubbles:true}));
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
   obj[field].set(neutral,neutral,neutral);this.physics.applyEditedPose(obj);
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
    this.physics.applyEditedPose(obj);this.recordEdit(before,this.snapshot(obj));this.refreshList();this.queueSave(obj);};}
  byId('objectColor').addEventListener('focus',()=>this.colorBefore=this.snapshot(this.selected));byId('objectColor').addEventListener('change',()=>{this.recordEdit(this.colorBefore,this.snapshot(this.selected));this.colorBefore=null;});
  byId('objectColor').oninput=e=>{const obj=this.selected;if(!obj||!this.canEdit(obj)||obj.userData.editorKind==='robot')return;
   if(obj.userData.editorKind==='stairs'){const state=obj.userData.stairs||{};rebuildOfficeStairs(obj,{...state,color:e.target.value,surface:{...state.surface,color:e.target.value}});this.physics.sync(obj);}
   else obj.traverse(o=>{if(o.material?.color)o.material.color.set(e.target.value);});
   this.queueSave(obj);};
  byId('texturePreset').onchange=e=>{const before=this.snapshot(this.selected);this.texture(e.target.value);this.recordEdit(before,this.snapshot(this.selected));};byId('textureUploadButton').onclick=()=>byId('textureUpload').click();
  byId('textureUpload').onchange=async e=>{const file=e.target.files[0];if(!file||!file.type.startsWith('image/')||file.size>5_000_000)return this.toast('Select an image under 5 MB');
   const before=this.snapshot(this.selected);const blob=URL.createObjectURL(file);new THREE.TextureLoader().load(blob,tex=>{tex.colorSpace=THREE.SRGBColorSpace;this.selected.userData.textureName='custom';this.assignTexture(tex);this.recordEdit(before,this.snapshot(this.selected));URL.revokeObjectURL(blob);},undefined,()=>URL.revokeObjectURL(blob));};
  byId('saveScene').onclick=()=>this.save();byId('reloadScene').onclick=()=>this.load();
 }
 setupWallControls(){
  const field=id=>byId(id),panel=field('wallPanel');if(!panel)return;
  field('wallConvertStatic').onclick=()=>this.convertWallToCuttableCubes();
  this.wallDoorSegments=[];
  const refreshDoorStatus=()=>{const out=field('wallDoorStatus');if(out)out.textContent='Door openings on segments: '+(this.wallDoorSegments.map(n=>n+1).join(', ')||'none');};
  field('wallDoorAdd').onclick=()=>{const i=Math.round(Number(field('wallDoorSegment').value))-1;if(i<0||i>=80)return;field('wallDoorsEnabled').checked=true;if(!this.wallDoorSegments.includes(i))this.wallDoorSegments.push(i);refreshDoorStatus();field('wallDoorWidth').dispatchEvent(new Event('input',{bubbles:true}));};
  field('wallDoorRemove').onclick=()=>{const i=Math.round(Number(field('wallDoorSegment').value))-1;this.wallDoorSegments=this.wallDoorSegments.filter(n=>n!==i);refreshDoorStatus();field('wallDoorWidth').dispatchEvent(new Event('input',{bubbles:true}));};
  this.refreshDoorStatus=refreshDoorStatus;

  const extraIds=['stairRailEnabled','stairRailSide','stairRailRods','stairRailHeight','stairRailWidth','stairRailEvery','stairRailMaterial','stairRailTexture','stairRailColor','stairRailOpacity','stairRoofEnabled','stairRoofWalls','stairRoofHeight','stairRoofThickness','stairRoofTexture','stairRoofColor','stairRoofOpacity','stairSupportEnabled','stairSupportSide','stairSupportEvery','stairSupportWidth','stairSupportTexture','stairSupportColor','stairSupportOpacity','stairSurfaceTexture','stairSurfaceMaterial','stairSurfaceColor','stairSurfaceOpacity','stairTransportEnabled','stairTransportSpeed','stairTransportDirection','stairTransportControlsEnabled','stairTransportControlsSide','stairLiftLevels','stairLiftLevelHeight','stairLiftCabinHeight','stairLiftCallButtons','stairLiftCallSide'];
  this.stairExtraIds=extraIds;
  const ranges={wallWidth:[.05,4,.01,'m'],wallHeight:[.2,10,.1,'m'],wallOpacity:[.08,1,.02,''],
   wallWindowsMinWidth:[1.2,15,.1,'m'],wallWindowsMinHeight:[1,10,.1,'m'],wallWindowsWidthRatio:[15,70,1,'%'],wallWindowsHeightRatio:[20,75,1,'%'],wallWindowsOpacity:[.08,.85,.01,''],
   wallRoofThickness:[.05,.6,.01,'m'],wallArrayCount:[1,16,1,''],wallArrayGap:[0,20,.05,'m'],
   wallDoorWidth:[.5,2.8,.05,'m'],wallDoorHeight:[1.5,4.5,.05,'m'],wallDoorSegment:[1,80,1,''],
   wallHouseRoofRise:[.15,6,.05,'m'],wallHouseRoofOverhang:[0,2,.05,'m'],wallHouseRoofThickness:[.05,.5,.01,'m'],
   wallTextureScale:[.25,5,.05,''],wallTextureDistortion:[0,2,.05,''],wallTextureContrast:[.2,3,.05,''],
   stairCount:[1,80,1,''],stairTread:[35,800,5,'mm'],stairRiser:[60,280,5,'mm']};
  let active='wallHeight';
  const setActive=id=>{active=id;const input=field(id),slider=field('wallValueSlider'),[min,max,step,unit]=ranges[id];
   slider.min=min;slider.max=max;slider.step=step;slider.value=input.value;
   const row=input.closest('.wall-compact-fields');const wrapper=slider.closest('.wall-active-slider');if(row&&wrapper&&row.nextElementSibling!==wrapper)row.after(wrapper);
   field('wallSliderLabel').textContent=(input.closest('label')?.textContent?.trim()||id.slice(4))+' · '+Number(input.value).toFixed(2)+(unit?' '+unit:'');
  };
  const rerender=()=>{
   if(panel.hidden)return;
   const stairMode=field('stairStepMode').value;const stairData=this.wallDrawing?.points||this.wallEditTarget?.userData?.stairs?.points||[];
   if((this.wallDrawing?.kind==='stairs'||this.wallEditTarget?.userData.editorKind==='stairs')&&stairData.length>=2){const steps=stairSegments(this.readStairOptions(this.wallDrawing?wallWorldToLocal(stairData).points:stairData));field('stairInfo').textContent=steps.length?`${steps.length} steps · ${steps.at(-1).top.toFixed(2)} m`:'';}
   field('stairCount').disabled=stairMode==='fixed';field('stairTread').disabled=stairMode!=='fixed';field('stairRiser').disabled=stairMode!=='fixed';field('wallHeight').disabled=(this.wallDrawing?.kind==='stairs'||this.wallEditTarget?.userData.editorKind==='stairs')&&stairMode==='fixed';
   byId('wallNaturalControls').hidden=!['wood','marble','granite'].includes(field('wallTexture').value);
   if(this.wallDrawing){this.drawWallPreview();this.trackWallState();return;}
   const obj=this.wallEditTarget;
   if(obj&&this.canEdit(obj)){
    if(obj.userData.editorKind==='stairs')rebuildOfficeStairs(obj,this.readStairOptions(obj.userData.stairs?.points));
    else rebuildOfficeWall(obj,this.readWallOptions(obj.userData.wall?.points),this.liftObjects());
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
  for(const id of ['wallTextureScale','wallTextureDistortion','wallTextureContrast','wallDoorsEnabled','wallDoorWidth','wallDoorHeight','wallDoorSegment','wallHouseRoofEnabled','wallHouseRoofStyle','wallHouseRoofDirection','wallHouseRoofRise','wallHouseRoofOverhang','wallHouseRoofThickness','wallHouseRoofTexture','wallHouseRoofColor','wallHouseChimney','wallHouseSolar','wallHouseSkylight','wallWindowsEnabled','wallWindowsOpenable','wallWindowsMinWidth','wallWindowsMinHeight','wallWindowsWidthRatio','wallWindowsHeightRatio','wallWindowsColor','wallWindowsOpacity','wallRoofEnabled','wallRoofAutoLift','wallRoofThickness','wallRoofTexture','wallRoofColor','wallArrayEnabled','wallArrayCount','wallArrayAxis','wallArrayDirection','wallArrayGap','wallArrayRotateX','wallArrayRotateY','wallArrayRotateZ','wallArrayScaleX','wallArrayScaleY','wallArrayScaleZ']){field(id).addEventListener('input',rerender);field(id).addEventListener('change',rerender);}
  for(const id of ['wallTexture','wallSmooth','wallPhysics','wallPreviewMode','wallCeilingHeight','stairStepMode','stairCount','stairTread','stairRiser','stairFloating'])field(id).addEventListener('change',rerender);
  for(const id of extraIds){field(id).addEventListener('change',rerender);if(['number','color'].includes(field(id).type))field(id).addEventListener('input',rerender);}
  field('stairLiftLevels').addEventListener('change',()=>this.refreshLiftLevels());
  field('stairLiftStart').onclick=()=>{const o=this.wallEditTarget;if(!o||o.userData.stairs?.variant!=='lift'||!this.canEdit(o))return;const level=Number(field('stairLiftTarget').value);this.activateLiftButton({parent:o,userData:{liftButton:true,liftLevel:level}});};
  field('stairLiftStop').onclick=()=>{const o=this.wallEditTarget;if(o&&this.canEdit(o)&&stopLift(o)){window.solviRoomSocket?.send({type:'lift-motion',id:o.userData.editorId,...o.userData.stairs.lift.motion});this.queueSave(o);field('stairLiftState').textContent='Stopped';}};
  field('wallColor').addEventListener('input',()=>{if(this.wallDrawing?.kind==='stairs'||this.wallEditTarget?.userData.editorKind==='stairs')field('stairSurfaceColor').value=field('wallColor').value;rerender();}); // Input, not change: update while native colour picker is open.
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
  field('wallCloseLoop').onclick=()=>{if(this.wallDrawing?.points.length>=3){byId('wallArrayOptions').hidden=false;this.wallDrawing.closed=true;this.wallDrawing.finished=true;this.drawWallPreview();this.trackWallState();}};
  field('wallCancel').onclick=()=>this.endWallDrawing();
  field('wallClose').onclick=()=>this.endWallDrawing();
  field('wallDrawMode').onchange=()=>{if(this.wallDrawing){byId('wallArrayOptions').hidden=field('wallDrawMode').value!=='closed';this.wallDrawing.mode=field('wallDrawMode').value;this.wallDrawing.points=[];this.wallDrawing.cursor=null;this.wallDrawing.finished=false;this.wallDrawing.closed=field('wallDrawMode').value==='closed';this.drawWallPreview();this.trackWallState();}};
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
 liftObjects(){return this.items.filter(o=>o.userData.editorKind==='stairs'&&o.userData.stairs?.variant==='lift');}
 readWallOptions(points=[]){return sanitiseWall({points,closed:!!(this.wallDrawing?.closed||this.wallEditTarget?.userData?.wall?.closed||byId('wallDrawMode').value==='closed'),width:byId('wallWidth').value,height:byId('wallHeight').value,opacity:byId('wallOpacity').value,texture:byId('wallTexture').value==='custom'&&!this.wallTextureMediaId?'plaster':byId('wallTexture').value,textureMediaId:this.wallTextureMediaId,textureScale:byId('wallTextureScale').value,textureDistortion:byId('wallTextureDistortion').value,textureContrast:byId('wallTextureContrast').value,color:byId('wallColor').value,smooth:byId('wallSmooth').checked,
 doors:{enabled:byId('wallDoorsEnabled').checked,width:byId('wallDoorWidth').value,height:byId('wallDoorHeight').value,segments:this.wallDoorSegments||[]},
 roof:{enabled:byId('wallHouseRoofEnabled').checked,style:byId('wallHouseRoofStyle').value,direction:byId('wallHouseRoofDirection').value,rise:byId('wallHouseRoofRise').value,overhang:byId('wallHouseRoofOverhang').value,thickness:byId('wallHouseRoofThickness').value,texture:byId('wallHouseRoofTexture').value,color:byId('wallHouseRoofColor').value,chimney:byId('wallHouseChimney').checked,solarPanels:byId('wallHouseSolar').checked,skylight:byId('wallHouseSkylight').checked},
 windows:{enabled:byId('wallWindowsEnabled').checked,openable:byId('wallWindowsOpenable').checked,minWidth:byId('wallWindowsMinWidth').value,minHeight:byId('wallWindowsMinHeight').value,widthRatio:Number(byId('wallWindowsWidthRatio').value)/100,heightRatio:Number(byId('wallWindowsHeightRatio').value)/100,color:byId('wallWindowsColor').value,opacity:byId('wallWindowsOpacity').value,openIds:this.wallEditTarget?.userData.wall?.windows?.openIds||[]},
 ceiling:{enabled:byId('wallRoofEnabled').checked,autoLiftOpenings:byId('wallRoofAutoLift').checked,thickness:byId('wallRoofThickness').value,texture:byId('wallRoofTexture').value,color:byId('wallRoofColor').value},
 array:{enabled:byId('wallArrayEnabled').checked,count:byId('wallArrayCount').value,axis:byId('wallArrayAxis').value,direction:Number(byId('wallArrayDirection').value),gap:byId('wallArrayGap').value,rotation:['X','Y','Z'].map(a=>Number(byId('wallArrayRotate'+a).value)),scale:['X','Y','Z'].map(a=>Number(byId('wallArrayScale'+a).value))}});}
 readStairOptions(points=[]){
  const get=id=>{const e=byId(id);return e.type==='checkbox'?e.checked:e.type==='number'?Number(e.value):e.value;};
  return sanitiseStairs({points,width:get('wallWidth'),height:get('wallHeight'),opacity:get('wallOpacity'),color:get('wallColor'),stepMode:get('stairStepMode'),steps:get('stairCount'),treadMm:get('stairTread'),riserMm:get('stairRiser'),floating:get('stairFloating'),
   variant:this.wallDrawing?.variant||this.wallEditTarget?.userData.stairs?.variant||'standard',
   surface:{texture:get('stairSurfaceTexture'),material:get('stairSurfaceMaterial'),color:get('stairSurfaceColor'),opacity:get('stairSurfaceOpacity')},
   rail:{enabled:get('stairRailEnabled'),side:get('stairRailSide'),rods:get('stairRailRods'),every:get('stairRailEvery'),height:get('stairRailHeight'),width:get('stairRailWidth'),material:get('stairRailMaterial'),texture:get('stairRailTexture'),color:get('stairRailColor'),opacity:get('stairRailOpacity')},
   roof:{enabled:get('stairRoofEnabled'),walls:get('stairRoofWalls'),height:get('stairRoofHeight'),thickness:get('stairRoofThickness'),texture:get('stairRoofTexture'),color:get('stairRoofColor'),opacity:get('stairRoofOpacity')},
   supports:{enabled:get('stairSupportEnabled'),side:get('stairSupportSide'),every:get('stairSupportEvery'),width:get('stairSupportWidth'),texture:get('stairSupportTexture'),color:get('stairSupportColor'),opacity:get('stairSupportOpacity')},
   transport:{enabled:get('stairTransportEnabled'),speed:get('stairTransportSpeed'),direction:get('stairTransportDirection')==='-1'?-1:1,controlsEnabled:get('stairTransportControlsEnabled'),controlsSide:get('stairTransportControlsSide'),changedAt:this.wallEditTarget?.userData.stairs?.transport?.changedAt||0},
   lift:{levels:get('stairLiftLevels'),levelHeight:get('stairLiftLevelHeight'),cabinHeight:get('stairLiftCabinHeight'),callButtons:get('stairLiftCallButtons'),callSide:get('stairLiftCallSide'),target:this.wallEditTarget?.userData.stairs?.lift?.target||0,currentHeight:this.wallEditTarget?.userData.stairs?.lift?.currentHeight||0,...(this.wallEditTarget?.userData.stairs?.lift?.motion?{motion:this.wallEditTarget.userData.stairs.lift.motion}:{})}
  });
 }
 refreshLiftLevels(){const select=byId('stairLiftTarget');if(!select)return;const previous=select.value;select.replaceChildren();const count=Math.max(2,Math.min(40,Number(byId('stairLiftLevels').value)||2));for(let i=0;i<count;i++){const option=document.createElement('option');option.value=String(i);option.textContent='Level '+(i+1);select.append(option);}select.value=Number(previous)<count?previous:'0';}
 addLift(){
  const lift=objectFor('stairs');const point=centreGroundFromCamera(this.world.camera,this.world.controls?.target);
  lift.position.set(point.x,0,point.z);lift.userData.ownerId=window.solviAPI?.auth()?.profile?.id||null;
  rebuildOfficeStairs(lift,{variant:'lift',points:[[0,0],[0,2]],width:1.6,height:3,rail:{enabled:false}});
  lift.name='Lift';lift.userData.physics=physicsOptions({mode:'kinematic'});
  this.items.push(lift);this.world.scene.add(lift);this.physics.sync(lift);this.select(lift);byId('addMenu').hidden=true;this.refreshList();this.recordEdit(null,this.snapshot(lift));this.queueSave(lift);
 }

 wallSessionState(){
  return {points:this.wallDrawing?.points.map(p=>({...p}))||null,finished:this.wallDrawing?.finished||false,closed:this.wallDrawing?.closed||false,mode:this.wallDrawing?.mode||'single',variant:this.wallDrawing?.variant||'standard',
   values:Object.fromEntries(['wallDrawMode','wallWidth','wallHeight','wallOpacity','wallColor','wallTexture','wallTextureScale','wallTextureDistortion','wallTextureContrast','wallDoorsEnabled','wallDoorWidth','wallDoorHeight','wallDoorSegment','wallHouseRoofEnabled','wallHouseRoofStyle','wallHouseRoofDirection','wallHouseRoofRise','wallHouseRoofOverhang','wallHouseRoofThickness','wallHouseRoofTexture','wallHouseRoofColor','wallHouseChimney','wallHouseSolar','wallHouseSkylight','wallWindowsEnabled','wallWindowsOpenable','wallWindowsMinWidth','wallWindowsMinHeight','wallWindowsWidthRatio','wallWindowsHeightRatio','wallWindowsColor','wallWindowsOpacity','wallRoofEnabled','wallRoofAutoLift','wallRoofThickness','wallRoofTexture','wallRoofColor','wallArrayEnabled','wallArrayCount','wallArrayAxis','wallArrayDirection','wallArrayGap','wallArrayRotateX','wallArrayRotateY','wallArrayRotateZ','wallArrayScaleX','wallArrayScaleY','wallArrayScaleZ','wallPhysics','wallPreviewMode','wallCeilingHeight','wallSnap','wallGridStep','wallAngleStep','wallSmooth','wallSmoothStrength','stairStepMode','stairCount','stairTread','stairRiser','stairFloating',...this.stairExtraIds].map(id=>[id,byId(id).type==='checkbox'?byId(id).checked:byId(id).value])),
   textureMediaId:this.wallTextureMediaId,doorSegments:[...(this.wallDoorSegments||[])],wallPoints:!this.wallDrawing&&this.wallEditTarget?.userData.editorKind==='wall'?structuredClone(this.wallEditTarget.userData.wall?.points):null};
 }
 trackWallState(){if(this.wallRestoring||byId('wallPanel').hidden)return;const next=this.wallSessionState();if(this.wallStateLast)this.wallSessionHistory.push(this.wallStateLast,next);this.wallStateLast=next;}
 restoreWallSessionState(state){if(!state)return;this.wallRestoring=true;
  for(const [id,value] of Object.entries(state.values)){const input=byId(id);if(input.type==='checkbox')input.checked=value;else input.value=value;}
  this.wallTextureMediaId=state.textureMediaId||'';this.wallDoorSegments=[...(state.doorSegments||[])];this.refreshDoorStatus?.();
  if(this.wallDrawing){Object.assign(this.wallDrawing,{points:state.points||[],finished:state.finished,closed:state.closed,mode:state.mode,variant:state.variant||'standard',cursor:null});this.drawWallPreview();}
  else if(this.wallEditTarget){const obj=this.wallEditTarget;if(obj.userData.editorKind==='stairs')rebuildOfficeStairs(obj,this.readStairOptions(obj.userData.stairs?.points));else rebuildOfficeWall(obj,this.readWallOptions(state.wallPoints||obj.userData.wall?.points),this.liftObjects());this.physics.sync(obj);}
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
  byId('stairConveyorControls').hidden=!['walkway','escalator'].includes(variant);
  if(stair){
   const map={stairRailEnabled:config.rail.enabled,stairRailSide:config.rail.side,stairRailRods:config.rail.rods,stairRailHeight:config.rail.height,stairRailWidth:config.rail.width,stairRailEvery:config.rail.every,stairRailMaterial:config.rail.material,stairRailTexture:config.rail.texture,stairRailColor:config.rail.color,stairRailOpacity:config.rail.opacity,
    stairRoofEnabled:config.roof.enabled,stairRoofWalls:config.roof.walls,stairRoofHeight:config.roof.height,stairRoofThickness:config.roof.thickness,stairRoofTexture:config.roof.texture,stairRoofColor:config.roof.color,stairRoofOpacity:config.roof.opacity,
    stairSupportEnabled:config.supports.enabled,stairSupportSide:config.supports.side,stairSupportEvery:config.supports.every,stairSupportWidth:config.supports.width,stairSupportTexture:config.supports.texture,stairSupportColor:config.supports.color,stairSupportOpacity:config.supports.opacity,
    stairSurfaceTexture:config.surface.texture,stairSurfaceMaterial:config.surface.material,stairSurfaceColor:config.surface.color,stairSurfaceOpacity:config.surface.opacity,
    stairTransportEnabled:config.transport.enabled,stairTransportSpeed:config.transport.speed,stairTransportDirection:config.transport.direction,stairTransportControlsEnabled:config.transport.controlsEnabled,stairTransportControlsSide:config.transport.controlsSide,
    stairLiftLevels:config.lift.levels,stairLiftLevelHeight:config.lift.levelHeight,stairLiftCabinHeight:config.lift.cabinHeight,stairLiftCallButtons:config.lift.callButtons,stairLiftCallSide:config.lift.callSide};
   for(const [id,value] of Object.entries(map)){const input=byId(id);if(input.type==='checkbox')input.checked=value;else input.value=value;}
   this.refreshLiftLevels();if(variant==='lift')byId('stairLiftTarget').value=String(Math.min(config.lift.target,config.lift.levels-1));
  }

  byId('wallStairOptions').hidden=!stair||variant==='lift';byId('wallMaterialOptions').hidden=stair;byId('wallSmoothingOptions').hidden=stair;
  byId('wallPreviewModeRow').hidden=!!wall;byId('wallCeilingRow').hidden=stair;byId('wallDrawMode').querySelector('option[value=closed]').hidden=stair;
  this.wallTextureMediaId=config.textureMediaId||'';
  this.wallEditOriginal=wall?{object:wall,before:this.snapshot(wall),wall:wall.userData.wall?structuredClone(wall.userData.wall):null,stairs:wall.userData.stairs?structuredClone(wall.userData.stairs):null,physics:structuredClone(wall.userData.physics)}:null;
  for(const [key,id] of [['width','wallWidth'],['height','wallHeight'],['opacity','wallOpacity']])byId(id).value=config[key];
  if(!stair){this.wallDoorSegments=[...(config.doors?.segments||[])];this.refreshDoorStatus?.();const w=config.windows||{},r=config.ceiling||{};const vals={wallDoorsEnabled:config.doors?.enabled,wallDoorWidth:config.doors?.width,wallDoorHeight:config.doors?.height,wallHouseRoofEnabled:config.roof?.enabled,wallHouseRoofStyle:config.roof?.style,wallHouseRoofDirection:config.roof?.direction,wallHouseRoofRise:config.roof?.rise,wallHouseRoofOverhang:config.roof?.overhang,wallHouseRoofThickness:config.roof?.thickness,wallHouseRoofTexture:config.roof?.texture,wallHouseRoofColor:config.roof?.color,wallHouseChimney:config.roof?.chimney,wallHouseSolar:config.roof?.solarPanels,wallHouseSkylight:config.roof?.skylight,wallWindowsEnabled:w.enabled,wallWindowsOpenable:w.openable,wallWindowsMinWidth:w.minWidth,wallWindowsMinHeight:w.minHeight,wallWindowsWidthRatio:(w.widthRatio||.36)*100,wallWindowsHeightRatio:(w.heightRatio||.42)*100,wallWindowsColor:w.color,wallWindowsOpacity:w.opacity,wallRoofEnabled:r.enabled,wallRoofAutoLift:r.autoLiftOpenings,wallRoofThickness:r.thickness,wallRoofTexture:r.texture,wallRoofColor:r.color,wallArrayEnabled:config.array?.enabled,wallArrayCount:config.array?.count,wallArrayAxis:config.array?.axis,wallArrayDirection:config.array?.direction,wallArrayGap:config.array?.gap,wallArrayRotateX:config.array?.rotation?.[0],wallArrayRotateY:config.array?.rotation?.[1],wallArrayRotateZ:config.array?.rotation?.[2],wallArrayScaleX:config.array?.scale?.[0],wallArrayScaleY:config.array?.scale?.[1],wallArrayScaleZ:config.array?.scale?.[2]};for(const [id,val] of Object.entries(vals)){const el=byId(id);if(el.type==='checkbox')el.checked=val===true;else if(val!==undefined)el.value=val;}}
  byId('wallDoorOptions').hidden=stair;byId('wallRoofShapeOptions').hidden=stair;byId('wallWindowOptions').hidden=stair;byId('wallCeilingOptions').hidden=stair;byId('wallArrayOptions').hidden=stair||!(config.closed||this.wallDrawing?.closed);byId('wallTexture').value=config.texture||'plaster';for(const [id,key] of [['wallTextureScale','textureScale'],['wallTextureDistortion','textureDistortion'],['wallTextureContrast','textureContrast']])byId(id).value=config[key];byId('wallColor').value=config.color;byId('wallSmooth').checked=config.smooth!==false;
  if(stair){byId('stairStepMode').value=config.stepMode;byId('stairCount').value=config.steps;byId('stairTread').value=config.treadMm;byId('stairRiser').value=config.riserMm;byId('stairFloating').checked=config.floating;}
  byId('wallNaturalControls').hidden=stair||!['wood','marble','granite'].includes(config.texture);
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
   if(original.object.userData.editorKind==='stairs')rebuildOfficeStairs(original.object,original.stairs);else rebuildOfficeWall(original.object,original.wall,this.liftObjects());
   original.object.userData.physics=original.physics;this.physics.sync(original.object);
  }
  this.vegetationDrawing=null;this.vegetationPreview=null;this.curveDrawing=null;this.curvePreview=null;this.faceDrawing=null;this.facePreview=null;this.mediaPickerURLs=[];
  this.wallDrawing=null;this.wallEditTarget=null;this.wallEditOriginal=null;this.wallTextureMediaId='';this.wallStateLast=null;this.wallSessionHistory.clear();++this.wallPreviewTextureReq;this.wallPreviewCustom?.dispose();this.wallPreviewCustom=null;this.wallPreviewTextureId='';
  if(this.wallPreview){this.world.scene.remove(this.wallPreview);this.disposeObject(this.wallPreview);this.wallPreview=null;}
  if(byId('wallPanel'))byId('wallPanel').hidden=true;
  this.world.controls.enabled=true;
  if(isEditMode()&&this.selected&&this.canTransform(this.selected)&&this.selected.userData.editorKind!=='robot')this.transform.attach(this.selected);
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
   else rebuildOfficeWall(target,this.readWallOptions(target.userData.wall?.points),this.liftObjects());
   target.userData.physics=physicsOptions({mode:target.userData.stairs?.variant==='lift'?'kinematic':['escalator','walkway'].includes(target.userData.stairs?.variant)?'static':byId('wallPhysics').value});this.physics.sync(target);
   this.wallEditOriginal=null;this.recordEdit(before,this.snapshot(target));this.queueSave(target);
   this.endWallDrawing();this.toast(target.userData.editorKind==='stairs'?'Stairs updated':'Wall updated');return;
  }
  const draft=this.wallDrawing;if(!draft||draft.points.length<2)return;
  let points=draft.points;
  if(draft.mode==='freehand'&&byId('wallSmooth').checked)points=smoothWallPoints(points.map(p=>[p.x,p.z]),Number(byId('wallSmoothStrength').value)).map(([x,z])=>({x,z}));
  if(points.length<2)return this.toast('Draw at least two points');
  const local=wallWorldToLocal(points);const stairs=draft.kind==='stairs';const options=stairs?this.readStairOptions(local.points):this.readWallOptions(local.points);
  if(!stairs)options.closed=draft.closed;const wall=objectFor(stairs?'stairs':'wall');
  wall.position.set(local.origin.x,0,local.origin.z);wall.name=stairs?({advanced:'Stairs advanced',escalator:'Escalator',walkway:'Moving walkway',lift:'Lift'}[options.variant]||'Office stairs'):options.closed?'Closed room':'Office wall';
  wall.userData.ownerId=window.solviAPI?.auth()?.profile?.id||null;
  wall.userData.physics=physicsOptions({mode:stairs&&options.variant==='lift'?'kinematic':stairs&&['escalator','walkway'].includes(options.variant)?'static':byId('wallPhysics').value});if(stairs)rebuildOfficeStairs(wall,options);else rebuildOfficeWall(wall,options,this.liftObjects());
  this.items.push(wall);this.world.scene.add(wall);this.physics.sync(wall);this.endWallDrawing();
  this.skipNextWallPanel=true;this.select(wall);this.skipNextWallPanel=false;
  this.refreshList();this.recordEdit(null,this.snapshot(wall));this.queueSave(wall);this.toast('Office wall created');
 }
 hitWindowButton(raycaster){
  const buttons=[];for(const root of this.items)if(root.userData.editorKind==='wall')root.traverse(mesh=>{if(mesh.userData.wallWindowButton)buttons.push(mesh);});
  const hit=raycaster.intersectObjects(buttons,false)[0];if(!hit)return null;
  const blocker=raycaster.intersectObjects(this.items,true).find(h=>!h.object.userData.wallWindowButton&&h.object.userData.wallSegment);
  if(blocker&&blocker.distance<hit.distance-.08)return null;
  return hit.object;
 }
 activateWindowButton(button){
  if(!button?.userData.wallWindowButton)return false;
  let root=button.parent;while(root&&root.userData.editorKind!=='wall')root=root.parent;
  if(!root||!this.canEdit(root))return false;
  const settings=structuredClone(root.userData.wall),id=button.userData.windowId,open=settings.windows.openIds;
  settings.windows.openIds=open.includes(id)?open.filter(n=>n!==id):[...open,id];
  rebuildOfficeWall(root,settings,this.liftObjects());this.physics.sync(root);this.queueSave(root);return true;
 }
 hitPortalButton(raycaster){
  const buttons=[];for(const item of this.items)if(item.userData.editorKind==='portal')item.traverse(o=>{if(o.userData.portalButton)buttons.push(o);});
  const hit=raycaster.intersectObjects(buttons,false)[0];if(!hit)return null;
  const front=raycaster.intersectObjects(this.items,true)[0];if(front&&front.distance<hit.distance-.02&&!front.object.userData.portalButton)return null;
  return hit.object;
 }
 activatePortalButton(button){return activatePortalButton(this,button);}
 hitTransportButton(raycaster){
  const buttons=[];
  for(const device of this.items)if(device.userData.editorKind==='stairs'&&['walkway','escalator'].includes(device.userData.stairs?.variant))device.traverse(part=>{if(part.userData.transportButton)buttons.push(part);});
  if(!buttons.length)return null;
  const hit=raycaster.intersectObjects(buttons,false)[0];if(!hit)return null;
  const front=raycaster.intersectObjects(this.items,true).find(result=>result.object.visible&&!result.object.userData.transportLabel&&!result.object.userData.transportButton);
  if(front&&front.distance<hit.distance-.025&&!front.object.userData.transportHousing)return null;
  return hit.object;
 }
 activateTransportButton(button){
  if(!button?.userData.transportButton)return false;
  let device=button.parent;while(device&&device.userData.editorKind!=='stairs')device=device.parent;
  if(!device||!this.items.includes(device)||!this.canEdit(device))return false;
  const action=button.userData.transportAction,transport=device.userData.stairs?.transport;
  if(!['walkway','escalator'].includes(device.userData.stairs?.variant)||!transport||!['start','stop','reverse'].includes(action))return false;
  if(action==='start')transport.enabled=true;
  else if(action==='stop')transport.enabled=false;
  else transport.direction=transport.direction===-1?1:-1;
  transport.changedAt=Date.now();updateConveyorControls(device);
  window.solviRoomSocket?.send({type:'conveyor-control',id:device.userData.editorId,action,changedAt:transport.changedAt});
  this.queueSave(device);
  if(this.wallEditTarget===device){byId('stairTransportEnabled').checked=transport.enabled;byId('stairTransportDirection').value=String(transport.direction);}
  return true;
 }
 applyRemoteTransportControl(packet){
  const device=this.items.find(o=>o.userData.editorId===packet?.id&&['walkway','escalator'].includes(o.userData.stairs?.variant));
  const transport=device?.userData.stairs?.transport;
  if(!transport||!['start','stop','reverse'].includes(packet.action)||!Number.isFinite(packet.changedAt)||packet.changedAt<=(transport.changedAt||0))return false;
  if(packet.action==='start')transport.enabled=true;
  else if(packet.action==='stop')transport.enabled=false;
  else transport.direction=transport.direction===-1?1:-1;
  transport.changedAt=packet.changedAt;updateConveyorControls(device);
  if(this.wallEditTarget===device){byId('stairTransportEnabled').checked=transport.enabled;byId('stairTransportDirection').value=String(transport.direction);}
  return true;
 }
 hitLiftButton(raycaster){
  const buttons=[];
  for(const lift of this.items){
   if(lift.userData.editorKind==='stairs'&&lift.userData.stairs?.variant==='lift'){
    lift.traverse(part=>{if(part.userData.liftButton)buttons.push(part);});
   }
  }
  if(!buttons.length)return null;
  // Only actual switches are interactive; decorations and cabin surfaces cannot steal clicks.
  const hit=raycaster.intersectObjects(buttons,false)[0];
  if(!hit)return null;
  // Do not operate controls through another solid object or through the lift wall.
  const front=raycaster.intersectObjects(this.items,true)[0];
  if(front&&front.distance<hit.distance-.02&&!front.object.userData.liftDecoration)return null;
  return hit.object;
 }
 activateLiftButton(button){
  if(!button?.userData.liftButton)return false;
  let device=button.parent;
  while(device&&device.userData.editorKind!=='stairs')device=device.parent;
  if(!device||!this.items.includes(device)||!this.canEdit(device))return false;
  const target=liftButtonRequest(device.userData.stairs?.lift,button);
  if(target===null)return false;
  const started=startLift(device,target);
  window.solviRoomSocket?.send({type:'lift-motion',id:device.userData.editorId,...device.userData.stairs.lift.motion});
  // Destination changes are saved as a compact object update, not a geometry rebuild.
  this.queueSave(device);
  if(this.wallEditTarget===device){
   const destination=byId('stairLiftTarget');if(destination)destination.value=String(target);
   const status=byId('stairLiftState');if(status)status.textContent=started?'Travelling to level '+(target+1):'At level '+(target+1);
  }
  return true;
 }
  applyRemoteLiftMotion(packet){
   const device=this.items.find(o=>o.userData.editorId===packet?.id&&o.userData.stairs?.variant==='lift');
   if(!device)return false;
   const incoming=safeLiftMotion(packet);if(!incoming||incoming.target>=device.userData.stairs.lift.levels)return false;
   const runtime=device.userData.stairRuntime||{height:device.userData.stairs.lift.currentHeight||0};
   if(runtime.motion&&incoming.startedAt<runtime.motion.startedAt)return false;
   runtime.baseY??=liftBaseY(device.position.y,runtime.height);
   // Avoid rebasing the same timeline after a slower scene revision arrives.
   runtime.motion=incoming;runtime.target=incoming.target;runtime.moving=incoming.active;runtime.commanded=true;runtime.authority=false;
   // Let the next transport tick apply the complete height change WITH the riders.
   // Moving the cabin here without its passengers would introduce an instant fall.
   device.userData.stairRuntime=runtime;device.userData.stairs.lift.motion=incoming;
   device.userData.stairs.lift.target=incoming.target;
   // The transport tick advances position, body, readout and riders atomically.
   updateLiftPanel(device);return true;
  }
 events(){
  const canvas=this.world.renderer.domElement;let startX,startY;
  window.addEventListener('keydown',e=>{if(e.target?.closest?.('input,textarea,select,[contenteditable]'))return;if(!byId('wallPanel')||byId('wallPanel').hidden)return;const cmd=e.ctrlKey||e.metaKey;if(cmd&&e.code==='KeyZ'){e.preventDefault();e.stopImmediatePropagation();e.shiftKey?this.redoWall():this.undoWall();return;}if(cmd&&e.code==='KeyY'){e.preventDefault();e.stopImmediatePropagation();this.redoWall();return;}if(!this.wallDrawing)return;if(e.key==='Escape'){e.preventDefault();this.endWallDrawing();}else if(e.key==='Enter'&&!e.target?.closest?.('input,select,textarea')){e.preventDefault();this.finishWallStroke();}},true);
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])document.addEventListener(type,e=>{if(this.infrastructureDrawing&&infrastructurePointer(this,e)){e.preventDefault();e.stopImmediatePropagation();return;}if(this.vegetationDrawing&&vegetationPointer(this,e)){e.preventDefault();e.stopImmediatePropagation();return;}if(this.spatialPointer(e)){e.preventDefault();e.stopImmediatePropagation();return;}if(this.wallPointer(e)){e.preventDefault();e.stopPropagation();}},true);
  canvas.addEventListener('dblclick',e=>{if(this.infrastructureDrawing){e.preventDefault();e.stopPropagation();finishInfrastructureDrawing(this);}else if(this.vegetationDrawing){e.preventDefault();e.stopPropagation();finishVegetationPlot(this);}else if(this.wallDrawing){e.preventDefault();e.stopPropagation();this.finishWallStroke();}},true);
  document.addEventListener('dblclick',e=>{if(this.infrastructureDrawing&&e.target===byId('spatialDrawShield')){e.preventDefault();e.stopImmediatePropagation();finishInfrastructureDrawing(this);}},true);
  const orbitGesture=new OrbitGesture();
  this.lastPointer={x:innerWidth/2,y:innerHeight/2};window.addEventListener('pointermove',e=>{if(!document.pointerLockElement)this.lastPointer={x:e.clientX,y:e.clientY};},{passive:true});
  // In-world lift buttons must capture a click before orbit or object selection.
  let liftPress=null;
  canvas.addEventListener('pointerdown',e=>{
   if(e.button!==0||this.vegetationDrawing||this.wallDrawing||this.faceDrawing||this.curveDrawing)return;
   this.pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);
   this.raycaster.setFromCamera(this.pointer,this.world.camera);
   const button=this.hitLiftButton(this.raycaster)||this.hitTransportButton(this.raycaster)||this.hitPortalButton(this.raycaster)||this.hitWindowButton(this.raycaster);
   if(!button)return;
   liftPress={id:e.pointerId,x:e.clientX,y:e.clientY};
   this.world.controls.enabled=false;e.preventDefault();e.stopImmediatePropagation();
  },true);
  canvas.addEventListener('pointerup',e=>{
   if(!liftPress||e.pointerId!==liftPress.id)return;
   const initial=liftPress;liftPress=null;
   if(Math.hypot(e.clientX-initial.x,e.clientY-initial.y)<12){
    this.pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);
    this.raycaster.setFromCamera(this.pointer,this.world.camera);
    const button=this.hitLiftButton(this.raycaster)||this.hitTransportButton(this.raycaster)||this.hitPortalButton(this.raycaster)||this.hitWindowButton(this.raycaster);
    if(button)(button.userData.transportButton?this.activateTransportButton(button):button.userData.portalButton?this.activatePortalButton(button):button.userData.wallWindowButton?this.activateWindowButton(button):this.activateLiftButton(button));
   }
   e.solviObjectPicked=true;e.preventDefault();e.stopImmediatePropagation();
  },true);
  canvas.addEventListener('pointercancel',()=>{liftPress=null;},true);
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
  // Smart displays remain interactive in edit, exploration and WebXR. The active
  // screen surface must be the closest real object; do not click through walls.
  this.hitSmartScreen=ray=>{
   const hits=ray.intersectObjects(this.items,true);
   // 2D labels are not surfaces and must never occlude a smart display.
   const first=hits.find(h=>!h.object.isSprite);if(!first)return null;
   const screenHit=hits.find(h=>['equipmentScreen','lampSwitch','equipmentSpeaker'].includes(h.object.name)||Boolean(propInteractionOf(h.object))||h.object.userData.smartScreenBack||h.object.userData.smartScreenAudio||h.object.userData.mediaPlaybackLabel||h.object.userData.editorKind==='media');
   if(!screenHit||screenHit.distance>first.distance+.035)return null;
   let object=screenHit.object;
   while(object.parent&&!this.items.includes(object))object=object.parent;
   return this.items.includes(object)?{object,hit:screenHit}:null;
  };
  this.activateSmartScreen=selection=>{
    const obj=selection.object,hit=selection.hit;
    if(obj.userData.editorKind==='media'&&sceneMediaKind(obj.userData.media?.mime)==='audio'){
      toggleSceneMediaPlayback(obj);this.updateInspector();return true;
    }
    const interaction=propInteractionOf(hit.object);
    if(interaction==='toggle-open'&&STATEFUL_PROPS.includes(obj.userData.furniture?.variant)){
      if(!this.canEdit(obj)){this.toast('Owner only');return true;}
      const before=this.snapshot(obj),next={...obj.userData.furniture,open:nextPropOpen(obj.userData.furniture.variant,obj.userData.furniture.open)};
      disposeEquipmentMedia(obj);rebuildFurniture(obj,next);this.physics.sync(obj);syncEquipmentMedia(obj,this);
      this.inventory?.reconcile?.();this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);this.updateInspector();
      this.toast((next.variant==='fridge'?'Fridge':'Laptop')+(next.open?' opened':' closed'));return true;
    }
    if(hit.object.name==='equipmentSpeaker')return nextSpeakerChannel(obj,this.world);
    if(hit.object.userData.lampSwitch){const before=this.snapshot(obj);const p={...obj.userData.furniture,lampOn:!obj.userData.furniture.lampOn};rebuildFurniture(obj,p);this.physics.sync(obj);this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);this.toast(p.lampOn?'Lamp on':'Lamp off');return true;}
    return smartScreenClick(obj,hit);
   };
  canvas.addEventListener('pointerup',e=>{
   if(this.transform.dragging||this.transform.axis||Math.hypot(e.clientX-startX,e.clientY-startY)>4||this.world.renderer.xr.isPresenting)return;
   if(this.toolAim){
    const aimed=this.toolAim;this.toolAim=null;canvas.style.cursor='';
    this.pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);
    this.raycaster.setFromCamera(this.pointer,this.world.camera);
    const ground=this.raycaster.intersectObject(this.world.floor)[0];
    const robot=this.items.find(x=>x.userData.editorId===aimed.robotId);
    const tool=this.items.find(x=>x.userData.editorId===aimed.toolId);
    if(!ground){this.toast('Click visible ground to dig');}
    else{
     const front=this.raycaster.intersectObjects(this.items,true).find(hit=>{
      let node=hit.object;while(node.parent&&!this.items.includes(node))node=node.parent;
      return node!==robot&&node!==tool;
     });
     if(front&&front.distance<ground.distance-.05)this.toast('Ground is hidden by another object; choose an unobstructed spot');
     else this.performToolUse(robot,tool,ground.point);
    }
    e.solviObjectPicked=true;e.preventDefault();e.stopImmediatePropagation();return;
   }
   this.pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);
   this.raycaster.setFromCamera(this.pointer,this.world.camera);
   const smart=this.hitSmartScreen(this.raycaster);if(smart&&this.activateSmartScreen(smart)){e.solviObjectPicked=true;return;}
   const hits=this.raycaster.intersectObjects(this.items,true);
   if(hits.length){let node=hits[0].object;while(node.parent&&!this.items.includes(node))node=node.parent;
    if(this.items.includes(node)){
      if((hits[0].object.name==='equipmentScreen'||hits[0].object.userData.smartScreenBack||hits[0].object.userData.smartScreenAudio||node.userData.editorKind==='media')&&smartScreenClick(node,hits[0])){e.solviObjectPicked=true;return;}
      this.select(node,{revealInList:true});e.solviObjectPicked=true;}}
   else if(this.selected?.userData.editorKind==='robot'&&this.selected?.userData.robotMode!=='idle'){
    const ground=this.raycaster.intersectObject(this.world.floor)[0];if(ground){setRobotDestination(this.selected,ground.point);this.queueSave(this.selected);}}
  },true);
  window.addEventListener('keydown',e=>{
   if(e.key==='Escape'&&this.toolAim){this.toolAim=null;canvas.style.cursor='';this.toast('Dig target cancelled');e.preventDefault();return;}
   if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable)return;
   if(e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.repeat&&e.code==='KeyI'&&this.controlMode==='robot'&&this.controlledRobot()){
    e.preventDefault();const bot=this.controlledRobot();
    const held=this.inventory.heldFor(bot,'right')||this.inventory.heldFor(bot,'left')||this.inventory.promoteCarriedDrink(bot);
    if(held)this.inventory.stowToBag(bot,held);
    else if(this.inventory.backpackReady(bot)){this.inventory.tab='bag';this.inventory.show(bot);}
    else if(!this.inventory.toggleBackpack(bot)){this.inventory.tab='bag';this.inventory.show(bot);this.toast('Activate the avatar backpack or wear a scene backpack');}
    return;
   }
   if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.repeat&&this.controlMode==='robot'&&this.controlledRobot()&&Object.hasOwn(ROBOT_KEY_ACTIONS,e.code)){
    e.preventDefault();const bot=this.controlledRobot();if(!this.canEdit(bot))return;
    if(e.code==='KeyI'){
     if(bot.userData.robotCarry){if(!this.carry.drop(bot))this.toast('Could not place the held object');}
     else if(this.inventory.heldFor(bot,'right')||this.inventory.heldFor(bot,'left')){
      // I is a pickup/drop toggle for ALL held items, including bag-sized tools.
      // Never attempt to stow a shovel that has no backpack.
      const held=this.inventory.heldFor(bot,'right')||this.inventory.heldFor(bot,'left');
      if(!this.inventory.drop(bot,held))this.toast('Could not drop '+held.name+'; check permissions and connection');
     }
     else{
      const target=pickableTarget(bot,this.items);
      if(target&&cleanInventory(target.userData.inventory).category!=='world')this.inventory.pickupNearest(bot);
      else if(!this.carry.pickup(bot))this.toast('Face a nearby Pickable object, enable room Physics, then press I');
     }
    }else if(e.code==='KeyO'){if(!this.carry.throw(bot))this.toast('Pick up an object with I before pressing O');}
    else if(e.code==='KeyB'){const panel=byId('robotInventoryPanel');if(panel&&!panel.hidden)panel.hidden=true;else this.inventory.show(bot);}
    else if(e.code==='KeyU'){const held=this.inventory.heldFor(bot,'right')||this.inventory.heldFor(bot,'left')||this.inventory.promoteCarriedDrink(bot);if(!held)this.toast('Hold a tool or drink first (I)');else this.inventory.useHeldItem(bot,held);}
    else if(e.code==='KeyJ'){
     if(bot.userData.robotSeated){if(!standUp(bot,this))this.toast('All seat exits blocked; clear the nearby furniture or make more room');}
     else{
      const target=this.items.filter(o=>o!==bot).map(o=>({o,plan:seatPlan(o,bot.position)})).filter(x=>x.plan).sort((a,b)=>a.plan.spot.distanceToSquared(bot.position)-b.plan.spot.distanceToSquared(bot.position))[0]?.o;
      if(!target||!takeSeat(bot,target,this))this.toast('Approach a flat seat surface, then press J');
     }
    }
    return;
   }
   const cmd=e.metaKey||e.ctrlKey;
   if(!isEditMode()&&(cmd||e.shiftKey||['KeyG','KeyR','KeyS','KeyX','KeyO','KeyU'].includes(e.code)||e.key==='Delete'||e.key==='Backspace'))return;
   if(cmd&&e.code==='KeyZ'){e.preventDefault();e.shiftKey?this.redo():this.undo();return;}
   if(cmd&&e.code==='KeyY'){e.preventDefault();this.redo();return;}
   if(e.metaKey||e.ctrlKey||e.altKey)return;
   if(e.shiftKey&&e.code==='KeyA'){e.preventDefault();if(byId('addMenu').hidden){this.showAddMenu(this.lastPointer.x,this.lastPointer.y);byId('addSearch')?.focus();}else byId('addMenu').hidden=true;}
   else if(this.selected&&e.shiftKey&&e.code==='KeyD'){e.preventDefault();this.duplicate();}
   else if(this.selected&&e.code==='KeyX'){e.preventDefault();this.remove();}
   else if(!e.repeat&&this.controlMode==='robot'&&this.controlledRobot()&&combatForKey(e.code,this.controlledRobot().userData.robotCombat)){e.preventDefault();const bot=this.controlledRobot();this.triggerRobotCombat(bot,combatForKey(e.code,bot.userData.robotCombat));}
   else if(this.controlMode==='robot'&&this.controlledRobot()&&['ShiftLeft','ShiftRight'].includes(e.code)){this.robotKeys.add(e.code);}
   else if(this.controlMode==='robot'&&this.controlledRobot()&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)){e.preventDefault();if(e.code==='Space'&&this.ladderSpaceReleased)return;this.robotKeys.add(e.code);this.world.keys.delete(e.code);if(e.code==='Space'&&!e.repeat){const bot=this.controlledRobot();if(releaseLadder(bot)){this.robotKeys.delete('Space');this.world.keys.delete('Space');this.ladderSpaceReleased=true;}else robotAction(bot,'jump');/* Jump is synchronised through the compact robot-input event. */}else if(e.code!=='Space'){this.controlledRobot().userData.robotGoal=null;}}
   else if(this.selected&&e.code==='KeyO'&&this.selected.userData.editorKind==='cube'){e.preventDefault();this.startFaceDrawing('opening');}
   else if(this.selected&&e.code==='KeyU'&&['cube','plane'].includes(this.selected.userData.editorKind)){e.preventDefault();this.startFaceDrawing('media');}
   else if((this.selected||this.collectionTarget)&&['KeyG','KeyR','KeyS'].includes(e.code)){if(this.collectionTarget&&!this.canMoveCollection(this.collectionTarget.members)||this.selected&&!this.canTransform(this.selected)){this.toast('Unlock this object or collection to transform it');return;}this.transform.setMode({KeyG:'translate',KeyR:'rotate',KeyS:'scale'}[e.code]);}
   else if(this.selected&&['Delete','Backspace'].includes(e.key)){e.preventDefault();this.remove();}
  });
  window.addEventListener('keyup',e=>{this.robotKeys.delete(e.code);if(e.code==='Space')this.ladderSpaceReleased=false;});
  window.addEventListener('blur',()=>{this.robotKeys.clear();this.walkHeldSince=null;this.broadcastEdit(false);});
 }
 canTransform(obj){return isEditMode()&&mayTransform(obj,this.canEdit(obj));}
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
  if(entry.kind==='wall')rebuildOfficeWall(duplicate,entry.wall||{});if(entry.kind==='stairs')rebuildOfficeStairs(duplicate,entry.stairs||{});if(entry.kind==='ladder')rebuildLadder(duplicate,entry.ladder||{});if(entry.kind==='furniture')rebuildFurniture(duplicate,entry.furniture||{});
  if(entry.kind==='light')setLight(duplicate,entry.light||{});duplicate.userData.robotSpeed=entry.speed??1.8;duplicate.userData.robotRunMultiplier=entry.runMultiplier??2.8;duplicate.userData.robotStrafeSpeed=entry.strafeSpeed??2.5;duplicate.userData.robotTurnSpeed=entry.turnSpeed??4;duplicate.userData.robotClimbSpeed=entry.climbSpeed??1.25;duplicate.userData.robotBrain=structuredClone(entry.brain||{});duplicate.userData.backpackEnabled=entry.backpackEnabled===true;duplicate.userData.robotCombat=combatSettings(entry.combat);duplicate.userData.robotAnimationSpeed=animationSpeedSettings(entry.animationSpeed);duplicate.userData.robotThrowSettings=cleanThrowSettings(entry.throwSettings);duplicate.userData.pickable=entry.pickable===true&&canBePickable(entry.kind);duplicate.userData.followHandRotation=entry.followHandRotation!==false;duplicate.userData.inventory=cleanInventory(entry.inventory);duplicate.userData.storage=null;duplicate.userData.climbable=entry.climbable===true&&canBeClimbable(entry.kind);duplicate.userData.physics=physicsOptions(entry.physics);duplicate.userData.ownerId=window.solviAPI?.auth()?.profile?.id||null;duplicate.userData.avatarUrl=source.userData.avatarUrl||DEFAULT_ROBOT_AVATAR;this.items.push(duplicate);this.world.scene.add(duplicate);this.physics.sync(duplicate);this.select(duplicate);if(entry.kind==='robot')hydrateRobot(duplicate);this.recordEdit(null,this.snapshot(duplicate));this.queueSave(duplicate);this.toast('Duplicated above original');
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
 // The last ADD is a more useful spatial anchor than an arbitrary prior selection.
 // Room-scoped IDs avoid borrowing a position from another multiplayer realm.
 recentPlacementAnchor(){
  const last=this.lastSmartPlacement;
  if(!last||last.room!==(window.solviRoom||'main'))return null;
  return this.items.find(o=>o.userData.editorId===last.id)||null;
 }
 rememberSmartPlacement(obj){this.lastSmartPlacement={id:obj.userData.editorId,room:window.solviRoom||'main'};}
 placeSmartNewObject(obj){return positionNewSmartly(obj,{camera:this.world.camera,orbitTarget:this.world.controls?.target,items:this.items,anchor:this.recentPlacementAnchor()});}
 // compatibility marker: addSceneMedia(media,{backing='white',width=null,height=null}={})
addSceneMedia(media,{backing='white',width=null,height=null,loop=true,refDistance=4,maxDistance=18,autoplayDistance=0,constantVolume=false,group='',shape='speaker',mount=null}={}){const object=objectFor('media');const x=this.lastPointer?.x??innerWidth/2,y=this.lastPointer?.y??innerHeight/2;this.pointer.set(x/innerWidth*2-1,1-y/innerHeight*2);this.raycaster.setFromCamera(this.pointer,this.world.camera);const point=this.cameraDropPosition(3.2);object.position.copy(point);object.userData.ownerId=window.solviAPI?.auth()?.profile?.id||null;object.userData.media={id:media.id,mime:media.mime,name:media.name,backing,stream:'direct',width:width??media.width??null,height:height??media.height??null,loop,muted:false,refDistance,maxDistance,autoplayDistance,constantVolume,group,shape,volume:1,color:'#3c9bd2',author:media.author||window.solviAPI?.auth()?.profile?.name||'User',created:media.created||new Date().toISOString(),caption:''};if(mount)object.userData.media.mount=structuredClone(mount);const kind=sceneMediaKind(media.mime);object.name=(kind==='video'?'Video screen · ':kind==='audio'?'Audio speaker · ':'Picture frame · ')+(media.name||'media');this.items.push(object);this.world.scene.add(object);this.physics.sync(object);hydrateSceneMedia(object,this.world);if(mount){object.userData.physics={mode:'off'};this.updateMountedMedia();this.physics.sync(object);}this.select(object);this.refreshList();this.recordEdit(null,this.snapshot(object));this.queueSave(object);return object;}
 // Procedural drawing workflows assign the final world coordinates from the user's
 // drawn points (road, motorway, fence, hedge, plot, freehand curve), or by a
 // dedicated layout operation (portal pair). Their unsaved temporary objects
 // MUST NOT enter the camera-limited furniture placement algorithm.
 add(kind,showGallery=true,lightType=undefined,persist=true,furnitureVariant='table'){
 const explicitlyPositionedDraft=!persist&&(kind==='curve'||kind==='portal'||
  kind==='furniture'&&['infrastructure','groundPlot','cropBed','waterPatch','vegetationArea'].includes(furnitureVariant));
 const object=objectFor(kind);if(kind==='furniture'){rebuildFurniture(object,{variant:furnitureVariant});if(['groundPlot','cropBed','waterPatch','vegetationArea'].includes(furnitureVariant)||furnitureVariant==='infrastructure')object.userData.physics={mode:'static'};else if(furnitureVariant==='shrub')object.userData.physics={mode:'off'};if(TOOL_TYPES.includes(furnitureVariant)){object.userData.pickable=true;object.userData.inventory={category:'tool',size:'bag',consumable:false};object.userData.physics={mode:'dynamic'};}if(['can','bottle'].includes(furnitureVariant)){object.userData.pickable=true;object.userData.inventory={category:'food',size:'pocket',consumable:true};object.userData.physics={mode:'dynamic'};}if(furnitureVariant==='backpack'){object.userData.pickable=true;object.userData.inventory={category:'backpack',size:'bag',consumable:false};}object.name=furnitureVariant[0].toUpperCase()+furnitureVariant.slice(1);}if(kind==='light'&&lightType){setLight(object,{type:lightType});object.name='New '+lightType+' light';}
 if(!['robot','model','media','light'].includes(kind)&&!explicitlyPositionedDraft){
  if(!this.placeSmartNewObject(object)){
   this.disposeObject(object);
   this.toast('No visible, collision-free space. Aim at an open patch of this floor, away from walls and stair or lift openings.');
   return null; // Never publish an overlapping or wall-hidden item to multiplayer.
  }
 }else if(!explicitlyPositionedDraft){const near=this.cameraDropPosition(3.2);object.position.x=near.x;object.position.z=near.z;if(kind!=='robot')object.position.y=Math.max(.8,near.y);}
 object.userData.ownerId=window.solviAPI?.auth()?.profile?.id||null;if(PRIMITIVE_FIELDS[kind])object.userData.primitive=sanitisePrimitive(kind);this.items.push(object);this.world.scene.add(object);if(kind==='furniture')syncEquipmentMedia(object,this);this.physics.sync(object);if(!explicitlyPositionedDraft&&!['robot','model','media','light'].includes(kind))this.rememberSmartPlacement(object);this.select(object);byId('addMenu').hidden=true;this.refreshList();if(kind==='robot'){hydrateRobot(object);if(showGallery)this.avatarGallery?.open();}if(kind==='model'&&object.userData.modelUrl)hydrateSceneModel(object);if(kind!=='model'&&persist){this.recordEdit(null,this.snapshot(object));this.queueSave(object);}return object;}
 // Autonomous agents use the same furniture generator, scene ownership,
 // history, collider and persistence path as human Add — without selecting the
 // object or moving the operator's camera/inspector.
 // A robot can scout an outdoor workspace without the user placing it there.
 planRobotBuildSite(robot,kind='furniture',settings={}){
  if(!robot||!this.items.includes(robot)||!this.canEdit(robot)||Math.abs(robot.position.y)>.85)return null;
  let width,depth;
  if(kind==='house'){const spec=houseBlueprint(settings);width=spec.width;depth=spec.depth;}
  else if(['road','footpath'].includes(kind)){width=8;depth=kind==='road'?3.6:1.8;}
  else{
   const candidate=objectFor('furniture');rebuildFurniture(candidate,{variant:settings.variant||'chair'});
   const dims=new THREE.Box3().setFromObject(candidate).getSize(new THREE.Vector3());
   this.disposeObject(candidate);width=dims.x;depth=dims.z;
  }
  if(!Number.isFinite(width)||!Number.isFinite(depth)||width<.1||depth<.1)return null;
  const start={x:robot.position.x,z:robot.position.z};
  const routeObstacles=this.navigationObstacles(robot),obstacles=this.navigationObstacles(robot,{forConstruction:true});
  // Roads and footpaths are walkable, but duplicate same-lane geometry should
  // still be treated as occupied when selecting a NEW infrastructure site.
  if(['road','footpath'].includes(kind))for(const obj of this.items){
   if(obj.userData?.furniture?.variant!=='infrastructure'||obj.userData.furniture.infraType!==kind)continue;
   const x=obj.position.x,z=obj.position.z;
   obstacles.push({minX:x-4.4,maxX:x+4.4,minZ:z-2.4,maxZ:z+2.4});
  }
  const anchor=settings.anchor;
  if(anchor&&Number.isFinite(anchor.x)&&Number.isFinite(anchor.z)&&
      Math.hypot(anchor.x-start.x,anchor.z-start.z)<72){
   const near=findRobotWorksite(anchor,obstacles,{width,depth},{yaw:0,navigationObstacles:routeObstacles});
   if(near){const route=planRobotPath(start,near.staging,routeObstacles);
    if(route?.length&&Math.hypot(route.at(-1).x-near.staging.x,route.at(-1).z-near.staging.z)<.3)
     return {...near,teamAnchor:true};
   }
  }
  return findRobotWorksite(start,obstacles,{width,depth},{yaw:robot.rotation.y,navigationObstacles:routeObstacles});
 }
 // Shares the movement controller, A* route and authoritative arrival event with
 // user-issued walk commands. It never teleports a robot or a construction item.
 routeRobotToWorksite(robot,point,taskId,label='construction site'){
  if(!robot||!this.canEdit(robot)||!this.items.includes(robot)||!point||
    !Number.isFinite(point.x)||!Number.isFinite(point.z))return false;
  const distance=Math.hypot(robot.position.x-point.x,robot.position.z-point.z);
  if(distance>90||Math.abs(robot.position.y)>.85)return false;
  interruptRobotMission(robot);
  robot.userData.robotMission={kind:'walk_forward',taskId,targetName:label,repeat:1,
   returnToStart:false,leg:0,origin:{x:robot.position.x,z:robot.position.z},endpoint:{x:point.x,z:point.z}};
  if(this.routeRobot(robot,point))return true;
  interruptRobotMission(robot);return false;
 }
 // The interior furnishing tool uses an actual house floor as its support.
 // It only works when this robot is already on that floor; no placement through
 // a wall or at a remote scene coordinate is inferred from a chat sentence.
 planRobotRoomFurnishing(robot,variant){
  if(!robot||!this.canEdit(robot)||!this.items.includes(robot)||
     !['fridge','tv','sofa','bed','table','chair','cabinet','lamp','speaker','monitor','stool'].includes(variant))return null;
  const probe=objectFor('furniture');rebuildFurniture(probe,{variant});
  const dims=new THREE.Box3().setFromObject(probe).getSize(new THREE.Vector3());this.disposeObject(probe);
  const obstacles=this.navigationObstacles(robot),floors=this.items.filter(o=>
   o.userData.editorKind==='cube'&&(o.userData.autonomyFloor===true||o.name?.endsWith(' · house floor'))&&this.canEdit(o));
  let best=null;
  for(const floor of floors){
   const b=new THREE.Box3().setFromObject(floor);
   if(b.isEmpty()||Math.abs(robot.position.y-b.max.y)>1.25)continue;
   // Require actual presence in the room, rather than a remote placement
   // across another building's wall or on a different storey.
   if(robot.position.x<b.min.x-.35||robot.position.x>b.max.x+.35||
      robot.position.z<b.min.z-.35||robot.position.z>b.max.z+.35)continue;
   const mx=dims.x/2+.30,mz=dims.z/2+.30;
   const startX=b.min.x+mx,endX=b.max.x-mx,startZ=b.min.z+mz,endZ=b.max.z-mz;
   if(startX>endX||startZ>endZ)continue;
   for(let x=startX;x<=endX+.001;x+=.35)for(let z=startZ;z<=endZ+.001;z+=.35){
    if(Math.hypot(x-robot.position.x,z-robot.position.z)<.85)continue;
    const blocked=obstacles.some(o=>o.minX<x+dims.x/2+.10&&o.maxX>x-dims.x/2-.10&&
     o.minZ<z+dims.z/2+.10&&o.maxZ>z-dims.z/2-.10);
    if(blocked)continue;
    const score=Math.hypot(x-robot.position.x,z-robot.position.z);
    if(!best||score<best.score)best={at:{x,y:b.max.y,z},floorId:floor.userData.editorId,score};
   }
  }
  if(best)return best;
  // Do not bypass a dedicated floor cube merely because all its safe
  // furniture positions are occupied. The wall-ground fallback applies only
  // when there is no dedicated floor under this robot at all.
  if(floors.some(floor=>{const b=new THREE.Box3().setFromObject(floor);
   return !b.isEmpty()&&Math.abs(robot.position.y-b.max.y)<1.25&&
    robot.position.x>=b.min.x-.35&&robot.position.x<=b.max.x+.35&&
    robot.position.z>=b.min.z-.35&&robot.position.z<=b.max.z+.35;}))return null;
  // The human wall editor also produces enclosed wooden houses that stand on
  // the actual realm ground, without a dedicated 'house floor' cube. Only a
  // complete, editable, non-array wall polygon on the same ground level is
  // eligible. Test the WHOLE footprint, not just its centre.
  const rooms=this.items.filter(o=>o.userData.editorKind==='wall'&&o.userData.wall?.closed===true&&
   o.userData.wall?.array?.enabled!==true&&o.userData.wall?.points?.length>=3&&this.canEdit(o));
  for(const wall of rooms){
   wall.updateMatrixWorld(true);
   const ground=wall.localToWorld(new THREE.Vector3(0,0,0));
   if(Math.abs(ground.y)>.30||Math.abs(robot.position.y-ground.y)>.42)continue;
   const localRobot=wall.worldToLocal(robot.position.clone());
   if(!enclosedRoomFootprint(wall.userData.wall.points,Array(4).fill([localRobot.x,localRobot.z]),.2))continue;
   for(const radius of [1.35,1.9,2.5,3.15,3.9,4.8])for(let k=0;k<16;k++){
    const angle=(k*2*Math.PI/16)+robot.rotation.y;
    const center=wall.localToWorld(new THREE.Vector3(localRobot.x+Math.cos(angle)*radius,0,localRobot.z+Math.sin(angle)*radius));
    if(Math.hypot(center.x-robot.position.x,center.z-robot.position.z)>6)continue;
    const corners=[[center.x-dims.x/2,center.z-dims.z/2],[center.x+dims.x/2,center.z-dims.z/2],
     [center.x+dims.x/2,center.z+dims.z/2],[center.x-dims.x/2,center.z+dims.z/2]];
    const localFootprint=corners.map(([x,z])=>{const p=wall.worldToLocal(new THREE.Vector3(x,ground.y,z));return [p.x,p.z];});
    if(!enclosedRoomFootprint(wall.userData.wall.points,localFootprint,.22))continue;
    const blocked=obstacles.some(o=>o.minX<center.x+dims.x/2+.10&&o.maxX>center.x-dims.x/2-.10&&
     o.minZ<center.z+dims.z/2+.10&&o.maxZ>center.z-dims.z/2-.10);
    if(blocked)continue;
    return {at:{x:center.x,y:ground.y,z:center.z},wallId:wall.userData.editorId,score:radius};
   }
  }
  return null;
 }
 // Walk into the nearest reachable, editable, closed ground-level house.
 // A visual label or a camera image never establishes an open entrance.
 planRobotRoomEntry(robot){
  if(!robot||!this.canEdit(robot)||!this.items.includes(robot)||Math.abs(robot.position.y)>.85)return null;
  const start={x:robot.position.x,z:robot.position.z};
  const obstacles=this.navigationObstacles(robot).filter(o=>o.kind!=='robot');
  const walls=this.items.filter(o=>o.userData.editorKind==='wall'&&o.userData.wall?.closed===true&&
    o.userData.wall?.array?.enabled!==true&&Array.isArray(o.userData.wall?.points)&&
    o.userData.wall.points.length>=3&&this.canEdit(o)&&o.visible);
  const sorted=walls.sort((a,b)=>a.position.distanceToSquared(robot.position)-b.position.distanceToSquared(robot.position)).slice(0,12);
  let best=null;
  for(const wall of sorted){
   wall.updateMatrixWorld(true);
   const ground=wall.localToWorld(new THREE.Vector3());
   if(Math.abs(ground.y-robot.position.y)>.55)continue;
   const pts=wall.userData.wall.points;
   const xs=pts.map(p=>p[0]),zs=pts.map(p=>p[1]);
   const centre={x:(Math.min(...xs)+Math.max(...xs))/2,z:(Math.min(...zs)+Math.max(...zs))/2};
   const offsets=[[0,0],[-.7,0],[.7,0],[0,-.7],[0,.7],[-1,1],[1,-1]];
   for(const [dx,dz] of offsets){
    const lx=centre.x+dx,lz=centre.z+dz;
    if(!enclosedRoomFootprint(pts,Array.from({length:4},()=>[lx,lz]),.32))continue;
    const point=wall.localToWorld(new THREE.Vector3(lx,0,lz));
    const target={x:point.x,z:point.z};
    const distance=Math.hypot(target.x-start.x,target.z-start.z);
    if(distance<1.2||distance>90||pathBlocked(target.x,target.z,obstacles,.40))continue;
    const route=planRobotTravelRoute(start,target,obstacles);
    if(!route?.length||Math.hypot(route.at(-1).x-target.x,route.at(-1).z-target.z)>.12)continue;
    const meters=plannedRouteLength(start,route);
    if(!best||meters<best.meters)best={site:target,staging:target,meters,
      roomId:wall.userData.editorId,roomName:wall.name||'procedural house'};
    break;
   }
  }
  return best;
 }
 createRobotRoomFurniture(robot,variant,options={}){
  const site=this.planRobotRoomFurnishing(robot,variant);
  const color=typeof options.color==='string'&&/^#[0-9a-f]{6}$/i.test(options.color)?options.color:'';
  return site?this.createRobotFurniture(robot,variant,{at:site.at,roomFloorId:site.floorId,roomWallId:site.wallId,...(color?{fabricColor:color}:{})}):null;
 }
 createRobotFurniture(robot,variant='chair',options={}){
  if(!robot||robot.userData.editorKind!=='robot'||!this.canEdit(robot)||
     !['chair','officeChair','stool','bed','armchair','sofa','table','cabinet','bottle','can','bin','tv','fridge','lamp','speaker','monitor'].includes(variant))return null;
  const obj=objectFor('furniture');
  const fabricColor=typeof options.fabricColor==='string'&&/^#[0-9a-f]{6}$/i.test(options.fabricColor)?options.fabricColor:undefined;
  rebuildFurniture(obj,{variant,...(fabricColor?{fabricColor}:{})});obj.userData.physics={mode:'static'};
  const bb=new THREE.Box3().setFromObject(obj),size=bb.getSize(new THREE.Vector3());
  const margin=Math.max(1.05,size.x*.6,size.z*.6);
  // Respect all nearby footprints; never build furniture across a doorway or
  // inside another scene object. The robot's own capsule is excluded here.
  const obstacles=this.navigationObstacles(robot,{forConstruction:true});
  let roomFloor=null,roomBounds=null,roomGroundY=null;
  if(options.roomWallId){
   const wall=this.items.find(o=>o.userData.editorId===options.roomWallId&&o.userData.editorKind==='wall'&&
    o.userData.wall?.closed===true&&o.userData.wall?.array?.enabled!==true&&this.canEdit(o));
   if(!wall||wall.userData.wall.points?.length<3){this.disposeObject(obj);return null;}
   wall.updateMatrixWorld(true);
   const ground=wall.localToWorld(new THREE.Vector3(0,0,0));
   const localBot=wall.worldToLocal(robot.position.clone());
   if(Math.abs(ground.y)>.30||Math.abs(robot.position.y-ground.y)>.42||
      !enclosedRoomFootprint(wall.userData.wall.points,Array(4).fill([localBot.x,localBot.z]),.2)){this.disposeObject(obj);return null;}
   const x=options.at?.x,z=options.at?.z,y=options.at?.y;
   if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(y)||Math.abs(y-ground.y)>.05){this.disposeObject(obj);return null;}
   const corners=[[x-size.x/2,z-size.z/2],[x+size.x/2,z-size.z/2],[x+size.x/2,z+size.z/2],[x-size.x/2,z+size.z/2]];
   const localCorners=corners.map(([cx,cz])=>{const pt=wall.worldToLocal(new THREE.Vector3(cx,ground.y,cz));return [pt.x,pt.z];});
   if(!enclosedRoomFootprint(wall.userData.wall.points,localCorners,.22)||Math.hypot(x-robot.position.x,z-robot.position.z)>6){this.disposeObject(obj);return null;}
   roomGroundY=ground.y;
  }
  if(options.roomFloorId){
   roomFloor=this.items.find(o=>o.userData.editorId===options.roomFloorId&&
     o.userData.editorKind==='cube'&&(o.userData.autonomyFloor===true||o.name?.endsWith(' · house floor'))&&this.canEdit(o));
   if(!roomFloor){this.disposeObject(obj);return null;}
   roomBounds=new THREE.Box3().setFromObject(roomFloor);
   const x=options.at?.x,z=options.at?.z,y=options.at?.y;
   if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(y)||
     Math.abs(y-roomBounds.max.y)>.07||Math.abs(robot.position.y-y)>1.25||
     robot.position.x<roomBounds.min.x-.35||robot.position.x>roomBounds.max.x+.35||
     robot.position.z<roomBounds.min.z-.35||robot.position.z>roomBounds.max.z+.35||
     x-size.x/2<roomBounds.min.x+.28||x+size.x/2>roomBounds.max.x-.28||
     z-size.z/2<roomBounds.min.z+.28||z+size.z/2>roomBounds.max.z-.28){this.disposeObject(obj);return null;}
  }
  let position=null;
  if(!options.at)for(const radius of [3.2,4.5,5.8])for(const angle of [0,Math.PI/2,-Math.PI/2,Math.PI,Math.PI/4,-Math.PI/4]){
   const heading=robot.rotation.y+angle;
   const x=robot.position.x+Math.sin(heading)*radius,z=robot.position.z+Math.cos(heading)*radius;
   if(!pathBlocked(x,z,obstacles,margin)&&Math.hypot(x-robot.position.x,z-robot.position.z)>margin+1){position={x,z};break;}
  }
  if(options.at && Number.isFinite(options.at.x)&&Number.isFinite(options.at.z)){
   const {x,z}=options.at;const bounding={minX:x-size.x/2,maxX:x+size.x/2,minZ:z-size.z/2,maxZ:z+size.z/2};
   const blocked=obstacles.some(b=>b.minX<bounding.maxX+.08&&b.maxX>bounding.minX-.08&&b.minZ<bounding.maxZ+.08&&b.maxZ>bounding.minZ-.08);
   if(blocked){this.disposeObject(obj);return null;}
   position={x,z};
  }
  if(!position){this.disposeObject(obj);return null;}
  positionNewOnGround(obj,{x:position.x,y:roomBounds?roomBounds.max.y:(roomGroundY??0),z:position.z});
  obj.name=robot.name+' · '+variant;
  obj.userData.ownerId=window.solviAPI?.auth()?.profile?.id||null;
  obj.userData.autonomyCreatedBy=robot.userData.editorId;
  obj.userData.autonomyCreatedRoom=window.solviRoom||'main';
  this.items.push(obj);this.world.scene.add(obj);this.physics.sync(obj);
  this.recordEdit(null,this.snapshot(obj));this.queueSave(obj);this.refreshList();
  return obj;
 }
 // House construction uses the same procedural Office Wall tool as a human,
 // plus a separately editable floor cube. A failed site check creates nothing.
 createRobotHouse(robot,input={}){
  if(!robot||robot.userData.editorKind!=='robot'||!this.canEdit(robot))return null;
  const spec=houseBlueprint(input),obstacles=this.navigationObstacles(robot,{forConstruction:true});
  const clearance=Math.hypot(spec.width,spec.depth)/2+.6;
  let site=null;
  if(input.at){
   if(!footprintClear(input.at,{width:spec.width,depth:spec.depth},obstacles,.65))return null;
   site={x:input.at.x,z:input.at.z};
  }
  if(!input.at)for(const radius of [10,14,18,24,30]){
   for(let i=0;i<12;i++){
    const heading=robot.rotation.y+i*Math.PI/6;
    const x=robot.position.x+Math.sin(heading)*radius,z=robot.position.z+Math.cos(heading)*radius;
    // The entire rectangular footprint, plus a 60cm working margin, must be free.
    if(footprintClear({x,z},{width:spec.width,depth:spec.depth},obstacles,.65)){site={x,z};break;}
   }
   if(site)break;
  }
  if(!site)return null;
  const wall=objectFor('wall');
  rebuildOfficeWall(wall,houseWallSettings(spec));
  wall.position.set(site.x-spec.width/2,0,site.z-spec.depth/2);
  wall.name=robot.name+' · small house';
  const floor=objectFor('cube');
  const dims=sanitisePrimitive('cube',{width:spec.width-.28,height:.12,depth:spec.depth-.28});
  floor.geometry.dispose();floor.geometry=buildPrimitive('cube',dims);
  floor.userData.primitive=dims;floor.userData.autonomyFloor=true;floor.name=robot.name+' · house floor';
  floor.position.set(site.x,.06,site.z);
  if(floor.material?.color)floor.material.color.set('#a48a69');
  const owner=window.solviAPI?.auth()?.profile?.id||null;
  for(const obj of [wall,floor]){
   obj.userData.ownerId=owner;obj.userData.physics={mode:'static'};
   obj.userData.autonomyCreatedBy=robot.userData.editorId;
   obj.userData.autonomyCreatedRoom=window.solviRoom||'main';
   this.items.push(obj);this.world.scene.add(obj);this.physics.sync(obj);
   this.recordEdit(null,this.snapshot(obj));this.queueSave(obj);
  }
  this.refreshList();
  return {wall,floor,center:site,spec};
 }
 // City-team roads are actual procedural infrastructure, not decorative props
 // or chat claims. Each short route is independently validated and persisted.
 createRobotInfrastructure(robot,type='road',options={}){
  if(!robot||robot.userData.editorKind!=='robot'||!this.items.includes(robot)||
    !this.canEdit(robot)||!['road','footpath'].includes(type))return null;
  const at=options.at,length=8,width=type==='road'?3.6:1.8;
  if(!at||![at.x,at.z].every(Number.isFinite)||Math.abs(at.x)>480||Math.abs(at.z)>480||
    Math.hypot(robot.position.x-at.x,robot.position.z-at.z)>22)return null;
  const obstacles=this.navigationObstacles(robot);
  if(!footprintClear(at,{width:length,depth:width},obstacles,.65))return null;
  const obj=objectFor('furniture');
  rebuildFurniture(obj,{variant:'infrastructure',infraType:type,infraWidth:width,
   infraPoints:[[-length/2,0],[length/2,0]],infraMarkings:type==='road',
   infraSurface:type==='road'?'asphalt':'pavers',infraSidewalks:false,infraCurbs:false});
  obj.position.set(at.x,0,at.z);obj.name=robot.name+' · '+(type==='road'?'city road':'pedestrian path');
  obj.userData.physics={mode:'static'};
  obj.userData.ownerId=window.solviAPI?.auth()?.profile?.id||null;
  obj.userData.autonomyCreatedBy=robot.userData.editorId;
  obj.userData.autonomyCreatedRoom=window.solviRoom||'main';
  this.items.push(obj);this.world.scene.add(obj);this.physics.sync(obj);
  this.recordEdit(null,this.snapshot(obj));this.queueSave(obj);this.refreshList();
  return obj;
 }
 // A real reusable 3D primitive creation tool for authorised creative robots.
 // It uses the human editor's scene object, physics, undo and persistence
 // pipeline. Every part is checked against *other* scene geometry before Add.
 createRobotCreativePart(robot,part,{site,tag,index=0,ignoreProjectTag="",collectionName=""}={}){
  const numeric=[site?.x,site?.z,part?.offset?.x,part?.offset?.y,part?.offset?.z,
   part?.size?.width,part?.size?.height,part?.size?.depth];
  if(!robot||robot.userData?.editorKind!=='robot'||!this.items.includes(robot)||!this.canEdit(robot)||
     !numeric.every(Number.isFinite)||!/^#[a-f0-9]{6}$/i.test(part?.color||'')||
     !/^[\w:.-]{1,90}$/.test(tag||'')||!Number.isInteger(index)||index<0||index>15)return null;
  const {width,height,depth}=part.size;
  const kind=['cube','sphere','cylinder'].includes(part.kind)?part.kind:'cube';
  if(Math.min(width,height,depth)<.1||Math.max(width,height,depth)>7||
     part.offset.y<0||part.offset.y+height>12||
     Math.abs(part.offset.x)+width/2>4.6||Math.abs(part.offset.z)+depth/2>4.6)return null;
  const x=site.x+part.offset.x,z=site.z+part.offset.z,y=part.offset.y+height/2;
  if(Math.abs(x)>480||Math.abs(z)>480||Math.hypot(robot.position.x-x,robot.position.z-z)>13||
     Math.abs(robot.position.y)>.85)return null;
  const box=new THREE.Box3(new THREE.Vector3(x-width/2,y-height/2,z-depth/2),
                           new THREE.Vector3(x+width/2,y+height/2,z+depth/2));
  const prefix='SOLVI Creative · '+tag+' · ';
  const ignoredPrefix=ignoreProjectTag&&/^[\w:.-]{1,90}$/.test(ignoreProjectTag)?'SOLVI Creative · '+ignoreProjectTag+' · ':null;
  this.world.scene.updateMatrixWorld(true);
  for(const other of this.items){
   if(other===robot||!other.visible||other.userData?.storage||other.userData?.carriedBy||
      other.userData?.editorKind==='light'||other.userData?.editorKind==='plane'||
      other.userData?.editorKind==='points'||other.userData?.editorKind==='curve')continue;
   // Other workers and nearby visitors are real occupied space. Only
   // decorative avatar rigs are ignored, never their body footprint.
   if(other.userData?.editorKind==='robot'){
    const px=other.position.x,py=other.position.y,pz=other.position.z;
    const avatar=new THREE.Box3(new THREE.Vector3(px-.48,py,pz-.48),
                                new THREE.Vector3(px+.48,py+2,pz+.48));
    if(box.intersectsBox(avatar))return null;
    continue;
   }
   if(other.name?.startsWith(prefix))continue; // this same planned structure
   if(ignoredPrefix&&other.name?.startsWith(ignoredPrefix)&&this.canEdit(other)&&!isTransformLocked(other)&&other.userData.ownerId===window.solviAPI?.auth()?.profile?.id)continue; // human authorised remodel of owned structure
   if(other.userData?.editorKind==='cube'&&other.name?.endsWith(' · house floor'))continue;
   if(other.userData?.editorKind==='furniture'&&
      ['road','footpath','curb'].includes(other.userData.furniture?.infraType))continue;
   const occupied=new THREE.Box3().setFromObject(other);
   if(!occupied.isEmpty()&&box.intersectsBox(occupied))return null;
  }
  const obj=objectFor(kind);
  obj.name=prefix+index+' · '+String(part.label||'part').slice(0,40);
  obj.userData.sceneCollection=cleanSceneCollection({id:tag,name:collectionName||creativeCollectionTitle(robot.name,'Creative build',tag)});
  const geometry=kind==='cube'?{width,height,depth}:kind==='sphere'?{radius:.5}:{radiusTop:.5,radiusBottom:.5,height:1};
  obj.userData.primitive=sanitisePrimitive(kind,geometry);
  obj.geometry.dispose();obj.geometry=buildPrimitive(kind,obj.userData.primitive);
  if(kind!=='cube')obj.scale.set(width,height,depth); // sphere/cylinder base radius .5 and height 1: real ellipsoids and varied diameters

  obj.material.color.set(part.color);obj.position.set(x,y,z);
  obj.userData.physics={mode:'static'};
  obj.userData.ownerId=window.solviAPI?.auth()?.profile?.id||null;
  if(!obj.userData.ownerId){this.disposeObject(obj);return null;}
  obj.userData.autonomyCreatedBy=robot.userData.editorId;
  obj.userData.autonomyCreatedRoom=window.solviRoom||'main';
  this.items.push(obj);this.world.scene.add(obj);this.physics.sync(obj);
  this.recordEdit(null,this.snapshot(obj));this.queueSave(obj);this.refreshList();
  return obj;
 }
 // Edit only a previously verified creative part from the same robot's
 // persisted work-order IDs. Never apply a room-wide colour operation.
 recolorRobotCreativePart(robot,obj,verifiedIds,color){
  if(!robot||robot.userData?.editorKind!=='robot'||!this.items.includes(robot)||!this.canEdit(robot)||
     !obj||!this.items.includes(obj)||!this.canEdit(obj)||isTransformLocked(obj)||
     !['cube','sphere','cylinder'].includes(obj.userData.editorKind)||
     !obj.name?.startsWith('SOLVI Creative · ')||
     !Array.isArray(verifiedIds)||!verifiedIds.includes(obj.userData.editorId)||
     obj.userData.ownerId!==window.solviAPI?.auth()?.profile?.id||
     !/^#[a-f0-9]{6}$/i.test(color||''))return false;
  const before=this.snapshot(obj);
  obj.material.color.set(color);
  this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);
  return true;
 }
 // Saved presets are account-scoped. The caller must obtain them through the
 // authenticated /api/object-presets endpoint and revalidate the current user.
 createRobotPreset(robot,saved){
  if(!robot||robot.userData.editorKind!=='robot'||!this.canEdit(robot)||
     !saved||!['wall','furniture'].includes(saved.kind))return null;
  const data=presetEntry(saved.payload);if(!data||data.kind!==saved.kind)return null;
  const candidate=objectFor(data.kind);
  if(data.kind==='wall')rebuildOfficeWall(candidate,data.wall||{});
  else rebuildFurniture(candidate,data.furniture||{});
  candidate.scale.fromArray(Array.isArray(data.scale)?data.scale:[1,1,1]);
  const dims=new THREE.Box3().setFromObject(candidate).getSize(new THREE.Vector3());
  this.disposeObject(candidate);
  if(!Number.isFinite(dims.x)||dims.x>.0+10||dims.z>10||dims.y>7)return null;
  const clearance=Math.hypot(dims.x,dims.z)/2+.6;
  const obstacles=this.navigationObstacles(robot);
  let position=null;
  for(const radius of [7,11,16,22,28])for(let i=0;i<8;i++){
   const angle=robot.rotation.y+i*Math.PI/4;
   const x=robot.position.x+Math.sin(angle)*radius,z=robot.position.z+Math.cos(angle)*radius;
   if(!pathBlocked(x,z,obstacles,clearance)){position={x,z};break;}
  }
  if(!position)return null;
  const entry={...data,id:crypto.randomUUID(),name:robot.name+' · '+String(saved.name||'preset').slice(0,75),
   owner:window.solviAPI?.auth()?.profile?.id||null,physics:{mode:'static'},position:[0,0,0],
   rotation:Array.isArray(data.rotation)?data.rotation:[0,0,0],scale:Array.isArray(data.scale)?data.scale:[1,1,1]};
  this.addSceneEntry(entry);
  const object=this.items.find(o=>o.userData.editorId===entry.id);
  if(!object)return null;
  positionNewOnGround(object,{x:position.x,y:0,z:position.z});
  object.userData.autonomyCreatedBy=robot.userData.editorId;
  object.userData.autonomyCreatedRoom=window.solviRoom||'main';
  this.physics.applyEditedPose(object);
  this.recordEdit(null,this.snapshot(object));this.queueSave(object);this.refreshList();
  return object;
 }
 // Same removal path as the human inspector, but only for session-created items.
 removeRobotCreatedObject(robot,obj){
  if(!robot||!obj||!this.items.includes(obj)||['robot','light'].includes(obj.userData.editorKind)||
   obj.userData.autonomyCreatedBy!==robot.userData.editorId||
   obj.userData.autonomyCreatedRoom!==(window.solviRoom||'main')||
   !this.canEdit(robot)||!this.canEdit(obj)||isTransformLocked(obj))return false;
  const previous=this.snapshot(obj);
  for(const bot of this.items)if(bot.userData.robotSeatedTarget===obj.userData.editorId)standUp(bot,this);
  if(this.selected===obj){this.transform.detach();this.selected=null;this.updateInspector();}
  this.items=this.items.filter(o=>o!==obj);this.world.scene.remove(obj);
  this.physics.remove(obj.userData.editorId);this.disposeObject(obj);
  this.recordEdit(previous,null);this.persistRemoval(obj.userData.editorId);this.refreshList();
  return true;
 }
 // Removal is intentionally narrower than human Delete. Only a robot-owned
 // object created in THIS browser session and room can be removed automatically.
 removeRobotFurniture(robot,obj){
  if(!robot||!obj||!this.items.includes(obj)||obj.userData.editorKind!=='furniture'||
     obj.userData.autonomyCreatedBy!==robot.userData.editorId||
     obj.userData.autonomyCreatedRoom!==(window.solviRoom||'main')||
     !this.canEdit(robot)||!this.canEdit(obj)||isTransformLocked(obj))return false;
  const previous=this.snapshot(obj);
  for(const bot of this.items)if(bot.userData.robotSeatedTarget===obj.userData.editorId)standUp(bot,this);
  if(this.selected===obj){this.transform.detach();this.selected=null;this.updateInspector();}
  this.items=this.items.filter(o=>o!==obj);this.world.scene.remove(obj);
  this.physics.remove(obj.userData.editorId);this.disposeObject(obj);
  this.recordEdit(previous,null);this.persistRemoval(obj.userData.editorId);this.refreshList();
  return true;
 }
 addPortalPairFromPreset(data){
  // Stage both objects locally. Do not persist either half of a pair until
  // both are valid; failure rolls back both provisional scene/physics nodes.
  const owner=window.solviAPI?.auth()?.profile?.id||null;
  const entries=portalPairEntries(data,[0,0,0],owner,()=>crypto.randomUUID());
  if(!entries)return null;
  const provisional=[];
  const rollback=()=>{for(const item of provisional){this.items=this.items.filter(o=>o!==item);this.world.scene.remove(item);this.physics.remove(item.userData.editorId);this.disposeObject(item);}};
  try{
   this.addSceneEntry(entries[0]);
   const entry=this.items.find(o=>o.userData.editorId===entries[0].id);
   if(!entry)return null;
   provisional.push(entry);
   if(!this.placeSmartNewObject(entry)){rollback();this.toast('No collision-free space for Portal Entry in this view.');return null;}
   const offset=data.exit.position;
   const exitPosition=offset.map((v,i)=>v+entry.position.toArray()[i]);
   if(exitPosition.some(n=>!Number.isFinite(n)||Math.abs(n)>490)){
    rollback();this.toast('The saved portal separation would place Exit outside this realm.');return null;
   }
   entries[1].position=exitPosition;
   this.addSceneEntry(entries[1]);
   const exit=this.items.find(o=>o.userData.editorId===entries[1].id);
   if(!exit){rollback();return null;}
   provisional.push(exit);
   const exitBox=new THREE.Box3().setFromObject(exit),entryBox=new THREE.Box3().setFromObject(entry);
   // Exits cannot overlap existing solid architecture or the entry frame.
   const obstacles=smartPlacementObstacles(this.items.filter(o=>o!==entry&&o!==exit));
   const occupied=obstacles.some(box=>exitBox.intersectsBox(new THREE.Box3(new THREE.Vector3(box.min.x,box.min.y,box.min.z),new THREE.Vector3(box.max.x,box.max.y,box.max.z))));
   if(occupied||exitBox.intersectsBox(entryBox)){
    rollback();this.toast('Portal Exit would overlap another object. Reposition the camera or edit the saved pair separation.');return null;
   }
   for(const item of provisional){this.physics.applyEditedPose(item);this.recordEdit(null,this.snapshot(item));this.queueSave(item);}
   this.rememberSmartPlacement(entry);this.select(entry);this.refreshList();
   return entry;
  }catch(error){rollback();console.warn('Could not add linked portal preset',error);this.toast('Could not add linked portal pair.');return null;}
 }
 addFromPreset(saved){
  const data=presetEntry(saved);
  if(!data)return null;
  if(data.kind==='portalPair')return this.addPortalPairFromPreset(data);
  const entry={...data,id:crypto.randomUUID(),name:data.name||'Preset object',owner:window.solviAPI?.auth()?.profile?.id||null,position:[0,0,0],rotation:Array.isArray(data.rotation)&&data.rotation.length===3?data.rotation:[0,0,0],scale:Array.isArray(data.scale)&&data.scale.length===3?data.scale:[1,1,1]};
  this.addSceneEntry(entry);
  const obj=this.items.find(o=>o.userData.editorId===entry.id);
  if(!obj)return null;
  if(!this.placeSmartNewObject(obj)){
   // addSceneEntry already registered a provisional local rigid body: unwind
   // both objects before returning, without sending a scene write or deletion.
   this.items=this.items.filter(item=>item!==obj);
   this.world.scene.remove(obj);this.physics.remove(obj.userData.editorId);
   this.disposeObject(obj);
   this.toast('No visible, collision-free space for this preset. Aim at an open patch on this floor, away from walls and openings.');
   return null;
  }
  this.physics.applyEditedPose(obj);
  this.rememberSmartPlacement(obj);this.select(obj);this.refreshList();this.recordEdit(null,this.snapshot(obj));this.queueSave(obj);
  return obj;
 }
 select(obj,{revealInList=false}={}){this.clearCollectionTarget();if(this.infrastructureDrawing&&this.infrastructureDrawing.editTarget!==obj)cancelInfrastructureDrawing(this);if(this.wallEditTarget&&this.wallEditTarget!==obj)this.endWallDrawing();if(this.selected&&this.selected!==obj)this.broadcastEdit(false);this.clearLightHelper();this.robotKeys?.clear();this.localRobotInput=null;  this.selected=obj;
  if(obj?.userData.editorKind==='robot'&&this.canEdit(obj)){this.controlledRobotId=obj.userData.editorId;this.controlMode='robot';}
  if(obj?.userData.editorKind==='robot')for(const key of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'])this.world.keys.delete(key);
  // Robots are controlled with arrows, not a permanent transform gizmo.
  if(isEditMode()&&this.canTransform(obj)&&obj.userData.editorKind!=='robot')this.transform.attach(obj);
  else{this.transform.detach();if(!this.canEdit(obj))this.toast('Read-only object · owned by another user');}
  if(revealInList&&obj)this.revealSceneObject(obj);
  this.updateInspector();this.refreshList();this.updateRobotDebugStatus();
  if(revealInList&&obj)requestAnimationFrame(()=>{
   const row=findSceneObjectRow(byId('sceneItems'),obj.userData.editorId);
   row?.scrollIntoView?.({block:'center',behavior:'smooth'});
  });
  if(isEditMode()&&['wall','stairs'].includes(obj?.userData.editorKind)&&!this.wallDrawing&&!this.skipNextWallPanel)this.openWallPanel(obj);else if(this.wallEditTarget)this.endWallDrawing();
  window.dispatchEvent(new CustomEvent('solvi:properties-robot-selected',{detail:{robotId:obj?.userData.editorKind==='robot'?obj.userData.editorId:null}}));
  // Selection must never move the camera; numpad presets and zoom remain explicit.
  if(obj&&isEditMode())this.broadcastEdit(true);}
 renderToolGripControls(obj){
  const details=byId('toolGripDetails');if(!details)return;
  const visible=Boolean(obj?.userData?.pickable&&isToolObject(obj));details.hidden=!visible;
  if(!visible)return;
  const hand=this.toolGripEditingHand==='left'?'left':'right';
  byId('toolGripHand').value=hand;
  const holderId=obj.userData.storage?.type==='held'?obj.userData.storage.holderId:null;
  const robot=this.items.find(r=>r.userData.editorKind==='robot'&&r.userData.editorId===holderId)||this.controlledRobot?.()||this.robot?.();
  const select=byId('toolGripBone');
  // Keep the alias choices stable and show the actual imported rig's hand bones.
  for(const element of [...select.querySelectorAll('option[data-rig-bone]')])element.remove();
  const bones=toolRigBones(robot,hand).filter(name=>/^[A-Za-z0-9_.: -]{1,64}$/.test(name));
  for(const name of bones){const option=document.createElement('option');option.value='rig:'+name;option.textContent='Rig · '+name;option.dataset.rigBone='1';select.append(option);}
  const grip=toolGripProfile(obj,hand);
  if(![...select.options].some(o=>o.value===grip.bone)){const opt=document.createElement('option');opt.value=grip.bone;opt.textContent='Saved bone · '+grip.bone;opt.dataset.rigBone='1';select.append(opt);}
  for(const element of details.querySelectorAll('[data-grip-field]')){
   element.disabled=!this.canEdit(obj);const field=element.dataset.gripField;
   if(field==='bone')element.value=grip.bone;
   else if(field==='followRotation')element.checked=grip.followRotation;
   else element.value=grip[field][Number(element.dataset.axis)];
  }
  const animSelect=byId('toolActionClip');
  if(animSelect){
   for(const item of [...animSelect.querySelectorAll('option[data-animation]')])item.remove();
   const current=cleanToolAnimationName(obj.userData.inventory?.actionClip||'');
   for(const name of (robot?.userData?.robotAvailableActions||[]).filter(n=>typeof n==='string'&&/^[\w .:-]{1,100}$/.test(n)).slice(0,140)){
    const option=document.createElement('option');option.value=name;option.textContent='GLB · '+name;option.dataset.animation='1';animSelect.append(option);
   }
   if(current&&![...animSelect.options].some(o=>o.value===current)){
    const opt=document.createElement('option');opt.value=current;opt.textContent='Saved unavailable clip · '+current;opt.dataset.animation='1';animSelect.append(opt);
   }
   animSelect.value=current;animSelect.disabled=!this.canEdit(obj);
  }
  byId('toolGripReset').disabled=!this.canEdit(obj);
 }
 updateInspector(){const obj=this.selected,slider=byId('inspectorValueSlider');
  const restoreSlider=!slider.hidden&&obj?.userData?.editorId===this.inspectorSliderSession?.id;
  if(!isEditMode()){byId('objectInspector').hidden=true;byId('propertiesPanel').hidden=true;slider.hidden=true;return;}
  byId('objectInspector').hidden=!obj;
  if(!restoreSlider)slider.hidden=true;
  if(obj)byId('propertiesPanel').hidden=false;if(!obj)return;
  this.syncTransformLockControls(obj);
  this.renderPrimitiveControls(obj);this.renderCurveControls(obj);this.renderTextGeometryControls(obj);this.renderPortalControls(obj);this.renderLadderControls(obj);this.renderFurnitureControls(obj);
  byId('objectPickableRow').hidden=!canBePickable(obj.userData.editorKind);byId('objectPickable').checked=obj.userData.pickable===true;byId('objectPickable').disabled=!this.canEdit(obj);  byId('objectConsumableRow').hidden=!canBePickable(obj.userData.editorKind)||obj.userData.pickable!==true;byId('objectInventoryOptions').hidden=!canBePickable(obj.userData.editorKind)||obj.userData.pickable!==true;byId('objectInventoryCategory').value=cleanInventory(obj.userData.inventory).category;byId('objectInventorySize').value=cleanInventory(obj.userData.inventory).size;byId('objectInventoryConsumable').checked=cleanInventory(obj.userData.inventory).consumable;
byId('objectFollowHandRotationRow').hidden=!canBePickable(obj.userData.editorKind)||obj.userData.pickable!==true;byId('objectFollowHandRotation').checked=obj.userData.followHandRotation!==false;byId('objectFollowHandRotation').disabled=!this.canEdit(obj);
  byId('saveObjectPreset').hidden=!(obj.userData.editorKind==='portal'||canPreset(this.snapshot(obj)));byId('saveObjectPreset').disabled=!this.canEdit(obj);
  byId('objectClimbableRow').hidden=!canBeClimbable(obj.userData.editorKind);byId('objectClimbable').checked=obj.userData.climbable===true;byId('objectClimbable').disabled=!this.canEdit(obj);
  byId('physicsObjectControls').hidden=['robot','light'].includes(obj.userData.editorKind);const phys=physicsOptions(obj.userData.physics);byId('objectPhysicsMode').value=phys.mode;byId('objectCollider').value=phys.collider||'box';this.updateColliderOption();this.updateCombatPhysicsHint();byId('objectRestitution').value=phys.restitution;byId('objectFriction').value=phys.friction;this.syncPhysicsSurface?.();byId('robotControls').hidden=obj.userData.editorKind!=='robot';byId('lightControls').hidden=obj.userData.editorKind!=='light';byId('mediaObjectControls').hidden=obj.userData.editorKind!=='media';  if(obj.userData.editorKind==='robot'){
   byId('robotAvatar').value=obj.userData.avatarUrl||DEFAULT_ROBOT_AVATAR;
   const prefs=obj.userData.robotBrain||{};
   for(const [id,property,def] of [['robotComicEnabled','comicEnabled','on'],['robotComicShape','comicShape','rounded'],['robotComicFont','comicFont','digital'],['robotComicThought','comicThought','on'],['robotComicCaps','comicCaps','auto']]){
    const select=byId(id);if(select)select.value=prefs[property]||def;
   }
  }
  byId('objectName').textContent=obj.name;byId('objectNameInput').value=obj.name;byId('objectNameInput').disabled=!this.canEdit(obj);
  if(obj.userData.editorKind==='robot')this.refreshRobotActions(obj);
  if(obj.userData.editorKind==='robot'){const settings=combatSettings(obj.userData.robotCombat);for(const el of byId('robotCombatList').querySelectorAll('[data-combat-action]'))el.value=String(settings[el.dataset.combatAction][el.dataset.combatField]);}
  this.renderToolGripControls(obj);
  const worn=byId('wearableAttachmentDetails'),category=cleanInventory(obj.userData.inventory).category;
  worn.hidden=!['backpack','jetpack','parachute','wearable'].includes(category)||!obj.userData.pickable;
  if(!worn.hidden){const cfg=cleanWearAttachment(obj.userData.inventory?.attachment);for(const el of worn.querySelectorAll('[data-wear-field]')){
   const key=el.dataset.wearField;el.disabled=!this.canEdit(obj);
   if(key==='followRotation')el.checked=cfg.followRotation;else if(key==='bone')el.value=cfg.bone;
   else el.value=cfg[key][Number(el.dataset.axis)];
  }}
  byId('objectAppearance').hidden=['robot','light','model','media','wall','ladder','furniture'].includes(obj.userData.editorKind);for(const id of ['replaceModelFile','replaceModelGallery']){byId(id).hidden=obj.userData.editorKind!=='model';byId(id).disabled=!this.canEdit(obj); }if(obj.userData.editorKind==='light'){this.refreshLightControls();this.showLightHelper(obj);}if(obj.userData.editorKind==='robot'){byId('robotStrafeSpeed').value=obj.userData.robotStrafeSpeed??2.5;byId('robotStrafeLabel').textContent=Number(obj.userData.robotStrafeSpeed??2.5).toFixed(1)+'×';byId('robotRunMultiplier').value=obj.userData.robotRunMultiplier??2.8;const factor=obj.userData.robotSpeed??1.8;byId('robotSpeed').value=factor;byId('robotSpeedLabel').textContent=Number(factor).toFixed(2)+'×';const turnFactor=obj.userData.robotTurnSpeed??4;byId('robotTurnSpeed').value=turnFactor;byId('robotTurnLabel').textContent=Number(turnFactor).toFixed(2)+'×';const climbFactor=obj.userData.robotClimbSpeed??1.25;byId('robotClimbSpeed').value=climbFactor;byId('robotClimbLabel').textContent=Number(climbFactor).toFixed(2)+' m/s';const throwConfig=cleanThrowSettings(obj.userData.robotThrowSettings);for(const [key,id] of [['angle','robotThrowAngle'],['height','robotThrowHeight'],['direction','robotThrowDirection'],['delay','robotThrowDelay'],['pickupDelay','robotPickupDelay'],['pickupSpeed','robotPickupSpeed'],['throwSpeed','robotThrowSpeed'],['force','robotThrowForce']]){const field=byId(id);if(field!==document.activeElement||this.throwEditingRobotId!==obj.userData.editorId)field.value=throwConfig[key];}const anim=animationSpeedSettings(obj.userData.robotAnimationSpeed);byId('animationWalk').value=anim.walk;byId('animationRun').value=anim.run;byId('animationJump').value=anim.jump;this.syncRobotSpeed?.();}if(obj.userData.editorKind==='media'){this.renderSmartMediaChannels(obj);const media=obj.userData.media||{};const kind=sceneMediaKind(media.mime);byId('mediaSourceLabel').textContent=media.name||'Uploaded media';byId('mediaBacking').value=media.backing||'white';byId('mediaStreamMode').value=media.stream||'direct';byId('mediaPlayPause').textContent=sceneMediaPlaying(obj)?'Pause':'Play';byId('mediaMuteToggle').textContent=sceneMediaMuted(obj)?'Unmute':'Mute';byId('mediaLoopToggle').checked=media.loop!==false;byId('mediaRefDistance').value=media.refDistance??4;byId('mediaMaxDistance').value=media.maxDistance??18;byId('mediaAutoplayDistance').value=media.autoplayDistance??0;byId('mediaConstantVolume').checked=media.constantVolume===true;byId('mediaGroup').value=media.group||'';byId('mediaVolume').value=media.volume??1;byId('mediaStreamRow').hidden=kind!=='video';byId('mediaBackingRow').hidden=kind==='audio';byId('mediaAudioFields').hidden=kind!=='audio';byId('mediaOrbAppearance').hidden=media.shape!=='orb';byId('mediaOrbColor').value=media.color||'#3c9bd2';byId('mediaOrbTexture').value=media.orbTexture||'none';byId('mediaTranscriptText').textContent=media.caption||'No transcription yet';this.updateMediaHUDPosition?.();}
  for(const name of ['position','rotation','scale'])['x','y','z'].forEach((axis,i)=>{
    const v=obj[name][axis];byId(`${name}-${i}`).value=name==='rotation'?(THREE.MathUtils.radToDeg(v)).toFixed(1):v.toFixed(2);if(this.activateInspectorValue && !byId('inspectorValueSlider').hidden && byId('inspectorActiveRange') && document.activeElement?.id===`${name}-${i}`)this.activateInspectorValue(document.activeElement);
  });
  const color=obj.material?.color||obj.children.find(c=>c.material?.color)?.material?.color;
  byId('objectColor').value=obj.userData.editorKind==='stairs'?(obj.userData.stairs?.surface?.color||'#c6d1dc'):color?'#'+color.getHexString():'#88bbdd';
  byId('texturePreset').value=obj.userData.editorKind==='stairs'?(obj.userData.stairs?.surface?.texture||'none'):obj.userData.textureName||'none';
  if(restoreSlider)this.restoreInspectorValue?.();
 }
 setupFurnitureControls(){
  const root=byId('furniturePropertiesFields');if(!root)return;
  root.addEventListener('click',event=>{const key=event.target.closest('button')?.dataset.smartAction;if(key)this.smartChannelAction(key,root,'furniture');});
  window.addEventListener('paste',event=>{
   const obj=this.selected;if(obj?.userData.editorKind!=='furniture'||!['tv','monitor'].includes(obj.userData.furniture?.variant)||!this.canEdit(obj))return;
   const target=event.target;if(target?.matches?.('input,textarea,select,[contenteditable]')&&target.dataset?.smartInput!=='url')return;
   const content=event.clipboardData?.getData('text/plain')?.trim();if(!content)return;
   if(safeIPTVPlaylistURL(content)){event.preventDefault();this.smartChannelAction('iptv-import',root,'furniture',content);return;}
   if(parseChannel(content)){event.preventDefault();this.smartChannelAction('pasteAdd',root,'furniture',content);}
  },true);
  // Numeric edits are previewed while typing/sliding rather than waiting for blur.
  // Keep the pre-edit snapshot so Undo still represents one committed edit.
  const drafts=new WeakMap();let previewTimer=null;
  root.addEventListener('input',event=>{
   const target=event.target,key=target?.dataset?.furnitureParam,obj=this.selected;
   if(target?.type!=='number'||!key||obj?.userData.editorKind!=='furniture'||!this.canEdit(obj))return;
   if(!Number.isFinite(Number(target.value))||target.value==='')return;
   if(!drafts.has(target))drafts.set(target,{id:obj.userData.editorId,before:this.snapshot(obj)});
   clearTimeout(previewTimer);
   previewTimer=setTimeout(()=>{
    if(this.selected!==obj||!target.isConnected)return;
    disposeEquipmentMedia(obj);rebuildFurniture(obj,{...obj.userData.furniture,[key]:target.value});
    if(this.infrastructureDrawing?.editTarget===obj){this.infrastructureDrawing.redraw?.();return;}
    this.physics.sync(obj);syncEquipmentMedia(obj,this);if(obj.userData.furniture?.variant==='fridge')this.inventory.reconcile();
   },90);
  });
  root.addEventListener('change',event=>{
   const obj=this.selected;if(obj?.userData.editorKind!=='furniture'||!this.canEdit(obj))return;
   const target=event.target,key=target?.dataset?.furnitureParam;if(!key)return;
   clearTimeout(previewTimer);
   const draft=drafts.get(target);const old=draft?.id===obj.userData.editorId?draft.before:this.snapshot(obj);drafts.delete(target);
   const value=target.type==='checkbox'?target.checked:target.value;
   if(key==='infraType'&&this.infrastructureDrawing?.editTarget===obj)this.infrastructureDrawing.type=value;
   disposeEquipmentMedia(obj);
   rebuildFurniture(obj,key==='variant'?{variant:value,color:obj.userData.furniture.color,fabricColor:obj.userData.furniture.fabricColor,texture:obj.userData.furniture.texture}:{...obj.userData.furniture,[key]:value});
   const activeInfrastructureDraw=this.infrastructureDrawing?.editTarget===obj?this.infrastructureDrawing:null;
   if(activeInfrastructureDraw)recordInfrastructureDraftChange(this,old?.furniture);
   if(!activeInfrastructureDraw){this.physics.sync(obj);syncEquipmentMedia(obj,this);if(old?.furniture?.variant==='fridge'||obj.userData.furniture?.variant==='fridge')this.inventory.reconcile();}
   if(key==='infraLanes')target.value=String(obj.userData.furniture.infraLanes);
   if(activeInfrastructureDraw){
    // This provisional inspector object must not reach room save or undo until
    // the user finishes a valid ground path.
    if(key==='infraType'){
     obj.name={road:'Road',footpath:'Footpath',curb:'Curb',fence:'Fence',hedge:'Hedge',pathWall:'Wall'}[obj.userData.furniture.infraType]||'Infrastructure';
     byId('objectName').textContent=obj.name;
    }
   }else{this.recordEdit(old,this.snapshot(obj));this.queueSave(obj);}
   activeInfrastructureDraw?.redraw?.();
   // Keep numeric focus and the shared slider mounted while editing dimensions.
   if(target.type!=='number')this.renderFurnitureControls(obj);
  });
 }
 renderFurnitureControls(obj){
  const section=byId('furnitureProperties'),root=byId('furniturePropertiesFields');if(!section||!root)return;
  const isFurniture=obj?.userData?.editorKind==='furniture';section.hidden=!isFurniture;
  if(!isFurniture)return;
  const p=sanitiseFurniture(obj.userData.furniture);obj.userData.furniture=p;
  const furnitureSummary=section.querySelector('summary');if(furnitureSummary)furnitureSummary.textContent=TOOL_TYPES.includes(p.variant)?'Tools · procedural':STATEFUL_PROPS.includes(p.variant)?'Interactive '+p.variant:p.variant==='infrastructure'?({road:'Road',footpath:'Footpath',curb:'Curb',fence:'Fence',hedge:'Hedge',pathWall:'Wall'}[p.infraType]||'Infrastructure')+' · path settings':'Basic furniture';
  // The shared contextual slider may be nested in this panel. Preserve it
  // before replacing fields; a new selection will attach it to its numeric row.
  const contextual=byId('inspectorValueSlider');if(root.contains(contextual)){section.append(contextual);contextual.hidden=true;}
  root.replaceChildren();
  const add=(key,label,type,choices=null)=>{
   // Only one numeric input per cell. The one wide range lives outside the
   // grid, so focusing any field never changes this row's height or layout.
   const holder=document.createElement('label');holder.className='furniture-param inspector-compact-field furniture-field-'+type+(key==='variant'?' furniture-field-full':'');
   const caption=document.createElement('span');caption.textContent=label;
   const control=document.createElement(type==='select'?'select':'input');control.dataset.furnitureParam=key;
   if(type==='select')for(const [value,title] of choices){const item=document.createElement('option');item.value=value;item.textContent=title;control.append(item);}
   else if(type==='checkbox')control.type='checkbox';
   else if(type==='color')control.type='color';
   else{control.type='number';control.className='inspector-compact-number';const [,min,max]=FURNITURE_NUMERIC[key];control.min=String(min);control.max=String(max);control.step=['shelves','corners','seats','infraLanes'].includes(key)?'1':'.01';control.setAttribute('aria-label',label);}
   if(type==='checkbox')control.checked=p[key];else control.value=p[key];control.disabled=!this.canEdit(obj);
   holder.append(caption,control);
   root.append(holder);
  };
  if(p.variant!=='infrastructure')add('variant','Type','select',FURNITURE_TYPES.map(kind=>[kind,kind==='miniComputer'?'Mini computer':kind==='officeChair'?'Office chair':kind[0].toUpperCase()+kind.slice(1)]));
  const equipment=['tv','monitor','miniComputer','keyboard','trackpad','mouse','printer','laptop','fridge','bin','backpack','sunbed','deckChair','beachUmbrella','lamp','speaker'].includes(p.variant)||TOOL_TYPES.includes(p.variant)||VEGETATION_TYPES.includes(p.variant)||p.variant==='infrastructure';
  if(TOOL_TYPES.includes(p.variant)){
   for(const [key,label] of [['handleLength','Handle length (m)'],['handleRadius','Handle radius (m)'],['headWidth','Head width (m)'],['headDepth','Head depth (m)']])if(p.variant!=='stick'||key.startsWith('handle'))add(key,label,'number');
   add('fabricColor','Head / bristle colour','color');add('metalColor','Metal colour','color');
  }else if(p.variant==='keyboard'||p.variant==='printer'||p.variant==='mouse'){
   for(const [key,label] of [['width','Width'],['depth','Depth'],['height','Height']])add(key,label,'number');
  }else if(p.variant==='trackpad'){
   for(const [key,label] of [['width','Width'],['depth','Depth'],['height','Height']])add(key,label,'number');
   add('deviceMode','Mode','select',[['trackpad','Touch trackpad'],['mouse','Mouse'],['stylus','Stylus tablet']]);
  }else if(p.variant==='fridge'){
   for(const [key,label] of [['width','Width'],['depth','Depth'],['height','Height'],['shelves','Shelves']])add(key,label,'number');
   add('open','Door open','checkbox');
   this.renderFridgeStorageControls(root,obj);
  }else if(p.variant==='laptop'){
   for(const [key,label] of [['width','Width'],['depth','Depth'],['height','Height'],['screenAngle','Screen angle (°)'],['diagonalInches','Diagonal (in)']])add(key,label,'number');
   add('open','Lid open','checkbox');add('powered','Screen on','checkbox');
   const mediaSources=this.items.filter(o=>o.userData.editorKind==='media'&&/^(video|image)\//.test(o.userData.media?.mime||''));
   add('mediaId','Media source','select',[['','None / offline'],...mediaSources.map(o=>[o.userData.media.id,o.name||'Scene media'])]);
  }else if(['tv','monitor'].includes(p.variant)){
   add('diagonalInches','Diagonal (in)','number');add('aspect','Aspect','select',[['16:9','16:9'],['21:9','21:9'],['4:3','4:3']]);
   add('bezel','Bezel (m)','number');add('mount','Mount','select',[['feet','Two feet'],['center','Centre stand'],['wall','VESA / wall'],['none','None']]);
   if(['feet','center'].includes(p.mount))add('standHeight','Stand height','number');
   if(p.variant==='monitor'){add('curved','Curved','checkbox');if(p.curved)add('curvature','Curve depth','number');}
   add('powered','Screen on','checkbox');
   const mediaSources=this.items.filter(o=>o.userData.editorKind==='media'&&/^(video|image)\//.test(o.userData.media?.mime||''));
   add('mediaId','Media source','select',[['','None / offline'],...mediaSources.map(o=>[o.userData.media.id,o.name||'Scene media'])]);
  }else if(p.variant==='miniComputer'){
   for(const [k,label] of [['width','Width'],['depth','Depth'],['height','Height']])add(k,label,'number');
   add('powered','Power LED','checkbox');const monitors=this.items.filter(o=>o!==obj&&o.userData.editorKind==='furniture'&&['monitor','tv'].includes(o.userData.furniture?.variant));
   add('pairedDisplayId','Paired display','select',[['','None'],...monitors.map(o=>[o.userData.editorId,o.name])]);
  }else if(p.variant==='bin'){
   for(const [k,label] of [['width','Width / diameter'],['depth','Depth'],['height','Height'],['rimWidth','Rim width']])add(k,label,'number');
   add('binShape','Shape','select',[['round','Cylinder'],['square','Box']]);add('lid','Closed lid','checkbox');
  }else if(['sunbed','deckChair'].includes(p.variant)){
   for(const [k,label] of [['width','Width'],['depth','Length'],['height','Seat height'],['reclineDeg','Back angle °']])add(k,label,'number');
  }else if(p.variant==='beachUmbrella'){
   for(const [k,label] of [['height','Height'],['canopyRadius','Canopy radius'],['canopySegments','Canopy segments']])add(k,label,'number');
  }else if(p.variant==='lamp'){
   for(const [k,label] of [['width','Shade diameter'],['height','Height'],['lampIntensity','Light intensity'],['lampRange','Light range'],['shadeOpacity','Shade opacity']])add(k,label,'number');
   add('lampShape','Shade shape','select',[['sphere','Sphere'],['cube','Cuboid'],['pyramid','Pyramid']]);add('lampType','Light source','select',[['point','Point light'],['spot','Spot light']]);add('lampOn','Initially on / light switch','checkbox');
  }else if(p.variant==='speaker'){
   for(const [k,label] of [['width','Width'],['depth','Depth'],['height','Height']])add(k,label,'number');
   add('speakerStyle','Speaker type','select',[['single','Single'],['tower','Tower']]);add('powered','Powered','checkbox');
  }else if(p.variant==='backpack'){
   for(const [k,label] of [['width','Width'],['depth','Depth'],['height','Height'],['strapWidth','Strap width']])add(k,label,'number');
   add('backpackStyle','Style','select',[['box','Cuboid'],['bag','Soft bag']]);add('straps','Shoulder straps','checkbox');add('frontPocket','Front pocket','checkbox');
  }
  if(p.variant==='infrastructure'){
   add('infraType','Type','select',[['road','Road / motorway'],['footpath','Footpath / pavement'],['curb','Curb'],['fence','Fence'],['hedge','Plant hedge'],['pathWall','Wall']]);
   if(p.infraType==='fence')add('infraStyle','Fence construction','select',[['plank','Plank fence'],['mesh','Wire mesh'],['rods','Metal rods']]);
   if(['road','footpath','curb'].includes(p.infraType))add('infraSurface','Surface','select',[['asphalt','Asphalt / tarmac'],['concrete','Concrete'],['gravel','Gravel'],['pavers','Paving stones'],['earth','Earth / dirt']]);
   if(p.infraType==='road'){
    add('infraTraffic','Traffic','select',[['twoway','Two-way'],['oneway','One-way']]);
    add('infraLanes','Lanes','number');add('infraMarkings','Paint lane markings','checkbox');
    if(p.infraMarkings){add('infraMarkingColour','Line colour','color');for(const [k,l] of [['infraMarkingWidth','Stripe width'],['infraDashLength','Dash length'],['infraDashGap','Dash spacing']])add(k,l,'number');}
    add('infraCurbs','Side curbs','checkbox');add('infraSidewalks','Footpaths at sides','checkbox');
    if(p.infraSidewalks)add('infraSidewalkWidth','Pavement width','number');
    add('infraStreetlights','Streetlights','checkbox');if(p.infraStreetlights){add('infraLightSpacing','Lamp spacing','number');add('infraLightHeight','Lamp height','number');add('infraLampsOn','Lamps illuminated','checkbox');}
   }
   for(const [k,l] of [['infraWidth','Width (m)'],['infraHeight','Height (m)'],['infraThickness','Thickness']]){
    // Line length is edited by moving its vertices. Do not expose a fence/wall
    // "Width" value that cannot affect an individual segment's length.
    if(k==='infraWidth'&&['fence','pathWall'].includes(p.infraType))continue;
    if((k==='infraHeight'&&!['fence','hedge','pathWall'].includes(p.infraType))||(k==='infraThickness'&&p.infraType==='hedge'))continue;
    add(k,l,'number');
   }
   if(['fence','hedge'].includes(p.infraType))add('infraPostSpacing',p.infraType==='fence'?'Post spacing':'Cluster spacing','number');
   if(p.infraType==='fence'&&p.infraStyle==='plank'){add('infraPicketWidth','Plank width','number');add('infraGap','Plank gap','number');}
   if(p.infraType==='hedge'){add('infraHedgeDensity','Hedge density','number');add('infraHedgeColour','Leaves colour','color');}
   if(p.infraType==='road'&&p.infraCurbs)add('infraCurbHeight','Curb height','number');
   add('infraColour',p.infraType==='hedge'?'Branch colour':'Material colour','color');
   if(['pathWall','fence'].includes(p.infraType))add('infraTexture','Material finish','select',[
    ['none','Plain / colour'],['wood','Wood'],['concrete','Concrete'],['bricks','Brick'],
    ['metal','Metal'],['plaster','Plaster'],['marble','Marble'],['granite','Granite']
   ]);
   add('infraSmooth','Smooth corners','checkbox');add('infraClose','Close path','checkbox');
   const activeDraw=this.infrastructureDrawing?.editTarget===obj?this.infrastructureDrawing:null;
   const modeLabel=document.createElement('label');modeLabel.className='infra-drawing-mode furniture-param';
   const caption=document.createElement('span');caption.textContent='Drawing mode';
   const mode=document.createElement('select');mode.id='infraDrawingMode';mode.setAttribute('aria-label','Infrastructure drawing mode');
   for(const [value,title] of [['line','Single line'],['polyline','Multi-line / polyline'],['freehand','Freehand stroke']]){
    const opt=document.createElement('option');opt.value=value;opt.textContent=title;mode.append(opt);
   }
   mode.value=activeDraw?.mode||'polyline';
   mode.onchange=()=>{const d=this.infrastructureDrawing;if(d&&d.editTarget===obj){d.mode=mode.value;d.drawing=false;}};
   modeLabel.append(caption,mode);root.append(modeLabel);
   if(activeDraw){
    const status=document.createElement('div');status.className='infra-inspector-status';status.id='infraDrawingStatus';
    status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    status.textContent=activeDraw.points.length>=2?`${activeDraw.points.length} points · Live construction`:activeDraw.points.length?'1 point · Add the next point':'Click the ground to start drawing';
    root.append(status);
   }
   const actions=document.createElement('div');actions.className='infra-inspector-actions';
   const start=document.createElement('button');start.type='button';start.id=activeDraw?'infraDrawingFinish':'infraDrawingStart';
   const subject={road:'road',footpath:'footpath',curb:'curb',fence:'fence',hedge:'hedge',pathWall:'wall'}[p.infraType]||'path';
   start.textContent=activeDraw?'Save '+subject:'Draw / redraw';
   start.className=activeDraw?'primary infra-drawing-save':'infra-drawing-start';
   start.disabled=Boolean(activeDraw&&activeDraw.points.length<2);
   start.title=activeDraw?'Save this '+subject+' to the scene (Enter)':'Edit this construction on the ground';
   start.setAttribute('aria-label',start.title);
   start.onclick=()=>activeDraw?finishInfrastructureDrawing(this):startInfrastructureDrawing(this,p.infraType,mode.value,obj);
   actions.append(start);
   if(activeDraw){
    const undo=document.createElement('button');undo.type='button';undo.id='infraDrawingUndo';undo.textContent='Undo';
    undo.title='Remove last point';undo.setAttribute('aria-label',undo.title);undo.disabled=!activeDraw.undoStack.length;
    undo.onclick=()=>drawingUndo(this);actions.append(undo);
    const redo=document.createElement('button');redo.type='button';redo.id='infraDrawingRedo';redo.textContent='Redo';
    redo.title='Redo last drawing point or stroke';redo.disabled=!activeDraw.redoStack.length;
    redo.onclick=()=>drawingRedo(this);actions.append(redo);
    const cancel=document.createElement('button');cancel.type='button';cancel.id='infraDrawingCancel';cancel.textContent='Cancel';
    cancel.title='Discard drawing (Escape)';cancel.setAttribute('aria-label',cancel.title);
    cancel.onclick=()=>cancelInfrastructureDrawing(this);actions.append(cancel);
   }
   root.append(actions);

  }
  if(VEGETATION_TYPES.includes(p.variant)){
   if(p.variant==='tree'){
    for(const [k,label] of [['treeHeight','Tree height (m)'],['trunkRadius','Trunk radius'],['canopyRadius','Canopy radius'],['branchCount','Branches'],['leafClusters','Foliage clusters'],['leafSize','Leaf size'],['trunkWobble','Trunk irregularity'],['treeSeed','Seed']])add(k,label,'number');
    add('treeStyle','Style','select',[['deciduous','Broadleaf'],['conifer','Conifer'],['orchard','Orchard'],['blossom','Blossom'],['palm','Palm / coconut']]);
    add('fruitType','Fruit','select',[['none','None'],['apple','Apples'],['orange','Oranges'],['plum','Plums'],['coconut','Coconuts']]);
    if(p.treeStyle==='blossom'){add('blossomColor','Blossom colour','color');add('blossomDensity','Blossom density','number');}
    if(p.treeStyle==='palm')add('palmFronds','Palm fronds','number');
    add('leafColor','Leaf colour','color');add('color','Trunk colour','color');
   }else if(p.variant==='shrub'){
    for(const [k,label] of [['shrubHeight','Height'],['shrubRadius','Spread'],['shrubLeaves','Leaf clusters'],['shrubBranches','Branches'],['treeSeed','Seed']])add(k,label,'number');
    add('shrubShape','Shape','select',[['wild','Wild'],['round','Round'],['oval','Oval'],['hedge','Hedge']]);
    add('leafColor','Leaf colour','color');add('color','Branch colour','color');
   }else{
    if(p.variant==='vegetationArea'){
     add('scatterMode','Planting pattern','select',[['orchard','Orchard rows'],['forest','Forest'],['thicket','Irregular thicket'],['brushwood','Brushwood']]);
     add('scatterSpecies','Tree species','select',[['mixed','Mixed'],['deciduous','Broadleaf'],['conifer','Conifer'],['orchard','Fruit tree'],['blossom','Blossom'],['palm','Palm']]);
     for(const [k,label] of [['scatterCount','Plant count'],['scatterSpacing','Spacing (m)'],['scatterJitter','Row irregularity'],['scatterCluster','Cluster strength'],['scatterScale','Size variation'],['treeHeight','Tree height'],['canopyRadius','Canopy radius'],['shrubHeight','Shrub height'],['shrubRadius','Shrub spread'],['shrubLeaves','Shrub foliage'],['plotSeed','Distribution seed']])add(k,label,'number');
     add('shrubShape','Shrub style','select',[['wild','Wild'],['round','Round'],['oval','Oval'],['hedge','Hedge']]);
     add('terrainRelief','Terrain height (m)','number');add('terrainFrequency','Hill irregularity','number');
     add('groundCover','Cover','select',[['soil','Soil'],['grass','Grass'],['mixed','Mixed grass / soil']]);
     add('soilPreset','Soil preset','select',[['loam','Loam'],['sand','Sandy'],['clay','Clay'],['compost','Compost']]);
     add('soilColor','Soil colour','color');add('leafColor','Plant colour','color');
     add('plotSmooth','Smooth boundary','checkbox');add('soilRoughness','Soil variation','number');
     add('grassDensity','Grass density','number');add('grassHeight','Grass height','number');add('grassWidth','Blade width','number');add('windStrength','Wind strength','number');add('windSpeed','Wind speed','number');add('plotSeed','Seed','number');
    }else{
     add('plotShape','Patch shape','select',[['freehand','Freehand'],['circle','Circle'],['oval','Oval'],['square','Square']]);
     if(p.plotShape!=='freehand'){add('width','Width / diameter','number');add('depth',p.plotShape==='circle'?'Depth (locked to width)':'Depth','number');}
     add('plotSmooth','Smooth boundary','checkbox');add('plotSeed','Seed','number');add('terrainRelief',p.variant==='waterPatch'?'Bank irregularity':'Terrain relief','number');add('terrainFrequency','Terrain detail','number');
     add('soilPreset','Soil preset','select',[['loam','Loam'],['sand','Sandy'],['clay','Clay'],['compost','Compost']]);
     add('soilColor',p.variant==='waterPatch'?'Lake bed colour':'Soil colour','color');
     if(p.variant==='waterPatch'){
      add('waterColor','Water colour','color');add('waterDepth','Depth','number');add('waterLevel','Water level','number');add('shoreSlope','Shore smoothness','number');
     }else{
      add('groundCover','Cover','select',[['soil','Soil'],['grass','Grass'],['mixed','Mixed grass / soil']]);
      add('leafColor','Plant colour','color');add('soilRoughness','Soil variation','number');
      add('grassDensity','Grass density','number');add('grassHeight','Grass height','number');add('grassWidth','Blade width','number');add('windStrength','Wind strength','number');add('windSpeed','Wind speed','number');
      if(p.variant==='cropBed'){
       add('cropType','Crop','select',[['carrot','Carrots'],['tomato','Tomatoes'],['lettuce','Lettuce'],['strawberry','Strawberries']]);
       add('cropSpacing','Plant spacing','number');add('cropRows','Rows','number');add('growthPercent','Growth %','number');
      }
     }
    }
    const edit=document.createElement('button');edit.type='button';edit.textContent='Redraw on ground';edit.className='furniture-field-full';edit.onclick=()=>startVegetationPlot(this,p.variant);root.append(edit);
   }
  }
  const isProp=BASIC_PROP_TYPES.includes(p.variant);
  if(!equipment)for(const [key,title] of [['width',isProp?'Diameter / width (m)':'Width (m)'],['depth','Depth (m)'],['height','Height (m)']])if(!isProp||key!=='depth'||p.variant==='box')add(key,title,'number');
  if(isProp){
   if(p.variant!=='plate')add('wallThickness','Wall thickness','number');
   if(p.variant==='bottle'){add('neckRadius','Neck radius','number');add('neckHeight','Neck height','number');add('bottleOpacity','Bottle opacity','number');add('fluidOpacity','Liquid opacity','number');add('fluidLevel','Fill level %','number');add('fluidColor','Liquid colour','color');add('cap','Cap / cork','checkbox');}
   if(p.variant==='mug')add('handle','Handle','checkbox');
   if(p.variant==='flowerpot')add('soil','Soil','checkbox');
   if(p.variant==='can')add('cap','Lid','checkbox');
   if(p.variant==='box')add('openTop','Open top','checkbox');
  }
  if(['table','stool'].includes(p.variant)){
   add('topShape','Top shape','select',[['rectangle','Rectangular'],['round','Round'],['polygon','Polygon']]);
   if(p.topShape!=='rectangle')add('topRadius','Top radius','number');
   if(p.topShape==='polygon')add('corners','Corners / legs','number');
   add('topThickness','Top thickness','number');
  }
  if(['chair','officeChair','armchair','sofa','stool','bed','table','sunbed','deckChair'].includes(p.variant))add('seatMoveMode','When furniture moves','select',[['stand','Non-stickable · stand up'],['follow','Stickable · ride along']]);
  if(['chair','officeChair','armchair','sofa'].includes(p.variant)){
   add('seatHeight','Seat height','number');add('backHeight','Back height','number');add('cushionThickness','Cushion','number');
   if(p.variant==='sofa')add('seats','Seats','number');
   add('headrest','Headrest','checkbox');
   if(p.variant==='officeChair'){add('ergonomicBack','Open ergonomic back','checkbox');add('armrests','Armrests','checkbox');}
  }
  if(p.variant==='bed'){
   add('cushionThickness','Mattress','number');add('headboard','Headboard','checkbox');
  }
  if(p.variant==='cabinet')add('shelves','Shelves','number');
  if(p.variant!=='cabinet'&&!isProp&&!equipment){
   add('legStyle','Base / legs','select',[['four','4 legs'],['three','3 legs'],['single','Pedestal'],['casters','Casters'],['none','No legs / floor']]);
   if(p.legStyle!=='none')add('legRadius','Leg width','number');
  }
  if((!VEGETATION_TYPES.includes(p.variant)&&p.variant!=='infrastructure')||p.variant==='tree')add('texture',p.variant==='tree'?'Trunk texture':'Texture','select',[['none','Plain'],['plaster','Plaster'],['concrete','Concrete'],['bricks','Bricks'],['metal','Metal'],['wood','Wood'],['marble','Marble'],['granite','Granite']]);
  if(['wood','marble','granite'].includes(p.texture)){add('textureScale','Pattern scale','number');add('textureDistortion','Distortion','number');add('textureContrast','Contrast','number');}
  if(!VEGETATION_TYPES.includes(p.variant)&&p.variant!=='infrastructure')add('color',isProp?'Colour':'Frame colour','color');
  if(['chair','officeChair','stool','armchair','sofa','bed','sunbed','deckChair','beachUmbrella','lamp','speaker'].includes(p.variant))add('fabricColor',p.variant==='beachUmbrella'?'Canopy colour':'Fabric colour','color');
  if(['tv','monitor','laptop','speaker'].includes(p.variant))this.renderSmartChannelControls(root,obj,'furniture');
 }
 renderFridgeStorageControls(root,fridge){
  const p=fridge.userData.furniture,layout=fridgeLayout(p),stored=this.items.filter(o=>o.userData.storage?.type==='container'&&o.userData.storage.containerId===fridge.userData.editorId);
  const section=document.createElement('section');section.className='smart-channel-controls';
  const title=document.createElement('strong');title.textContent=`Fridge storage · ${stored.length}/${layout.capacity} slots`;section.append(title);
  const note=document.createElement('small');note.textContent='Open door to add/remove cans, bottles or boxes. Items must fit inside one shelf slot.';section.append(note);
  const store=document.createElement('select');store.setAttribute('aria-label','Item to store in fridge');
  const empty=document.createElement('option');empty.value='';empty.textContent='Choose nearby world item';store.append(empty);
  const valid=this.items.filter(o=>o!==fridge&&o.userData.editorKind==='furniture'&&FRIDGE_ITEM_TYPES.includes(o.userData.furniture?.variant)&&!o.userData.storage&&canStoreInFridge(p,o.userData.furniture,stored.map(s=>s.userData.storage.slot))>=0);
  const near=o=>o.position.distanceTo(fridge.position)<3;
  for(const o of valid.filter(near)){const option=document.createElement('option');option.value=o.userData.editorId;option.textContent=o.name;store.append(option);}
  const addButton=document.createElement('button');addButton.type='button';addButton.textContent='Put on shelf';addButton.disabled=!p.open||!this.canEdit(fridge)||!valid.some(near);
  addButton.onclick=()=>{const item=this.items.find(o=>o.userData.editorId===store.value);if(item)this.storeFridgeItem(fridge,item);};
  const take=document.createElement('select');take.setAttribute('aria-label','Fridge item to remove');
  for(const o of stored){const option=document.createElement('option');option.value=o.userData.editorId;option.textContent=o.name;take.append(option);}
  const takeButton=document.createElement('button');takeButton.type='button';takeButton.textContent='Take out';takeButton.disabled=!p.open||!this.canEdit(fridge)||!stored.length;
  takeButton.onclick=()=>{const item=this.items.find(o=>o.userData.editorId===take.value);if(item)this.takeFridgeItem(fridge,item);};
  section.append(store,addButton,take,takeButton);root.append(section);
 }
 storeFridgeItem(fridge,item){
  if(!this.canEdit(fridge)||!this.canEdit(item)||!fridge.userData.furniture?.open||item.userData.storage||item.position.distanceTo(fridge.position)>=3)return false;
  const occupied=this.items.filter(o=>o.userData.storage?.type==='container'&&o.userData.storage.containerId===fridge.userData.editorId).map(o=>o.userData.storage.slot);
  const slot=canStoreInFridge(fridge.userData.furniture,item.userData.furniture,occupied);if(slot<0){this.toast('Item does not fit or fridge is full');return false;}
  const before=this.snapshot(item);item.userData.pickable=true;item.userData.inventory={category:item.userData.furniture.variant==='box'?'general':'food',size:'pocket',consumable:false};item.userData.storage={type:'container',containerId:fridge.userData.editorId,slot};
  this.inventory.applyState(item);this.inventory.tick();this.recordEdit(before,this.snapshot(item));this.queueSave(item);this.renderFurnitureControls(fridge);this.toast(item.name+' stored');return true;
 }
 takeFridgeItem(fridge,item){
  if(!this.canEdit(fridge)||!this.canEdit(item)||!fridge.userData.furniture?.open||item.userData.storage?.containerId!==fridge.userData.editorId)return false;
  const before=this.snapshot(item);delete item.userData.storage;item.visible=true;
  fridge.updateWorldMatrix(true,false);const outside=fridge.localToWorld(new THREE.Vector3(0,.35,fridge.userData.furniture.depth/2+.5));
  item.position.copy(item.parent?.worldToLocal?.(outside)||outside);this.physics.sync(item);
  this.recordEdit(before,this.snapshot(item));this.queueSave(item);this.renderFurnitureControls(fridge);this.toast(item.name+' removed');return true;
 }
 renderSmartChannelControls(root,obj,kind){
  const value=kind==='furniture'?obj.userData.furniture:obj.userData.media;
  const channels=cleanChannels(value?.channels),options=cleanSmartOptions(value);
  const section=document.createElement('details');section.className='smart-channel-controls';section.open=true;
  const summary=document.createElement('summary');summary.textContent=(value?.variant==='speaker'?'Audio channels · ':'Smart screen · ')+channels.length+' channels';section.append(summary);
  const list=document.createElement('div');list.className='smart-channel-list';
  channels.forEach((c,i)=>{const row=document.createElement('div');row.className='smart-channel-row';
   const label=document.createElement('span');label.textContent=(i+1)+'. '+c.title;label.title=c.url;
   const play=document.createElement('button');play.type='button';play.title='Play '+c.title;play.setAttribute('aria-label','Play '+c.title);play.dataset.uiIcon='play';play.dataset.smartAction='play:'+i;row.append(label,play);
   const remove=document.createElement('button');remove.type='button';remove.dataset.uiIcon='delete';remove.title='Remove channel';remove.setAttribute('aria-label','Remove channel');remove.dataset.smartAction='remove:'+i;row.append(remove);list.append(row);
  });section.append(list);
  if(value?.variant!=='speaker'){
   const settings=document.createElement('div');settings.className='smart-channel-settings';
   const field=(name,label,checked)=>{const l=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.checked=checked;input.dataset.smartOption=name;l.append(input,document.createTextNode(label));settings.append(l);};
   field('smartAudio','Audio enabled',options.smartAudio);field('smartMuted','Start muted',options.smartMuted);
   field('smartLoop','Loop video',options.smartLoop);field('smartAutoPlay','Play on startup',options.smartAutoPlay);
   field('smartPreserveAspect','Original aspect',options.smartPreserveAspect);
   const start=document.createElement('label');start.textContent='Startup';const select=document.createElement('select');select.dataset.smartOption='smartStartChannel';
   const off=document.createElement('option');off.value='-1';off.textContent='Menu';select.append(off);
   channels.forEach((c,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=(i+1)+'. '+c.title;select.append(o);});select.value=String(options.smartStartChannel);start.append(select);settings.append(start);section.append(settings);
   settings.addEventListener('change',event=>this.smartChannelOption(event.target,kind,obj));
  }
  const entry=document.createElement('input');entry.type='url';entry.dataset.smartInput='url';entry.placeholder='Paste HTTPS HLS / MP4 / WebM';entry.setAttribute('aria-label','New media channel URL');section.append(entry);
  const title=document.createElement('input');title.type='text';title.dataset.smartInput='title';title.placeholder='Channel name (optional)';title.maxLength=65;section.append(title);
  const buttons=document.createElement('div');buttons.className='smart-channel-actions';
  const add=document.createElement('button');add.type='button';add.textContent='Add channel';add.dataset.smartAction='add';buttons.append(add);section.append(buttons);
  const iptv=document.createElement('details');iptv.className='smart-iptv-picker';
  const heading=document.createElement('summary');heading.textContent='Import IPTV playlist (.m3u)';iptv.append(heading);
  const playlist=document.createElement('input');playlist.type='url';playlist.dataset.smartInput='iptv';playlist.placeholder='https://iptv-org.github.io/iptv/index.m3u';iptv.append(playlist);
  const importBtn=document.createElement('button');importBtn.type='button';importBtn.textContent='Load channels';importBtn.dataset.smartAction='iptv-import';iptv.append(importBtn);
  const status=document.createElement('small');status.className='smart-iptv-status';iptv.append(status);
  const search=document.createElement('input');search.type='search';search.placeholder='Search by channel or category';search.dataset.smartInput='iptv-search';iptv.append(search);
  const results=document.createElement('div');results.className='smart-iptv-results';iptv.append(results);
  search.addEventListener('input',()=>this.renderIPTVResults(iptv,obj));section.append(iptv);root.append(section);
  const cache=this.iptvCatalog;if(cache?.id===obj.userData.editorId){playlist.value=cache.url;this.renderIPTVResults(iptv,obj);}
 }
 smartChannelOption(input,kind,obj){
  const name=input?.dataset?.smartOption;if(!name||this.selected!==obj||!this.canEdit(obj))return;
  const value=kind==='furniture'?obj.userData.furniture:obj.userData.media;const before=this.snapshot(obj);
  value[name]=name==='smartStartChannel'?Number(input.value):Boolean(input.checked);
  if(kind==='furniture')syncEquipmentMedia(obj,this);else hydrateSceneMedia(obj,this.world);
  this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);
 }
 renderIPTVResults(section,obj){
  const results=section.querySelector('.smart-iptv-results'),status=section.querySelector('.smart-iptv-status');if(!results||!status)return;results.replaceChildren();
  const catalog=this.iptvCatalog;if(catalog?.id!==obj?.userData?.editorId){status.textContent='';return;}
  const q=(section.querySelector('[data-smart-input="iptv-search"]')?.value||'').toLowerCase().trim();
  const matching=catalog.entries.filter(c=>(c.title+' '+c.group).toLowerCase().includes(q));
  status.textContent=matching.length+' matching / '+catalog.entries.length+' playable channels · select to add (12 per screen)';
  for(const c of matching.slice(0,60)){
   const row=document.createElement('div');row.className='smart-iptv-result';const label=document.createElement('span');label.textContent=c.title+' · '+c.group;label.title=c.url;
   const button=document.createElement('button');button.type='button';button.textContent='Add';button.dataset.smartAction='iptv-add:'+catalog.entries.indexOf(c);row.append(label,button);results.append(row);
  }
 }
 async smartChannelAction(action,root,kind,clipboardText=null){
  const obj=this.selected;if(!obj||!this.canEdit(obj)||!(kind==='furniture'?obj.userData.editorKind==='furniture':obj.userData.editorKind==='media'))return;
  const value=kind==='furniture'?obj.userData.furniture:obj.userData.media;
  let channels=cleanChannels(value.channels);
  if(action==='iptv-import'){
   const url=(clipboardText||root.querySelector('[data-smart-input="iptv"]')?.value||'').trim();
   try{const entries=await fetchIPTVPlaylist(url);if(this.selected!==obj)return;
    this.iptvCatalog={id:obj.userData.editorId,url,entries};
    const section=root.querySelector('.smart-iptv-picker');if(section){section.open=true;this.renderIPTVResults(section,obj);}
   }catch(error){this.toast('IPTV unavailable: '+error.message+' (check CORS)');}return;
  }
  if(action.startsWith('play:')){const index=Number(action.slice(5));const done=kind==='furniture'&&value.variant==='speaker'?await playEquipmentChannel(obj,index,this.world):await openSmartChannel(obj,index);
   if(!done)this.toast('Could not play channel: verify the stream URL, CORS and codec');return;}
  if(action.startsWith('remove:'))channels.splice(Number(action.split(':')[1]),1);
  else if(action==='pasteAdd'||action==='add'||action.startsWith('iptv-add:')){
   const catalog=this.iptvCatalog;
   const parsed=action.startsWith('iptv-add:')&&catalog?.id===obj.userData.editorId?catalog.entries[Number(action.slice(9))]:parseChannel(clipboardText||root.querySelector('[data-smart-input="url"]')?.value);
   if(!parsed){this.toast('Enter a valid HTTPS HLS, MP4 or WebM stream URL');return;}
   if(channels.length>=12){this.toast('Maximum 12 channels per display');return;}
   if(channels.some(c=>c.url===parsed.url)){this.toast('Channel already added');return;}
   const name=action==='add'?(root.querySelector('[data-smart-input="title"]')?.value||'').trim().slice(0,65):'';
   channels.push({title:name||parsed.title,url:parsed.url});
  }else return;
  const before=this.snapshot(obj);value.channels=channels;
  if(kind==='furniture')syncEquipmentMedia(obj,this);else hydrateSceneMedia(obj,this.world);
  this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);
  if(kind==='furniture')this.renderFurnitureControls(obj);else this.renderSmartMediaChannels(obj);
 }
 renderSmartMediaChannels(obj){const root=byId('mediaSmartChannelControls');if(!root)return;root.replaceChildren();root.hidden=obj?.userData.editorKind!=='media';if(!root.hidden)this.renderSmartChannelControls(root,obj,'media');}
 setupLadderControls(){
  for(const id of ['ladderWidth','ladderHeight','ladderAdhesion','ladderRungSpacing','ladderRungs','ladderRungMode','ladderTexture','ladderColor']){
   const el=byId(id);if(!el)continue;
   el.addEventListener('change',()=>{const obj=this.selected;if(obj?.userData.editorKind!=='ladder'||!this.canEdit(obj))return;
    const before=this.snapshot(obj),raw={...obj.userData.ladder,width:byId('ladderWidth').value,height:byId('ladderHeight').value,adhesion:byId('ladderAdhesion').value,rungMode:byId('ladderRungMode').value,rungSpacing:byId('ladderRungSpacing').value,rungs:byId('ladderRungs').value,texture:byId('ladderTexture').value,color:byId('ladderColor').value};
    rebuildLadder(obj,raw);this.physics.sync(obj);this.recordEdit(before,this.snapshot(obj));this.queueSave(obj);this.renderLadderControls(obj);
   });
  }
 }
 renderLadderControls(obj){
  const section=byId('ladderProperties');if(!section)return;const ladder=obj?.userData.editorKind==='ladder';section.hidden=!ladder;if(!ladder)return;
  const cfg=sanitiseLadder(obj.userData.ladder);
  for(const [key,id] of Object.entries({width:'ladderWidth',height:'ladderHeight',adhesion:'ladderAdhesion',rungSpacing:'ladderRungSpacing',rungs:'ladderRungs',rungMode:'ladderRungMode',texture:'ladderTexture',color:'ladderColor'})){byId(id).value=cfg[key];byId(id).disabled=!this.canEdit(obj);}
  byId('ladderRungSpacingRow').hidden=cfg.rungMode==='count';byId('ladderRungCountRow').hidden=cfg.rungMode!=='count';
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
  if(obj===this.selected){this.syncTransformLockControls(obj);if(isEditMode()&&!locked&&obj.userData.editorKind!=='robot')this.transform.attach(obj);}
  this.queueSave(obj);this.refreshList();this.toast(locked?'Transform locked · '+obj.name:'Transform unlocked · '+obj.name);
 }
 updateCombatPhysicsHint(){
  const obj=this.selected,hint=byId('combatObjectPhysicsHint'),make=byId('makeObjectPushable');
  if(!hint||!make)return;
  const equipped=obj?.userData?.storage?.type==='held';
  const eligible=obj&&!['robot','light'].includes(obj.userData.editorKind)&&!equipped;
  hint.hidden=!eligible;make.hidden=!eligible||byId('objectPhysicsMode').value==='dynamic';
  if(!eligible)return;
  const mode=byId('objectPhysicsMode').value;
  hint.textContent=mode==='dynamic'?'Pushable: Punch/Kick transfer force when room Physics is on and the attack connects.':
    mode==='off'?'No physics: attacks pass through. Set Dynamic to receive punches and kicks.':
    'Static/kinematic: stays fixed during combat. Use Dynamic if this object should move.';
  make.disabled=!this.canEdit(obj);
 }
 updateColliderOption(){
  const mode=byId('objectPhysicsMode').value,selector=byId('objectCollider');
  // Collider selection is independent of rigid-body mode; never silently reset Trimesh.
  selector.disabled=!this.selected||!this.canEdit(this.selected);
  const isTrimesh=selector.value==='trimesh',hint=byId('colliderHint');
  hint.hidden=!isTrimesh;
  hint.textContent='Trimesh available for Dynamic, Static and Kinematic. Detailed moving meshes can be slower or less stable.';
  const status=byId('colliderRuntimeStatus');
  status.hidden=!isTrimesh;
  status.textContent=mode==='off'?'Enable Physics to use the selected Trimesh.':
   this.selected?.userData.colliderStatus||
   (this.selected?.userData.editorKind==='model'&&!this.selected?.userData.modelReady?'Waiting for imported model geometry':'Trimesh selected. Enable room Physics to create its collider.');
  const runtime=byId('physicsRuntimeStatus');const equipped=this.selected?.userData?.storage?.type==='held';runtime.hidden=mode==='off'||equipped;
  if(mode!=='off'&&!equipped){
   const editorObject=this.selected,id=editorObject?.userData.editorId;
   runtime.textContent=!window.solviRoomPolicy?.physics?'Room physics OFF. Enable Physics in World settings to activate gravity and collisions.':
    !this.physics.enabled||!this.physics.world?'Rapier physics is starting. If this persists, check the browser console and vendor assets.':
    !this.physics.bodies.has(id)?'Physics body not ready. Check the model geometry and scene loading.':
    mode==='dynamic'&&!this.physics.owns(editorObject)?'Dynamic physics simulated by the object owner; this browser displays updates.':
    mode==='dynamic'?`Dynamic body active — gravity, ${isTrimesh?'Trimesh':'box'} collider and bouncing enabled.`:
    mode==='static'?`Static collision body active — ${isTrimesh?'Trimesh':'box'} collider.`:
    `Kinematic collision body active — ${isTrimesh?'Trimesh':'box'} collider.`;
  }
 }

 refreshRobotActions(obj){const select=byId('robotActionSelect');select.querySelectorAll('optgroup[data-real-actions]').forEach(n=>n.remove());
  const clips=obj.userData.robotAvailableActions||[];if(clips.length){const group=document.createElement('optgroup');group.label='Model animations';group.dataset.realActions='1';for(const name of clips.slice(0,120))group.append(new Option(name,'clip:'+name));select.append(group);}
  select.value=[...select.options].some(o=>o.value===obj.userData.robotMode)?obj.userData.robotMode:'idle';
 }
  visibleSceneItems(){const term=byId('sceneObjectSearch')?.value?.trim().toLocaleLowerCase()||'';const filter=byId('sceneObjectFilter')?.value||'all';return this.items.filter(o=>!o.userData.temporaryCarryTest&&(filter==='all'||(filter==='robot')===(o.userData.editorKind==='robot'))&&(!term||(`${o.name} ${o.userData.editorKind}`).toLocaleLowerCase().includes(term)));}
 // Visible names are friendly, while stable IDs remain authoritative for save/recovery.
 sceneObjectLabel(obj){return memberDisplayName(obj);}
 revealSceneObject(obj){
  const panel=byId('scenePanel');if(panel){panel.hidden=false;panel.classList.remove('minimized');}
  byId('sceneObjectSearch').value='';byId('sceneObjectFilter').value='all';
  const folder=collectionOf(obj);if(folder)this.collectionExpanded.add(folder.id);
 }
 clearCollectionTarget(){
  if(this.collectionTarget){this.transform.detach();this.world.scene.remove(this.collectionTarget.pivot);this.collectionTarget=null;this.collectionDrag=null;this.activeCollectionId=null;}
 }
 collectionMembers(id){return this.items.filter(o=>collectionOf(o)?.id===id);}
 canMoveCollection(members){return members.length>0&&members.every(o=>o.userData.editorKind!=='robot'&&this.canEdit(o)&&!isTransformLocked(o));}
 selectCollection(id){
  const members=this.collectionMembers(id);if(!this.canMoveCollection(members)){this.toast('Collection move requires all parts to be editable and unlocked');return;}
  if(!isEditMode()){this.toast('Enable Edit mode first, then select Move on this collection');return;}
  this.clearCollectionTarget();this.selected=null;this.updateInspector();this.collectionExpanded.add(id);this.activeCollectionId=id;
  const pivot=new THREE.Group();pivot.name='SOLVI collection transform pivot (temporary)';
  const centre=new THREE.Vector3();members.forEach(o=>centre.add(o.getWorldPosition(new THREE.Vector3())));centre.divideScalar(members.length);pivot.position.copy(centre);
  this.world.scene.add(pivot);pivot.updateMatrixWorld(true);
  this.collectionTarget={id,pivot,members};
  if(isEditMode())this.transform.attach(pivot);else this.toast('Enable Edit mode to use the collection transform gizmo');
  this.refreshList();
 }
 beginCollectionDrag(){
  const target=this.collectionTarget;if(!target||!this.canMoveCollection(target.members)){this.clearCollectionTarget();return;}
  this.world.scene.updateMatrixWorld(true);
  this.collectionDrag={pivot:target.pivot.matrixWorld.clone(),members:target.members.map(object=>({object,world:object.matrixWorld.clone(),before:this.snapshot(object)}))};
 }
 applyCollectionDrag(){
  if(!this.collectionDrag||!this.collectionTarget)return;
  const current=this.collectionTarget.pivot;current.updateMatrixWorld(true);
  const change=new THREE.Matrix4().multiplyMatrices(current.matrixWorld,this.collectionDrag.pivot.clone().invert());
  for(const {object,world} of this.collectionDrag.members){
   if(!this.items.includes(object))continue;
   const pose=new THREE.Matrix4().multiplyMatrices(change,world);
   const local=new THREE.Matrix4().multiplyMatrices(object.parent.matrixWorld.clone().invert(),pose);
   local.decompose(object.position,object.quaternion,object.scale);object.updateMatrixWorld(true);
  }
 }
 endCollectionDrag(){
  if(!this.collectionDrag)return;this.applyCollectionDrag();
  for(const {object,before} of this.collectionDrag.members){
   if(!this.items.includes(object))continue;this.physics.sync(object);this.recordEdit(before,this.snapshot(object));this.queueSave(object);
  }
  this.collectionDrag=null;this.refreshList();
 }
 async groupBulkSelection(){
  const chosen=this.items.filter(o=>this.bulkChecked.has(o.userData.editorId)&&o.userData.editorKind!=='robot'&&this.canEdit(o)&&!isTransformLocked(o));
  if(chosen.length<2){this.toast('Select at least two editable, unlocked objects');return;}
  const entered=await textEntry('Collection name','My collection');if(entered===null)return;
  const group=cleanSceneCollection({id:'group:'+crypto.randomUUID(),name:entered.trim().slice(0,80)});
  if(!group){this.toast('A collection name is required');return;}
  for(const item of chosen){const previous=this.snapshot(item);item.userData.sceneCollection=group;item.userData.sceneCollectionOptOut=false;this.recordEdit(previous,this.snapshot(item));this.queueSave(item);}
  this.bulkChecked.clear();this.collectionExpanded.add(group.id);this.refreshList();this.toast(`Grouped ${chosen.length} objects into ${group.name}`);
 }
 async renameCollection(id){
  const members=this.collectionMembers(id),group=collectionOf(members[0]);if(!group||!members.every(o=>this.canEdit(o)))return this.toast('Owner only');
  const value=await textEntry('Collection name',group.name);if(value===null)return;const renamed=cleanSceneCollection({id,name:value.trim().slice(0,80)});
  if(!renamed)return this.toast('A collection name is required');
  for(const item of members){const before=this.snapshot(item);item.userData.sceneCollection=renamed;item.userData.sceneCollectionOptOut=false;this.recordEdit(before,this.snapshot(item));this.queueSave(item);}
  this.refreshList();
 }
 ungroupCollection(id){
  const members=this.collectionMembers(id);if(!members.every(o=>this.canEdit(o)&&cleanSceneCollection(o.userData.sceneCollection)))return this.toast('Owner only');
  this.clearCollectionTarget();
  for(const item of members){const before=this.snapshot(item);item.userData.sceneCollection=null;item.userData.sceneCollectionOptOut=/^SOLVI Creative · /.test(item.name);this.recordEdit(before,this.snapshot(item));this.queueSave(item);}
  this.collectionExpanded.delete(id);this.refreshList();
 }
 refreshList(){this.syncControlSwitcher?.();const list=byId('sceneItems');if(!list)return;list.replaceChildren();
  const visible=this.visibleSceneItems();const ids=new Set(this.items.map(o=>o.userData.editorId));
  for(const id of this.bulkChecked)if(!ids.has(id))this.bulkChecked.delete(id);
  const makeRow=obj=>{
   const row=document.createElement('div');row.className='scene-item-row'+(obj===this.selected?' is-active':'');row.dataset.objectId=obj.userData.editorId;
   const check=document.createElement('input');check.type='checkbox';check.className='scene-row-check';check.title='Select '+obj.name;check.setAttribute('aria-label','Select '+obj.name);check.checked=this.bulkChecked.has(obj.userData.editorId);check.disabled=!this.canEdit(obj);check.onchange=()=>{if(check.checked)this.bulkChecked.add(obj.userData.editorId);else this.bulkChecked.delete(obj.userData.editorId);this.updateBulkControls();};
   const b=document.createElement('button');b.className='scene-item-name'+(obj===this.selected?' selected':'');b.textContent=`${obj.userData.editorKind} · ${this.sceneObjectLabel(obj)}`;b.dataset.objectKind=obj.userData.editorKind;b.setAttribute('aria-current',String(obj===this.selected));b.title=obj.name;b.onclick=()=>this.select(obj);
   const lock=document.createElement('button');lock.type='button';lock.className='scene-item-lock';lock.dataset.uiIcon=isTransformLocked(obj)?'lock':'unlock';lock.dataset.locked=String(isTransformLocked(obj));lock.setAttribute('aria-pressed',String(isTransformLocked(obj)));lock.setAttribute('aria-label',(isTransformLocked(obj)?'Unlock ':'Lock ')+obj.name+' transforms');lock.title=(isTransformLocked(obj)?'Unlock':'Lock')+' transforms · '+obj.name;lock.disabled=!this.canEdit(obj);lock.onclick=()=>this.toggleTransformLock(obj);
   const remove=document.createElement('button');remove.className='scene-item-delete';remove.textContent='';remove.dataset.uiIcon='delete';remove.title='Delete '+obj.name;remove.setAttribute('aria-label','Delete '+obj.name);remove.disabled=!this.canEdit(obj);remove.onclick=()=>{this.select(obj);this.remove();};
   if(byId('scenePanel').classList.contains('bulk-mode'))row.append(check);row.append(b,lock,remove);return row;
  };
  const {folders,ungrouped}=groupSceneItems(visible);
  for(const folder of folders){
   const box=document.createElement('div');box.className='scene-collection';box.dataset.collectionId=folder.id;
   const heading=document.createElement('div');heading.className='scene-collection-heading'+(this.activeCollectionId===folder.id?' is-target':'');
   const expanded=this.collectionExpanded.has(folder.id)||folder.items.some(o=>o===this.selected);
   const toggle=document.createElement('button');toggle.type='button';toggle.className='scene-collection-toggle';
   const label=folder.name;
   toggle.textContent=(expanded?'▾ ':'▸ ')+label+` (${folder.items.length})`;toggle.title=label;toggle.setAttribute('aria-expanded',String(expanded));
   toggle.onclick=()=>{if(expanded)this.collectionExpanded.delete(folder.id);else this.collectionExpanded.add(folder.id);this.refreshList();};
   const move=document.createElement('button');move.type='button';move.className='scene-collection-action';move.textContent='Move';move.title='One translate/rotate/scale gizmo for all editable collection members';move.disabled=!this.canMoveCollection(this.collectionMembers(folder.id));move.onclick=()=>this.selectCollection(folder.id);
   const rename=document.createElement('button');rename.type='button';rename.className='scene-collection-action';rename.textContent='Rename';rename.disabled=!this.collectionMembers(folder.id).every(o=>this.canEdit(o));rename.onclick=()=>this.renameCollection(folder.id);
   const ungroup=document.createElement('button');ungroup.type='button';ungroup.className='scene-collection-action';ungroup.textContent='Ungroup';ungroup.disabled=!this.collectionMembers(folder.id).every(o=>this.canEdit(o)&&cleanSceneCollection(o.userData.sceneCollection));ungroup.onclick=()=>this.ungroupCollection(folder.id);
   heading.append(toggle,move,rename,ungroup);box.append(heading);
   if(expanded){const children=document.createElement('div');children.className='scene-collection-members';folder.items.forEach(o=>children.append(makeRow(o)));box.append(children);}
   list.append(box);
  }
  for(const obj of ungrouped)list.append(makeRow(obj));
  this.updateBulkControls();
 }
 updateBulkControls(){const visible=this.visibleSceneItems().filter(o=>this.canEdit(o));const n=this.items.filter(o=>this.bulkChecked.has(o.userData.editorId)&&this.canEdit(o)).length;byId('sceneGroupSelected').disabled=n<2;byId('sceneDeleteSelected').disabled=n===0;byId('sceneDeleteSelected').textContent=`Delete ${n||'selected'}`;byId('sceneDeleteAll').disabled=!this.items.some(o=>this.canEdit(o));byId('sceneSelectAll').checked=visible.length>0&&visible.every(o=>this.bulkChecked.has(o.userData.editorId));byId('sceneSelectAll').indeterminate=visible.some(o=>this.bulkChecked.has(o.userData.editorId))&&!byId('sceneSelectAll').checked;}
 async removeBulk(all){const targets=this.items.filter(o=>this.canEdit(o)&&(all||this.bulkChecked.has(o.userData.editorId)));if(!targets.length)return;
  if(readDeleteConfirmation()&&!await confirmAction(`Delete ${targets.length} ${all?'editable objects from this room':'selected objects'}? This cannot be undone.`,{title:'Delete scene objects',confirmLabel:'Delete',danger:true}))return;
  // Respect ownership on each object and persist each deletion to the room backend.
  for(const o of targets){if(!this.items.includes(o))continue;this.selected=o;await this.remove(true);this.bulkChecked.delete(o.userData.editorId);}this.selected=null;this.updateInspector();this.refreshList();this.toast(`Deleted ${targets.length} objects`);}

 async remove(skipConfirmation=false){if(!this.selected)return;
  const deleting=this.selected;
  if(!skipConfirmation&&readDeleteConfirmation()&&!await confirmAction(`Delete object "${deleting.name}" from the shared scene?`,{title:'Delete scene object',confirmLabel:'Delete',danger:true}))return;
  if(this.selected!==deleting||!this.items.includes(deleting))return;this.clearLightHelper();if(!this.canEdit(this.selected))return this.toast('Owner only');const o=this.selected;const before=this.snapshot(o);if(['fridge','bin'].includes(o.userData.furniture?.variant))this.inventory.releaseContainer(o);for(const bot of this.items){if(bot.userData.robotSeatedTarget===o.userData.editorId)standUp(bot,this);}if(this.infrastructureDrawing?.editTarget===o)cancelInfrastructureDrawing(this,{keepTarget:true});if(this.wallEditTarget===o)this.endWallDrawing();this.transform.detach();this.items=this.items.filter(x=>x!==o);this.world.scene.remove(o);this.physics.remove(o.userData.editorId);this.disposeObject(o);this.selected=null;this.updateInspector();byId('propertiesPanel').hidden=true;this.refreshList();this.recordEdit(before,null);this.persistRemoval(o.userData.editorId);}
 texture(name){if(!this.selected||this.selected.userData.editorKind==='robot'||!this.canEdit(this.selected))return;
  const obj=this.selected;
  if(obj.userData.editorKind==='stairs'){
   const supported=['none','wood','marble','granite','concrete','bricks'];
   if(!supported.includes(name)){this.toast('Stairs use a procedural surface texture: choose None, Wood, Marble, Granite, Concrete or Bricks.');return;}
   const state=obj.userData.stairs||{};rebuildOfficeStairs(obj,{...state,surface:{...state.surface,texture:name}});this.physics.sync(obj);this.queueSave(obj);return;
  }
  obj.userData.textureName=name;this.assignTexture(name==='none'?null:makeTexture(name));}
 assignTexture(tex){if(!this.selected||!this.canEdit(this.selected)||this.selected.userData.editorKind==='robot')return;this.selected.userData.textureName=this.selected.userData.textureName||'custom';this.queueSave(this.selected);this.selected.traverse(o=>{if(o.material?.isMeshStandardMaterial){if(o.material.map&&o.material.map!==tex)o.material.map.dispose();o.material.map=tex;o.material.needsUpdate=true;}});}
  updateMediaHUDPosition(){const hud=byId('mediaInteractionHud');if(!hud)return;const obj=this.selected;if(!obj||obj.userData?.editorKind!=='media'){hud.hidden=true;return;}const pos=obj.getWorldPosition(new THREE.Vector3());pos.y+=0.9;pos.project(this.world.camera);if(pos.z>1){hud.hidden=true;return;}const rect=this.world.renderer.domElement.getBoundingClientRect();const x=(pos.x*.5+.5)*rect.width+rect.left,y=(-pos.y*.5+.5)*rect.height+rect.top;hud.style.left=`${x}px`;hud.style.top=`${y}px`;hud.hidden=false;byId('mediaHudPlay').textContent=sceneMediaPlaying(obj)?'Pause':'Play';byId('mediaHudMute').textContent=sceneMediaMuted(obj)?'Unmute':'Mute';}

  serialize(){return this.items.filter(o=>!o.userData.temporaryCarryTest).map(o=>({id:o.userData.editorId,kind:o.userData.editorKind,name:o.name,collection:o.userData.editorKind==='robot'?undefined:(cleanSceneCollection(o.userData.sceneCollection)||undefined),collectionOptOut:o.userData.sceneCollectionOptOut===true?true:undefined,position:xyz(o.userData.carryOrigin?.position||o.position),rotation:xyz(o.userData.carryOrigin?.rotation||o.rotation),scale:xyz(o.scale),color:o.material?.color?'#'+o.material.color.getHexString():null,texture:o.userData.textureName||'none',owner:o.userData.ownerId||null,avatar:o.userData.avatarUrl||undefined,seating:o.userData.editorKind==='robot'&&o.userData.robotSeated?structuredClone(o.userData.robotSeatState):undefined,light:o.userData.editorKind==='light'?cleanLightSettings(o.userData.light):undefined,physics:['robot','light'].includes(o.userData.editorKind)?undefined:physicsOptions(o.userData.physics),pickable:canBePickable(o.userData.editorKind)?o.userData.pickable===true:undefined,followHandRotation:canBePickable(o.userData.editorKind)?o.userData.followHandRotation!==false:undefined,inventory:canBePickable(o.userData.editorKind)&&o.userData.pickable===true?cleanInventory(o.userData.inventory):undefined,storage:canBePickable(o.userData.editorKind)&&o.userData.pickable===true?cleanStorage(o.userData.storage):undefined,climbable:canBeClimbable(o.userData.editorKind)?o.userData.climbable===true:undefined,strafeSpeed:o.userData.editorKind==='robot'?(o.userData.robotStrafeSpeed??2.5):undefined,speed:o.userData.editorKind==='robot'?(o.userData.robotSpeed??1.8):undefined,runMultiplier:o.userData.editorKind==='robot'?(o.userData.robotRunMultiplier??2.8):undefined,turnSpeed:o.userData.editorKind==='robot'?(o.userData.robotTurnSpeed??4):undefined,climbSpeed:o.userData.editorKind==='robot'?(o.userData.robotClimbSpeed??1.25):undefined,backpackEnabled:o.userData.editorKind==='robot'?o.userData.backpackEnabled===true:undefined,combat:o.userData.editorKind==='robot'?combatSettings(o.userData.robotCombat):undefined,animationSpeed:o.userData.editorKind==='robot'?animationSpeedSettings(o.userData.robotAnimationSpeed):undefined,throwSettings:o.userData.editorKind==='robot'?cleanThrowSettings(o.userData.robotThrowSettings):undefined,transformLocked:isTransformLocked(o),brain:o.userData.editorKind==='robot'?(o.userData.robotBrain||{}):undefined,model:o.userData.editorKind==='model'?o.userData.modelUrl:undefined,media:o.userData.editorKind==='media'?structuredClone(o.userData.media||{}):undefined,primitive:PRIMITIVE_FIELDS[o.userData.editorKind]?structuredClone(o.userData.primitive||sanitisePrimitive(o.userData.editorKind)):undefined,curve:o.userData.editorKind==='curve'?structuredClone(cleanCurve(o.userData.curve)):undefined,text:o.userData.editorKind==='text'?structuredClone(cleanText(o.userData.text)):undefined,openings:o.userData.editorKind==='cube'?cleanOpenings(o.userData.openings):undefined,wall:o.userData.editorKind==='wall'?structuredClone(o.userData.wall):undefined,stairs:o.userData.editorKind==='stairs'?structuredClone(o.userData.stairs):undefined,ladder:o.userData.editorKind==='ladder'?structuredClone(o.userData.ladder):undefined,furniture:o.userData.editorKind==='furniture'?structuredClone(o.userData.furniture):undefined,portal:o.userData.editorKind==='portal'?cleanPortal(o.userData.portal):undefined}));}
 beginRealmTransition(room,previousRoom){
  this.clearCollectionTarget();this.collectionExpanded.clear();
  // Finish old-room debounced saves before changing scene identity. A delayed
  // write must never end up in whichever room is active 650ms later.
  this.flushPendingRoomSaves(previousRoom);
  this.realmTransitioning=room;
  this.sceneLoadTicket=(this.sceneLoadTicket||0)+1;this.lastSmartPlacement=null;
  this.controlledRobotId=null;this.remoteInput.clear();this.remoteCorrections.clear();this.remoteRobotMotion.clear();this.sentRobotMotion.clear();this.robotKeys.clear();
  this.localRobotInput=null;this.transform.detach();
  // A previous realm's collision world must not keep stepping as scene meshes
  // are removed. The room policy is restored only after the scene has arrived.
  void this.physics.setEnabled(false);
 }
 endRealmTransition(room){
  if(this.realmTransitioning!==room)return;
  this.realmTransitioning=null;
  if(window.solviRoomPolicy?.physics){
   this.physics.setEnabled(true).catch(error=>this.toast('Physics unavailable: '+error.message));
  }
 }
 beginSceneReplacement(){this.clearCollectionTarget();this.collectionExpanded.clear();this.lastSmartPlacement=null;if(this.infrastructureDrawing)cancelInfrastructureDrawing(this);this.cancelSpatialDrawing?.();clearAllRobotPathDebug(this.world);this.history.clear();this.clearLightHelper();for(const o of [...this.items]){this.transform.detach();this.world.scene.remove(o);this.disposeObject(o);}this.items=[];this.liftCeilingSignature=null;this.selected=null;this.controlledRobotId=null;this.robotKeys.clear();this.sceneRestorePhysics=this.physics.enabled;this.physics.clear();this.carry.clearTrajectory();byId('propertiesPanel').hidden=true;}
 addSceneEntry(entry){if(!kinds.includes(entry.kind))return;const o=objectFor(entry.kind);o.userData.editorId=entry.id;o.name=entry.name||o.name;o.userData.sceneCollection=cleanSceneCollection(entry.collection);o.userData.sceneCollectionOptOut=entry.collectionOptOut===true;o.userData.ownerId=entry.owner||null;o.userData.transformLocked=entry.transformLocked===true;o.userData.avatarUrl=entry.avatar||DEFAULT_ROBOT_AVATAR;if(entry.kind==='robot'&&entry.seating){o.userData.robotSeatState=structuredClone(entry.seating);o.userData.robotSeatedTarget=entry.seating.targetId;o.userData.robotSeatSlot=entry.seating.slot??0;o.userData.robotSeated=true;o.userData.robotSitPose='procedural';o.userData.robotMode='idle';}o.userData.robotSpeed=entry.speed??1.8;o.userData.robotRunMultiplier=entry.runMultiplier??2.8;o.userData.robotStrafeSpeed=entry.strafeSpeed??2.5;o.userData.robotTurnSpeed=entry.turnSpeed??4;o.userData.robotClimbSpeed=entry.climbSpeed??1.25;o.userData.robotBrain=structuredClone(entry.brain||{});o.userData.robotCombat=combatSettings(entry.combat);o.userData.robotAnimationSpeed=animationSpeedSettings(entry.animationSpeed);o.userData.robotThrowSettings=cleanThrowSettings(entry.throwSettings);o.userData.physics=physicsOptions(entry.physics||(['ladder','furniture'].includes(entry.kind)?{mode:'static'}:undefined));o.userData.pickable=entry.pickable===true&&canBePickable(entry.kind);o.userData.followHandRotation=entry.followHandRotation!==false;o.userData.inventory=cleanInventory(entry.inventory);o.userData.storage=cleanStorage(entry.storage);o.userData.climbable=entry.climbable===true&&canBeClimbable(entry.kind);if(entry.kind==='light')setLight(o,entry.light||{});if(entry.kind==='robot')o.userData.backpackEnabled=entry.backpackEnabled===true;if(entry.kind==='model')o.userData.modelUrl=entry.model;if(entry.kind==='media')o.userData.media=structuredClone(entry.media||{});if(entry.kind==='curve'){o.userData.curve=cleanCurve(entry.curve);o.geometry.dispose();o.geometry=buildCurveGeometry(o.userData.curve);}if(entry.kind==='text')rebuildText(o,entry.text,()=>{if(this.items.includes(o))this.physics.sync(o);});if(entry.kind==='wall')rebuildOfficeWall(o,entry.wall||{},this.liftObjects());if(entry.kind==='stairs')rebuildOfficeStairs(o,entry.stairs||{});if(entry.kind==='ladder')rebuildLadder(o,entry.ladder||{});if(entry.kind==='furniture'){rebuildFurniture(o,entry.furniture||{});syncEquipmentMedia(o,this);}if(entry.kind==='portal')rebuildPortal(o,entry.portal||{});if(PRIMITIVE_FIELDS[entry.kind]){o.userData.primitive=sanitisePrimitive(entry.kind,entry.primitive);const previous=o.geometry;o.userData.openings=entry.kind==='cube'?cleanOpenings(entry.openings):undefined;o.geometry=entry.kind==='cube'?cutCubeGeometry(o.userData.primitive,o.userData.openings):buildPrimitive(entry.kind,o.userData.primitive);previous?.dispose();}
   o.position.fromArray(entry.position);o.rotation.fromArray(entry.rotation);o.scale.fromArray(entry.scale);
   if(entry.kind==='stairs'&&o.userData.stairs?.variant==='lift'){
    const lift=o.userData.stairs.lift,h=Number(lift.currentHeight)||0;
    const baseY=safeLiftMotion(lift.motion)?liftBaseY(o.position.y,h):legacyLiftBaseY(o.position.y,h);
    o.userData.stairRuntime={baseY,height:h,target:lift.target,moving:!!lift.motion?.active,motion:safeLiftMotion(lift.motion),authority:false,commanded:true};
    o.position.y=baseY+h;for(const child of o.children)if(child.userData.stairShaft)child.position.y=-h;updateLiftPanel(o);
   }
   if(entry.color&&o.material?.color)o.material.color.set(entry.color);
   o.userData.textureName=entry.texture||'none';if(entry.texture&&entry.texture!=='none'&&entry.texture!=='custom')o.traverse(x=>{if(x.material?.isMeshStandardMaterial){x.material.map=makeTexture(entry.texture);x.material.needsUpdate=true;}});
   this.items.push(o);this.world.scene.add(o);if(entry.kind==='furniture')syncEquipmentMedia(o,this);if(entry.kind==='robot')hydrateRobot(o);if(entry.kind==='model')hydrateSceneModel(o);if(entry.kind==='media')hydrateSceneMedia(o,this.world);this.physics.sync(o);if(o.userData.storage)this.inventory.applyState(o);}
 endSceneReplacement(){for(const obj of this.items)if(obj.userData.editorKind==='furniture')syncEquipmentMedia(obj,this);restoreSeatedRobots(this);repairLoadedRobotElevation(this);this.inventory.reconcile();this.refreshList();if(this.sceneRestorePhysics&&!this.realmTransitioning)this.physics.setEnabled(true).catch(e=>this.toast('Physics unavailable: '+e.message));}
 apply(data){this.beginSceneReplacement();for(const entry of data)this.addSceneEntry(entry);this.endSceneReplacement();}
 async applyCooperatively(data,stillCurrent){
  // Both disposal and hydration are chunked. Removing a large room in one
  // synchronous loop can stall the Chromium renderer as readily as creating it.
  const batch=3,previous=[...this.items];
  // Timers yield even when requestAnimationFrame is throttled during a heavy
  // scene replacement; this keeps navigation and the browser UI responsive.
  const yieldMain=()=>new Promise(resolve=>setTimeout(resolve,0));
  this.cancelSpatialDrawing?.();clearAllRobotPathDebug(this.world);
  this.history.clear();this.clearLightHelper();this.transform.detach();this.carry.clearTrajectory();
  this.items=[];this.lastSmartPlacement=null;this.liftCeilingSignature=null;this.selected=null;this.sceneRestorePhysics=this.physics.enabled;
  this.physics.clear();this.carry.clearTrajectory();byId('propertiesPanel').hidden=true;
  for(let i=0;i<previous.length;i++){
   const old=previous[i];this.world.scene.remove(old);this.disposeObject(old);
   if(i%batch===batch-1)await yieldMain();
  }
  if(!stillCurrent())return false;
  for(let i=0;i<data.length;i++){
   if(!stillCurrent())return false;
   this.addSceneEntry(data[i]);
   if(i%batch===batch-1)await yieldMain();
  }
  if(!stillCurrent())return false;this.endSceneReplacement();return true;
 }

 disposeObject(obj){
  if(obj.userData.editorKind==='furniture')disposeEquipmentMedia(obj);
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
   if(!current)return;for(const bot of this.items){if(bot.userData.robotSeatedTarget===id)standUp(bot,this);}this.physics.remove(id);
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
  obj.name=entry.name||obj.name;obj.userData.sceneCollection=cleanSceneCollection(entry.collection);obj.userData.sceneCollectionOptOut=entry.collectionOptOut===true;obj.userData.ownerId=entry.owner||null;obj.userData.transformLocked=entry.transformLocked===true;
  const oldTexture=obj.userData.textureName||'none',newTexture=entry.texture||'none';
  // Scene persistence is a checkpoint, not an animation frame. Never rewind
  // a locally driven or currently predicted remote robot to a stale save.
  const movingRemote=this.remoteInput.get(id);
  const preserveRobotPose=!isNew&&entry.kind==='robot'&&(
    (movingRemote&&performance.now()-movingRemote.received<2400)||
    (this.remoteRobotMotion.get(id)&&performance.now()-this.remoteRobotMotion.get(id).received<2300)||
    (this.canEdit(obj)&&Boolean(obj.userData.robotGoal||obj.userData.robotMission))||
    (this.controlMode==='robot'&&this.selected===obj&&this.canEdit(obj))||
    Boolean(obj.userData.robotImpactVelocity));
  const incomingLift=entry.kind==='stairs'&&entry.stairs?.variant==='lift';
  const liftBefore=incomingLift&&!isNew?obj.userData.stairRuntime:null;
  const priorLiftBaseY=liftBefore?.baseY;
  if(!preserveRobotPose){obj.position.fromArray(entry.position);obj.rotation.fromArray(entry.rotation);}
  // Live transport commands take priority over slower scene revision/checkpoint
  // messages. Never rewind a new Start/Stop/Reverse to an older saved snapshot.
  let incomingStairs=entry.stairs;
  if(entry.kind==='stairs'&&!isNew&&['walkway','escalator'].includes(entry.stairs?.variant)){
   const previous=obj.userData.stairs?.transport,latest=Number(previous?.changedAt)||0;
   if(latest>(Number(entry.stairs?.transport?.changedAt)||0))
    incomingStairs={...entry.stairs,transport:structuredClone(previous)};
  }
  obj.scale.fromArray(entry.scale);if(entry.kind==='wall'&&JSON.stringify(obj.userData.wall)!==JSON.stringify(entry.wall))rebuildOfficeWall(obj,entry.wall||{});if(entry.kind==='stairs'){if(stairGeometryKey(obj.userData.stairs)!==stairGeometryKey(incomingStairs))rebuildOfficeStairs(obj,incomingStairs||{});else if(incomingStairs)obj.userData.stairs=structuredClone(incomingStairs);if(['walkway','escalator'].includes(incomingStairs?.variant))updateConveyorControls(obj);}if(incomingLift){
   const cfg=obj.userData.stairs?.lift;const motion=safeLiftMotion(cfg?.motion);
   const height=Number(cfg?.currentHeight)||0;
   const oldMotion=liftBefore?.motion;
   if(oldMotion&&motion&&oldMotion.startedAt>motion.startedAt){
    cfg.motion=oldMotion;cfg.target=liftBefore.target;
   }
   const effective=safeLiftMotion(cfg?.motion);
   const baseY=priorLiftBaseY??(effective?liftBaseY(obj.position.y,height):legacyLiftBaseY(obj.position.y,height));
   const runtime=liftBefore||{height,baseY,authority:false};
   if(oldMotion&&effective&&effective.startedAt>oldMotion.startedAt)runtime.authority=false;
   runtime.baseY=baseY;runtime.motion=effective;runtime.target=effective?.target??cfg.target;runtime.commanded=!!effective;runtime.moving=!!effective?.active;
   runtime.height=effective?liftHeightAt(effective,cfg.levelHeight,cfg.levels):height;
   obj.userData.stairRuntime=runtime;cfg.currentHeight=runtime.height;obj.position.y=baseY+runtime.height;
   for(const child of obj.children)if(child.userData.stairShaft)child.position.y=-runtime.height;
   updateLiftPanel(obj);
  }
  // Incremental update: do not leave old procedural children behind on peers.
  if(entry.kind==='furniture'){
   const effective=sanitiseFurniture(entry.furniture||{});
   if(JSON.stringify(obj.userData.furniture)!==JSON.stringify(effective)){
    disposeEquipmentMedia(obj);rebuildFurniture(obj,effective);
   }
   syncEquipmentMedia(obj,this);
  }
  if(entry.kind==='portal'&&JSON.stringify(obj.userData.portal)!==JSON.stringify(cleanPortal(entry.portal)))rebuildPortal(obj,entry.portal||{});if(entry.kind==='curve'&&JSON.stringify(obj.userData.curve)!==JSON.stringify(cleanCurve(entry.curve))){obj.userData.curve=cleanCurve(entry.curve);obj.geometry.dispose();obj.geometry=buildCurveGeometry(obj.userData.curve);}if(entry.kind==='text'&&(isNew||JSON.stringify(obj.userData.text)!==JSON.stringify(cleanText(entry.text))))rebuildText(obj,entry.text,()=>{if(this.items.includes(obj))this.physics.sync(obj);});if(PRIMITIVE_FIELDS[entry.kind]){const next=sanitisePrimitive(entry.kind,entry.primitive),holes=entry.kind==='cube'?cleanOpenings(entry.openings):[];if(JSON.stringify(obj.userData.primitive)!==JSON.stringify(next)||JSON.stringify(obj.userData.openings||[])!==JSON.stringify(holes)){const prior=obj.geometry;obj.geometry=entry.kind==='cube'?cutCubeGeometry(next,holes):buildPrimitive(entry.kind,next);prior?.dispose();}obj.userData.primitive=next;if(entry.kind==='cube')obj.userData.openings=holes;}
  if(entry.color&&entry.kind!=='model'&&entry.kind!=='media'&&entry.kind!=='furniture'){obj.traverse(node=>{if(node.material?.color&&node.userData.editorKind!=='robot'){
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
  if(entry.kind==='light')setLight(obj,entry.light||{});obj.userData.robotSpeed=entry.speed??1.8;obj.userData.robotRunMultiplier=entry.runMultiplier??2.8;obj.userData.robotStrafeSpeed=entry.strafeSpeed??2.5;obj.userData.robotTurnSpeed=entry.turnSpeed??4;obj.userData.robotClimbSpeed=entry.climbSpeed??1.25;obj.userData.robotBrain=structuredClone(entry.brain||{});obj.userData.backpackEnabled=entry.backpackEnabled===true;obj.userData.robotCombat=combatSettings(entry.combat);obj.userData.robotAnimationSpeed=animationSpeedSettings(entry.animationSpeed);obj.userData.robotThrowSettings=cleanThrowSettings(entry.throwSettings);obj.userData.pickable=entry.pickable===true&&canBePickable(entry.kind);obj.userData.followHandRotation=entry.followHandRotation!==false;obj.userData.inventory=cleanInventory(entry.inventory);obj.userData.storage=cleanStorage(entry.storage);obj.userData.physics=physicsOptions(entry.physics);this.physics.sync(obj);
  if(entry.kind==='model'&&(isNew||obj.userData.modelUrl!==entry.model)){if(!isNew)invalidateSceneModel(obj);obj.userData.modelUrl=entry.model;hydrateSceneModel(obj);}
  if(entry.kind==='media'){const incoming=entry.media||obj.userData.media||{};const changed=isNew||JSON.stringify(obj.userData.media)!==JSON.stringify(incoming);if(changed){obj.userData.media=structuredClone(incoming);if(!isNew)disposeSceneMedia(obj);hydrateSceneMedia(obj,this.world);}}
  if(entry.kind==='robot'&&!(this.controlMode==='robot'&&this.selected===obj&&this.canEdit(obj))){
   // Apply seated state even while remote movement packets are still fresh;
   // pose prediction is independent from the persisted seating relationship.
   const seat=entry.seating;
   if(seat){obj.userData.robotSeatState=structuredClone(seat);obj.userData.robotSeatedTarget=seat.targetId;obj.userData.robotSeatSlot=seat.slot??0;obj.userData.robotSeated=true;obj.userData.robotSitPose=sittingClip(obj.userData.robotAvailableActions||[])?'clip':'procedural';obj.userData.robotMode=sittingClip(obj.userData.robotAvailableActions||[])||'idle';obj.userData.robotPlaying=null;}
   else if(obj.userData.robotSeated){obj.userData.robotSeated=false;obj.userData.robotSeatState=null;obj.userData.robotSeatedTarget=null;obj.userData.robotSitPose=null;obj.userData.robotMode='idle';}
  }
  if(entry.kind==='robot'&&(isNew||obj.userData.avatarUrl!==avatar)){
   obj.userData.avatarUrl=avatar;
   if(!isNew){for(const child of [...obj.children])if(!child.userData.robotPlaceholder)obj.remove(child);
    obj.userData.robotReady=false;}
   hydrateRobot(obj);
  }
  if(this.selected===obj){
   if(isTransformLocked(obj)&&this.transform.object===obj)this.transform.detach();
   if(isEditMode()&&!isTransformLocked(obj)&&this.canTransform(obj)&&obj.userData.editorKind!=='robot'&&this.transform.object!==obj)this.transform.attach(obj);
   if(byId('propertiesPanel')&&!byId('propertiesPanel').hidden)this.updateInspector();
  }
  if(entry.storage)this.inventory.applyState(obj);else obj.visible=true;
  this.inventory.render();this.refreshList();
 }
 sceneDiagnostic(event,data={}){
  window.dispatchEvent?.(new CustomEvent('solvi:room-diagnostic',{detail:{event,room:window.solviRoom||'main',...data}}));
 }
 acceptRemoteRevision(message){
  const revision=Number(message?.revision)||0;
  if(revision<=this.revision)return;
  if(revision>this.revision+1){
   this.sceneDiagnostic('scene-revision-gap',{revision,expected:this.revision+1,action:message.action||'bulk'});
   void this.load({quiet:true,reason:'revision-gap'});return;
  }
  this.revision=revision;
  if(message?.action&&message.action!=='bulk'){
   const id=message.id||message.object?.id;
   // Never replace an unacknowledged local edit with a remote checkpoint.
   if(this.dirtyGenerations.has(id)||this.pendingRemovals.has(id)){
    this.sceneDiagnostic('scene-conflict-preserved',{revision,id,kind:message.object?.kind||'',action:message.action});
    return;
   }
   this.applyObjectPatch(message);
   this.sceneDiagnostic('scene-object-applied',{revision,id,kind:message.object?.kind||'',action:message.action});return;
  }
  void this.load({quiet:true,reason:'bulk-revision'});
 }
 async load({quiet=false,reason='manual-load'}={}){const ticket=this.sceneLoadTicket=(this.sceneLoadTicket||0)+1;const api=window.solviAPI;const local=localStorage.getItem('solvi-scene-'+(window.solviRoom||'main')); 
  if(!api?.online){if(local)this.apply(JSON.parse(local));if(!quiet)this.toast('Local scene loaded (not shared)');this.sceneDiagnostic('scene-local-only',{reason});return;}
  try{
   const room=window.solviRoom||'main';
   const data=await api.req('/api/scene?room='+encodeURIComponent(room));
   if(ticket!==this.sceneLoadTicket||room!==(window.solviRoom||'main'))return;
   const safety=validateSceneSnapshot(data,{localCount:this.items.length,sameRoom:this.lastLoadedRoom===room&&!this.realmTransitioning});
   if(!safety.ok){this.sceneDiagnostic('scene-snapshot-rejected',{reason:safety.reason,count:data?.objects?.length??-1});throw Error(safety.reason);}
   // An older GET must never roll back a newer saved object or received revision.
   if(data.revision<this.revision){this.sceneDiagnostic('scene-stale-snapshot',{revision:data.revision,expected:this.revision,reason});return;}
   this.revision=Math.max(this.revision,data.revision);
   if(this.items.length&&(this.lastLoadedRoom===room||(!this.realmTransitioning&&this.dirtyGenerations.size))){
    // Merge revisions without destroying every GLB and its animation mixer.
    const next=new Set((data.objects||[]).map(o=>o.id));
    for(const entry of data.objects||[])if(!this.dirtyGenerations.has(entry.id)&&!this.pendingRemovals.has(entry.id))this.applyObjectPatch({action:'upsert',object:entry});
    for(const old of [...this.items])if(!next.has(old.userData.editorId)&&!this.dirtyGenerations.has(old.userData.editorId)&&!this.pendingRemovals.has(old.userData.editorId))this.applyObjectPatch({action:'remove',id:old.userData.editorId});
   }else if(!await this.applyCooperatively(data.objects||[],()=>ticket===this.sceneLoadTicket&&room===(window.solviRoom||'main')))return;
   if(ticket!==this.sceneLoadTicket||room!==(window.solviRoom||'main'))return;
   this.lastLoadedRoom=room;
   // A local read-only emergency copy may assist recovery if server data is later lost.
   // Quota failure must never interfere with the 3D application.
   try{if(data.objects.length){const backup=JSON.stringify(data);if(backup.length<3000000)localStorage.setItem('solvi-scene-last-good-'+room,backup);}}catch{}
   this.sceneDiagnostic('scene-reconciled',{revision:this.revision,count:data.objects.length,reason});
   if(!quiet)this.toast('Shared scene loaded');
  }catch(e){this.sceneDiagnostic('scene-fetch-failed',{reason:e.message});this.toast('Scene sync failed: '+e.message);}}
 async save(){const room=window.solviRoom||'main',api=window.solviAPI;
  if(!api?.online){localStorage.setItem('solvi-scene-'+room,JSON.stringify(this.serialize()));this.toast('Scene saved locally (not shared)');return;}
  // A bulk PUT with a stale peer snapshot may delete somebody else's furniture.
  // The Save button flushes only changed objects via atomic per-object patches.
  const ids=[...this.dirtyGenerations.keys()];
  for(const id of ids){const timer=this.pendingSaves.get(id);if(timer){clearTimeout(timer);this.pendingSaves.delete(id);}}
  const results=await Promise.allSettled(ids.map(id=>{const object=this.items.find(o=>o.userData.editorId===id);return object?this.persistObject(object,room):Promise.resolve();}));
  const failed=results.filter(r=>r.status==='rejected').length+ids.filter(id=>this.dirtyGenerations.has(id)).length;
  this.sceneDiagnostic(failed?'scene-save-partial':'scene-manual-save',{count:ids.length,reason:failed?failed+' changes awaiting successful save':'All changes synchronised'});
  this.toast(failed?`${failed} scene changes are not yet saved. Check Live diagnostics.`:ids.length?'Shared changes saved':'Scene already synchronised');
 }

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
  flushPendingRoomSaves(room){
   if(!room)return;
   for(const [id,timer] of this.pendingSaves){
    clearTimeout(timer);this.pendingSaves.delete(id);
    const object=this.items.find(o=>o.userData.editorId===id);
    if(object)void this.persistObject(object,room);
   }
  }
  queueSave(o){
   if(!o||o.userData.temporaryCarryTest||this.realmTransitioning||!this.canEdit(o))return;
   const id=o.userData.editorId,room=window.solviRoom||'main';
   this.dirtyGenerations.set(id,(this.dirtyGenerations.get(id)||0)+1);
   clearTimeout(this.pendingSaves.get(id));
   this.pendingSaves.set(id,setTimeout(()=>{this.pendingSaves.delete(id);void this.persistObject(o,room);},650));
  }
  async persistObject(o,room=window.solviRoom||'main'){
   if(!o||o.userData.temporaryCarryTest||!this.items.includes(o)||!this.canEdit(o))return false;
   const id=o.userData.editorId,key=room+':'+id;
   const prior=this.inFlightSaves.get(key);
   if(prior){await prior.catch(()=>{});if(!this.dirtyGenerations.has(id))return true;}
   if(!this.items.includes(o)||!this.canEdit(o))return false;
   const generation=this.dirtyGenerations.get(id)||0,data=this.snapshot(o),api=window.solviAPI;
   if(!data)return false;
   if(!api?.online){localStorage.setItem('solvi-scene-'+room,JSON.stringify(this.serialize()));return false;}
   const task=api.req('/api/scene/object',{method:'POST',body:JSON.stringify({room,action:'upsert',object:data})});
   this.inFlightSaves.set(key,task);
   try{
    const result=await task;
    if(room===(window.solviRoom||'main')){
     const old=this.revision;this.revision=Math.max(old,result.revision||0);
     if(result.revision>old+1)void this.load({quiet:true,reason:'save-ack-revision-gap'});
    }
    if(this.dirtyGenerations.get(id)===generation)this.dirtyGenerations.delete(id);
    this.retrySaveCounts.delete(key);
    this.sceneDiagnostic('scene-object-saved',{room,id,kind:data.kind,name:data.name,revision:result.revision,action:'upsert'});
    return true;
   }catch(error){
    const reason=String(error?.message||error);
    this.sceneDiagnostic('scene-save-failed',{room,id,kind:data.kind,name:data.name,action:'upsert',reason});
    this.toast('Scene object NOT saved: '+data.name+' · '+reason);
    const count=(this.retrySaveCounts.get(key)||0)+1;this.retrySaveCounts.set(key,count);
    const permanent=/invalid|unsupported|owner|owned|forbidden|limit reached|unknown|too long|missing uploaded|not found/i.test(reason);
    if(!permanent&&count<=3&&room===(window.solviRoom||'main')){
     clearTimeout(this.pendingSaves.get(id));
     const delays=[1500,3500,7500];
     this.pendingSaves.set(id,setTimeout(()=>{this.pendingSaves.delete(id);if(this.items.includes(o))void this.persistObject(o,room);},delays[count-1]));
     this.sceneDiagnostic('scene-save-retry',{room,id,kind:data.kind,attempt:count,seconds:delays[count-1]/1000});
    }
    return false;
   }finally{if(this.inFlightSaves.get(key)===task)this.inFlightSaves.delete(key);}
  }
  async persistRemoval(id){
   const room=window.solviRoom||'main',api=window.solviAPI;this.pendingRemovals.add(id);
   if(!api?.online){localStorage.setItem('solvi-scene-'+room,JSON.stringify(this.serialize()));return;}
   for(let attempt=0;attempt<3;attempt++){
    try{const result=await api.req('/api/scene/object',{method:'POST',body:JSON.stringify({room,action:'remove',object:{id}})});
     if(room===(window.solviRoom||'main'))this.revision=Math.max(this.revision,result.revision||0);
     this.pendingRemovals.delete(id);this.dirtyGenerations.delete(id);
     this.sceneDiagnostic('scene-object-removed',{room,id,action:'remove',revision:result.revision});return;
    }catch(error){this.sceneDiagnostic('scene-remove-failed',{room,id,action:'remove',reason:String(error.message),attempt:attempt+1});
     if(attempt===2){this.toast('Remove NOT saved: '+error.message);return;}
     await new Promise(resolve=>setTimeout(resolve,[1500,3500][attempt]));
    }
   }
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
   // Never simulate the outgoing realm while its objects and physics world are
   // being replaced; normal rendering and UI remain active.
   if(this.realmTransitioning)return;
    const clock=performance.now();
    if(clock-(this.lastLiftCeilingCheck||0)>850){
     this.lastLiftCeilingCheck=clock;
     const lifts=this.liftObjects();
     const signature=JSON.stringify(lifts.map(l=>[l.userData.editorId,[l.position.x,l.position.z],l.rotation.toArray(),l.scale.toArray(),l.userData.stairs?.width,l.userData.stairs?.points]));
     if(signature!==this.liftCeilingSignature){
      this.liftCeilingSignature=signature;
      for(const wall of this.items){
       if(wall.userData.editorKind!=='wall'||!wall.userData.wall?.ceiling?.enabled||!wall.userData.wall.ceiling.autoLiftOpenings)continue;
       rebuildOfficeWall(wall,wall.userData.wall,lifts);this.physics.remove(wall.userData.editorId);this.physics.sync(wall);
      }
      this.world.xrSurfaceCache=null;
     }
    }
    for(const [id,marker] of this.editMarkers){const item=this.items.find(o=>o.userData.editorId===id);if(!item||clock>marker.expires){this.world.scene.remove(marker.sprite);marker.sprite.material.map?.dispose();marker.sprite.material.dispose();this.editMarkers.delete(id);continue;}const bounds=new THREE.Box3().setFromObject(item);marker.sprite.position.copy(bounds.getCenter(new THREE.Vector3()));marker.sprite.position.y=(bounds.isEmpty()?item.position.y+2:bounds.max.y)+.42;}
    if(this.selected&&this.canEdit(this.selected)&&(this.world.editorDragging||this.robotKeys.size)&&clock-this.lastEditPing>2500){this.broadcastEdit(true);this.lastEditPing=clock;}
    if(this.lightHelper&&!byId('propertiesPanel').hidden){this.lightHelper.visible=!this.world.renderer.xr.isPresenting;this.lightHelper.update?.();}
    if(this.lightHelper&&byId('propertiesPanel').hidden)this.clearLightHelper();
    const previousRobotPositions=new Map(this.items.filter(o=>o.userData.editorKind==='robot').map(o=>[o.userData.editorId,{x:o.position.x,z:o.position.z}]));
    const robot=this.controlledRobot?.(),canControl=this.controlMode==='robot'&&robot&&this.canEdit(robot);
    const rawIntent=intent(this.robotKeys);
    const now=performance.now();
    if(canControl&&rawIntent.f&&robot.userData.robotSeated)standUp(robot,this);
    // Retry only on an actual movement attempt, not continuously each frame.
    if(canControl&&rawIntent.f&&!robot.userData.robotSeated&&now-(robot.userData.lastSeatEscapeAttempt||0)>1800){
      robot.userData.lastSeatEscapeAttempt=now;
      if(recoverStandingSeatTrap(robot,this))this.toast('Released avatar from furniture; movement restored');
    }
    if(canControl&&rawIntent.f>0){this.walkHeldSince??=now;}else this.walkHeldSince=null;
    const autoRun=autoRunAfterHold(this.walkHeldSince===null?0:now-this.walkHeldSince,{walking:rawIntent.f>0,airborne:!!(robot?.userData.robotJumpActive||robot?.userData.physicsAirborne),shift:!!rawIntent.r});
    const input=canControl?{...rawIntent,r:Number(autoRun),runMultiplier:robot.userData.robotRunMultiplier??2.8,s:robot.userData.robotSpeed??1.8,q:robot.userData.robotStrafeSpeed??2.5,u:robot.userData.robotTurnSpeed??4,j:Number(this.robotKeys.has('Space'))}:{f:0,t:0,r:0,b:0,s:1.8,q:2.5,u:4,j:0};
    if(canControl&&robot.userData.robotSeated){input.f=0;input.b=0;} // An obstructed stand-up must not walk through the seat collider.
    // Motion intent belongs to a particular robot, not every avatar in the room.
    for(const item of this.items){if(item.userData.editorKind==='robot')item.userData.robotLocalMotion=false;}
    if(canControl){
      const state={x:robot.position.x,z:robot.position.z,yaw:robot.rotation.y,velocity:robot.userData.robotVelocity||0,steer:robot.userData.robotSteer||0,lateral:robot.userData.robotLateral||0};
      const ladderActive=stepLadderRobot(robot,this.items,input.f,dt,{upperSurface:(ladder,bot,target)=>this.physics.landAtLadderTop(ladder,bot,target)});
      const jumping=!!(robot.userData.robotJumpActive||robot.userData.physicsAirborne);
      const motion=ladderActive?{...state,velocity:0,steer:0,lateral:0}:jumping&&robot.userData.robotAirPlan?airStep(state,robot.userData.robotAirPlan,dt):stepRobotMotion(state,input,dt);
      if(!ladderActive){robot.position.x=motion.x;robot.position.z=motion.z;robot.rotation.y=motion.yaw;}
      robot.userData.robotVelocity=motion.velocity;robot.userData.robotSteer=motion.steer;robot.userData.robotLateral=motion.lateral;
      robot.userData.robotLocalMotion=active(input)||Math.abs(motion.velocity)>.04||Math.abs(motion.lateral)>.04;
      const walking=Math.abs(motion.velocity)>.04;const strafing=Math.abs(motion.lateral)>.04;
      if(input.f||input.t||input.j)interruptRobotMission(robot);
      if(!ladderActive&&!robot.userData.robotJumpActive&&robot.userData.jumpVel===undefined&&!robot.userData.physicsAirborne){
       if(!robot.userData.robotMission&&!robot.userData.robotSeated)robot.userData.robotMode=!walking?(strafing?(motion.lateral>0?'strafeLeft':'strafeRight'):'idle'):motion.velocity<0?'walkBackward':(input.r&&motion.velocity>1.4?'run':'walk');
      }
    }
    const previous=this.localRobotInput;
    if(canControl){
      const moving=active(input)||Math.abs(robot.userData.robotVelocity||0)>.04||Math.abs(robot.userData.robotLateral||0)>.04;
      const wasMoving=previous&&(active(previous)||previous.moving);
      const changed=!previous||input.f!==previous.f||input.t!==previous.t||input.r!==previous.r||input.runMultiplier!==previous.runMultiplier||input.b!==previous.b||input.s!==previous.s||input.q!==previous.q||input.u!==previous.u||input.j!==previous.j;
      if(changed||((moving||wasMoving)&&now-this.lastRobotPacket>140)){
        window.solviRoomSocket?.send({...packetFor(robot.userData.editorId,{...input,j:input.j&&!previous?.j?1:0},robot,!moving&&!input.j),seq:++this.robotPacketSeq});
        this.lastRobotPacket=now;
      }
      if(wasMoving&&!moving){this.queueSave(robot);}
      this.localRobotInput={...input,moving};
    }else this.localRobotInput=null;
    // Remote robots integrate the same acceleration and turn-rate equations.
    for(const [id,remote] of this.remoteInput){
      if(this.remoteRobotMotion.has(id))continue;
      const other=this.items.find(o=>o.userData.editorId===id);
      if(!other||now-remote.received>3600){this.remoteInput.delete(id);if(other){other.userData.robotRemoteMotion=false;other.userData.robotMode='idle';other.userData.robotVelocity=0;other.userData.robotSteer=0;other.userData.robotLateral=0;}continue;}
      const state={x:other.position.x,z:other.position.z,yaw:other.rotation.y,velocity:other.userData.robotVelocity||0,steer:other.userData.robotSteer||0,lateral:other.userData.robotLateral||0};
      const remoteClimbing=stepLadderRobot(other,this.items,remote.f,dt,{upperSurface:(ladder,bot,target)=>this.physics.landAtLadderTop(ladder,bot,target)});
      const next=remoteClimbing?{...state,velocity:0,steer:0,lateral:0}:(other.userData.robotJumpActive||other.userData.physicsAirborne)&&other.userData.robotAirPlan?airStep(state,other.userData.robotAirPlan,dt):stepRobotMotion(state,remote,dt);
      if(!remoteClimbing){other.position.x=next.x;other.position.z=next.z;other.rotation.y=next.yaw;}other.userData.robotVelocity=next.velocity;other.userData.robotSteer=next.steer;other.userData.robotLateral=next.lateral;
      other.userData.robotRemoteMotion=Boolean(remote.f||remote.t||Math.abs(next.velocity)>.04||Math.abs(next.lateral)>.04);
      if(!remoteClimbing&&!other.userData.robotSeated&&!other.userData.robotJumpActive&&other.userData.jumpVel===undefined&&!other.userData.physicsAirborne){other.userData.robotMode=Math.abs(next.velocity)<.04?(Math.abs(next.lateral)>.04?(next.lateral>0?'strafeLeft':'strafeRight'):'idle'):next.velocity<0?'walkBackward':(remote.r&&next.velocity>1.4?'run':'walk');}
    }
    // Smooth server-authoritative corrections without reloading the avatar mesh.
    for(const [id,correction] of this.remoteCorrections){
      const obj=this.items.find(o=>o.userData.editorId===id);
      if(!obj){this.remoteCorrections.delete(id);continue;}
      // An attached climber is constrained by the ladder on every client.
      // Old horizontal packet corrections must not pull it out of the rungs.
      if(obj.userData.robotLadderRide||obj.userData.robotSeated){this.remoteCorrections.delete(id);continue;}
      const next=applyRemoteCorrection({x:obj.position.x,z:obj.position.z,yaw:obj.rotation.y},correction,dt);
      obj.position.x=next.x;obj.position.z=next.z;if(!obj.userData.robotJumpActive&&!obj.userData.physicsAirborne)obj.rotation.y=next.yaw;
      if(next.done)this.remoteCorrections.delete(id);else this.remoteCorrections.set(id,next.residual);
    }
    // Playback is intentionally delayed by one or two network packets. It uses
    // measured owner poses rather than re-executing A* on other clients.
    for(const [id,stream] of this.remoteRobotMotion){
      const other=this.items.find(o=>o.userData.editorKind==='robot'&&o.userData.editorId===id);
      if(!other){this.remoteRobotMotion.delete(id);continue;}
      const pose=sampleRobotPose(stream,now);
      if(!pose){this.remoteRobotMotion.delete(id);continue;}
      other.position.set(pose.x,pose.y,pose.z);other.rotation.y=pose.yaw;
      other.userData.robotMode=pose.mode;
      other.userData.robotRemoteMotion=pose.moving;
      if(pose.stale&&now-stream.received>2600){
        other.userData.robotMode='idle';other.userData.robotRemoteMotion=false;
        this.remoteRobotMotion.delete(id);
      }
    }
    tickRobots(this.items,dt,Object.assign((o,arrived)=>{
      if(!this.canEdit(o))return;
      // Scene saves are recovery checkpoints, never animation frames. Live
      // locomotion is published separately below at ~9 snapshots/second.
      if(arrived||o.userData.robotMission&&now-(o.userData.lastMissionSave||0)>5000){
        o.userData.lastMissionSave=now;this.queueSave(o);
      }
    },{navigate:(robot,target)=>this.routeRobot(robot,target),recover:(robot,reason)=>this.recoverRobot(robot,reason),refreshRoute:robot=>this.refreshRobotRoute(robot),checkpoint:(robot,point)=>this.inspectRobotRouteCheckpoint(robot,point),avoidRobot:(robot,other)=>this.avoidMovingRobot(robot,other),push:(robot,other,next,step)=>this.physics.tryPushRobot(robot,other,next,step),retarget:robot=>this.retargetRobot(robot),patrol:(robot,mission)=>this.continueRobotPatrol(robot,mission),restart:(robot,mission)=>this.continueRobotRecovery(robot,mission),seat:(robot,id)=>{const target=this.items.find(o=>o.userData.editorId===id);return target?takeSeat(robot,target,this):false;}}));
    // Move kinematic transport platforms and cabin riders before evaluating
    // character gravity, on both the lift operator and the robot owner's tab.
    tickStairTransport(this,dt);
    this.inventory.tick(dt);
    this.physics.tick(dt);
    followFurnitureSeats(this);
    for(const bot of this.items){const y=bot.userData.liftRemoteTargetY;if(bot.userData.editorKind!=='robot'||!Number.isFinite(y)||this.physics.owns(bot)||bot.userData.liftRide)continue;
     const delta=Math.max(-.16,Math.min(.16,(y-bot.position.y)*Math.min(1,dt*12)));if(Math.abs(delta)>.001){bot.position.y+=delta;const body=this.physics.bodies.get(bot.userData.editorId);if(body){const p=body.translation(),next={x:p.x,y:p.y+delta,z:p.z};body.setTranslation(next,true);body.setNextKinematicTranslation(next);}}
     if(Math.abs(y-bot.position.y)<.02)delete bot.userData.liftRemoteTargetY;
    }
    tickPortals(this,dt);this.updateMountedMedia();
    // Broadcast actually simulated autonomous poses after navigation, physics
    // and transport. Keyboard-controlled robots retain robot-input prediction.
    for(const bot of this.items){
      if(bot.userData.editorKind!=='robot'||!this.canEdit(bot))continue;
      const id=bot.userData.editorId;
      const manual=this.controlMode==='robot'&&this.controlledRobot?.()===bot&&
        (active(input)||Math.abs(bot.userData.robotVelocity||0)>.04);
      // Manual keyboard input is still relayed for responsive prediction, but
      // remote clients also need the owner's Y coordinate on upper floors.
      // Otherwise each browser's independent Rapier gravity can select a
      // different slab and show the same robot on different storeys.
      const moving=manual||Boolean(bot.userData.robotGoal||bot.userData.robotMission);
      const previous=this.sentRobotMotion.get(id);
      // A remote client must never echo another controller's motion snapshots
      // or keyboard input as an additional authoritative sender.
      if(this.remoteRobotMotion.has(id)||this.remoteInput.has(id))continue;
      if(!moving&&!previous)continue;
      if(previous&&now-previous.at<110&&moving)continue;
      const origin=previousRobotPositions.get(id);
      const observedSpeed=origin?Math.hypot(bot.position.x-origin.x,bot.position.z-origin.z)/Math.max(.016,dt):0;
      // Checkpoint camera scans may pause for 1.4s while the mission remains
      // active. Those frames must animate as idle, not walking in place.
      const mode=moving&&observedSpeed>.12?(bot.userData.robotMode==='run'?'run':'walk'):'idle';
      const seq=((previous?.seq||0)%2147483646)+1;
      window.solviRoomSocket?.send(robotPosePacket(bot,seq,mode));
      if(moving)this.sentRobotMotion.set(id,{at:now,seq});
      else this.sentRobotMotion.delete(id); // final idle is sent once
    }
    for(const r of this.items){if(r.userData.editorKind!=='robot')continue;const previous=previousRobotPositions.get(r.userData.editorId);if(!previous)continue;const distance=Math.hypot(r.position.x-previous.x,r.position.z-previous.z);r.userData.robotActualSpeed=distance/Math.max(.016,dt);}
    animateRobots(this.items,dt,(actor,kind,force,remote)=>{
      const hits=this.physics.applyCombat(actor,kind,force,remote);
      if(!remote&&this.selected===actor&&['punch','kick'].includes(kind)&&!hits){
        this.toast('No pushable target hit. Set the target to Dynamic, enable room Physics, and face it within reach.');
      }
      return hits;
    });
    this.carry.tick(dt);
    this.inventory.tick(dt); // Post-animation hand-bone pose for every client.
    for(const item of this.items){if(item.userData.editorKind!=='robot')continue;
      if(item.userData.robotTelemetry&&item.userData.robotMission)sampleMovementTelemetry(item.userData.robotTelemetry,item);
      if(item.userData.robotMission&&this.robotPathDebugVisible(item))trackRobotPathDebug(this.world,item);}
  }
  aimHeldTool(robot,tool){
    if(!this.canEdit(robot)||!this.canEdit(tool)||tool?.userData?.storage?.type!=='held'||tool.userData.storage.holderId!==robot?.userData?.editorId||tool.userData?.furniture?.variant!=='shovel')return false;
    this.toolAim={robotId:robot.userData.editorId,toolId:tool.userData.editorId};
    this.world.renderer.domElement.style.cursor='crosshair';
    // Keep Inventory open even when aiming fails. The next world click or Esc resolves the action.
    this.toast('Aim dig: click ground within 2.8 m · Esc cancels');return true;
  }
  startToolActionAnimation(robot,variant,chosen=''){
    const clip=resolveToolAnimation(variant,robot.userData.robotAvailableActions||[],chosen);
    if(!clip||!robot.userData.robotAnimator?.actions?.has('clip:'+clip)){
      if(variant==='shovel'&&chosen!=='none'){
        robot.userData.robotToolAction={mode:'procedural-dig',elapsed:0,duration:1.35};
        robot.userData.robotPlaying=null;
        window.solviRoomSocket?.send({type:'robot-tool-use',id:robot.userData.editorId,tool:variant,clip:'procedural:digging',seq:++this.robotActionSeq});
        return true;
      }
      return false;
    }
    const duration=Math.min(8,Math.max(.3,robot.userData.robotAnimator.clipDuration('clip:'+clip)||1.3));
    robot.userData.robotToolAction={clip:'clip:'+clip,elapsed:0,duration};
    robot.userData.robotPlaying=null;
    window.solviRoomSocket?.send({type:'robot-tool-use',id:robot.userData.editorId,tool:variant,clip,seq:++this.robotActionSeq});
    return true;
  }
  applyRemoteRobotToolUse(packet){
    const robot=this.items.find(o=>o.userData.editorKind==='robot'&&o.userData.editorId===packet?.id);
    if(!robot||!TOOL_TYPES.includes(packet?.tool))return;
    const stored=this.items.find(o=>o.userData.storage?.type==='held'&&o.userData.storage.holderId===packet.id&&o.userData.furniture?.variant===packet.tool);
    if(!stored)return;
    if(packet.clip==='procedural:digging'&&packet.tool==='shovel'){
      robot.userData.robotToolAction={mode:'procedural-dig',elapsed:0,duration:1.35};
      robot.userData.robotPlaying=null;return;
    }
    const clip=resolveToolAnimation(packet.tool,robot.userData.robotAvailableActions||[],packet.clip||'');
    if(!clip||!robot.userData.robotAnimator?.actions?.has('clip:'+clip))return;
    robot.userData.robotToolAction={clip:'clip:'+clip,elapsed:0,duration:Math.min(8,Math.max(.3,robot.userData.robotAnimator.clipDuration('clip:'+clip)||1.3))};
    robot.userData.robotPlaying=null;
  }
  performToolUse(robot,tool,target=null){
    if(!robot||!tool||!this.items.includes(robot)||!this.items.includes(tool)||!this.canEdit(robot)||!this.canEdit(tool)||tool.userData.storage?.type!=='held'||tool.userData.storage.holderId!==robot.userData.editorId)return false;
    const variant=tool.userData.furniture?.variant;
    if(!TOOL_TYPES.includes(variant)){this.toast('This item does not have a tool action');return false;}
    if(variant!=='shovel'){
      const animated=this.startToolActionAnimation(robot,variant,tool.userData.inventory?.actionClip);
      this.toast(animated?`${TOOL_ACTIVITIES[variant]?.label||'Tool animation'} played (no world effect configured)`:`No matching ${TOOL_ACTIVITIES[variant]?.label||'tool'} animation in this avatar. Choose a clip in Tool grip settings.`);
      return animated;
    }
    const point=target||digAheadPoint(robot);
    if(!point){this.toast('Unable to find a digging position');return false;}
    const ray=new THREE.Raycaster(new THREE.Vector3(point.x,30,point.z),new THREE.Vector3(0,-1,0),0,100);
    const ground=ray.intersectObject(this.world.floor)[0];
    if(!ground){this.toast('The dig location is outside the ground');return false;}
    const candidates=this.items.map(o=>{
      if(o===robot||o===tool||o.userData?.storage||!o.visible)return o;
      // Other avatars occupy a small feet-centred capsule, not their animated
      // GLB's potentially huge mesh bounds. Digging at someone's feet is blocked.
      const b=o.userData.editorKind==='robot'?{min:{x:o.position.x-.42,y:o.position.y,z:o.position.z-.42},max:{x:o.position.x+.42,y:o.position.y+1.8,z:o.position.z+.42}}:new THREE.Box3().setFromObject(o);
      return {name:o.name,visible:o.visible,userData:o.userData,boundingBox:b};
    });
    const check=validDigTarget(robot,ground.point,candidates);
    if(!check.ok){this.toast(check.reason);return false;}
    const site=objectFor('furniture');rebuildFurniture(site,{variant:'excavation'});
    site.name=`${robot.name} · dig site`;
    site.position.set(ground.point.x,ground.point.y+.012,ground.point.z);
    site.userData.physics={mode:'off'};site.userData.ownerId=window.solviAPI?.auth()?.profile?.id||null;
    this.items.push(site);this.world.scene.add(site);this.physics.sync(site);
    this.recordEdit(null,this.snapshot(site));this.queueSave(site);this.refreshList();
    const animated=this.startToolActionAnimation(robot,variant,tool.userData.inventory?.actionClip);
    this.toast(animated?'Digging · persistent excavation mark created':'Excavation mark created without animation (disabled in tool settings)');
    return true;
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
  applyRemoteCarry(packet){this.carry.remotePacket(packet);}
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
    this.remoteRobotMotion.delete(packet.id);
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
      this.remoteInput.set(packet.id,{f:0,t:0,r:0,b:0,s:packet.s??1.8,runMultiplier:packet.runMultiplier??2.8,q:packet.q??2.5,u:packet.u??4,received:performance.now()});
    }else this.remoteInput.set(packet.id,{f:packet.f,t:packet.t,r:packet.r,b:packet.b,s:packet.s,runMultiplier:packet.runMultiplier??2.8,q:packet.q??2.5,u:packet.u??4,received:performance.now()});
  }
  applyRobotMotion(state){
    const robot=this.items.find(o=>o.userData.editorKind==='robot'&&o.userData.editorId===state?.id);
    if(!robot)return;
    // Transports retain their existing authoritative vertical reconciliation.
    if(state.mode==='lift'||state.mode==='conveyor'){
      this.applyRobotInput({...state,m:0,x:state.position?.[0],y:state.position?.[1],z:state.position?.[2],yaw:state.rotation?.[1]});
      const y=state.position?.[1];
      if(!this.physics.owns(robot)&&typeof y==='number'&&Number.isFinite(y)){
        if(!robot.userData.liftRide)robot.userData.liftRemoteTargetY=y;
      }
      return;
    }
    if(this.controlMode==='robot'&&this.controlledRobot?.()===robot&&this.canEdit(robot)&&this.robotKeys.size)return;
    const now=performance.now();
    const stream=appendRobotPose(this.remoteRobotMotion.get(state.id),state,now,
      {x:robot.position.x,y:robot.position.y,z:robot.position.z,yaw:robot.rotation.y});
    if(!stream)return;
    this.remoteRobotMotion.set(state.id,stream);
    this.remoteInput.delete(state.id);this.remoteCorrections.delete(state.id);
  }
  // Same live editor geometry drives the minimap and route planner. Footprints
  // are kept clear of robots and furniture; navigation never pushes objects.
  robotPathDebugVisible(robot){return robotPathVisible(robot?.userData?.editorId,sessionStorage);}
  updateRobotDebugStatus(){const label=byId('robotPathDebugStatus'),robot=this.robot();if(!label)return;label.hidden=!robot||!this.robotPathDebugVisible(robot);if(label.hidden)return;const route=robot.userData.robotDebugRoute;label.textContent=!route?'Route debug ready — start a robot walking mission to see its actual planned path.':route.blocked?'No valid route — red destination ring only; there is no traversable line.':route.finished?'Previous route shown briefly after the mission ended.':'Green: A* planned route · cyan: actual travelled trail · red: obstacles · orange: destination; blue shows direction, not camera evidence.';}
  syncRobotPathDebug(){for(const robot of this.items.filter(o=>o.userData.editorKind==='robot')){const route=robot.userData.robotDebugRoute;if(this.robotPathDebugVisible(robot)&&route&&!route.finished)updateRobotPathDebug(this.world,robot,route);else if(!this.robotPathDebugVisible(robot))clearRobotPathDebug(this.world,robot.userData.editorId);}this.updateRobotDebugStatus();}
  navigationObstacles(robot,options={}){
    this.world.scene.updateMatrixWorld(true);
    const supplements=(robot.userData.robotNavTemporaryObstacles||[]).filter(o=>o.until>Date.now());
    robot.userData.robotNavTemporaryObstacles=supplements;
    const scene=this.items.filter(o=>o!==robot&&o.visible&&!o.userData.carriedBy&&!o.userData.storage&&!(o.userData.editorKind==='cube'&&o.name?.endsWith(' · house floor'))&&!['light','plane','points','curve'].includes(o.userData.editorKind)).flatMap(o=>{
      if(['wall','stairs'].includes(o.userData.editorKind))return o.children.filter(child=>child.userData.wallSegment||child.userData.stairTread).map((child,i)=>{const b=new THREE.Box3().setFromObject(child);if(b.isEmpty()||b.max.y<robot.position.y+.10||b.min.y>robot.position.y+1.7)return null;return {minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z,name:(o.name||'Office wall')+' section '+(i+1),kind:'wall',id:o.userData.editorId};}).filter(Boolean);
      // A user-visible label can be stale (e.g. a fence still named 'Footpath').
      // Use the generated infrastructure type/centreline, not its display name.
      // Previously every object >28m was silently removed from the navmesh.
      // That made long fences invisible to A* even though Rapier stopped robots.
      if(o.userData.editorKind==='furniture'&&o.userData.furniture?.variant==='infrastructure'){
        const cfg=o.userData.furniture;
        if(['road','footpath','curb'].includes(cfg.infraType))return null; // ground surface, not a wall
        const b=new THREE.Box3().setFromObject(o);
        if(b.isEmpty()||b.max.y<robot.position.y+.10||b.min.y>robot.position.y+1.7)return null;
        const segments=infrastructureSegments(cfg);
        return infrastructureNavigationFootprints(segments,(x,z)=>{
          const p=o.localToWorld(new THREE.Vector3(x,0,z));return {x:p.x,z:p.z};
        },{...cfg,navigationWorldScale:Math.max(Math.abs(o.scale.x),Math.abs(o.scale.z))},
        {name:o.name||cfg.infraType,id:o.userData.editorId});
      }
      // A nature patch is a walkable terrain surface, NOT a solid rectangle
      // spanning its grass and tree canopies. Keep only real trunk footprints
      // when walking. Placement of NEW buildings still reserves its full plot.
      if(o.userData.editorKind==='furniture'&&WALKABLE_NATURE_AREAS.includes(o.userData.furniture?.variant)){
        if(options.forConstruction){
          const b=new THREE.Box3().setFromObject(o);
          return b.isEmpty()?null:{minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z,
            name:o.name||'Nature plot',kind:'nature-reserved',id:o.userData.editorId};
        }
        return natureNavigationFootprints(o.userData.furniture,(x,z)=>{
          const p=o.localToWorld(new THREE.Vector3(x,0,z));
          return {x:p.x,z:p.z,scale:Math.max(Math.abs(o.scale.x),Math.abs(o.scale.z))};
        },{name:o.name,id:o.userData.editorId},robot.position.y);
      }
      // A solitary tree has a slender physical trunk, not an impassable leafy
      // canopy; decorative shrubs with physics disabled do not block paths.
      if(o.userData.editorKind==='furniture'&&o.userData.furniture?.variant==='shrub'&&o.userData.physics?.mode==='off')return null;
      if(o.userData.editorKind==='furniture'&&o.userData.furniture?.variant==='tree'){
        const p=o.userData.furniture,r=Math.min(1.5,Math.max(.12,(Number(p.trunkRadius)||.18)*Math.max(Math.abs(o.scale.x),Math.abs(o.scale.z))+.10));
        return {minX:o.position.x-r,maxX:o.position.x+r,minZ:o.position.z-r,maxZ:o.position.z+r,
          name:o.name||'Tree',kind:'tree-trunk',id:o.userData.editorId};
      }
      // Human-like glTF bounds can swell with animation and accessories. Use a
      // stable feet-centred capsule footprint for other robots instead.
      if(o.userData.editorKind==='robot')return {minX:o.position.x-.38,maxX:o.position.x+.38,minZ:o.position.z-.38,maxZ:o.position.z+.38,name:o.name||'Robot',kind:'robot',id:o.userData.editorId};
      const b=new THREE.Box3().setFromObject(o);
      if(b.isEmpty())return {minX:o.position.x-.33,maxX:o.position.x+.33,minZ:o.position.z-.33,maxZ:o.position.z+.33,name:o.name||'Unnamed object',kind:o.userData.editorKind||'object',id:o.userData.editorId};
      if(b.max.y<robot.position.y+.10||b.min.y>robot.position.y+1.7)return null;
      // A long solid object must remain an obstacle; skipping it creates
      // routes through actual colliders. Segmented infrastructure is above.
      // An imported elongated model remains conservatively bounded.
      return {minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z,name:o.name||'Unnamed object',kind:o.userData.editorKind||'object',id:o.userData.editorId};
    }).filter(Boolean);
    return [...scene,...supplements];
  }
  routeRobot(robot,point){
    const {preserveMission=false,quiet=false,wholePath=false,smooth=this.smoothRobotPathsEnabled}=arguments[2]||{};
    if(!robot||!point)return false;
    // A work route must first release its avatar from a seating collider.
    // Try the seat front and three other exits, never cutting through walls;
    // keep the current storey rather than silently falling to ground level.
    if(robot.userData.robotSeated&&!standUp(robot,this))return false;
    if(!robot.userData.robotSeated&&typeof recoverStandingSeatTrap==='function')recoverStandingSeatTrap(robot,this);
    const allObstacles=this.navigationObstacles(robot);
    // A robot already standing within another robot's clearance zone must be
    // allowed to depart. Runtime collision still prevents moving further into
    // that robot; all geometry and non-overlapping robots remain obstacles.
    const start={x:robot.position.x,z:robot.position.z};
    const obstacles=allObstacles.filter(o=>o.kind!=='robot');
    const distance=Math.hypot(point.x-start.x,point.z-start.z);
    if(distance>600){this.toast('Robot route exceeds 600 m safety limit');return false;}
    // Use reachable, obstacle-aware intermediate waypoints. The previous fixed
    // straight-line midpoints could lie inside a house and reject a valid detour.
    const rawWaypoints=planRobotTravelRoute(start,{x:point.x,z:point.z},obstacles)||[];
    // Barrier camera checkpoints must remain exact. Otherwise round only
    // corners whose full curve clears the same scene collision footprints.
    const rawCheckpoints=robotRouteCheckpoints(start,rawWaypoints,obstacles);
    const waypoints=smooth&&rawCheckpoints.length===0
      ?smoothRobotWaypoints(start,rawWaypoints,obstacles):rawWaypoints;
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
    robot.userData.robotRouteCheckpointHoldUntil=0;
    robot.userData.robotRouteCheckpoints=rawCheckpoints;
    robot.userData.robotProgressSample=null;
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
      checkpoints:robot.userData.robotRouteCheckpoints.length,
      plan:{waypoints:waypoints.map(p=>({x:p.x,z:p.z})),obstacles:obstacles.map(o=>({minX:o.minX,maxX:o.maxX,minZ:o.minZ,maxZ:o.maxZ}))}}}));
    setRobotDestination(robot,waypoints[0]);return true;
  }
  // Commands are issued by the authenticated chat endpoint and resolved against
  // the same room scene. The client still checks editable state and targets.
  inspectRobotRouteCheckpoint(robot,reached){
    const points=robot?.userData?.robotRouteCheckpoints;
    if(!robot||!Array.isArray(points)||!points.length)return false;
    const index=points.findIndex(p=>Math.hypot(p.x-reached.x,p.z-reached.z)<.20);
    if(index<0)return false;
    const current=points[index];points.splice(0,index+1);
    const destination=robot.userData.robotRouteDestination;
    const mission=robot.userData.robotMission;
    const remaining=destination?Math.hypot(destination.x-robot.position.x,destination.z-robot.position.z):0;
    window.dispatchEvent(new CustomEvent('solvi:robot-route-checkpoint',{detail:{
      room:this.roomId||'',robotId:robot.userData.editorId,taskId:mission?.taskId||'',
      point:{x:robot.position.x,z:robot.position.z},destination,
      remainingMeters:+remaining.toFixed(1),checkpoint:current.metres,
      reason:'Reached collision-checked barrier detour waypoint; inspect surroundings and retain original goal'}}));
    // A new object may now obstruct the rest of a multi-part route. Replan
    // from the measured position, preserving mission ID and final goal.
    if(!destination||!mission)return false;
    const obstacles=this.navigationObstacles(robot).filter(o=>o.kind!=='robot');
    const onward=robot.userData.robotWaypoints||[];
    if(!remainingRouteBlocked({x:robot.position.x,z:robot.position.z},onward[0]||destination,onward.slice(1),obstacles))return 'scan';
    if(this.routeRobot(robot,destination,{preserveMission:true,quiet:true}))return true;
    // The world changed while the agent was inspecting a barrier. Never use
    // the now-invalid original waypoints, or report the final goal completed.
    robot.userData.robotGoal=null;robot.userData.robotWaypoints=null;
    robot.userData.robotRouteCheckpoints=[];robot.userData.robotPathObstacles=null;
    robot.userData.robotMission=null;robot.userData.robotMode='idle';
    window.dispatchEvent(new CustomEvent('solvi:robot-task-update',{detail:{
      robot:robot.name,robotId:robot.userData.editorId,taskId:mission.taskId,
      target:mission.targetName,status:'blocked',reason:'Remaining detour obstructed at observation checkpoint'}}));
    return true;
  }
  avoidMovingRobot(robot,other){
    const mission=robot?.userData?.robotMission;
    if(!mission||!other||!this.canEdit(robot))return false;
    // Other robots are transient local occupancy, NOT static navmesh. Ask a
    // colleague to yield with body language rather than pushing or repeatedly
    // claiming that the whole scene is impossible.
    const staticObstacles=this.navigationObstacles(robot).filter(o=>o.kind!=='robot');
    const start={x:robot.position.x,z:robot.position.z};
    if(mission.kind==='go_to'&&mission.targetId===other.userData.editorId&&
      canMeetRobot({...start,y:robot.position.y},{x:other.position.x,y:other.position.y,z:other.position.z},staticObstacles,{minimum:.53})){
      robot.userData.robotWaypoints=[];setRobotDestination(robot,start);return true;
    }
    const count=Number(mission.dynamicDetours||0);
    if(count>=3)return false;
    const destination=robot.userData.robotRouteDestination;
    if(!destination)return false;
    const dx=start.x-other.position.x,dz=start.z-other.position.z;
    const length=Math.hypot(dx,dz)||1;
    const blocker={minX:other.position.x-.39,maxX:other.position.x+.39,
      minZ:other.position.z-.39,maxZ:other.position.z+.39,kind:'temporary-robot'};
    const sideX=-dz/length,sideZ=dx/length;
    for(const [back,lateral] of [[.75,.95],[.75,-.95],[1.25,1.45],[1.25,-1.45]]){
      const via={x:start.x+dx/length*back+sideX*lateral,
        z:start.z+dz/length*back+sideZ*lateral};
      if(pathBlocked(via.x,via.z,staticObstacles,.3))continue;
      const first=planRobotTravelRoute(start,via,staticObstacles);
      const second=planRobotTravelRoute(via,destination,[...staticObstacles,blocker]);
      if(!first?.length||!second?.length||
        Math.hypot(first.at(-1).x-via.x,first.at(-1).z-via.z)>.14||
        Math.hypot(second.at(-1).x-destination.x,second.at(-1).z-destination.z)>.14)continue;
      mission.dynamicDetours=count+1;
      robot.userData.robotWaypoints=[...first.slice(1),...second];
      robot.userData.robotPathObstacles=staticObstacles;
      setRobotDestination(robot,first[0]);
      window.dispatchEvent(new CustomEvent('solvi:robot-recovery',{detail:{robotId:robot.userData.editorId,
        name:robot.name,kind:'moving-colleague',reason:'walking around moving colleague',attempt:mission.dynamicDetours}}));
      return true;
    }
    return false;
  }
  refreshRobotRoute(robot){
    const mission=robot?.userData?.robotMission;
    if(!mission||!robot.userData.robotGoal||!this.canEdit(robot))return false;
    const now=performance.now();
    if(now-(mission.lastTargetCheck||0)<1000)return false;
    mission.lastTargetCheck=now;
    const target=mission.targetId&&this.items.find(o=>o.userData.editorId===mission.targetId);
    const obstacles=this.navigationObstacles(robot).filter(o=>o.kind!=='robot');
    if(target?.userData.editorKind==='robot'&&mission.kind==='go_to'){
      const original=mission.targetPlanPosition||target.position;
      if(Math.hypot(target.position.x-original.x,target.position.z-original.z)>.90){
        mission.retargets=Number(mission.retargets||0)+1;
        if(mission.retargets>12)return false; // the ordinary route/recovery remains authoritative
        const approach=planRobotMeeting({x:robot.position.x,y:robot.position.y,z:robot.position.z},
          {x:target.position.x,y:target.position.y,z:target.position.z},obstacles);
        if(approach?.alreadyNear){
          robot.userData.robotWaypoints=[];
          setRobotDestination(robot,{x:robot.position.x,z:robot.position.z});return true;
        }
        if(approach&&this.routeRobot(robot,approach.point,{preserveMission:true,quiet:true})){
          mission.targetPlanPosition={x:target.position.x,z:target.position.z};return true;
        }
      }
    }
    // A newly moved wall, closed door or furniture item can invalidate the
    // old corridor. The next route is based on live scene geometry, not the
    // obstacle snapshot captured when the mission started.
    const from={x:robot.position.x,z:robot.position.z};
    const goal=robot.userData.robotGoal;
    if(!remainingRouteBlocked(from,goal,robot.userData.robotWaypoints||[],obstacles))return false;
    const destination=robot.userData.robotRouteDestination;
    if(!destination)return false;
    return this.routeRobot(robot,destination,{preserveMission:true,quiet:true});
  }
  retargetRobot(robot){
    const mission=robot.userData.robotMission;
    if(!mission||mission.kind!=='go_to'||!this.canEdit(robot))return false;
    const target=this.items.find(o=>o.userData.editorId===mission.targetId&&o.userData.editorKind==='robot');
    if(!target)return false;
    const dx=robot.position.x-target.position.x,dz=robot.position.z-target.position.z;
    const distance=Math.hypot(dx,dz);
    const staticObstacles=this.navigationObstacles(robot).filter(o=>o.kind!=='robot');
    if(canMeetRobot({x:robot.position.x,y:robot.position.y,z:robot.position.z},{x:target.position.x,y:target.position.y,z:target.position.z},staticObstacles))return false;
    const reroutes=Number(mission.retargets||0);
    if(reroutes>=4){
      robot.userData.robotMission=null;robot.userData.robotGoal=null;robot.userData.robotMode='idle';
      window.dispatchEvent(new CustomEvent('solvi:robot-task-update',{detail:{robot:robot.name,robotId:robot.userData.editorId,taskId:mission.taskId,target:mission.targetName,status:'blocked'}}));return true;
    }
    mission.retargets=reroutes+1;
    const start={x:robot.position.x,z:robot.position.z};
    const obstacles=this.navigationObstacles(robot).filter(o=>o.kind!=='robot');
    const approach=planRobotMeeting({...start,y:robot.position.y},{x:target.position.x,y:target.position.y,z:target.position.z},obstacles);
    if(approach?.alreadyNear)return false;
    if(approach&&this.routeRobot(robot,approach.point,{preserveMission:true})){
      mission.targetPlanPosition={x:target.position.x,z:target.position.z};return true;
    }
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
    // A physical stall can reveal a collider missing from the scene route
    // snapshot. Temporarily mark the contact point, not an entire building or
    // other robot. Each retry is bounded and never modifies persisted objects.
    if(reason==='no measured movement' || reason==='scene obstacle'){
      const from={x:robot.position.x,z:robot.position.z};
      const goal=robot.userData.robotGoal||destination;
      const dx=goal.x-from.x,dz=goal.z-from.z,len=Math.hypot(dx,dz)||1;
      const cx=from.x+dx/len*.78,cz=from.z+dz/len*.78;
      const blockers=robot.userData.robotNavTemporaryObstacles||[];
      if(!blockers.some(b=>Math.hypot((b.minX+b.maxX)/2-cx,(b.minZ+b.maxZ)/2-cz)<.38)){
        blockers.push({minX:cx-.24,maxX:cx+.24,minZ:cz-.24,maxZ:cz+.24,
          kind:'runtime-contact',name:'Measured movement obstruction',until:Date.now()+45000});
        robot.userData.robotNavTemporaryObstacles=blockers.slice(-3);
      }
    }
    // Re-read every physical obstacle and choose a route around the latest
    // contact rather than repeating the same straight line through the fence.
    if(this.routeRobot(robot,destination,{preserveMission:true,quiet:true}))return true;
    // A blocked narrow passage may require a short reverse step first. Both legs
    // must be verified by A* before movement starts; never back into obstacles.
    const obstacles=this.navigationObstacles(robot).filter(o=>o.kind!=='robot');
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
  // Select successive physically reachable, novel heading/distance pairs.
  // A failed candidate never becomes a displayed route or a claimed movement.
  continueRobotPatrol(robot,mission){
    if(!robot||!mission||mission.kind!=='patrol')return false;
    if(Date.now()>=mission.expiresAt){mission.termination='duration-complete';return false;}
    if(mission.leg>=500){mission.termination='step-budget';return false;}
    const start={x:robot.position.x,z:robot.position.z};
    const obstacles=this.navigationObstacles(robot).filter(o=>o.kind!=='robot');
    const turn=(Math.random()*2-1)*Math.PI;
    for(const range of [16,11,7,4])for(let i=0;i<12;i++){
      const theta=robot.rotation.y+turn+i*Math.PI/6;
      const candidate={x:start.x+Math.sin(theta)*range,z:start.z+Math.cos(theta)*range};
      if(Math.abs(candidate.x)>490||Math.abs(candidate.z)>490)continue;
      const path=planRobotTravelRoute(start,candidate,obstacles);
      if(!path?.length||Math.hypot(path.at(-1).x-candidate.x,path.at(-1).z-candidate.z)>.22)continue;
      if(this.routeRobot(robot,candidate,{preserveMission:true,quiet:true})){
        mission.leg++;return true;
      }
    }
    mission.termination='blocked';return false;
  }
  startRobotRecovery(robot,mission){
    const origin={x:robot.position.x,z:robot.position.z};
    const obstacles=this.navigationObstacles(robot).filter(o=>o.kind!=='robot');
    const back=robot.rotation.y+Math.PI;
    for(const radius of [mission.retreatMetres,Math.min(10,mission.retreatMetres),Math.min(5,mission.retreatMetres)]){
      for(const offset of [0,Math.PI/6,-Math.PI/6,Math.PI/3,-Math.PI/3,Math.PI/2,-Math.PI/2]){
        const angle=back+offset,candidate={x:origin.x+Math.sin(angle)*radius,z:origin.z+Math.cos(angle)*radius};
        const route=planRobotTravelRoute(origin,candidate,obstacles);
        if(!route?.length||Math.hypot(route.at(-1).x-candidate.x,route.at(-1).z-candidate.z)>.22)continue;
        if(this.routeRobot(robot,candidate,{preserveMission:true,quiet:true}))return true;
      }
    }
    return false;
  }
  continueRobotRecovery(robot,mission){
    if(!robot||!mission||mission.kind!=='recover_route')return false;
    const origin={x:robot.position.x,z:robot.position.z};
    const obstacles=this.navigationObstacles(robot).filter(o=>o.kind!=='robot');
    for(const radius of [9,6,3])for(const offset of [0,Math.PI/6,-Math.PI/6,Math.PI/3,-Math.PI/3]){
      const angle=robot.rotation.y+offset,candidate={x:origin.x+Math.sin(angle)*radius,z:origin.z+Math.cos(angle)*radius};
      const route=planRobotTravelRoute(origin,candidate,obstacles);
      if(!route?.length||Math.hypot(route.at(-1).x-candidate.x,route.at(-1).z-candidate.z)>.22)continue;
      if(this.routeRobot(robot,candidate,{preserveMission:true,quiet:true}))return true;
    }
    return false;
  }
  receiveRobotCommand(command){
    if(!command||command.room!==(window.solviRoom||'main'))return false;
    const robot=this.items.find(x=>x.userData.editorKind==='robot'&&x.userData.editorId===command.robot_id);
    if(!robot||!this.canEdit(robot)){this.toast('Robot command rejected: robot not editable or missing');return false;}
    if(!['stop','wander','random_action','patrol','recover_route','go_to','go_sit','coffee_visit','walk_forward','turn','turn_walk','jump'].includes(command.kind))return false;
    // Explicit human commands always supersede ambient life; STOP also
    // temporarily suppresses a new autonomous route after the stop.
    robot.userData.robotLifePauseUntil=Date.now()+(command.kind==='stop'?120000:45000);
    interruptRobotMission(robot);
    if(command.kind==='stop'){clearRobotPathDebug(this.world,robot.userData.editorId);robot.userData.robotDebugRoute=null;this.updateRobotDebugStatus();robot.userData.robotMode='idle';this.queueSave(robot);this.toast(robot.name+' stopped');return true;}
    if(command.kind==='recover_route'){
      const metres=Number(command.distance);
      if(!Number.isFinite(metres)||metres<.5||metres>30)return false;
      const mission={kind:'recover_route',phase:'retreat',taskId:command.id,
        targetName:command.target_name||'retreat and change heading',retreatMetres:metres};
      robot.userData.robotMission=mission;
      if(!this.startRobotRecovery(robot,mission)){
        interruptRobotMission(robot);this.toast(robot.name+' cannot safely reverse; no teleport attempted');return false;
      }
      return true;
    }
    if(command.kind==='patrol'){
      const seconds=Math.max(60,Math.min(3600,Number(command.duration_seconds)||300));
      robot.userData.robotMission={kind:'patrol',taskId:command.id,targetName:command.target_name||'timed patrol',
        startedAt:Date.now(),expiresAt:Date.now()+seconds*1000,leg:0};
      if(!this.continueRobotPatrol(robot,robot.userData.robotMission)){
        interruptRobotMission(robot);this.toast(robot.name+' has no safe patrol start');return false;
      }
      this.toast(robot.name+' started a timed patrol');return true;
    }
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
    const bounds2d=target.userData.editorKind==='robot'?
      {minX:target.position.x-.38,maxX:target.position.x+.38,minZ:target.position.z-.38,maxZ:target.position.z+.38}:
      {minX:center.x-size.x/2,maxX:center.x+size.x/2,minZ:center.z-size.z/2,maxZ:center.z+size.z/2};
    const obstacles=this.navigationObstacles(robot).filter(o=>o.kind!=='robot');
    // Ordinary targets can be approached from any navigable side. Stairs are
    // directional: their first path point is the low, physically accessible
    // landing. Do not use the upper/side edge as a successful destination.
    const isStairEntrance=target.userData.editorKind==='stairs'&&
      ['standard','advanced'].includes(target.userData.stairs?.variant);
    const projectStairPoint=p=>{
      const world=target.localToWorld(new THREE.Vector3(p.x,0,p.z));
      return {x:world.x,z:world.z};
    };
    const differentFloor=target.userData.editorKind==='robot'&&!sameRobotFloor(robot.position,target.position);
    const approach=isStairEntrance?
      planRobotLowStairApproach(start,target.userData.stairs,obstacles,projectStairPoint):
      target.userData.editorKind==='robot'?
        planRobotMeeting({...start,y:robot.position.y},{x:target.position.x,y:target.position.y,z:target.position.z},obstacles):
        planRobotApproach(start,bounds2d,obstacles);
    // An intermediate stop outside the wall must never count as meeting a
    // robot inside. For social tasks, a blocked door is a genuine blocked route.
    const partial=!approach&&!isStairEntrance&&target.userData.editorKind!=='robot'?
       planRobotPartialApproach(start,bounds2d,obstacles):null;
    robot.userData.robotMission={kind:command.kind,taskId:command.id,targetName:target.name,targetId:target.userData.editorId,
      origin:{x:robot.position.x,z:robot.position.z},leg:0,lastTargetCheck:0,
      ...(target.userData.editorKind==='robot'?{targetPlanPosition:{x:target.position.x,z:target.position.z}}:{}),
      ...(isStairEntrance?{destinationPart:'low stair entrance'}:{})};
    if(target.userData.editorKind==='robot'&&approach?.alreadyNear){
      // Already near AND no wall between them. Use the ordinary measured
      // arrival path, rather than claiming an arrival from a planner guess.
      robot.userData.robotWaypoints=[];setRobotDestination(robot,start);
      return true;
    }
    if(!approach&&!partial){
      const nearby=obstacles.map(o=>({name:o.name||'Unknown object',kind:o.kind||'object',distance:+Math.hypot((o.minX+o.maxX)/2-start.x,(o.minZ+o.maxZ)/2-start.z).toFixed(2)})).sort((a,b)=>a.distance-b.distance).slice(0,8);
      robot.userData.robotDebugRoute={start,waypoints:[],obstacles,destination:{x:center.x,z:center.z},blocked:true};
      if(this.robotPathDebugVisible(robot))updateRobotPathDebug(this.world,robot,robot.userData.robotDebugRoute);
      window.dispatchEvent(new CustomEvent('solvi:robot-route',{detail:{robotId:robot.userData.editorId,name:robot.name,status:'blocked',target:target.name,reason:differentFloor?'Colleague on another storey; a vertical lift/stair route is required':isStairEntrance?'Low stair entrance inaccessible; no route through high/side faces':'No reachable safe approach from any tested side',nearby_obstacles:nearby,obstacles:obstacles.length,waypoints:0,start,destination:{x:center.x,z:center.z},taskId:command.id}}));
      const mission=robot.userData.robotMission;robot.userData.robotMission=null;
      robot.userData.robotGoal=null;robot.userData.robotMode='idle';
      window.dispatchEvent(new CustomEvent('solvi:robot-task-update',{detail:{robot:robot.name,robotId:robot.userData.editorId,taskId:mission.taskId,target:mission.targetName,status:'blocked',reason:differentFloor?'Colleague is on another floor; a lift/stair journey is required':isStairEntrance?'Low stair entrance inaccessible':'No reachable approach point'}}));
      this.toast(differentFloor?robot.name+': '+target.name+' is on another floor; use lift/stairs first':robot.name+': no safe route to any side of '+target.name);return false;
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
    if(!this.routeRobot(robot,approach.point,isStairEntrance?{wholePath:true}:undefined))return false;
    this.toast(isStairEntrance?
      robot.name+' → '+target.name+' (routing around the high/side faces to the accessible bottom entrance)':
      robot.name+' → '+target.name+' (A* chose a reachable approach from multiple sides)');
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

SceneEditor.prototype.addPortalPair=function(){
 const entry=this.add('portal',false,undefined,false),exit=this.add('portal',false,undefined,false);
 entry.name='Portal Entry';exit.name='Portal Exit';
 entry.userData.portal=cleanPortal({...entry.userData.portal,role:'entry',partner:exit.userData.editorId});
 exit.userData.portal=cleanPortal({...exit.userData.portal,role:'exit',partner:entry.userData.editorId});
 entry.userData.physics=physicsOptions({mode:'static'});exit.userData.physics=physicsOptions({mode:'static'});
 // Place both above the same floor: changing positions later is independent.
 const ahead=this.cameraDropPosition(3.6);entry.position.set(ahead.x,.05,ahead.z);
 exit.position.copy(entry.position);exit.position.x+=5;exit.position.z+=1;
 rebuildPortal(entry,entry.userData.portal);rebuildPortal(exit,exit.userData.portal);
 this.physics.sync(entry);this.physics.sync(exit);this.select(entry);this.refreshList();
 for(const o of [entry,exit]){this.recordEdit(null,this.snapshot(o));this.queueSave(o);}
 this.toast('Portal pair created · Move Entry and Exit separately in Objects');return [entry,exit];
};
SceneEditor.prototype.setupPortalControls=function(){
 const simple=['portalShape','portalEffect','portalMode','portalColor','portalTexture','portalSound'];
 const numeric=['openingWidth','openingHeight','depth','delay','opacity'];
 const labels={openingWidth:'Width',openingHeight:'Height',depth:'Depth',delay:'Delay',opacity:'Opacity'};
 const controlFor=key=>document.getElementById('portal'+key[0].toUpperCase()+key.slice(1));
 const slider=document.getElementById('portalParameterRange');
 const chooseParameter=key=>{
  const el=controlFor(key);if(!el||!slider)return;
  this.portalActiveParameter=key;
  slider.min=el.min;slider.max=el.max;slider.step=el.step;slider.value=el.value;
  slider.disabled=el.disabled;
  slider.setAttribute('aria-label','Portal '+labels[key]);
  const label=document.getElementById('portalRangeLabel');if(label)label.textContent=labels[key];
 };
 const apply=(key,raw)=>{
  const o=this.selected;if(o?.userData.editorKind!=='portal'||!this.canEdit(o))return;
  if(o.userData.portal?.role==='exit'&&['mode','delay','sound'].includes(key))return;
  const before=this.snapshot(o);
  const next=['openingWidth','openingHeight'].includes(key)
   ?resizePortalAperture(o.userData.portal,key,raw)
   :cleanPortal({...o.userData.portal,[key]:raw});
  if(JSON.stringify(next)===JSON.stringify(o.userData.portal))return;
  rebuildPortal(o,next);
  this.physics.sync(o);this.recordEdit(before,this.snapshot(o));this.queueSave(o);
  this.updateInspector();
 };
 for(const id of simple)document.getElementById(id)?.addEventListener('change',()=>{
  const part=id.slice('portal'.length),key=part[0].toLowerCase()+part.slice(1),control=document.getElementById(id);
  apply(key,control.type==='checkbox'?control.checked:control.value);
 });
 for(const key of numeric){
  const el=controlFor(key);if(!el)continue;
  el.addEventListener('focus',()=>chooseParameter(key));
  el.addEventListener('click',()=>chooseParameter(key));
  el.addEventListener('change',()=>{apply(key,el.value);chooseParameter(key);});
 }
 slider?.addEventListener('input',()=>{
  const key=this.portalActiveParameter||'openingWidth',el=controlFor(key);
  if(el)el.value=slider.value;
  apply(key,slider.value);
 });
 this.portalActiveParameter='openingWidth';
 this.refreshPortalSlider=()=>chooseParameter(this.portalActiveParameter||'openingWidth');
};
SceneEditor.prototype.renderPortalControls=function(obj){
 const fold=document.getElementById('portalProperties');if(!fold)return;
 fold.hidden=obj?.userData.editorKind!=='portal';if(fold.hidden)return;
 const cfg=cleanPortal(obj.userData.portal);obj.userData.portal=cfg;
 document.getElementById('portalRole').textContent=cfg.role==='entry'?'Entry → Exit':'Exit';
 document.getElementById('portalPairStatus').textContent=pairedPortal(this.items,obj)?'Linked pair':'Missing partner';
 const editable=this.canEdit(obj);
 for(const key of ['shape','effect','mode','color','texture','sound']){
  const id='portal'+key[0].toUpperCase()+key.slice(1),el=document.getElementById(id);
  if(!el)continue;
  if(el.type==='checkbox')el.checked=cfg[key];else el.value=String(cfg[key]);
  el.disabled=!editable||(cfg.role==='exit'&&['mode','sound'].includes(key));
 }
 for(const key of ['openingWidth','openingHeight','depth','delay','opacity']){
  const id='portal'+key[0].toUpperCase()+key.slice(1),el=document.getElementById(id);
  if(el){el.value=String(cfg[key]);el.disabled=!editable||(cfg.role==='exit'&&key==='delay');}
 }
 this.refreshPortalSlider?.();
};
