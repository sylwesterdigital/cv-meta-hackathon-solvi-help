import * as THREE from 'three';
import {setupAvatarGallery} from './avatar-gallery.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {EditHistory,duplicateElevation,nextDuplicateName} from './edit-history.js';
import {makeRobot,hydrateRobot,robotAction,tickRobots,setRobotDestination,resolveAvatarPath,DEFAULT_ROBOT_AVATAR} from './robots.js';
import {intent,active,packetFor,stepRobotMotion,signedAngle} from './robot-net.js';

const kinds=['cube','sphere','cylinder','plane','torus','curve','surface','text','points','light','robot'];
const byId=id=>document.getElementById(id);
const material=(color='#8bc3ff')=>new THREE.MeshStandardMaterial({color,roughness:.7,side:THREE.DoubleSide});
const xyz=v=>[+v.x.toFixed(4),+v.y.toFixed(4),+v.z.toFixed(4)];
const makeTexture=(kind)=>{
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
 case 'curve':{const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.8,.1,-.6),new THREE.Vector3(-.25,.65,0),new THREE.Vector3(.4,.15,.25),new THREE.Vector3(.8,.7,.1)]);object=new THREE.Mesh(new THREE.TubeGeometry(curve,42,.035,8,false),material());break;}
 case 'points':{const coords=[];for(let i=0;i<95;i++)coords.push((Math.random()-.5)*1.4,Math.random()*1.2,(Math.random()-.5)*1.4);const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));object=new THREE.Points(geo,new THREE.PointsMaterial({color:'#88e1d5',size:.07}));break;}
 case 'text':{const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#f2f5ff';ctx.font='bold 132px system-ui';ctx.textAlign='center';ctx.fillText('SOLVI',512,176);const tex=new THREE.CanvasTexture(c);object=new THREE.Mesh(new THREE.PlaneGeometry(2,.5),new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide}));break;}
 case 'robot':object=makeRobot();break;
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

export class SceneEditor{
 constructor(world,onToast){
  this.world=world;this.toast=onToast;this.items=[];this.selected=null;this.revision=0;
  this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();
  this.history=new EditHistory(120);this.transformBefore=null;
  this.transform=new TransformControls(world.camera,world.renderer.domElement);
  // Recent Three.js exposes TransformControls as an Object3D wrapper plus a helper gizmo.
  world.scene.add(this.transform.getHelper());
  this.transform.addEventListener('dragging-changed',e=>{
   world.editorDragging=Boolean(e.value);
   if(e.value){world.editorGizmoPointer=true;world.controls.enabled=false;}
   else{world.editorGizmoPointer=false;world.cameraOrbitGesture=null;}
  });
  this.transform.addEventListener('mouseDown',()=>{this.broadcastEdit(true);this.transformBefore=this.snapshot(this.selected);world.editorDragging=true;world.editorGizmoPointer=true;world.controls.enabled=false;});
  this.transform.addEventListener('mouseUp',()=>{this.broadcastEdit(false);world.editorDragging=false;this.recordEdit(this.transformBefore,this.snapshot(this.selected));this.transformBefore=null;});
  this.transform.addEventListener('objectChange',()=>{if(!this.canEdit(this.selected))return;this.updateInspector();this.queueSave(this.selected);});
  window.addEventListener('solvi:robot-model-ready',e=>{if(this.selected?.userData.editorId===e.detail.id)this.updateInspector();});
  this.editMarkers=new Map();this.lastEditPing=0;this.lightHelper=null;this.setupUI();this.events();this.refreshList();this.avatarGallery=setupAvatarGallery(this);window.solviEditor=this;world.robotEditor=this;this.pendingSaves=new Map();this.robotKeys=new Set();this.localRobotInput=null;this.lastRobotPacket=0;this.remoteInput=new Map();
 }
 setupUI(){
  const menu=byId('addMenu');
  const groups=[['Geometry',['cube','sphere','cylinder','plane','torus']],['Curves / surfaces',['curve','surface']],['Text / points',['text','points']],['Robots',['robot']],['Lighting',['point light','spot light','directional light','ambient light','hemisphere light']]];
  menu.replaceChildren();const bar=document.createElement('div');bar.className='drag-handle add-drag';bar.textContent='Add object · Shift+A';menu.append(bar);const search=document.createElement('input');search.id='addSearch';search.placeholder='Search / Enter to add';search.autocomplete='off';search.className='add-search';menu.append(search);
  search.addEventListener('keydown',event=>{if(event.key==='Enter'){const first=menu.querySelector('.add-group button:not([hidden])');if(first){event.preventDefault();first.click();}}if(event.key==='Escape')menu.hidden=true;});
  search.addEventListener('input',()=>{for(const button of menu.querySelectorAll('.add-group button'))button.hidden=!button.textContent.toLowerCase().includes(search.value.trim().toLowerCase());});
  for(const [label,options] of groups){const group=document.createElement('div');group.className='add-group';const strong=document.createElement('strong');strong.textContent=label;group.append(strong);
   for(const k of options){const button=document.createElement('button');button.textContent=k[0].toUpperCase()+k.slice(1);button.onclick=()=>this.add(k.endsWith(' light')?'light':k,true,k.endsWith(' light')?k.split(' ')[0]:undefined);group.append(button);}menu.append(group);}
  const toolbox=byId('toolboxActions');for(const id of ['addObjectButton','objectsButton','avatarsButton'])toolbox.append(byId(id));
  byId('toolboxMinimize').onclick=()=>{const collapsed=byId('editorToolbox').classList.toggle('minimized');byId('toolboxMinimize').textContent=collapsed?'+':'−';};
  const openMenu=(x,y)=>{menu.hidden=false;menu.style.right='auto';menu.style.left=Math.max(8,Math.min(innerWidth-275,x))+'px';menu.style.top=Math.max(54,Math.min(innerHeight-370,y))+'px';search.value='';for(const b of menu.querySelectorAll('.add-group button'))b.hidden=false;};
  this.showAddMenu=openMenu;
  byId('addObjectButton').onclick=e=>{if(menu.hidden)openMenu(e.clientX+10,e.clientY+10);else menu.hidden=true;};
  document.addEventListener('pointerdown',event=>{if(!menu.hidden&&!menu.contains(event.target)&&!byId('addObjectButton').contains(event.target))menu.hidden=true;});

  byId('objectsButton').onclick=()=>{const panel=byId('scenePanel');if(panel.hidden){panel.hidden=false;panel.classList.remove('minimized');}else panel.classList.toggle('minimized');this.refreshList();};
  byId('minimizeScenePanel').onclick=()=>byId('scenePanel').classList.toggle('minimized');
  byId('closeScenePanel').onclick=()=>byId('scenePanel').hidden=true;
  byId('closeProperties').onclick=()=>{byId('propertiesPanel').hidden=true;this.clearLightHelper();};
  const speed=byId('robotSpeed');speed.addEventListener('pointerdown',()=>this.speedBefore=this.snapshot(this.selected));speed.addEventListener('change',()=>{this.recordEdit(this.speedBefore,this.snapshot(this.selected));this.speedBefore=null;});speed.oninput=()=>{if(!this.selected||!this.canEdit(this.selected))return;this.selected.userData.robotSpeed=Number(speed.value);byId('robotSpeedLabel').textContent=Number(speed.value).toFixed(2)+'×';this.queueSave(this.selected);};
  for(const id of ['lightType','lightIntensity','lightRange','lightDecay','lightAngle','lightPenumbra','lightColor','lightGround'])byId(id).addEventListener('change',()=>{const o=this.selected;if(!o||o.userData.editorKind!=='light'||!this.canEdit(o))return;
   const before=this.snapshot(o);setLight(o,{type:byId('lightType').value,intensity:+byId('lightIntensity').value,range:+byId('lightRange').value,decay:+byId('lightDecay').value,angle:+byId('lightAngle').value,penumbra:+byId('lightPenumbra').value,color:byId('lightColor').value,groundColor:byId('lightGround').value});this.refreshLightControls();this.recordEdit(before,this.snapshot(o));this.queueSave(o);});

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
   if(!this.selected||!this.canEdit(this.selected))return;
   this.transform.setMode(mode);
   this.transform.attach(this.selected); // Explicit manual placement of robots remains possible.
  };
  byId('objectNameInput').onchange=e=>{if(!this.selected||!this.canEdit(this.selected))return;const name=e.target.value.trim().slice(0,100);if(!name)return;const before=this.snapshot(this.selected);this.selected.name=name;byId('objectName').textContent=name;this.recordEdit(before,this.snapshot(this.selected));this.refreshList();this.queueSave(this.selected);};
  byId('deleteObject').onclick=()=>this.remove();
  for(const field of ['position','rotation','scale'])for(let axis=0;axis<3;axis++){
   const el=byId(`${field}-${axis}`);el.onchange=()=>{if(!this.selected||!this.canEdit(this.selected))return;const v=Number(el.value);if(!Number.isFinite(v))return;const before=this.snapshot(this.selected);
    const vec=this.selected[field];const name=['x','y','z'][axis];vec[name]=field==='rotation'?THREE.MathUtils.degToRad(v):v;
    this.recordEdit(before,this.snapshot(this.selected));this.refreshList();this.queueSave(this.selected);};}
  byId('objectColor').addEventListener('focus',()=>this.colorBefore=this.snapshot(this.selected));byId('objectColor').addEventListener('change',()=>{this.recordEdit(this.colorBefore,this.snapshot(this.selected));this.colorBefore=null;});
  byId('objectColor').oninput=e=>{const obj=this.selected;if(!obj||!this.canEdit(obj)||obj.userData.editorKind==='robot')return;obj.traverse(o=>{if(o.material?.color)o.material.color.set(e.target.value);});this.queueSave(obj);};
  byId('texturePreset').onchange=e=>{const before=this.snapshot(this.selected);this.texture(e.target.value);this.recordEdit(before,this.snapshot(this.selected));};byId('textureUploadButton').onclick=()=>byId('textureUpload').click();
  byId('textureUpload').onchange=async e=>{const file=e.target.files[0];if(!file||!file.type.startsWith('image/')||file.size>5_000_000)return this.toast('Select an image under 5 MB');
   const before=this.snapshot(this.selected);const blob=URL.createObjectURL(file);new THREE.TextureLoader().load(blob,tex=>{tex.colorSpace=THREE.SRGBColorSpace;this.selected.userData.textureName='custom';this.assignTexture(tex);this.recordEdit(before,this.snapshot(this.selected));URL.revokeObjectURL(blob);},undefined,()=>URL.revokeObjectURL(blob));};
  byId('saveScene').onclick=()=>this.save();byId('reloadScene').onclick=()=>this.load();
 }
 events(){
  const canvas=this.world.renderer.domElement;let startX,startY;this.lastPointer={x:innerWidth/2,y:innerHeight/2};window.addEventListener('pointermove',e=>{if(!document.pointerLockElement)this.lastPointer={x:e.clientX,y:e.clientY};},{passive:true});
  canvas.addEventListener('pointerdown',e=>{
   startX=e.clientX;startY=e.clientY;
   this.world.cameraOrbitGesture=!this.transform.dragging&&!this.transform.axis;
   this.world.editorGizmoPointer=!this.world.cameraOrbitGesture;
   if(this.world.editorGizmoPointer)this.world.controls.enabled=false;
  },true);
  const endGesture=()=>{queueMicrotask(()=>{if(!this.transform.dragging){this.world.cameraOrbitGesture=null;this.world.editorGizmoPointer=false;}});};
  window.addEventListener('pointerup',endGesture,true);window.addEventListener('pointercancel',endGesture,true);
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
    if(this.items.includes(node)){this.select(node);e.stopImmediatePropagation();}}
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
   else if(this.selected?.userData.editorKind==='robot'&&['ShiftLeft','ShiftRight'].includes(e.code)){this.robotKeys.add(e.code);}
   else if(this.selected?.userData.editorKind==='robot'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)){e.preventDefault();this.robotKeys.add(e.code);this.world.keys.delete(e.code);if(e.code==='Space'&&!e.repeat){robotAction(this.selected,'jump');/* Jump is synchronised through the compact robot-input event. */}else if(e.code!=='Space'){this.selected.userData.robotGoal=null;}}
   else if(this.selected&&['KeyG','KeyR','KeyS'].includes(e.code))this.transform.setMode({KeyG:'translate',KeyR:'rotate',KeyS:'scale'}[e.code]);
   else if(this.selected&&['Delete','Backspace'].includes(e.key)){e.preventDefault();this.remove();}
  });
  window.addEventListener('keyup',e=>{this.robotKeys.delete(e.code);});
  window.addEventListener('blur',()=>{this.robotKeys.clear();this.broadcastEdit(false);});
 }
 canEdit(obj){if(!obj)return false;const policy=window.solviRoomPolicy||{objects:'open',robots:'open'};const type=obj.userData.editorKind==='robot'?'robots':'objects';if(policy[type]!=='owned')return true;const uid=window.solviAPI?.auth()?.profile?.id;return !obj.userData.ownerId||obj.userData.ownerId===uid;}
 duplicate(){
  if(!this.selected)return;if(!this.canEdit(this.selected))return this.toast('Owner only');const source=this.selected,entry=this.snapshot(source);if(!entry)return;
  const duplicate=objectFor(entry.kind);duplicate.name=nextDuplicateName(source.name,this.items.map(x=>x.name));duplicate.position.copy(source.position);duplicate.quaternion.copy(source.quaternion);duplicate.scale.copy(source.scale);
  const box=new THREE.Box3().setFromObject(source);
  const measured=box.isEmpty()?0:box.getSize(new THREE.Vector3()).y;
  const height=entry.kind==='robot'?Math.max(1.9,measured):Math.max(.32,measured);
  duplicate.position.y+=duplicateElevation(height);
  if(entry.color)duplicate.traverse(mesh=>{if(mesh.material?.color)mesh.material.color.set(entry.color);});
  duplicate.userData.textureName=entry.texture||'none';
  if(entry.texture&&entry.texture!=='none'&&entry.texture!=='custom')duplicate.traverse(mesh=>{if(mesh.material?.isMeshStandardMaterial){mesh.material.map=makeTexture(entry.texture);mesh.material.needsUpdate=true;}});
  if(entry.kind==='light')setLight(duplicate,entry.light||{});duplicate.userData.robotSpeed=entry.speed||1;duplicate.userData.ownerId=window.solviAPI?.auth()?.profile?.id||null;duplicate.userData.avatarUrl=source.userData.avatarUrl||DEFAULT_ROBOT_AVATAR;this.items.push(duplicate);this.world.scene.add(duplicate);this.select(duplicate);if(entry.kind==='robot')hydrateRobot(duplicate);this.recordEdit(null,this.snapshot(duplicate));this.queueSave(duplicate);this.toast('Duplicated above original');
 }
 add(kind,showGallery=true,lightType=undefined){const object=objectFor(kind);if(kind==='light'&&lightType){setLight(object,{type:lightType});object.name='New '+lightType+' light';}
 const x=this.lastPointer?.x??innerWidth/2,y=this.lastPointer?.y??innerHeight/2;this.pointer.set(x/innerWidth*2-1,1-y/innerHeight*2);this.raycaster.setFromCamera(this.pointer,this.world.camera);const point=this.raycaster.intersectObject(this.world.floor)?.[0]?.point;if(point){object.position.x=point.x;object.position.z=point.z;}
 object.userData.ownerId=window.solviAPI?.auth()?.profile?.id||null;this.items.push(object);this.world.scene.add(object);this.select(object);byId('addMenu').hidden=true;this.refreshList();if(kind==='robot'){hydrateRobot(object);if(showGallery)this.avatarGallery?.open();}this.recordEdit(null,this.snapshot(object));this.queueSave(object);return object;}
 select(obj){if(this.selected&&this.selected!==obj)this.broadcastEdit(false);this.clearLightHelper();this.robotKeys.clear();this.localRobotInput=null;this.selected=obj;
  if(obj?.userData.editorKind==='robot')for(const key of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'])this.world.keys.delete(key);
  // Robots are controlled with arrows, not a permanent transform gizmo.
  if(this.canEdit(obj)&&obj.userData.editorKind!=='robot')this.transform.attach(obj);
  else{this.transform.detach();if(!this.canEdit(obj))this.toast('Read-only object · owned by another user');}
  this.updateInspector();this.refreshList();
  if(obj)this.world.focusCameraOn(obj);
  if(obj)this.broadcastEdit(true);}
 updateInspector(){const obj=this.selected;byId('objectInspector').hidden=!obj;if(obj)byId('propertiesPanel').hidden=false;if(!obj)return;
  byId('robotControls').hidden=obj.userData.editorKind!=='robot';byId('lightControls').hidden=obj.userData.editorKind!=='light';if(obj.userData.editorKind==='robot'){byId('robotAvatar').value=obj.userData.avatarUrl||DEFAULT_ROBOT_AVATAR;}
  byId('objectName').textContent=obj.name;byId('objectNameInput').value=obj.name;byId('objectNameInput').disabled=!this.canEdit(obj);
  if(obj.userData.editorKind==='robot')this.refreshRobotActions(obj);
  byId('objectAppearance').hidden=['robot','light'].includes(obj.userData.editorKind);if(obj.userData.editorKind==='light'){this.refreshLightControls();this.showLightHelper(obj);}if(obj.userData.editorKind==='robot'){const factor=obj.userData.robotSpeed||1;byId('robotSpeed').value=factor;byId('robotSpeedLabel').textContent=Number(factor).toFixed(2)+'×';}
  for(const name of ['position','rotation','scale'])['x','y','z'].forEach((axis,i)=>{
    const v=obj[name][axis];byId(`${name}-${i}`).value=name==='rotation'?(THREE.MathUtils.radToDeg(v)).toFixed(1):v.toFixed(2);
  });
  const color=obj.material?.color||obj.children.find(c=>c.material?.color)?.material?.color;
  byId('objectColor').value=color?'#'+color.getHexString():'#88bbdd';byId('texturePreset').value=obj.userData.textureName||'none';
 }
 refreshRobotActions(obj){const select=byId('robotActionSelect');select.querySelectorAll('optgroup[data-real-actions]').forEach(n=>n.remove());
  const clips=obj.userData.robotAvailableActions||[];if(clips.length){const group=document.createElement('optgroup');group.label='Model animations';group.dataset.realActions='1';for(const name of clips.slice(0,120))group.append(new Option(name,'clip:'+name));select.append(group);}
  select.value=[...select.options].some(o=>o.value===obj.userData.robotMode)?obj.userData.robotMode:'idle';
 }
  refreshList(){const list=byId('sceneItems');list.replaceChildren();for(const obj of this.items){const row=document.createElement('div');row.className='scene-item-row';const b=document.createElement('button');b.className=obj===this.selected?'selected':'';b.textContent=`${obj.userData.editorKind} · ${obj.name}`;b.onclick=()=>this.select(obj);const remove=document.createElement('button');remove.className='scene-item-delete';remove.textContent='×';remove.title='Delete '+obj.name;remove.setAttribute('aria-label','Delete '+obj.name);remove.disabled=!this.canEdit(obj);remove.onclick=()=>{this.select(obj);this.remove();};row.append(b,remove);list.append(row);}}
 remove(){if(!this.selected)return;this.clearLightHelper();if(!this.canEdit(this.selected))return this.toast('Owner only');const o=this.selected;const before=this.snapshot(o);this.transform.detach();this.items=this.items.filter(x=>x!==o);this.world.scene.remove(o);this.disposeObject(o);this.selected=null;this.updateInspector();byId('propertiesPanel').hidden=true;this.refreshList();this.recordEdit(before,null);this.persistRemoval(o.userData.editorId);}
 texture(name){if(!this.selected||this.selected.userData.editorKind==='robot')return;if(this.canEdit(this.selected))this.selected.userData.textureName=name;this.assignTexture(name==='none'?null:makeTexture(name));}
 assignTexture(tex){if(!this.selected||!this.canEdit(this.selected)||this.selected.userData.editorKind==='robot')return;this.selected.userData.textureName=this.selected.userData.textureName||'custom';this.queueSave(this.selected);this.selected.traverse(o=>{if(o.material?.isMeshStandardMaterial){if(o.material.map&&o.material.map!==tex)o.material.map.dispose();o.material.map=tex;o.material.needsUpdate=true;}});}
  serialize(){return this.items.map(o=>({id:o.userData.editorId,kind:o.userData.editorKind,name:o.name,position:xyz(o.position),rotation:xyz(o.rotation),scale:xyz(o.scale),color:o.material?.color?'#'+o.material.color.getHexString():null,texture:o.userData.textureName||'none',owner:o.userData.ownerId||null,avatar:o.userData.avatarUrl||undefined,light:o.userData.editorKind==='light'?cleanLightSettings(o.userData.light):undefined,speed:o.userData.editorKind==='robot'?(o.userData.robotSpeed||1):undefined}));}
 apply(data){this.history.clear();this.clearLightHelper();for(const o of [...this.items]){this.transform.detach();this.world.scene.remove(o);o.traverse(x=>{x.geometry?.dispose();x.material?.dispose?.();});}this.items=[];this.selected=null;byId('propertiesPanel').hidden=true;for(const entry of data){if(!kinds.includes(entry.kind))continue;const o=objectFor(entry.kind);o.userData.editorId=entry.id;o.name=entry.name||o.name;o.userData.ownerId=entry.owner||null;o.userData.avatarUrl=entry.avatar||DEFAULT_ROBOT_AVATAR;o.userData.robotSpeed=entry.speed||1;if(entry.kind==='light')setLight(o,entry.light||{});
   o.position.fromArray(entry.position);o.rotation.fromArray(entry.rotation);o.scale.fromArray(entry.scale);
   if(entry.color&&o.material?.color)o.material.color.set(entry.color);
   o.userData.textureName=entry.texture||'none';if(entry.texture&&entry.texture!=='none'&&entry.texture!=='custom')o.traverse(x=>{if(x.material?.isMeshStandardMaterial){x.material.map=makeTexture(entry.texture);x.material.needsUpdate=true;}});
   this.items.push(o);this.world.scene.add(o);if(entry.kind==='robot')hydrateRobot(o);}this.refreshList();}
 disposeObject(obj){
  obj.traverse(x=>{x.geometry?.dispose();if(x.material?.map)x.material.map.dispose();x.material?.dispose?.();});
 }
 applyObjectPatch(message){
  const entry=message.object,action=message.action;
  const id=action==='remove'?message.id:entry?.id;
  if(typeof id!=='string'||!id)return;
  const current=this.items.find(obj=>obj.userData.editorId===id);
  if(action==='remove'){
   if(!current)return;
   if(current===this.selected){this.transform.detach();this.selected=null;byId('propertiesPanel').hidden=true;}
   this.items=this.items.filter(obj=>obj!==current);this.world.scene.remove(current);this.disposeObject(current);
   this.refreshList();return;
  }
  if(action!=='upsert'||!entry||!kinds.includes(entry.kind))return;
  if(!Array.isArray(entry.position)||!Array.isArray(entry.rotation)||!Array.isArray(entry.scale))return;
  if(current&&current.userData.editorKind!==entry.kind){
   if(this.selected===current){this.selected=null;this.transform.detach();byId('propertiesPanel').hidden=true;}
   this.items=this.items.filter(obj=>obj!==current);this.world.scene.remove(current);this.disposeObject(current);
  }
  const obj=current?.userData.editorKind===entry.kind?current:objectFor(entry.kind);
  const isNew=obj!==current;
  if(isNew){obj.userData.editorId=id;this.items.push(obj);this.world.scene.add(obj);}
  obj.name=entry.name||obj.name;obj.userData.ownerId=entry.owner||null;
  const oldTexture=obj.userData.textureName||'none',newTexture=entry.texture||'none';
  obj.position.fromArray(entry.position);obj.rotation.fromArray(entry.rotation);obj.scale.fromArray(entry.scale);
  if(entry.color){obj.traverse(node=>{if(node.material?.color&&node.userData.editorKind!=='robot'){
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
  if(entry.kind==='light')setLight(obj,entry.light||{});obj.userData.robotSpeed=entry.speed||1;
  if(entry.kind==='robot'&&(isNew||obj.userData.avatarUrl!==avatar)){
   obj.userData.avatarUrl=avatar;
   if(!isNew){for(const child of [...obj.children])if(!child.userData.robotPlaceholder)obj.remove(child);
    obj.userData.robotReady=false;}
   hydrateRobot(obj);
  }
  if(this.selected===obj&&byId('propertiesPanel')&&!byId('propertiesPanel').hidden)this.updateInspector();
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
 async load(){const api=window.solviAPI;const local=localStorage.getItem('solvi-scene-'+(window.solviRoom||'main'));
  if(!api?.online){if(local)this.apply(JSON.parse(local));this.toast('Local scene loaded (not shared)');return;}
  try{const data=await api.req('/api/scene?room='+encodeURIComponent(window.solviRoom||'main'));this.revision=data.revision;this.apply(data.objects);this.toast('Shared scene loaded');}catch(e){this.toast(e.message);}}
 async save(){const list=this.serialize();const api=window.solviAPI;
  if(!api?.online){localStorage.setItem('solvi-scene-'+(window.solviRoom||'main'),JSON.stringify(list));this.toast('Scene saved locally (not shared)');return;}
  try{const data=await api.req('/api/scene',{method:'PUT',body:JSON.stringify({room:window.solviRoom||'main',revision:this.revision,objects:list})});this.revision=data.revision;this.toast('Shared scene saved');}catch(e){this.toast(e.message);}}

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
    const robot=this.robot(),canControl=robot&&this.canEdit(robot);
    const input=canControl?{...intent(this.robotKeys),s:robot.userData.robotSpeed||1,j:Number(this.robotKeys.has('Space'))}:{f:0,t:0,r:0,b:0,s:1,j:0};
    const now=performance.now();
    if(canControl){
      const motion=stepRobotMotion({x:robot.position.x,z:robot.position.z,yaw:robot.rotation.y,velocity:robot.userData.robotVelocity||0,steer:robot.userData.robotSteer||0,lateral:robot.userData.robotLateral||0},input,dt);
      robot.position.x=motion.x;robot.position.z=motion.z;robot.rotation.y=motion.yaw;
      robot.userData.robotVelocity=motion.velocity;robot.userData.robotSteer=motion.steer;robot.userData.robotLateral=motion.lateral;
      const walking=Math.abs(motion.velocity)>.04;const strafing=Math.abs(motion.lateral)>.04;
      if(input.f||input.t)robot.userData.robotGoal=null;
      if(robot.userData.jumpVel===undefined){
       robot.userData.robotMode=!walking?(strafing?(motion.lateral>0?'strafeLeft':'strafeRight'):'idle'):motion.velocity<0?'walkBackward':(input.r&&motion.velocity>1.4?'run':'walk');
      }
    }
    const previous=this.localRobotInput;
    if(canControl){
      const moving=active(input)||Math.abs(robot.userData.robotVelocity||0)>.04||Math.abs(robot.userData.robotLateral||0)>.04;
      const wasMoving=previous&&(active(previous)||previous.moving);
      const changed=!previous||input.f!==previous.f||input.t!==previous.t||input.r!==previous.r||input.b!==previous.b||input.s!==previous.s||input.j!==previous.j;
      if(changed||((moving||wasMoving)&&now-this.lastRobotPacket>1800)){
        window.solviRoomSocket?.send(packetFor(robot.userData.editorId,{...input,j:input.j&&!previous?.j?1:0},robot,!moving&&!input.j));
        this.lastRobotPacket=now;
      }
      if(wasMoving&&!moving){this.queueSave(robot);}
      this.localRobotInput={...input,moving};
    }else this.localRobotInput=null;
    // Remote robots integrate the same acceleration and turn-rate equations.
    for(const [id,remote] of this.remoteInput){
      const other=this.items.find(o=>o.userData.editorId===id);
      if(!other||now-remote.received>2400){this.remoteInput.delete(id);if(other){other.userData.robotMode='idle';other.userData.robotVelocity=0;other.userData.robotSteer=0;other.userData.robotLateral=0;}continue;}
      const next=stepRobotMotion({x:other.position.x,z:other.position.z,yaw:other.rotation.y,velocity:other.userData.robotVelocity||0,steer:other.userData.robotSteer||0,lateral:other.userData.robotLateral||0},remote,dt);
      other.position.x=next.x;other.position.z=next.z;other.rotation.y=next.yaw;other.userData.robotVelocity=next.velocity;other.userData.robotSteer=next.steer;other.userData.robotLateral=next.lateral;
      if(other.userData.jumpVel===undefined){other.userData.robotMode=Math.abs(next.velocity)<.04?(Math.abs(next.lateral)>.04?(next.lateral>0?'strafeLeft':'strafeRight'):'idle'):next.velocity<0?'walkBackward':(remote.r&&next.velocity>1.4?'run':'walk');}
    }
    tickRobots(this.items,dt,(o,arrived)=>{
      if(arrived&&this.canEdit(o))this.queueSave(o);
    });
  }
  applyRobotInput(packet){
    const robot=this.items.find(o=>o.userData.editorId===packet.id&&o.userData.editorKind==='robot');
    if(!robot||(this.selected===robot&&this.canEdit(robot)&&this.robotKeys.size))return;
    const diff=Math.hypot((robot.position.x-(Number(packet.x)||0)),robot.position.z-(Number(packet.z)||0));
    if(diff>.18){const factor=diff>1?1:.35;robot.position.x+=(Number(packet.x)-robot.position.x)*factor;robot.position.z+=(Number(packet.z)-robot.position.z)*factor;}
    robot.rotation.y+=signedAngle(Number(packet.yaw)||0,robot.rotation.y)*.95;
    if(packet.m&&(packet.f||packet.t))robot.userData.robotGoal=null;
    if(packet.j&&!robot.userData.jumpVel)robotAction(robot,'jump');
    if(!packet.m){this.remoteInput.delete(packet.id);robot.userData.robotVelocity=0;robot.userData.robotSteer=0;robot.userData.robotLateral=0;if(robot.userData.jumpVel===undefined)robot.userData.robotMode='idle';robot.position.x=Number(packet.x)||0;robot.position.z=Number(packet.z)||0;if(robot.userData.jumpVel===undefined)robot.position.y=Number(packet.y)||0;robot.rotation.y=Number(packet.yaw)||0;}
    else this.remoteInput.set(packet.id,{f:packet.f,t:packet.t,r:packet.r,b:packet.b,s:packet.s,received:performance.now()});
  }
  applyRobotMotion(state){this.applyRobotInput({...state,m:0,x:state.position?.[0],y:state.position?.[1],z:state.position?.[2],yaw:state.rotation?.[1]});}
  robot(){return this.selected?.userData.editorKind==='robot'?this.selected:null;}
}
