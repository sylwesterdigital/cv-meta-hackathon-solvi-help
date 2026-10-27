import * as THREE from 'three';
import {setupAvatarGallery} from './avatar-gallery.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {makeRobot,hydrateRobot,robotAction,tickRobots,setRobotDestination,resolveAvatarPath,DEFAULT_ROBOT_AVATAR} from './robots.js';
import {intent,active,packetFor,stepIntent,signedAngle} from './robot-net.js';

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
 case 'light':{object=new THREE.Group();const lamp=new THREE.PointLight('#d0efff',7,8);object.add(lamp);object.add(new THREE.Mesh(new THREE.SphereGeometry(.15,12,8),new THREE.MeshBasicMaterial({color:'#d0efff'})));break;}
 default:throw Error('Unsupported kind');
 }
 object.name='New '+kind;object.userData.editorKind=kind;object.userData.editorId=crypto.randomUUID();
 if(kind==='light')object.position.set(0,2.2,0);else object.position.set(0,kind==='plane'?.015:kind==='robot'?0:.8,0);
 object.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 return object;
}

export class SceneEditor{
 constructor(world,onToast){
  this.world=world;this.toast=onToast;this.items=[];this.selected=null;this.revision=0;
  this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();
  this.transform=new TransformControls(world.camera,world.renderer.domElement);
  // Recent Three.js exposes TransformControls as an Object3D wrapper plus a helper gizmo.
  world.scene.add(this.transform.getHelper());
  this.transform.addEventListener('dragging-changed',e=>{
   world.editorDragging=Boolean(e.value);
   world.controls.enabled=!e.value&&!world.renderer.xr.isPresenting;
  });
  this.transform.addEventListener('objectChange',()=>{if(!this.canEdit(this.selected))return;this.updateInspector();this.queueSave(this.selected);});
  this.setupUI();this.events();this.refreshList();this.avatarGallery=setupAvatarGallery(this);window.solviEditor=this;world.robotEditor=this;this.pendingSaves=new Map();this.robotKeys=new Set();this.localRobotInput=null;this.lastRobotPacket=0;this.remoteInput=new Map();
 }
 setupUI(){
  const menu=byId('addMenu');
  const groups=[['Geometry',['cube','sphere','cylinder','plane','torus']],['Curves / surfaces',['curve','surface']],['Text / points',['text','points']],['Robots',['robot']],['Lighting',['light']]];
  menu.replaceChildren();const bar=document.createElement('div');bar.className='drag-handle add-drag';bar.textContent='Add object · Shift+A';menu.append(bar);const search=document.createElement('input');search.id='addSearch';search.placeholder='Search / Enter to add';search.autocomplete='off';search.className='add-search';menu.append(search);
  search.addEventListener('keydown',event=>{if(event.key==='Enter'){const first=menu.querySelector('.add-group button:not([hidden])');if(first){event.preventDefault();first.click();}}if(event.key==='Escape')menu.hidden=true;});
  search.addEventListener('input',()=>{for(const button of menu.querySelectorAll('.add-group button'))button.hidden=!button.textContent.toLowerCase().includes(search.value.trim().toLowerCase());});
  for(const [label,options] of groups){const group=document.createElement('div');group.className='add-group';const strong=document.createElement('strong');strong.textContent=label;group.append(strong);
   for(const k of options){const button=document.createElement('button');button.textContent=k[0].toUpperCase()+k.slice(1);button.onclick=()=>this.add(k);group.append(button);}menu.append(group);}
  byId('addObjectButton').onclick=()=>{menu.hidden=!menu.hidden;if(!menu.hidden)byId('addSearch')?.focus();};
  byId('objectsButton').onclick=()=>{byId('scenePanel').hidden=!byId('scenePanel').hidden;this.refreshList();};
  byId('closeScenePanel').onclick=()=>byId('scenePanel').hidden=true;
  byId('closeProperties').onclick=()=>byId('propertiesPanel').hidden=true;
  byId('confirmProperties').onclick=async()=>{if(this.selected)await this.persistObject(this.selected);byId('propertiesPanel').hidden=true;this.transform.detach();};
  for(const mode of ['idle','walk','run','wave','jump'])byId('robot-'+mode).onclick=()=>{if(this.selected&&this.canEdit(this.selected)){robotAction(this.selected,mode);this.queueSave(this.selected);}else this.toast('Only the owner can control this robot.');};
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
   const obj=this.selected;obj.userData.avatarUrl=url;obj.userData.robotReady=false;
   for(const child of [...obj.children])if(!child.userData.robotPlaceholder){obj.remove(child);}
   hydrateRobot(obj);this.queueSave(obj);
  };
  for(const mode of ['translate','rotate','scale'])byId('transform-'+mode).onclick=()=>{
   if(!this.selected||!this.canEdit(this.selected))return;
   this.transform.setMode(mode);
   this.transform.attach(this.selected); // Explicit manual placement of robots remains possible.
  };
  byId('deleteObject').onclick=()=>this.remove();
  for(const field of ['position','rotation','scale'])for(let axis=0;axis<3;axis++){
   const el=byId(`${field}-${axis}`);el.onchange=()=>{if(!this.selected||!this.canEdit(this.selected))return;const v=Number(el.value);if(!Number.isFinite(v))return;
    const vec=this.selected[field];const name=['x','y','z'][axis];vec[name]=field==='rotation'?THREE.MathUtils.degToRad(v):v;
    this.refreshList();this.queueSave(this.selected);};}
  byId('objectColor').oninput=e=>{const obj=this.selected;if(!obj||!this.canEdit(obj)||obj.userData.editorKind==='robot')return;obj.traverse(o=>{if(o.material?.color)o.material.color.set(e.target.value);});this.queueSave(obj);};
  byId('textureGrid').replaceChildren();for(const name of ['none','checker','gradient','stripes','dots']){
   const b=document.createElement('button');b.textContent=name;b.onclick=()=>this.texture(name);byId('textureGrid').append(b);}
  byId('textureUpload').onchange=async e=>{const file=e.target.files[0];if(!file||!file.type.startsWith('image/')||file.size>5_000_000)return this.toast('Select an image under 5 MB');
   const blob=URL.createObjectURL(file);new THREE.TextureLoader().load(blob,tex=>{tex.colorSpace=THREE.SRGBColorSpace;this.assignTexture(tex);URL.revokeObjectURL(blob);},undefined,()=>URL.revokeObjectURL(blob));};
  byId('saveScene').onclick=()=>this.save();byId('reloadScene').onclick=()=>this.load();
 }
 events(){
  const canvas=this.world.renderer.domElement;let startX,startY;
  canvas.addEventListener('pointerdown',e=>{startX=e.clientX;startY=e.clientY;},true);
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
  window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||e.metaKey||e.ctrlKey||e.altKey)return;
   if(e.shiftKey&&e.code==='KeyA'){e.preventDefault();byId('addMenu').hidden=!byId('addMenu').hidden;if(!byId('addMenu').hidden)byId('addSearch')?.focus();}
   else if(this.selected&&e.shiftKey&&e.code==='KeyD'){e.preventDefault();this.duplicate();}
   else if(this.selected&&e.code==='KeyX'){e.preventDefault();this.remove();}
   else if(this.selected?.userData.editorKind==='robot'&&['ShiftLeft','ShiftRight'].includes(e.code)){this.robotKeys.add(e.code);}
   else if(this.selected?.userData.editorKind==='robot'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)){e.preventDefault();this.robotKeys.add(e.code);if(e.code==='Space'&&!e.repeat){robotAction(this.selected,'jump');this.queueSave(this.selected);}}
   else if(this.selected&&['KeyG','KeyR','KeyS'].includes(e.code))this.transform.setMode({KeyG:'translate',KeyR:'rotate',KeyS:'scale'}[e.code]);
   else if(this.selected&&['Delete','Backspace'].includes(e.key)){e.preventDefault();this.remove();}
  });
  window.addEventListener('keyup',e=>{this.robotKeys.delete(e.code);});
  window.addEventListener('blur',()=>this.robotKeys.clear());
 }
 canEdit(obj){const uid=window.solviAPI?.auth()?.profile?.id;return !obj?.userData?.ownerId||!uid||obj.userData.ownerId===uid;}
 duplicate(){
  if(!this.selected)return;if(!this.canEdit(this.selected))return this.toast('Owner only');const source=this.selected,entry=this.snapshot(source);if(!entry)return;
  const duplicate=objectFor(entry.kind);duplicate.name=source.name+' copy';duplicate.position.copy(source.position);duplicate.quaternion.copy(source.quaternion);duplicate.scale.copy(source.scale);
  if(entry.color)duplicate.traverse(mesh=>{if(mesh.material?.color)mesh.material.color.set(entry.color);});
  duplicate.userData.textureName=entry.texture||'none';
  if(entry.texture&&entry.texture!=='none'&&entry.texture!=='custom')duplicate.traverse(mesh=>{if(mesh.material?.isMeshStandardMaterial){mesh.material.map=makeTexture(entry.texture);mesh.material.needsUpdate=true;}});
  duplicate.userData.ownerId=window.solviAPI?.auth()?.profile?.id||null;duplicate.userData.avatarUrl=source.userData.avatarUrl||DEFAULT_ROBOT_AVATAR;this.items.push(duplicate);this.world.scene.add(duplicate);this.select(duplicate);if(entry.kind==='robot')hydrateRobot(duplicate);this.queueSave(duplicate);this.toast('Duplicated in place');
 }
 add(kind,showGallery=true){const object=objectFor(kind);object.userData.ownerId=window.solviAPI?.auth()?.profile?.id||null;this.items.push(object);this.world.scene.add(object);this.select(object);byId('addMenu').hidden=true;byId('scenePanel').hidden=false;this.refreshList();if(kind==='robot'){hydrateRobot(object);if(showGallery)this.avatarGallery?.open();}this.queueSave(object);return object;}
 select(obj){this.robotKeys.clear();this.localRobotInput=null;this.selected=obj;
  // Robots are controlled with arrows, not a permanent transform gizmo.
  if(this.canEdit(obj)&&obj.userData.editorKind!=='robot')this.transform.attach(obj);
  else{this.transform.detach();if(!this.canEdit(obj))this.toast('Read-only object · owned by another user');}
  this.updateInspector();this.refreshList();}
 updateInspector(){const obj=this.selected;byId('objectInspector').hidden=!obj;if(obj)byId('propertiesPanel').hidden=false;if(!obj)return;
  byId('robotControls').hidden=obj.userData.editorKind!=='robot';if(obj.userData.editorKind==='robot'){byId('robotAvatar').value=obj.userData.avatarUrl||DEFAULT_ROBOT_AVATAR;}
  byId('objectName').textContent=obj.name;
  byId('objectAppearance').hidden=obj.userData.editorKind==='robot';
  for(const name of ['position','rotation','scale'])['x','y','z'].forEach((axis,i)=>{
    const v=obj[name][axis];byId(`${name}-${i}`).value=name==='rotation'?(THREE.MathUtils.radToDeg(v)).toFixed(1):v.toFixed(2);
  });
  const color=obj.material?.color||obj.children.find(c=>c.material?.color)?.material?.color;
  byId('objectColor').value=color?'#'+color.getHexString():'#88bbdd';
 }
 refreshList(){const list=byId('sceneItems');list.replaceChildren();for(const obj of this.items){const b=document.createElement('button');b.className=obj===this.selected?'selected':'';b.textContent=`${obj.userData.editorKind} · ${obj.name}`;b.onclick=()=>this.select(obj);list.append(b);}}
 remove(){if(!this.selected)return;if(!this.canEdit(this.selected))return this.toast('Owner only');const o=this.selected;this.transform.detach();this.items=this.items.filter(x=>x!==o);this.world.scene.remove(o);this.disposeObject(o);this.selected=null;this.updateInspector();byId('propertiesPanel').hidden=true;this.refreshList();this.persistRemoval(o.userData.editorId);}
 texture(name){if(!this.selected||this.selected.userData.editorKind==='robot')return;if(this.canEdit(this.selected))this.selected.userData.textureName=name;this.assignTexture(name==='none'?null:makeTexture(name));}
 assignTexture(tex){if(!this.selected||!this.canEdit(this.selected)||this.selected.userData.editorKind==='robot')return;this.selected.userData.textureName=this.selected.userData.textureName||'custom';this.queueSave(this.selected);this.selected.traverse(o=>{if(o.material?.isMeshStandardMaterial){if(o.material.map&&o.material.map!==tex)o.material.map.dispose();o.material.map=tex;o.material.needsUpdate=true;}});}
  serialize(){return this.items.map(o=>({id:o.userData.editorId,kind:o.userData.editorKind,name:o.name,position:xyz(o.position),rotation:xyz(o.rotation),scale:xyz(o.scale),color:o.material?.color?'#'+o.material.color.getHexString():null,texture:o.userData.textureName||'none',owner:o.userData.ownerId||null,avatar:o.userData.avatarUrl||undefined}));}
 apply(data){for(const o of [...this.items]){this.transform.detach();this.world.scene.remove(o);o.traverse(x=>{x.geometry?.dispose();x.material?.dispose?.();});}this.items=[];this.selected=null;byId('propertiesPanel').hidden=true;for(const entry of data){if(!kinds.includes(entry.kind))continue;const o=objectFor(entry.kind);o.userData.editorId=entry.id;o.name=entry.name||o.name;o.userData.ownerId=entry.owner||null;o.userData.avatarUrl=entry.avatar||DEFAULT_ROBOT_AVATAR;
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
  tick(dt){
    const robot=this.robot(),canControl=robot&&this.canEdit(robot);
    const input=canControl?intent(this.robotKeys):{f:0,t:0,r:0};
    const now=performance.now();
    if(canControl&&robot.userData.jumpVel===undefined){
      if(active(input)){
        const next=stepIntent(robot.position.x,robot.position.z,robot.rotation.y,input,dt);
        robot.position.x=next.x;robot.position.z=next.z;robot.rotation.y=next.yaw;
        robot.userData.robotGoal=null;robot.userData.robotMode=input.f?(input.r?'run':'walk'):'idle';
      }else if(this.localRobotInput&&robot.userData.robotMode!=='jump'){robot.userData.robotMode='idle';}
    }
    const previous=this.localRobotInput;
    if(canControl){
      const moving=active(input),wasMoving=active(previous);
      const changed=!previous||input.f!==previous.f||input.t!==previous.t||input.r!==previous.r;
      if(changed||((moving||wasMoving)&&now-this.lastRobotPacket>1800)){
        window.solviRoomSocket?.send(packetFor(robot.userData.editorId,input,robot,!moving));
        this.lastRobotPacket=now;
      }
      if(wasMoving&&!moving){this.queueSave(robot);}
      this.localRobotInput=moving?input:null;
    }else this.localRobotInput=null;
    // Remote input packets are applied predictively; occasional snapshots correct drift.
    for(const [id,remote] of this.remoteInput){
      const other=this.items.find(o=>o.userData.editorId===id);
      if(!other||now-remote.received>2400){this.remoteInput.delete(id);if(other){other.userData.robotMode='idle';}continue;}
      if(remote.f||remote.t){const next=stepIntent(other.position.x,other.position.z,other.rotation.y,remote,dt);
        other.position.x=next.x;other.position.z=next.z;other.rotation.y=next.yaw;
        other.userData.robotMode=remote.f?(remote.r?'run':'walk'):'idle';}
    }
    // Walk-to-point is deterministic client-side. Persist completed positions once.
    tickRobots(this.items,dt,(o,arrived)=>{
      if(arrived&&this.canEdit(o))this.queueSave(o);
    });
  }
  applyRobotInput(packet){
    const robot=this.items.find(o=>o.userData.editorId===packet.id&&o.userData.editorKind==='robot');
    if(!robot||this.canEdit(robot)&&this.robotKeys.size)return;
    const diff=Math.hypot((robot.position.x-(Number(packet.x)||0)),robot.position.z-(Number(packet.z)||0));
    if(diff>.18){const factor=diff>1?1:.35;robot.position.x+=(Number(packet.x)-robot.position.x)*factor;robot.position.z+=(Number(packet.z)-robot.position.z)*factor;}
    robot.rotation.y+=signedAngle(Number(packet.yaw)||0,robot.rotation.y)*.5;
    if(!packet.m){this.remoteInput.delete(packet.id);robot.userData.robotMode='idle';robot.position.set(Number(packet.x)||0,Number(packet.y)||0,Number(packet.z)||0);robot.rotation.y=Number(packet.yaw)||0;}
    else this.remoteInput.set(packet.id,{f:packet.f,t:packet.t,r:packet.r,received:performance.now()});
  }
  applyRobotMotion(state){this.applyRobotInput({...state,m:0,x:state.position?.[0],y:state.position?.[1],z:state.position?.[2],yaw:state.rotation?.[1]});}
  robot(){return this.selected?.userData.editorKind==='robot'?this.selected:null;}
}
