import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
const $=id=>document.getElementById(id);
const loader=new GLTFLoader();const draco=new DRACOLoader();draco.setDecoderPath('./vendor/three/draco/');loader.setDRACOLoader(draco);
const safe=(a)=>typeof a?.url==='string'&&(a.url.startsWith('./assets/')||/^\/api\/avatars\/[0-9a-f-]+\.glb$/.test(a.url));
export function setupAvatarGallery(editor){
 const backdrop=$('avatarGalleryBackdrop'),grid=$('avatarGalleryGrid'),status=$('avatarGalleryStatus');
 let collection=[];
 const close=()=>backdrop.hidden=true;
 $('closeAvatarGallery').onclick=close;backdrop.addEventListener('pointerdown',e=>{if(e.target===backdrop)close();});
 const chooser=(useSelected)=>{const robot=editor.selected?.userData.editorKind==='robot'&&editor.canEdit(editor.selected)?editor.selected:null;
  return robot&&useSelected?robot:editor.add('robot',false);};
 async function thumbnail(canvas,url){
  // Render a real snapshot of the GLB, never a generic placeholder pretending to be the model.
  let renderer=null;try{
   const gltf=await loader.loadAsync(url);if(!canvas.isConnected)return;
   renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(176,142,false);
   const scene=new THREE.Scene(),light=new THREE.HemisphereLight(0xffffff,0x7a91ae,3);scene.add(light);
   const box=new THREE.Box3().setFromObject(gltf.scene);const size=box.getSize(new THREE.Vector3());
   const center=box.getCenter(new THREE.Vector3());gltf.scene.position.sub(center);scene.add(gltf.scene);
   const cam=new THREE.PerspectiveCamera(37,176/142,.03,200);const distance=Math.max(size.x,size.y,size.z,1)*2.1;cam.position.set(distance*.4,distance*.28,distance);cam.lookAt(0,0,0);
   renderer.render(scene,cam);
   const image=new Image();image.alt='';image.src=canvas.toDataURL('image/png');canvas.replaceWith(image);
  }catch{const parent=canvas.parentElement;if(parent){parent.classList.add('unavailable');parent.textContent='Model not on server';}}
  finally{renderer?.dispose();}
 }
 async function render(){grid.replaceChildren();
  const promises=[];for(const avatar of collection.filter(safe)){
   const card=document.createElement('button');card.type='button';card.className='avatar-card';card.setAttribute('role','listitem');
   const preview=document.createElement('span');preview.className='avatar-preview';const canvas=document.createElement('canvas');canvas.width=176;canvas.height=142;preview.append(canvas);
   const name=document.createElement('strong');name.textContent=avatar.label||avatar.id;
   const description=document.createElement('small');description.textContent=(avatar.genderPresentation||'')+(avatar.ownerName?' · by '+avatar.ownerName:'');
   card.append(preview,name,description);grid.append(card);
   card.onclick=()=>{if(preview.classList.contains('unavailable')){status.textContent='Avatar file is not on the server. Add it to the release or upload GLB.';return;}
    const obj=chooser(true);if(!obj)return;editor.changeRobotAvatar(obj,avatar.url);editor.select(obj);editor.updateInspector();close();};
   promises.push(thumbnail(canvas,avatar.url));
  }
  await Promise.allSettled(promises);
 }
 async function open(){backdrop.hidden=false;status.textContent='Preview models from the server or upload your own GLB.';
  let builtins=[];try{const r=await fetch('./assets/avatars/catalog.json',{cache:'no-cache'});builtins=(await r.json()).avatars||[];}catch{}
  let user=[];try{user=(await window.solviAPI.req('/api/avatars')).avatars||[];}catch{}
  collection=[...builtins,...user];render();}
 $('avatarsButton').onclick=open;$('openAvatarGallery').onclick=open;
 $('uploadRobotAvatar').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;
  if(!file.name.toLowerCase().endsWith('.glb')||file.size>20_000_000||file.size<100){status.textContent='Select a GLB under 20 MB';return;}
  try{status.textContent='Uploading '+file.name+'…';const form=new FormData();form.append('avatar',file);
   const result=await window.solviAPI.req('/api/avatars',{method:'POST',body:form});status.textContent='Uploaded: '+result.avatar.label;
   collection.push(result.avatar);await render();}catch(error){status.textContent='Upload failed: '+error.message;}finally{e.target.value='';}
 };
 return {open};
}
