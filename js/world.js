import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {MotionController, computeMode} from './animations.js';
import {teleportOffset,validTeleport} from './xr-navigation.js';
import {XRControllerModelFactory} from 'three/addons/webxr/XRControllerModelFactory.js';
import {XRHandModelFactory} from 'three/addons/webxr/XRHandModelFactory.js';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const random=(a,b)=>a+Math.random()*(b-a);
export class SolviWorld {
  constructor(root, onState=()=>{}) {
    this.onState=onState;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#101b2c');
    this.scene.fog=new THREE.FogExp2('#101b2c',.028);
    this.camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.05,150);
    this.camera.position.set(5,3.7,7.5);
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
    this.controls.enableDamping=true;this.controls.target.set(0,1,0);
    this.controls.maxPolarAngle=Math.PI/2.07;
    this.controls.minDistance=3;this.controls.maxDistance=24;
    this.controls.update();
    this.clock=new THREE.Clock();
    this.character=new THREE.Group();this.scene.add(this.character);
    this.actor=new THREE.Group();this.character.add(this.actor);
    this.pending=null;this.roam=true;this.desiredSpeed=1.4;this.idleTimer=2;this.currentMode='idle';this.gestureUntil=0;
    this.keys=new Set();this.animator=null;this.ready=false;this.others=new Map();
    this.raycaster=new THREE.Raycaster();this.mouse=new THREE.Vector2();
    this.setupEnvironment();this.setupEvents();this.setupXR();
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
    const grid=new THREE.GridHelper(70,70,'#455a6a','#3b5061');grid.position.y=.007;this.scene.add(grid);
    const boxGeo=new THREE.BoxGeometry(1,1,1);
    const palette=['#d1b29b','#638c9c','#8c89af','#8c9b83','#b78e78'];
    this.obstacles=[];
    for(let i=0;i<16;i++){
      const x=random(-13,13),z=random(-12,12);
      if(Math.hypot(x,z)<3.5)continue;
      const h=random(.5,2.6);
      const m=new THREE.Mesh(boxGeo,new THREE.MeshStandardMaterial({color:palette[i%palette.length],roughness:.76,metalness:.05}));
      m.position.set(x,h/2,z);m.scale.set(random(.5,1.8),h,random(.6,1.6));m.castShadow=true;m.receiveShadow=true;this.scene.add(m);
      this.obstacles.push(m);
    }
    const rings=new THREE.Mesh(new THREE.TorusGeometry(1.4,.012,8,60),new THREE.MeshBasicMaterial({color:'#87bdc9',transparent:true,opacity:.4}));
    rings.rotation.x=Math.PI/2;rings.position.y=.02;this.scene.add(rings);
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
    window.addEventListener('keydown',e=>{if(e.target?.closest?.('input,textarea,select,[contenteditable]'))return;if(/^(KeyW|KeyA|KeyS|KeyD|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|ShiftLeft|ShiftRight)$/.test(e.code)){
      this.keys.add(e.code);if(e.code.startsWith('Arrow'))e.preventDefault();this.pending=null;}});
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    let dragX=0,dragY=0;
    this.renderer.domElement.addEventListener('pointerdown',e=>{dragX=e.clientX;dragY=e.clientY;});
    this.renderer.domElement.addEventListener('pointerup',e=>{
      if(Math.hypot(e.clientX-dragX,e.clientY-dragY)>5||this.renderer.xr.isPresenting)return;
      this.mouse.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);
      this.raycaster.setFromCamera(this.mouse,this.camera);
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
    const forward=(this.keys.has('KeyW')||this.keys.has('ArrowUp'))?1:(this.keys.has('KeyS')||this.keys.has('ArrowDown'))?-1:0;
    const strafe=(this.keys.has('KeyD')||this.keys.has('ArrowRight'))?1:(this.keys.has('KeyA')||this.keys.has('ArrowLeft'))?-1:0;
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
      this.character.position.x=clamp(this.character.position.x+vx*speed*dt,-16,16);
      this.character.position.z=clamp(this.character.position.z+vz*speed*dt,-16,16);
      const heading=Math.atan2(vx,vz);let diff=((heading-this.character.rotation.y+Math.PI*3)%(2*Math.PI))-Math.PI;
      this.character.rotation.y+=diff*Math.min(1,dt*8);
    }
    const mode=this.gestureUntil>performance.now()?'wave':computeMode(speed);
    if(mode!==this.currentMode){this.currentMode=mode;this.animator?.play(mode);}
    this.animator?.update(dt);
    this.onPose?.({x:+this.character.position.x.toFixed(2),z:+this.character.position.z.toFixed(2),yaw:+this.character.rotation.y.toFixed(2),mode});
  }
  setRemotePeers(peers){
    for(const [id,mesh] of this.others){if(!peers.has(id)){this.scene.remove(mesh);mesh.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.others.delete(id);}}
    for(const [id,state] of peers){if(!this.others.has(id)){
      const group=new THREE.Group(),mat=new THREE.MeshStandardMaterial({color:'#6fcaba',transparent:true,opacity:.72});
      const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.22,.85,4,8),mat);torso.position.y=.85;group.add(torso);
      const head=new THREE.Mesh(new THREE.SphereGeometry(.18,12,10),mat);head.position.y=1.62;group.add(head);
      this.scene.add(group);this.others.set(id,group);
    }this.updateRemoteState(id,state);}
    document.getElementById('visitorCount').textContent=`${peers.size+1} viewer${peers.size?'s':''}`;
  }
  updateRemoteState(id,state){const group=this.others.get(id);if(group&&state){group.position.set(Number(state.x)||0,0,Number(state.z)||0);group.rotation.y=Number(state.yaw)||0;}}
  setupXR(){
    const btn=document.getElementById('xrButton');
    const toast=(message)=>{const el=document.getElementById('toast');el.textContent=message;el.hidden=false;};
    // Keep the XR button visible even on desktop. It can explain why XR is unavailable.
    btn.disabled=false;btn.textContent='Enter VR';btn.title='WebXR: Meta Quest / compatible headset browser';
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
        btn.textContent='Exit VR';this.xrMenuPlaced=false;this.teleportAim=null;
        this.renderer.xr.setFoveation?.(.8);
        session.addEventListener('end',()=>{
          btn.textContent='Enter VR';this.xrMenu.visible=false;
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
    for(const [index,mode] of ['idle','walk','run','wave'].entries()){
      const cv=document.createElement('canvas');cv.width=256;cv.height=72;
      const ctx=cv.getContext('2d');ctx.fillStyle='#294960';ctx.fillRect(0,0,256,72);
      ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.font='600 30px system-ui';
      ctx.fillText(mode.toUpperCase(),128,47);
      const tex=new THREE.CanvasTexture(cv);
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.68,.19),
        new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide,depthTest:false}));
      mesh.position.set(0,.35-index*.23,.01);mesh.userData.motion=mode;
      this.xrMenu.add(mesh);this.xrButtons.push(mesh);
    }
    this.xrMenu.visible=false;this.scene.add(this.xrMenu);
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
      controller.addEventListener('selectstart',()=>{
        if(!this.renderer.xr.isPresenting)return;
        const selection=this.xrRaycast(controller);
        if(selection.menu){this.setMode(selection.menu.userData.motion);return;}
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
    const floor=this.raycaster.intersectObject(this.floor,false)[0];
    return {menu,floor:floor&&validTeleport(floor.point.x,floor.point.z)?floor:null};
  }
  teleportTo(landing){
    const session=this.renderer.xr.getSession();
    const reference=this.renderer.xr.getReferenceSpace();
    if(!session||!reference||typeof XRRigidTransform==='undefined')return;
    const head=this.renderer.xr.getCamera();
    const current=head.getWorldPosition(new THREE.Vector3());
    if(!validTeleport(landing.x,landing.z))return;
    const offset=teleportOffset(current,landing);
    try{
      this.renderer.xr.setReferenceSpace(reference.getOffsetReferenceSpace(new XRRigidTransform(offset)));
    }catch(err){console.warn('XR teleport failed:',err);}
  }
  updateXR(){
    const presenting=this.renderer.xr.isPresenting;
    this.xrMenu.visible=presenting;
    if(!presenting){this.teleportIndicator.visible=false;return;}
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
  frame(){
    const dt=Math.min(.05,this.clock.getDelta());this.updateMovement(dt);
    this.controls.enabled=!this.renderer.xr.isPresenting;
    if(!this.renderer.xr.isPresenting)this.controls.update();
    this.updateXR();
    this.renderer.render(this.scene,this.camera);
  }
}
