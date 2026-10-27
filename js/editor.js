import * as THREE from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';

const kinds=['cube','sphere','cylinder','plane','torus','curve','surface','text','points','light'];
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
 case 'light':{object=new THREE.Group();const lamp=new THREE.PointLight('#d0efff',7,8);object.add(lamp);object.add(new THREE.Mesh(new THREE.SphereGeometry(.15,12,8),new THREE.MeshBasicMaterial({color:'#d0efff'})));break;}
 default:throw Error('Unsupported kind');
 }
 object.name='New '+kind;object.userData.editorKind=kind;object.userData.editorId=crypto.randomUUID();
 if(kind==='light')object.position.set(0,2.2,0);else object.position.set(0,kind==='plane'?.015:.8,0);
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
  this.transform.addEventListener('dragging-changed',e=>{world.editorDragging=Boolean(e.value);world.controls.enabled=!e.value;});
  this.transform.addEventListener('objectChange',()=>{this.updateInspector();});
  this.setupUI();this.events();this.refreshList();window.solviEditor=this;
 }
 setupUI(){
  const menu=byId('addMenu');
  const groups=[['Geometry',['cube','sphere','cylinder','plane','torus']],['Curves / surfaces',['curve','surface']],['Text / points',['text','points']],['Lighting',['light']]];
  menu.replaceChildren();const bar=document.createElement('div');bar.className='drag-handle add-drag';bar.textContent='Add object · Shift+A';menu.append(bar);const search=document.createElement('input');search.id='addSearch';search.placeholder='Search / Enter to add';search.autocomplete='off';search.className='add-search';menu.append(search);
  search.addEventListener('keydown',event=>{if(event.key==='Enter'){const first=menu.querySelector('.add-group button:not([hidden])');if(first){event.preventDefault();first.click();}}if(event.key==='Escape')menu.hidden=true;});
  search.addEventListener('input',()=>{for(const button of menu.querySelectorAll('.add-group button'))button.hidden=!button.textContent.toLowerCase().includes(search.value.trim().toLowerCase());});
  for(const [label,options] of groups){const group=document.createElement('div');group.className='add-group';const strong=document.createElement('strong');strong.textContent=label;group.append(strong);
   for(const k of options){const button=document.createElement('button');button.textContent=k[0].toUpperCase()+k.slice(1);button.onclick=()=>this.add(k);group.append(button);}menu.append(group);}
  byId('addObjectButton').onclick=()=>{menu.hidden=!menu.hidden;if(!menu.hidden)byId('addSearch')?.focus();};
  byId('objectsButton').onclick=()=>{byId('scenePanel').hidden=!byId('scenePanel').hidden;this.refreshList();};
  byId('closeScenePanel').onclick=()=>byId('scenePanel').hidden=true;
  byId('closeProperties').onclick=()=>byId('propertiesPanel').hidden=true;
  for(const mode of ['translate','rotate','scale'])byId('transform-'+mode).onclick=()=>this.transform.setMode(mode);
  byId('deleteObject').onclick=()=>this.remove();
  for(const field of ['position','rotation','scale'])for(let axis=0;axis<3;axis++){
   const el=byId(`${field}-${axis}`);el.onchange=()=>{if(!this.selected)return;const v=Number(el.value);if(!Number.isFinite(v))return;
    const vec=this.selected[field];const name=['x','y','z'][axis];vec[name]=field==='rotation'?THREE.MathUtils.degToRad(v):v;
    this.refreshList();};}
  byId('objectColor').oninput=e=>{const obj=this.selected;if(!obj)return;obj.traverse(o=>{if(o.material?.color)o.material.color.set(e.target.value);});};
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
   if(this.transform.dragging || Math.hypot(e.clientX-startX,e.clientY-startY)>4 || this.world.renderer.xr.isPresenting)return;
   this.pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);
   this.raycaster.setFromCamera(this.pointer,this.world.camera);
   const hits=this.raycaster.intersectObjects(this.items,true);
   if(hits.length){let node=hits[0].object;while(node.parent&&!this.items.includes(node))node=node.parent;
    if(this.items.includes(node)){this.select(node);e.stopImmediatePropagation();}}
  },true);
  window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||e.metaKey||e.ctrlKey||e.altKey)return;
   if(e.shiftKey&&e.code==='KeyA'){e.preventDefault();byId('addMenu').hidden=!byId('addMenu').hidden;if(!byId('addMenu').hidden)byId('addSearch')?.focus();}
   else if(this.selected&&['KeyG','KeyR','KeyS'].includes(e.code))this.transform.setMode({KeyG:'translate',KeyR:'rotate',KeyS:'scale'}[e.code]);
   else if(this.selected&&['Delete','Backspace'].includes(e.key)){e.preventDefault();this.remove();}
  });
 }
 add(kind){const object=objectFor(kind);this.items.push(object);this.world.scene.add(object);this.select(object);byId('addMenu').hidden=true;byId('scenePanel').hidden=false;this.refreshList();}
 select(obj){this.selected=obj;this.transform.attach(obj);this.updateInspector();this.refreshList();}
 updateInspector(){const obj=this.selected;byId('objectInspector').hidden=!obj;if(obj)byId('propertiesPanel').hidden=false;if(!obj)return;
  byId('objectName').textContent=obj.name;
  for(const name of ['position','rotation','scale'])['x','y','z'].forEach((axis,i)=>{
    const v=obj[name][axis];byId(`${name}-${i}`).value=name==='rotation'?(THREE.MathUtils.radToDeg(v)).toFixed(1):v.toFixed(2);
  });
  const color=obj.material?.color||obj.children.find(c=>c.material?.color)?.material?.color;
  byId('objectColor').value=color?'#'+color.getHexString():'#88bbdd';
 }
 refreshList(){const list=byId('sceneItems');list.replaceChildren();for(const obj of this.items){const b=document.createElement('button');b.className=obj===this.selected?'selected':'';b.textContent=`${obj.userData.editorKind} · ${obj.name}`;b.onclick=()=>this.select(obj);list.append(b);}}
 remove(){if(!this.selected)return;const o=this.selected;this.transform.detach();this.items=this.items.filter(x=>x!==o);this.world.scene.remove(o);o.traverse(x=>{x.geometry?.dispose();if(x.material?.map)x.material.map.dispose();x.material?.dispose?.();});this.selected=null;this.updateInspector();byId('propertiesPanel').hidden=true;this.refreshList();}
 texture(name){this.assignTexture(name==='none'?null:makeTexture(name));}
 assignTexture(tex){if(!this.selected)return;this.selected.traverse(o=>{if(o.material?.isMeshStandardMaterial){if(o.material.map&&o.material.map!==tex)o.material.map.dispose();o.material.map=tex;o.material.needsUpdate=true;}});}
 serialize(){return this.items.map(o=>({id:o.userData.editorId,kind:o.userData.editorKind,name:o.name,position:xyz(o.position),rotation:xyz(o.rotation),scale:xyz(o.scale),color:o.material?.color?'#'+o.material.color.getHexString():null}));}
 apply(data){for(const o of [...this.items]){this.select(o);this.remove();}for(const entry of data){if(!kinds.includes(entry.kind))continue;const o=objectFor(entry.kind);o.userData.editorId=entry.id;o.name=entry.name||o.name;
   o.position.fromArray(entry.position);o.rotation.fromArray(entry.rotation);o.scale.fromArray(entry.scale);
   if(entry.color&&o.material?.color)o.material.color.set(entry.color);
   this.items.push(o);this.world.scene.add(o);}this.refreshList();}
 async load(){const api=window.solviAPI;const local=localStorage.getItem('solvi-scene-'+(window.solviRoom||'main'));
  if(!api?.online){if(local)this.apply(JSON.parse(local));this.toast('Local scene loaded (not shared)');return;}
  try{const data=await api.req('/api/scene?room='+encodeURIComponent(window.solviRoom||'main'));this.revision=data.revision;this.apply(data.objects);this.toast('Shared scene loaded');}catch(e){this.toast(e.message);}}
 async save(){const list=this.serialize();const api=window.solviAPI;
  if(!api?.online){localStorage.setItem('solvi-scene-'+(window.solviRoom||'main'),JSON.stringify(list));this.toast('Scene saved locally (not shared)');return;}
  try{const data=await api.req('/api/scene',{method:'PUT',body:JSON.stringify({room:window.solviRoom||'main',revision:this.revision,objects:list})});this.revision=data.revision;this.toast('Shared scene saved');}catch(e){this.toast(e.message);}}
}
