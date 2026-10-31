import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {isTrackpadPan,trackpadPanDelta} from './trackpad-navigation.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {MotionController, computeMode} from './animations.js';
import {teleportOffset,validTeleport} from './xr-navigation.js';
import {XRControllerModelFactory} from 'three/addons/webxr/XRControllerModelFactory.js';
import {XRHandModelFactory} from 'three/addons/webxr/XRHandModelFactory.js';
import {readPreferences} from './preferences.js';
import {ENVIRONMENT_DEFAULTS,normalizeEnvironment,environmentViewLimit,createSkyDome,skyModeIndex} from './scene-environment.js';
import {nextCameraMode,followAnchor,localOrbitOffset,cameraFromLocalOffset,chaseOffset,clampChaseDistance,zoomChaseDistance,smoothFactor,chaseSmartStep} from './camera-follow.js';
import {freeCameraAxes} from './camera-key-movement.js';
import {createFloorTexture} from './floor-textures.js';
import {updateSceneMedia,toggleSceneMediaPlayback,setSceneMediaMuted,sceneMediaMuted,showSceneMediaCaptions} from './scene-media.js';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const random=(a,b)=>a+Math.random()*(b-a);
export class SolviWorld {
  constructor(root, onState=()=>{}) {
    this.onState=onState;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#101b2c');
    this.environment={...ENVIRONMENT_DEFAULTS};this.skyClock=0;this.extentCheck=0;this.sceneExtent=0;
    this.camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.05,1500);
    this.camera.position.set(5,3.7,7.5);
    this.audioListener=new THREE.AudioListener();
    this.camera.add(this.audioListener);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.4;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.xr.enabled=true;
    this.renderer.xr.setReferenceSpaceType('local-floor');
    root.append(this.renderer.domElement);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=false;this.controls.autoRotate=false;this.controls.target.set(0,1,0);
    this.cameraOrbitGesture=null;this.editorGizmoPointer=false;
    this.cameraVelocity=new THREE.Vector3();
    this.cameraFollowMode=['free','chase','chase-smart','orbit'].includes(localStorage.getItem('solvi-camera-follow'))?localStorage.getItem('solvi-camera-follow'):'free';
    this.followRobotId=null;this.smartFollowYaw=null;this.smartChaseEngaged=false;this.followOrbitOffset=null;this.followOrbitDistance=clampChaseDistance(localStorage.getItem('solvi-orbit-distance'),8);this.followOrbitCustomized=localStorage.getItem('solvi-orbit-distance')!==null;this.followChaseCustomized=localStorage.getItem('solvi-chase-distance')!==null;this.followChaseDistance=clampChaseDistance(localStorage.getItem('solvi-chase-distance'));this.lastFollowLabel='';this.smartTurnThreshold=Math.max(5,Math.min(120,Number(localStorage.getItem('solvi-smart-chase-threshold'))||35));
    // Left drag = orbit, right drag = pan, wheel = dolly; gizmos temporarily lock orbit.
    this.controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};
    this.controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
    this.controls.enablePan=true;
    this.controls.minPolarAngle=.02;this.controls.maxPolarAngle=Math.PI-.02;
    this.controls.minDistance=.35;this.controls.maxDistance=1500;
    this.controls.update();
    this.localHeadRotation=[0,0,0];this.localBody={};this.localVoiceLevel=0;this.localVoiceBands=[0,0,0];
    this.clock=new THREE.Clock();
    this.character=new THREE.Group();this.scene.add(this.character);
    this.actor=new THREE.Group();this.character.add(this.actor);
    this.pending=null;this.roam=false;this.allowFloorWalk=false;this.editorDragging=false;this.desiredSpeed=1.4;this.idleTimer=2;this.currentMode='idle';this.gestureUntil=0;
    this.keys=new Set();this.animator=null;this.ready=false;this.others=new Map();this.cameraMoveSpeed=Number(localStorage.getItem('solvi-camera-speed')||2.6);
    this.raycaster=new THREE.Raycaster();this.mouse=new THREE.Vector2();
    this.setupEnvironment();this.setupEvents();this.setupXR();
    const fly=document.getElementById('cameraFlyButton');
    document.getElementById('cameraSpeed').value=this.cameraMoveSpeed;document.getElementById('cameraSpeed').oninput=e=>{this.cameraMoveSpeed=Number(e.target.value);localStorage.setItem('solvi-camera-speed',String(this.cameraMoveSpeed));};
    // Orbit is an independent scene-navigation action, even with a robot selected.
    // Do not enter pointer-lock on an Orbit button; pointer-lock blocks orbit gestures.
    fly.title='Orbit the scene: drag to rotate, right-drag to pan, wheel to zoom';
    fly.onclick=event=>{if(event.altKey){this.renderer.domElement.requestPointerLock()?.catch(()=>{});return;}if(document.pointerLockElement===this.renderer.domElement)document.exitPointerLock();this.setCameraFollowMode('free');this.cameraOrbitGesture=null;this.editorGizmoPointer=false;this.controls.enabled=false;this.controls.update();fly.textContent='Orbit scene';};
    document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===this.renderer.domElement;fly.textContent=locked?'Fly · Esc':'Orbit scene';this.cameraOrbitGesture=null;this.controls.enabled=false;});
    const followButton=document.getElementById('cameraFollowButton');
    if(followButton)followButton.addEventListener('click',()=>this.setCameraFollowMode(nextCameraMode(this.cameraFollowMode)));
    const smartSlider=document.getElementById('smartChaseAngleSlider');if(smartSlider){smartSlider.value=String(this.smartTurnThreshold);smartSlider.addEventListener('input',e=>{this.smartTurnThreshold=Math.max(5,Math.min(120,Number(e.target.value)||35));localStorage.setItem('solvi-smart-chase-threshold',String(this.smartTurnThreshold));this.updateChaseDistanceUI();});}
    const chaseSlider=document.getElementById('chaseDistanceSlider');
    if(chaseSlider)chaseSlider.addEventListener('input',event=>this.cameraFollowMode==='orbit'?this.setOrbitDistance(event.target.value):this.setChaseDistance(event.target.value));
    // Capture before OrbitControls' wheel handler to avoid fighting its own dolly.
    // Apple trackpads dispatch wheel events, sometimes with ctrlKey for pinch.
    this.renderer.domElement.addEventListener('wheel',event=>{
      if(!['chase','chase-smart','orbit'].includes(this.cameraFollowMode)||!this.robotEditor?.robot()||this.renderer.xr.isPresenting)return;
      event.preventDefault();event.stopImmediatePropagation();
      const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?500:1);
      if(['chase','chase-smart'].includes(this.cameraFollowMode))this.setChaseDistance(zoomChaseDistance(this.followChaseDistance,delta));
      else this.setOrbitDistance(zoomChaseDistance(this.followOrbitDistance,delta));
    },{capture:true,passive:false});
    // A released pointer is not a camera drag. Keep OrbitControls enabled while idle
    // so trackpad two-finger scroll and Ctrl+wheel pinch zoom reach its wheel handler.
    // The editor clears stale _pointers on release and blocks transform gestures.
    this.controls.enabled=true;
    // macOS trackpad: two-finger scroll pans; pinch sends Ctrl+wheel and
    // reaches OrbitControls' native dolly. A physical mouse wheel still zooms.
    this.renderer.domElement.addEventListener('wheel',event=>{
      if(this.cameraFollowMode!=='free'||!isTrackpadPan(event)||this.editorDragging||this.editorGizmoPointer||this.renderer.xr.isPresenting||document.pointerLockElement===this.renderer.domElement)return;
      event.preventDefault();event.stopImmediatePropagation();
      const distance=Math.max(.35,this.camera.position.distanceTo(this.controls.target));
      const size=this.renderer.domElement.getBoundingClientRect();
      const pan=trackpadPanDelta(event.deltaX,event.deltaY,distance,this.camera.fov,Math.max(1,size.height));
      const direction=this.camera.getWorldDirection(new THREE.Vector3());
      const right=new THREE.Vector3().crossVectors(direction,new THREE.Vector3(0,1,0)).normalize();
      if(right.lengthSq()<.001)right.set(1,0,0);
      const up=new THREE.Vector3().crossVectors(right,direction).normalize();
      const translate=right.multiplyScalar(pan.x).addScaledVector(up,pan.y);
      this.camera.position.add(translate);this.controls.target.add(translate);this.controls.update();
    },{capture:true,passive:false});
    this.refreshFollowButton();
    document.addEventListener('mousemove',event=>{if(document.pointerLockElement!==this.renderer.domElement)return;
       const euler=new THREE.Euler().setFromQuaternion(this.camera.quaternion,'YXZ');euler.y-=event.movementX*.002;euler.x=Math.max(-1.53,Math.min(1.53,euler.x-event.movementY*.002));this.camera.quaternion.setFromEuler(euler);
       const distance=Math.max(2,this.camera.position.distanceTo(this.controls.target));this.controls.target.copy(this.camera.position).addScaledVector(this.camera.getWorldDirection(new THREE.Vector3()),distance);
    });
    window.addEventListener('solvi:prefs-changed',event=>{for(const peer of this.others.values())if(peer.faceModel)peer.faceModel.rotation.y=event.detail.flipHead?Math.PI:0;});
    this.renderer.setAnimationLoop(()=>this.frame());
  }
  setupEnvironment(){
    this.scene.add(new THREE.HemisphereLight(0xc8e4ff,0x34485f,2.3));
    const sunlight=new THREE.DirectionalLight(0xffeed7,3.6);sunlight.position.set(4,9,7);sunlight.castShadow=true;
    sunlight.shadow.mapSize.set(1024,1024);sunlight.shadow.camera.left=-16;sunlight.shadow.camera.right=16;
    sunlight.shadow.camera.top=16;sunlight.shadow.camera.bottom=-16;sunlight.shadow.normalBias=.025;
    this.scene.add(sunlight);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(70,70),new THREE.MeshStandardMaterial({color:'#344758',roughness:.97}));
    ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.name='floor';this.scene.add(ground);this.floor=ground;
    this.grid=new THREE.GridHelper(70,70,'#455a6a','#3b5061');this.grid.position.y=.007;this.scene.add(this.grid);
    this.skyDome=createSkyDome(THREE);this.scene.add(this.skyDome);this.applyEnvironment(this.environment);
    const boxGeo=new THREE.BoxGeometry(1,1,1);
    const palette=['#d1b29b','#638c9c','#8c89af','#8c9b83','#b78e78'];
    this.obstacles=[];
    for(let i=0;i<0;i++){
      const x=random(-13,13),z=random(-12,12);
      if(Math.hypot(x,z)<3.5)continue;
      const h=random(.5,2.6);
      const m=new THREE.Mesh(boxGeo,new THREE.MeshStandardMaterial({color:palette[i%palette.length],roughness:.76,metalness:.05}));
      m.position.set(x,h/2,z);m.scale.set(random(.5,1.8),h,random(.6,1.6));m.castShadow=true;m.receiveShadow=true;this.scene.add(m);
      this.obstacles.push(m);
    }
    // The world begins empty: only the ground plane and grid are visible.
    this.remoteFaceSource=null;this.remoteFaceLoading=null;
  }
  applyEnvironment(input={}){
    const previous=this.environment||ENVIRONMENT_DEFAULTS;
    const cfg=normalizeEnvironment(input);this.environment=cfg;
    this.scene.background=new THREE.Color(cfg.backgroundColor);
    this.scene.fog=cfg.fogEnabled?new THREE.Fog(cfg.fogColor,cfg.fogNear,cfg.fogFar):null;
    const previousSize=previous.floorSize;
    if(this.floor){
      if(previousSize!==cfg.floorSize||this.floor.geometry.parameters.width!==cfg.floorSize){
        const old=this.floor.geometry;this.floor.geometry=new THREE.PlaneGeometry(cfg.floorSize,cfg.floorSize);old.dispose();
      }
      this.floor.material.color.set(cfg.floorColor);
      if(previous.floorTexture!==cfg.floorTexture||this.floorTextureStyle!==cfg.floorTexture){
        this.floor.material.map?.dispose?.();
        this.floor.material.map=createFloorTexture(cfg.floorTexture);this.floorTextureStyle=cfg.floorTexture;
        this.floor.material.needsUpdate=true;
      }
      if(this.floor.material.map)this.floor.material.map.repeat.set(cfg.floorSize/4,cfg.floorSize/4);
    }
    if(this.grid){
      if(previousSize!==cfg.floorSize||previous.gridColor!==cfg.gridColor){
        const old=this.grid;this.scene.remove(old);old.geometry.dispose();
        if(Array.isArray(old.material))old.material.forEach(m=>m.dispose());else old.material.dispose();
        // A fixed division ceiling keeps giant worlds from producing thousands of lines.
        const divisions=Math.min(200,Math.max(20,Math.round(cfg.floorSize/2)));
        this.grid=new THREE.GridHelper(cfg.floorSize,divisions,cfg.gridColor,cfg.gridColor);
        this.grid.position.y=.007;this.scene.add(this.grid);
      }
      this.grid.visible=cfg.gridEnabled;
    }
    if(this.skyDome){
      this.skyDome.visible=cfg.skyType!=='solid';
      const u=this.skyDome.material.uniforms;
      u.uTop.value.set(cfg.skyTop);u.uHorizon.value.set(cfg.skyHorizon);
      u.uIntensity.value=cfg.skyIntensity;u.uDensity.value=cfg.starDensity;u.uMode.value=skyModeIndex(cfg.skyType);
    }
    this.refreshWorldViewDistance();
    return cfg;
  }
  refreshWorldViewDistance(){
    if(!this.camera||!this.controls)return;
    const max=environmentViewLimit(this.environment,this.sceneExtent);
    this.camera.far=max;this.camera.updateProjectionMatrix();
    this.controls.maxDistance=Math.max(150,this.environment.floorSize*.85,max*.8);
    if(this.skyDome)this.skyDome.scale.setScalar(max*.94);
  }
  updateWorldExtent(){
    // Include oversized furniture and user-imported models outside the ground footprint.
    const items=this.robotEditor?.items||[];
    let max=0;
    const bounds=new THREE.Box3();
    for(const object of items){
      if(!object?.visible)continue;
      bounds.setFromObject(object);
      if(bounds.isEmpty())continue;
      const x=Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x));
      const y=Math.max(Math.abs(bounds.min.y),Math.abs(bounds.max.y));
      const z=Math.max(Math.abs(bounds.min.z),Math.abs(bounds.max.z));
      max=Math.max(max,Math.hypot(x,y,z));
    }
    if(Math.abs(max-this.sceneExtent)>5){this.sceneExtent=max;this.refreshWorldViewDistance();}
  }
  async loadAvatar(url='./assets/solvi-character.glb'){
    const draco=new DRACOLoader();draco.setDecoderPath('./vendor/three/draco/');
    const loader=new GLTFLoader();loader.setDRACOLoader(draco);
    try{
      const gltf=await loader.loadAsync(url);
      const model=gltf.scene;
      const bbox=new THREE.Box3().setFromObject(model);
      const sz=bbox.getSize(new THREE.Vector3());
      const center=bbox.getCenter(new THREE.Vector3());
      if(sz.y>0){const s=1.85/sz.y;model.scale.setScalar(s);model.position.set(-center.x*s,-bbox.min.y*s,-center.z*s);}
      model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
      this.actor.add(model);
      this.animator=new MotionController(THREE,model,gltf.animations);
      this.ready=true;
      console.info('Loaded rig:',gltf.animations.map(a=>a.name));
      this.onState({loaded:true,clips:gltf.animations.length});
    }catch(e){
      console.error('Unable to load avatar GLB:',e);
      this.onState({loaded:false,error:e.message});
      // Geometric humanoid fallback keeps the app usable while asset loading is repaired.
      const bodyMat=new THREE.MeshStandardMaterial({color:'#c1d2e0',roughness:.7});
      const body=new THREE.Mesh(new THREE.CapsuleGeometry(.35,.95,5,12),bodyMat);body.position.y=1;this.actor.add(body);
      const head=new THREE.Mesh(new THREE.SphereGeometry(.25,20,16),bodyMat);head.position.y=1.88;this.actor.add(head);
    }finally{draco.dispose();}
  }
  setupEvents(){
    window.addEventListener('resize',()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);});
    // Camera locomotion is arrow-only while no owned robot is selected.
    // W/A/S/D/G/R are reserved for editor shortcuts (Blender-like).
    window.addEventListener('keydown',e=>{if(e.target?.closest?.('input,textarea,select,[contenteditable]')||e.ctrlKey||e.metaKey||e.altKey)return;
      if(e.code==='KeyV'&&!e.repeat){e.preventDefault();this.setCameraFollowMode(nextCameraMode(this.cameraFollowMode));return;}
      if(/^(ArrowUp|ArrowDown|ArrowLeft|ArrowRight|PageUp|PageDown|ShiftLeft|ShiftRight)$/.test(e.code)){
       const robot=this.robotEditor?.robot();
       if(robot&&this.robotEditor.canEdit(robot)&&e.code.startsWith('Arrow')){this.keys.delete(e.code);return;}
       this.keys.add(e.code);if(e.code.startsWith('Arrow')||e.code.startsWith('Page'))e.preventDefault();this.pending=null;
      }});
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>{this.keys.clear();this.cameraOrbitGesture=null;this.editorGizmoPointer=false;this.controls.enabled=false;});
    let dragX=0,dragY=0;
    this.renderer.domElement.addEventListener('pointerdown',e=>{dragX=e.clientX;dragY=e.clientY;});
    this.renderer.domElement.addEventListener('pointermove',e=>{
      if(!e.buttons||!['chase','chase-smart'].includes(this.cameraFollowMode)||this.editorDragging||this.editorGizmoPointer||this.renderer.xr.isPresenting)return;
      if((e.buttons&1)&&Math.hypot(e.clientX-dragX,e.clientY-dragY)>6)this.syncFollowAfterManualView();
    });
    this.renderer.domElement.addEventListener('pointerup',e=>{
      // Let OrbitControls receive pointerup even when the editor selected a mesh.
      if(e.solviObjectPicked)return;
      if(Math.hypot(e.clientX-dragX,e.clientY-dragY)>5||this.renderer.xr.isPresenting)return;
      this.mouse.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);
      this.raycaster.setFromCamera(this.mouse,this.camera);
      if(!this.allowFloorWalk)return;
      const hits=this.raycaster.intersectObject(this.floor);
      if(hits.length){this.pending=new THREE.Vector3(hits[0].point.x,0,hits[0].point.z);this.idleTimer=0;}
    });
  }
  setMode(mode){
    if(mode==='auto'){this.roam=true;this.pending=null;this.idleTimer=.5;return;}
    this.roam=false;
    if(mode==='idle'){this.pending=null;this.gestureUntil=0;this.currentMode='idle';this.animator?.play('idle');}
    else if(mode==='wave'){this.pending=null;this.gestureUntil=performance.now()+1750;this.currentMode='wave';this.animator?.play('wave');}
    else if(['walk','run'].includes(mode)){
      this.desiredSpeed=mode==='run'?3.3:1.4;
      this.pending=new THREE.Vector3(random(-4,4),0,random(-4,4));
    }
  }
  pickRoamTarget(){
    for(let i=0;i<16;i++){
      const x=random(-6,6),z=random(-6,6);
      if(this.obstacles.every(o=>o.position.distanceTo(new THREE.Vector3(x,o.position.y,z))>1.8)){
        this.pending=new THREE.Vector3(x,0,z);break;
      }
    }
    this.desiredSpeed=Math.random()<.16?3.2:1.35;
  }
  updateMovement(dt){
    if(!this.ready)return;
    let vx=0,vz=0,speed=0;
    const forward=this.keys.has('ArrowUp')?1:this.keys.has('ArrowDown')?-1:0;
    const strafe=this.keys.has('ArrowRight')?1:this.keys.has('ArrowLeft')?-1:0;
    if(forward||strafe){
      const camdir=new THREE.Vector3();this.camera.getWorldDirection(camdir);camdir.y=0;camdir.normalize();
      const right=new THREE.Vector3(-camdir.z,0,camdir.x);
      const d=camdir.multiplyScalar(forward).addScaledVector(right,strafe).normalize();
      vx=d.x;vz=d.z;speed=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?3.3:1.4;
    }else if(this.pending){
      const d=this.pending.clone().sub(this.character.position);d.y=0;
      if(d.length()<.10){this.pending=null;this.idleTimer=random(1.5,6);}
      else{d.normalize();vx=d.x;vz=d.z;speed=this.desiredSpeed;}
    }else if(this.roam){this.idleTimer-=dt;if(this.idleTimer<=0)this.pickRoamTarget();}
    if(speed){
      const worldLimit=Math.max(16,this.environment.floorSize/2-.4);
      this.character.position.x=clamp(this.character.position.x+vx*speed*dt,-worldLimit,worldLimit);
      this.character.position.z=clamp(this.character.position.z+vz*speed*dt,-worldLimit,worldLimit);
      const heading=Math.atan2(vx,vz);let diff=((heading-this.character.rotation.y+Math.PI*3)%(2*Math.PI))-Math.PI;
      this.character.rotation.y+=diff*Math.min(1,dt*8);
    }
    const mode=this.gestureUntil>performance.now()?'wave':computeMode(speed);
    if(mode!==this.currentMode){this.currentMode=mode;this.animator?.play(mode);}
    this.animator?.update(dt);
    this.onPose?.({x:+this.character.position.x.toFixed(2),z:+this.character.position.z.toFixed(2),yaw:+this.character.rotation.y.toFixed(2),mode});
  }
  async loadRemoteFace(){
    if(this.remoteFaceLoading)return this.remoteFaceLoading;
    this.remoteFaceLoading=(async()=>{
      const loader=new GLTFLoader();const ktx=new KTX2Loader();
      ktx.setTranscoderPath('./vendor/three/basis/');ktx.detectSupport(this.renderer);
      loader.setKTX2Loader(ktx);loader.setMeshoptDecoder(MeshoptDecoder);
      try{
        const gltf=await loader.loadAsync('./assets/facecap.glb');
        this.remoteFaceSource=gltf.scene;
        for(const peer of this.others.values())this.addFaceToPeer(peer);
      }catch(error){console.warn('FaceCap GLB unavailable; using visible fallback heads.',error);}
      finally{ktx.dispose();}
    })();return this.remoteFaceLoading;
  }
  labelSprite(text,background='#142539'){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.fillStyle=background;ctx.beginPath();ctx.roundRect(4,8,504,104,22);ctx.fill();
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 37px system-ui';ctx.fillStyle='#ffffff';ctx.fillText(String(text||'Guest').slice(0,25),256,60,478);
    const texture=new THREE.CanvasTexture(canvas);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));sprite.scale.set(1.38,.35,1);
    return sprite;
  }
  addFaceToPeer(peer){
    if(!this.remoteFaceSource||peer.faceModel)return;
    const model=this.remoteFaceSource.clone(true);
    const box=new THREE.Box3().setFromObject(model);const size=box.getSize(new THREE.Vector3());
    if(size.y>.001){const k=.52/size.y;model.scale.setScalar(k);model.position.set(-box.getCenter(new THREE.Vector3()).x*k,-box.getCenter(new THREE.Vector3()).y*k,-box.getCenter(new THREE.Vector3()).z*k);}
    model.rotation.y=readPreferences().flipHead?Math.PI:0;peer.faceGroup.add(model);peer.faceModel=model;peer.fallback.visible=false;
  }
  ensurePeer(id,state={}){
    if(this.others.has(id))return this.others.get(id);
    const group=new THREE.Group();
    const faceGroup=new THREE.Group();faceGroup.position.y=1.65;group.add(faceGroup);
    const fallback=new THREE.Mesh(new THREE.SphereGeometry(.26,24,16),new THREE.MeshStandardMaterial({color:'#a6d9ee',roughness:.65}));faceGroup.add(fallback);
    const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.24,.38,4,10),new THREE.MeshStandardMaterial({color:0x86b8cc,roughness:.75,transparent:true,opacity:.34}));torso.position.y=1.14;group.add(torso);
    const label=this.labelSprite(state.name||'Guest');label.position.y=2.12;group.add(label);
    this.scene.add(group);
    const rings=[];
    for(let j=0;j<3;j++){
      const ring=new THREE.Mesh(new THREE.RingGeometry(.27,.295,48),new THREE.MeshBasicMaterial({color:0x9adcf9,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
      ring.position.set(0,0,.35+j*.12);faceGroup.add(ring);rings.push(ring);
    }
    const limbs=new THREE.Group();group.add(limbs);
    const peer={group,faceGroup,fallback,label,limbs,rings,torso,voiceLevel:0,voiceBands:[0,0,0],name:state.name||'Guest',faceModel:null,balloon:null,balloonTimeout:0};
    this.others.set(id,peer);this.addFaceToPeer(peer);
    this.loadRemoteFace();return peer;
  }
  setRemotePeers(peers){
    for(const [id,peer] of this.others){if(!peers.has(id)){
      this.scene.remove(peer.group);peer.label.material.map.dispose();peer.label.material.dispose();this.others.delete(id);
    }}
    for(const [id,data] of peers){const state=data.state||data;const peer=this.ensurePeer(id,{name:data.name||state.name||'Guest'});this.updateRemoteState(id,state);}
    const out=document.getElementById('visitorCount');if(out)out.textContent=`${peers.size+1} in room`;
  }
  updateRemoteState(id,state){
    if(!state)return;const peer=this.ensurePeer(id,{name:state.name||'Guest'});
    if(Number.isFinite(+state.x)&&Number.isFinite(+state.z))peer.group.position.set(Number(state.x),Math.max(-1,Math.min(12,(Number(state.y)||1.65)-1.65)),Number(state.z));
    // 'yaw' is the calibrated world gaze direction (world +Z is avatar forward).
    const worldYaw=Number(state.yaw)||0;
    peer.group.rotation.y+=Math.atan2(Math.sin(worldYaw-peer.group.rotation.y),Math.cos(worldYaw-peer.group.rotation.y))*.32;
    if(Array.isArray(state.headRotation)&&state.headRotation.length===3){
      const [pitch,yaw,roll]=state.headRotation;
      for(const [axis,value] of [['x',pitch],['y',yaw],['z',roll]]){
        const target=Number(value)||0;
        peer.faceGroup.rotation[axis]+=Math.atan2(Math.sin(target-peer.faceGroup.rotation[axis]),Math.cos(target-peer.faceGroup.rotation[axis]))*.40;
      }
      peer.faceGroup.rotation.order='YXZ';
    }
    peer.voiceLevel=Math.max(0,Math.min(1,Number(state.voiceLevel)||0));peer.voiceBands=Array.isArray(state.voiceBands)?state.voiceBands.slice(0,3).map(x=>Math.min(1,Math.max(0,Number(x)||0))):[0,0,0];
    if(state.body&&typeof state.body==='object')this.updatePeerBody(peer,state.body);
    const dict=state.face||{};
    peer.faceModel?.traverse(obj=>{if(!obj.morphTargetDictionary||!obj.morphTargetInfluences)return;
      for(const [key,value] of Object.entries(dict)){
        const index=obj.morphTargetDictionary[key]??obj.morphTargetDictionary[key.replace('Left','_L').replace('Right','_R')];
        if(index!==undefined)obj.morphTargetInfluences[index]=Math.max(0,Math.min(1,Number(value)||0));
      }
    });
  }
  showPeerMessage(id,text){const peer=this.others.get(id);if(!peer||!text)return;
    if(peer.balloon){peer.group.remove(peer.balloon);peer.balloon.material.map.dispose();peer.balloon.material.dispose();}
    peer.balloon=this.labelSprite(text.slice(0,42),'#27506a');peer.balloon.position.y=2.54;peer.balloon.scale.set(2.2,.40,1);peer.group.add(peer.balloon);
    const token=++peer.balloonTimeout;setTimeout(()=>{if(peer.balloonTimeout===token&&peer.balloon){peer.group.remove(peer.balloon);peer.balloon.material.map.dispose();peer.balloon.material.dispose();peer.balloon=null;}},6500);
  }
  updatePeerBody(peer,body){
    // Stylised upper-body: shoulders, elbows, wrists and palm/index landmarks.
    const links=[['leftShoulder','rightShoulder'],['leftShoulder','leftElbow'],['leftElbow','leftWrist'],['rightShoulder','rightElbow'],['rightElbow','rightWrist'],['leftWrist','leftIndex'],['rightWrist','rightIndex']];
    while(peer.limbs.children.length){const child=peer.limbs.children[0];peer.limbs.remove(child);child.geometry?.dispose();child.material?.dispose();}
    const point=name=>{
      const a=body[name];if(!Array.isArray(a)||a.length!==3)return null;
      return new THREE.Vector3(Math.max(-2,Math.min(2,a[0])),Math.max(.15,Math.min(2.8,a[1])),Math.max(-1,Math.min(1,a[2])));
    };
    const left=point('leftShoulder'),right=point('rightShoulder');
    peer.torso.visible=!(left&&right);
    if(left&&right){
      const middle=left.clone().add(right).multiplyScalar(.5);
      const neck=new THREE.Vector3(0,peer.faceGroup.position.y-.2,0);
      const torso=middle.clone().add(new THREE.Vector3(0,-.48,.04));
      const neckLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([neck,middle,torso]),new THREE.LineBasicMaterial({color:0xb7e2ec,transparent:true,opacity:.8}));peer.limbs.add(neckLine);
      const chest=new THREE.Mesh(new THREE.SphereGeometry(.28,12,8),new THREE.MeshBasicMaterial({color:0x79c6d5,transparent:true,opacity:.12,depthWrite:false}));chest.position.copy(middle).add(new THREE.Vector3(0,-.21,0));chest.scale.set(Math.max(.85,left.distanceTo(right)*1.55),.9,.42);peer.limbs.add(chest);
    }
    for(const [a,b] of links){const p1=point(a),p2=point(b);if(!p1||!p2)continue;
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([p1,p2]),new THREE.LineBasicMaterial({color:0x93dbea,transparent:true,opacity:.75}));peer.limbs.add(line);
    }
    // Palm and finger joints: thumb, index, middle, ring and pinky. 21 landmarks per hand.
    const fingerChains=[[0,1,2,3,4],[0,5,6,7,8],[0,9,10,11,12],[0,13,14,15,16],[0,17,18,19,20]];
    for(const side of ['left','right']){
      const hand=body[side+'Hand'];if(!Array.isArray(hand)||hand.length!==21)continue;
      const points=hand.map(item=>Array.isArray(item)&&item.length===3?new THREE.Vector3(...item):null);
      const wrist=point(side+'Wrist');if(wrist&&points[0]){const offset=wrist.clone().sub(points[0]);for(const candidate of points)candidate?.add(offset);}
      for(const chain of [...fingerChains,[0,5,9,13,17,0]])for(let i=1;i<chain.length;i++){
        const a=points[chain[i-1]],b=points[chain[i]];if(!a||!b)continue;
        peer.limbs.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),new THREE.LineBasicMaterial({color:0xb7f7f0,transparent:true,opacity:.85})));
      }
      for(const tip of [0,4,8,12,16,20])if(points[tip]){
        const joint=new THREE.Mesh(new THREE.SphereGeometry(.028,7,5),new THREE.MeshBasicMaterial({color:0xdafef7}));joint.position.copy(points[tip]);peer.limbs.add(joint);
      }
    }
    for(const name of ['leftWrist','rightWrist','leftIndex','rightIndex']){const p=point(name);if(!p)continue;
      const marker=new THREE.Mesh(new THREE.SphereGeometry(.055,8,6),new THREE.MeshBasicMaterial({color:0xb4f8d8}));marker.position.copy(p);peer.limbs.add(marker);
    }
  }
  updateVoiceRings(dt){
    const now=performance.now()/1000;
    for(const peer of this.others.values()){
      const loud=peer.voiceLevel||0;
      peer.voiceLevel=Math.max(0,loud-dt*.9);
      peer.rings?.forEach((ring,index)=>{
        const phase=(now*.85+index/3)%1;
        const band=peer.voiceBands?.[index]||0;
        const gain=Math.min(1,peer.voiceLevel*2.4+band*.6);
        ring.material.opacity=gain*(1-phase)*(.24+band*.34);
        ring.material.color.setHSL(.52+index*.065,.48+band*.36,.66);
        ring.scale.setScalar(.85+phase*(1.6+band*2.3));
      });
    }
  }
  setupXR(){
    const btn=document.getElementById('xrButton');
    const toast=(message)=>{const el=document.getElementById('toast');el.textContent=message;el.hidden=false;};
    const stage=document.getElementById('xrStageButton');btn.hidden=true;stage.hidden=true;
    if(navigator.xr?.isSessionSupported && navigator.xr?.requestSession){navigator.xr.isSessionSupported('immersive-vr').then(supported=>{btn.hidden=!supported;stage.hidden=!supported;}).catch(()=>{btn.hidden=true;stage.hidden=true;});}
    stage.onclick=()=>btn.click();btn.disabled=false;btn.textContent='VR';btn.title='WebXR: Meta Quest / compatible headset browser';
    btn.addEventListener('click',async()=>{
      if(this.renderer.xr.isPresenting){await this.renderer.xr.getSession()?.end();return;}
      if(!navigator.xr){toast('VR requires a WebXR-enabled browser on a supported headset (e.g. Meta Quest Browser).');return;}
      try{
        if(!await navigator.xr.isSessionSupported('immersive-vr')){
          toast('Immersive VR is not supported on this device. Open SOLVI.help in a headset browser.');return;
        }
        let session;
        try {
          this.renderer.xr.setReferenceSpaceType('local-floor');
          session=await navigator.xr.requestSession('immersive-vr',{
            requiredFeatures:['local-floor'],optionalFeatures:['hand-tracking','bounded-floor']});
        }catch(floorError){
          // A seated device can still provide 'local' tracking.
          this.renderer.xr.setReferenceSpaceType('local');
          session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['hand-tracking']});
        }
        try{await this.renderer.xr.setSession(session);}catch(e){await session.end().catch(()=>{});throw e;}
        btn.textContent='Exit VR';stage.hidden=true;this.xrMenuPlaced=false;this.teleportAim=null;
        this.renderer.xr.setFoveation?.(.8);
        session.addEventListener('end',()=>{
          btn.textContent='VR';stage.hidden=false;this.xrMenu.visible=false;
          this.teleportIndicator.visible=false;this.teleportAim=null;
          this.renderer.xr.setReferenceSpaceType('local-floor');
        },{once:true});
      }catch(e){toast('Cannot start VR: '+e.message);console.warn('XR session:',e);}
    });
    // Floating menu: controller ray / hand select can trigger animations.
    this.xrMenu=new THREE.Group();
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(.88,1.04),
      new THREE.MeshBasicMaterial({color:0x102136,transparent:true,opacity:.94,side:THREE.DoubleSide,depthTest:false}));
    this.xrMenu.add(panel);
    this.xrButtons=[];
    for(const [index,mode] of ['cube','sphere','light','room'].entries()){
      const cv=document.createElement('canvas');cv.width=256;cv.height=72;
      const ctx=cv.getContext('2d');ctx.fillStyle='#294960';ctx.fillRect(0,0,256,72);
      ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.font='600 30px system-ui';
      ctx.fillText(mode.toUpperCase(),128,47);
      const tex=new THREE.CanvasTexture(cv);
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.68,.19),
        new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide,depthTest:false}));
      mesh.position.set(0,.35-index*.23,.01);mesh.userData.action=mode;
      this.xrMenu.add(mesh);this.xrButtons.push(mesh);
    }
    this.xrMenu.visible=false;this.scene.add(this.xrMenu);
    // Ray-facing XR controls appear only when targeting a media object, never as permanent overlays.
    this.xrMediaControls=new THREE.Group();this.xrMediaControls.name='XR media controls';this.xrMediaControls.visible=false;
    this.xrMediaButtons=[];
    for(const [action,label,index] of [['play','▶ / Ⅱ',0],['mute','🔈 / ×',1],['cc','CC',2]]){
      const cv=document.createElement('canvas');cv.width=240;cv.height=88;
      const ctx=cv.getContext('2d');ctx.fillStyle='#152d43';ctx.beginPath();ctx.roundRect(0,0,240,88,16);ctx.fill();ctx.font='bold 36px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#a7eeff';ctx.fillText(label,120,44);
      const tex=new THREE.CanvasTexture(cv);
      const btn=new THREE.Mesh(new THREE.PlaneGeometry(.32,.13),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide,depthTest:false}));
      btn.position.set((index-1)*.36,0,.02);btn.userData.mediaAction=action;
      this.xrMediaControls.add(btn);this.xrMediaButtons.push(btn);
    }
    this.scene.add(this.xrMediaControls);

    // Ring indicates controller/hand teleport destination on the floor.
    this.teleportIndicator=new THREE.Mesh(new THREE.RingGeometry(.17,.27,36),
      new THREE.MeshBasicMaterial({color:0x72e7ff,side:THREE.DoubleSide,depthTest:false}));
    this.teleportIndicator.rotation.x=-Math.PI/2;this.teleportIndicator.position.y=.023;
    this.teleportIndicator.visible=false;this.scene.add(this.teleportIndicator);
    this.xrInputs=[];
    const controllerFactory=new XRControllerModelFactory();
    const handFactory=new XRHandModelFactory();
    for(let i=0;i<2;i++){
      const controller=this.renderer.xr.getController(i);
      // A simple ray works even when a native controller profile cannot be fetched.
      const beam=new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,-5)]),
        new THREE.LineBasicMaterial({color:0x9fe3ff,transparent:true,opacity:.7}));
      beam.name='Teleport ray';controller.add(beam);
      controller.addEventListener('selectstart',async()=>{
        if(!this.renderer.xr.isPresenting)return;
        const selection=this.xrRaycast(controller);
        if(selection.menu){const action=selection.menu.userData.action;if(action==='room'){const select=document.getElementById('roomSelect');if(select&&select.options.length>1){select.selectedIndex=(select.selectedIndex+1)%select.options.length;select.dispatchEvent(new Event('change'));}}else window.solviEditor?.add(action);return;}
        const mediaTarget=selection.mediaTarget||this.xrMediaTarget;
        if((selection.mediaButton||selection.mediaTarget)&&mediaTarget){
          if(selection.mediaButton?.userData.mediaAction==='mute')setSceneMediaMuted(mediaTarget,!sceneMediaMuted(mediaTarget));
          else if(selection.mediaButton?.userData.mediaAction==='cc'){const media=mediaTarget.userData.media||{};try{const result=media.caption?{text:media.caption}:await window.solviAPI?.req('/api/media/'+encodeURIComponent(media.id)+'/caption');if(!result?.text)return;mediaTarget.userData.captionVisible=!mediaTarget.userData.captionVisible;showSceneMediaCaptions(mediaTarget,this,result.text,mediaTarget.userData.captionVisible);}catch(error){console.warn('XR caption unavailable',error);}}
          else toggleSceneMediaPlayback(mediaTarget);
          return;
        }
        this.xrInputs[i].selecting=true;
        this.xrInputs[i].landing=selection.floor?.point.clone()||null;
      });
      controller.addEventListener('selectend',()=>{
        const input=this.xrInputs[i];if(!input.selecting)return;
        input.selecting=false;
        if(input.landing)this.teleportTo(input.landing);
        input.landing=null;this.teleportIndicator.visible=false;
      });
      this.scene.add(controller);
      const grip=this.renderer.xr.getControllerGrip(i);
      const fallback=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,.13,9),
        new THREE.MeshStandardMaterial({color:0x80c6dc,roughness:.55}));
      fallback.rotation.x=Math.PI/2;grip.add(fallback);
      // Native controller models when their profiles are available. Primitive remains as fallback.
      grip.add(controllerFactory.createControllerModel(grip));
      this.scene.add(grip);
      const hand=this.renderer.xr.getHand(i);
      hand.add(handFactory.createHandModel(hand,'spheres'));
      this.scene.add(hand);
      this.xrInputs.push({controller,grip,hand,selecting:false,landing:null});
    }
  }
  xrRaycast(controller){
    controller.updateWorldMatrix(true,false);
    this.raycaster.setFromXRController(controller);
    const menu=this.raycaster.intersectObjects(this.xrButtons,false)[0]?.object;
    const mediaButton=this.xrMediaControls?.visible?this.raycaster.intersectObjects(this.xrMediaButtons,false)[0]?.object:null;
    const floor=this.raycaster.intersectObject(this.floor,false)[0];
    const media=this.robotEditor?.items?.filter(o=>o.userData.editorKind==='media')||[];
    const mediaHit=this.raycaster.intersectObjects(media,true)[0];
    let mediaTarget=mediaHit?.object;
    while(mediaTarget&&!mediaTarget.userData?.editorKind)mediaTarget=mediaTarget.parent;
    if(mediaHit&&floor&&mediaHit.distance>floor.distance)mediaTarget=null;
    return {menu,mediaButton,mediaTarget,floor:floor&&validTeleport(floor.point.x,floor.point.z,Math.max(16,this.environment.floorSize/2-1))?floor:null};
  }
  teleportTo(landing){
    const session=this.renderer.xr.getSession();
    const reference=this.renderer.xr.getReferenceSpace();
    if(!session||!reference||typeof XRRigidTransform==='undefined')return;
    const head=this.renderer.xr.getCamera();
    const current=head.getWorldPosition(new THREE.Vector3());
    if(!validTeleport(landing.x,landing.z,Math.max(16,this.environment.floorSize/2-1)))return;
    const offset=teleportOffset(current,landing);
    try{
      this.renderer.xr.setReferenceSpace(reference.getOffsetReferenceSpace(new XRRigidTransform(offset)));
    }catch(err){console.warn('XR teleport failed:',err);}
  }
  updateXR(){
    const presenting=this.renderer.xr.isPresenting;
    this.xrMenu.visible=presenting;
    if(!presenting){this.teleportIndicator.visible=false;if(this.xrMediaControls)this.xrMediaControls.visible=false;this.xrMediaTarget=null;return;}
    let target=null;
    for(const input of this.xrInputs||[]){const hit=this.xrRaycast(input.controller);if(hit.mediaTarget){target=hit.mediaTarget;break;}}
    if(target){this.xrMediaTarget=target;this.xrMediaControls.visible=true;this.xrMediaControls.position.copy(target.getWorldPosition(new THREE.Vector3()));this.xrMediaControls.position.y+=target.userData.media?.shape==='orb'?-.72:.72;
      this.xrMediaControls.lookAt(this.renderer.xr.getCamera().getWorldPosition(new THREE.Vector3()));}
    else if(!this.xrMediaTarget?.parent){this.xrMediaControls.visible=false;this.xrMediaTarget=null;}
    else this.xrMediaControls.visible=false;

    if(!this.xrMenuPlaced){
      const eye=this.renderer.xr.getCamera();
      const pos=eye.getWorldPosition(new THREE.Vector3());
      const fwd=new THREE.Vector3(0,0,-1).applyQuaternion(eye.getWorldQuaternion(new THREE.Quaternion()));
      fwd.y=0;fwd.normalize();
      const right=new THREE.Vector3().crossVectors(fwd,new THREE.Vector3(0,1,0)).normalize();
      if(pos.y<.2)return; // Wait for first tracked headset pose.
      this.xrMenu.position.copy(pos).addScaledVector(fwd,1.5).addScaledVector(right,.65);
      this.xrMenu.position.y=pos.y;
      this.xrMenu.lookAt(pos);
      this.xrMenuPlaced=true;
    }
    let found=false;
    for(const input of this.xrInputs){
      if(!input.selecting)continue;
      const hit=this.xrRaycast(input.controller);
      input.landing=hit.menu?null:hit.floor?.point.clone()||null;
      if(input.landing){
        this.teleportIndicator.position.set(input.landing.x,.024,input.landing.z);
        found=true;
      }
    }
    this.teleportIndicator.visible=found;
  }
  refreshFollowButton(){
    const button=document.getElementById('cameraFollowButton');if(!button)return;
    const labels={free:'Camera: Free',chase:'Camera: Chase','chase-smart':'Camera: Chase Smart',orbit:'Camera: Orbit follow'};
    const hasRobot=Boolean(this.robotEditor?.robot());
    const label=labels[this.cameraFollowMode]+(this.cameraFollowMode!=='free'&&!hasRobot?' · select robot':'');
    if(label!==this.lastFollowLabel){button.textContent=label;this.lastFollowLabel=label;}
    button.dataset.mode=this.cameraFollowMode;
    button.setAttribute('aria-label',label+'. Click to switch camera mode.');
    button.title='Cycle: Free → Chase → Chase Smart → Orbit follow (V). Adjust follow distance via slider or wheel/trackpad.';
    const control=document.getElementById('chaseDistanceControl');
    if(control)control.hidden=!['chase','chase-smart','orbit'].includes(this.cameraFollowMode);const smart=document.getElementById('smartChaseAngleControl');if(smart)smart.hidden=this.cameraFollowMode!=='chase-smart'||!this.robotEditor?.robot();
    this.updateChaseDistanceUI();
  }
  updateChaseDistanceUI(){
    const slider=document.getElementById('chaseDistanceSlider');
    const output=document.getElementById('chaseDistanceOutput');
    const distance=this.cameraFollowMode==='orbit'?this.followOrbitDistance:this.followChaseDistance;
    if(slider)slider.value=String(distance);
    if(output)output.textContent=`${distance.toFixed(1)} m`;const angle=document.getElementById('smartChaseAngleOutput');if(angle)angle.textContent=`${this.smartTurnThreshold}°`;
  }
  setChaseDistance(distance){
    this.followChaseDistance=clampChaseDistance(distance);
    this.followChaseCustomized=true;
    localStorage.setItem('solvi-chase-distance',String(this.followChaseDistance));
    this.updateChaseDistanceUI();
  }
  setOrbitDistance(distance){
    const next=clampChaseDistance(distance);this.followOrbitDistance=next;this.followOrbitCustomized=true;
    localStorage.setItem('solvi-orbit-distance',String(next));
    if(this.followOrbitOffset){const vector=new THREE.Vector3(this.followOrbitOffset.x,this.followOrbitOffset.y,this.followOrbitOffset.z);if(vector.lengthSq()<.001)vector.set(0,2,-1);vector.setLength(next);this.followOrbitOffset={x:vector.x,y:vector.y,z:vector.z};}
    this.updateChaseDistanceUI();
  }
  setCameraFollowMode(mode){
    if(!['free','chase','chase-smart','orbit'].includes(mode))return;
    this.cameraFollowMode=mode;localStorage.setItem('solvi-camera-follow',mode);
    this.followRobotId=null;this.smartFollowYaw=null;this.smartChaseEngaged=false;this.followOrbitOffset=null;this.cameraVelocity.set(0,0,0);
    if(mode!=='free'&&document.pointerLockElement===this.renderer.domElement)document.exitPointerLock();
    this.refreshFollowButton();
  }
  syncFollowAfterManualView(){
    if(this.cameraFollowMode==='free')return;
    const robot=this.robotEditor?.robot();if(!robot)return;
    // Numpad views should not be immediately overwritten by chase mode.
    if(['chase','chase-smart'].includes(this.cameraFollowMode))this.setCameraFollowMode('orbit');
    const anchor=followAnchor(robot);
    this.followOrbitOffset=localOrbitOffset(this.camera.position,anchor,robot.rotation.y);
    if(this.cameraFollowMode==='orbit'&&this.followOrbitCustomized)this.setOrbitDistance(this.followOrbitDistance);
    this.followRobotId=robot.userData.editorId;
    this.refreshFollowButton();
  }
  updateFollowCamera(dt){
    if(this.renderer.xr.isPresenting||document.pointerLockElement===this.renderer.domElement||this.cameraFollowMode==='free')return;
    const robot=this.robotEditor?.robot();
    if(!robot){this.followRobotId=null;this.followOrbitOffset=null;this.refreshFollowButton();return;}
    if(this.editorDragging||this.editorGizmoPointer)return;
    const anchor=followAnchor(robot),yaw=robot.rotation.y,id=robot.userData.editorId;
    if(id!==this.followRobotId){
      this.followRobotId=id;this.smartFollowYaw=yaw;this.smartChaseEngaged=false;
      const currentDistance=Math.hypot(this.camera.position.x-anchor.x,this.camera.position.z-anchor.z);
      // Keep the user-set chase distance across mode switches and robot selection.
      if(!this.followChaseCustomized)this.followChaseDistance=clampChaseDistance(currentDistance);
      this.updateChaseDistanceUI();
      this.followOrbitOffset=localOrbitOffset(this.camera.position,anchor,yaw);
      if(!this.followOrbitCustomized)this.followOrbitDistance=clampChaseDistance(Math.hypot(this.followOrbitOffset.x,this.followOrbitOffset.y,this.followOrbitOffset.z));
      else this.setOrbitDistance(this.followOrbitDistance);
      this.refreshFollowButton();
    }
    const target=this.controls.target;
    const orbiting=this.cameraOrbitGesture===true&&this.controls.enabled;
    if(this.cameraFollowMode==='orbit'&&orbiting){
      // Keep the moving robot under the orbit pivot without fighting the mouse.
      const previous=target.clone();target.lerp(new THREE.Vector3(anchor.x,anchor.y,anchor.z),smoothFactor(dt,12));
      this.camera.position.add(target.clone().sub(previous));
      this.followOrbitOffset=localOrbitOffset(this.camera.position,target,yaw);
      this.followOrbitDistance=clampChaseDistance(Math.hypot(this.followOrbitOffset.x,this.followOrbitOffset.y,this.followOrbitOffset.z));
      if(this.followOrbitCustomized)localStorage.setItem('solvi-orbit-distance',String(this.followOrbitDistance));
      this.updateChaseDistanceUI();this.controls.update();return;
    }
    if(this.cameraFollowMode==='chase-smart'){const smart=chaseSmartStep(this.smartFollowYaw??yaw,yaw,this.smartTurnThreshold,dt,this.smartChaseEngaged);this.smartFollowYaw=smart.yaw;this.smartChaseEngaged=smart.engaged;}
    const followingChase=['chase','chase-smart'].includes(this.cameraFollowMode);
    const local=followingChase?chaseOffset(this.followChaseDistance):this.followOrbitOffset;
    if(!local)return;
    const desired=cameraFromLocalOffset(anchor,local,this.cameraFollowMode==='chase-smart'?this.smartFollowYaw:yaw);
    target.lerp(new THREE.Vector3(anchor.x,anchor.y,anchor.z),smoothFactor(dt,followingChase?9:12));
    // Chase has deliberate drone inertia; orbit-follow keeps the chosen relative angle.
    this.camera.position.lerp(new THREE.Vector3(desired.x,desired.y,desired.z),smoothFactor(dt,this.cameraFollowMode==='chase-smart'?3.2:(followingChase?4.5:10)));
    this.controls.update();
  }
  focusCameraOn(object){
    // Preserve orientation and distance when changing the orbit pivot; do not orbit around scene origin.
    const center=new THREE.Vector3();
    const bounds=new THREE.Box3().setFromObject(object);
    if(bounds.isEmpty())center.copy(object.position);else bounds.getCenter(center);
    const delta=center.clone().sub(this.controls.target);
    this.camera.position.add(delta);this.controls.target.copy(center);
    this.controls.update();
  }
  zoomOnSelectedObject(direction){
    if(this.renderer.xr.isPresenting)return false;
    const selected=this.robotEditor?.selected;
    if(!selected)return false;
    const bounds=new THREE.Box3().setFromObject(selected);
    const center=new THREE.Vector3();
    if(bounds.isEmpty())center.copy(selected.position);else bounds.getCenter(center);
    const size=bounds.isEmpty()?1:bounds.getSize(new THREE.Vector3()).length();
    const minDistance=Math.max(.2,size*.2),maxDistance=this.controls.maxDistance;
    const vector=this.camera.position.clone().sub(center);
    if(vector.lengthSq()<.0001)vector.set(0,.3,1);
    const currentDistance=vector.length();
    const nextDistance=THREE.MathUtils.clamp(currentDistance*(direction>0?.8:1.25),minDistance,maxDistance);
    this.camera.position.copy(center).addScaledVector(vector.normalize(),nextDistance);
    this.controls.target.copy(center);
    this.camera.lookAt(center);
    this.controls.update();
    if(['chase','chase-smart'].includes(this.cameraFollowMode))this.setChaseDistance(nextDistance);
    else this.syncFollowAfterManualView();
    return true;
  }
  cameraPreset(key,reverse=false){
    if(this.renderer.xr.isPresenting)return;
    const selected=this.robotEditor?.selected;
    const bounds=selected?new THREE.Box3().setFromObject(selected):null;
    const center=new THREE.Vector3();
    if(bounds&&!bounds.isEmpty())bounds.getCenter(center);
    else if(selected)center.copy(selected.position);
    else center.copy(this.controls.target);
    // Numeric views only rotate the view direction. Never auto-fit/zoom based
    // on object size: preserve the viewer's existing distance to the pivot.
    const cameraOffset=this.camera.position.clone().sub(center);
    const distance=Math.max(this.controls.minDistance,cameraOffset.length());
    const current=cameraOffset.lengthSq()>.000001?cameraOffset.normalize():new THREE.Vector3(.5,.3,1).normalize();
    let offset=null;
    if(key===1)offset=new THREE.Vector3(0,0,reverse?-1:1);
    if(key===3)offset=new THREE.Vector3(reverse?-1:1,0,0);
    if(key===7)offset=new THREE.Vector3(0,reverse?-1:1,0);
    if(key===9)offset=current.clone().negate();
    if(key===0)offset=new THREE.Vector3(.7,.42,1);
    if(key===5){if(selected)this.focusCameraOn(selected);else{this.controls.target.copy(this.camera.position).addScaledVector(this.camera.getWorldDirection(new THREE.Vector3()),Math.max(3,distance));this.controls.update();}this.syncFollowAfterManualView();return;}
    if([2,4,6,8].includes(key)){
      const v=current.clone();const spherical=new THREE.Spherical().setFromVector3(v);
      if(key===4)spherical.theta-=Math.PI/12;
      if(key===6)spherical.theta+=Math.PI/12;
      if(key===2)spherical.phi+=Math.PI/12;
      if(key===8)spherical.phi-=Math.PI/12;
      spherical.phi=THREE.MathUtils.clamp(spherical.phi,.06,Math.PI-.06);
      offset=new THREE.Vector3().setFromSpherical(spherical);
    }
    if(!offset)return;
    offset.normalize();this.controls.target.copy(center);
    this.camera.up.set(0,1,0);
    if(Math.abs(offset.y)>.995)this.camera.up.set(0,0,reverse?1:-1);
    this.camera.position.copy(center).addScaledVector(offset,distance);
    this.camera.lookAt(center);this.controls.update();this.syncFollowAfterManualView();
  }
  navigateCamera(dt){
    // Inertia applies only to free camera translations, never gizmo drags.
    if(this.renderer.xr.isPresenting||this.editorDragging||this.editorGizmoPointer){this.cameraVelocity.set(0,0,0);return;}
    const robot=this.robotEditor?.robot();
    if(this.cameraFollowMode!=='free'&&robot){this.cameraVelocity.set(0,0,0);return;}
    if(robot&&this.robotEditor.canEdit(robot)&&this.robotEditor.controlMode==='robot'){this.cameraVelocity.set(0,0,0);return;}
    const {forward:f,side,vertical,boost}=freeCameraAxes(this.keys);
    const desired=new THREE.Vector3();
    if(f||side||vertical){
      const look=this.camera.getWorldDirection(new THREE.Vector3());look.y=0;
      if(look.lengthSq()<.001)look.set(0,0,-1);look.normalize();
      const right=new THREE.Vector3().crossVectors(look,new THREE.Vector3(0,1,0)).normalize();
      desired.copy(look).multiplyScalar(f).addScaledVector(right,side);desired.y+=vertical;
      desired.normalize().multiplyScalar(this.cameraMoveSpeed*boost);
    }
    const response=desired.lengthSq()>.001?8:10; // 0.1–0.2s acceleration/deceleration
    this.cameraVelocity.lerp(desired,1-Math.exp(-response*dt));
    if(this.cameraVelocity.lengthSq()<.00004&&!desired.lengthSq())this.cameraVelocity.set(0,0,0);
    const delta=this.cameraVelocity.clone().multiplyScalar(dt);
    this.camera.position.add(delta);this.controls.target.add(delta);
  }
  frame(){
    const dt=Math.min(.05,this.clock.getDelta());
    this.skyClock+=dt*this.environment.skySpeed;
    if(this.skyDome?.visible){this.skyDome.position.copy(this.camera.position);this.skyDome.material.uniforms.uTime.value=this.skyClock;}
    this.extentCheck+=dt;if(this.extentCheck>3){this.extentCheck=0;this.updateWorldExtent();}
    // Never give OrbitControls ownership of a TransformControls gesture.
    const cameraAllowed=this.cameraOrbitGesture!==false; // Idle wheel gestures and active camera drags; no transform drags.
    const sketchLocked=Boolean(this.robotEditor?.curveDrawing||this.robotEditor?.faceDrawing);
    this.controls.enabled=!sketchLocked&&!this.renderer.xr.isPresenting&&!this.editorDragging&&!this.editorGizmoPointer&&cameraAllowed&&document.pointerLockElement!==this.renderer.domElement;
    if(!sketchLocked)this.navigateCamera(dt);
    if(!this.renderer.xr.isPresenting&&!sketchLocked)this.controls.update();
    this.updateXR();this.robotEditor?.tick(dt);if(!sketchLocked)this.updateFollowCamera(dt);this.updateVoiceRings(dt);updateSceneMedia(this,dt);this.robotEditor?.updateMediaHUDPosition?.();
    if(this.onPose&&(!this.lastPose||performance.now()-this.lastPose>180)){
      this.lastPose=performance.now();const cam=this.renderer.xr.isPresenting?this.renderer.xr.getCamera():this.camera;
      const position=cam.getWorldPosition(new THREE.Vector3());
      // Camera's local -Z is the viewing direction. Convert to avatar-forward +Z.
      const gaze=cam.getWorldDirection(new THREE.Vector3());
      const facingYaw=Math.atan2(gaze.x,gaze.z);
      this.onPose({x:position.x,y:position.y,z:position.z,yaw:facingYaw,face:this.localFace||{},headRotation:this.localHeadRotation||[0,0,0],body:this.localBody||{},voiceLevel:this.localVoiceLevel||0,voiceBands:this.localVoiceBands||[0,0,0]});
    }
    if(this.skyDome?.visible)this.skyDome.position.copy(this.camera.position);
    this.renderer.render(this.scene,this.camera);
  }
}
