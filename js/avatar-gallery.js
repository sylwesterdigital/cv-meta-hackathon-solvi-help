import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {renderAvatarPortrait,disposeAvatarPreview,AVATAR_THUMB_WIDTH,AVATAR_THUMB_HEIGHT} from './avatar-thumbnail.js';
import {readThumbnail,writeThumbnail} from './thumbnail-cache.js';
const $=id=>document.getElementById(id);
const loader=new GLTFLoader();const draco=new DRACOLoader();draco.setDecoderPath('./vendor/three/draco/');loader.setDRACOLoader(draco);
const safe=(a)=>typeof a?.url==='string'&&(a.url.startsWith('./assets/')||/^\/api\/avatars\/[0-9a-f-]+\.glb$/.test(a.url));
export function setupAvatarGallery(editor){
 const backdrop=$('avatarGalleryBackdrop'),grid=$('avatarGalleryGrid'),status=$('avatarGalleryStatus');
 let collection=[],renderGeneration=0,previewObserver=null,lanes=[Promise.resolve(),Promise.resolve()],nextLane=0;
 const enqueue=task=>{const lane=nextLane++%lanes.length;lanes[lane]=lanes[lane].catch(()=>{}).then(task);};
 const close=()=>{backdrop.hidden=true;renderGeneration++;previewObserver?.disconnect();previewObserver=null;};
 $('closeAvatarGallery').onclick=close;backdrop.addEventListener('pointerdown',e=>{if(e.target===backdrop)close();});
 const chooser=(useSelected)=>{const robot=editor.selected?.userData.editorKind==='robot'&&editor.canEdit(editor.selected)?editor.selected:null;
  return robot&&useSelected?robot:editor.add('robot',false);};
 async function thumbnail(canvas,url,generation){
  // Display a persistent cached image before attempting any GLB download.
  const cached=await readThumbnail(url);
  if(!canvas.isConnected||generation!==renderGeneration||backdrop.hidden)return;
  if(cached){const image=new Image();image.alt='';image.decoding='async';image.src=cached;canvas.replaceWith(image);return;}
  let gltf=null;
  try{
   gltf=await loader.loadAsync(url);
   if(!canvas.isConnected||generation!==renderGeneration||backdrop.hidden)return;
   const snapshot=renderAvatarPortrait(gltf.scene);
   if(!canvas.isConnected||generation!==renderGeneration||backdrop.hidden)return;
   const image=new Image();image.alt='';image.decoding='async';image.src=snapshot;canvas.replaceWith(image);
   // Async persistence must not hold up the next thumbnail job.
   void writeThumbnail(url,snapshot);
  }catch{
   if(canvas.isConnected&&generation===renderGeneration){const parent=canvas.parentElement;if(parent){parent.classList.add('unavailable');parent.textContent='Preview unavailable';}}
  }finally{if(gltf)disposeAvatarPreview(gltf.scene);}
 }
 async function render({append=false}={}){const generation=append?renderGeneration:++renderGeneration;
  if(!append){previewObserver?.disconnect();previewObserver=null;grid.replaceChildren();}
  const existing=new Set([...grid.children].map(card=>card._avatar?.url));
  const previews=[];const newCards=[];for(const avatar of collection.filter(safe)){
   if(existing.has(avatar.url))continue;
   const card=document.createElement('button');card.type='button';card.className='avatar-card';card.setAttribute('role','listitem');
   const preview=document.createElement('span');preview.className='avatar-preview';const canvas=document.createElement('canvas');canvas.width=AVATAR_THUMB_WIDTH;canvas.height=AVATAR_THUMB_HEIGHT;preview.append(canvas);
   const name=document.createElement('strong');name.textContent=avatar.label||avatar.id;
   const description=document.createElement('small');description.textContent=(avatar.genderPresentation||'')+(avatar.ownerName?' · by '+avatar.ownerName:'');
   card.append(preview,name,description);card._avatar=avatar;grid.append(card);newCards.push(card);existing.add(avatar.url);
   card.onclick=()=>{if(preview.classList.contains('unavailable')){status.textContent='Avatar file is not on the server. Add it to the release or upload GLB.';return;}
    const obj=chooser(true);if(!obj)return;editor.changeRobotAvatar(obj,avatar.url);editor.select(obj);editor.updateInspector();close();};
   previews.push([canvas,avatar.url]);
  }
  if(typeof IntersectionObserver==='function'){
   if(!previewObserver)previewObserver=new IntersectionObserver(entries=>{
    for(const entry of entries){if(!entry.isIntersecting)continue;
     previewObserver?.unobserve(entry.target);
     const canvas=entry.target.querySelector('canvas');const avatar=entry.target._avatar;
     if(canvas&&avatar)enqueue(()=>generation===renderGeneration&&!backdrop.hidden?thumbnail(canvas,avatar.url,generation):undefined);
    }
   },{root:grid,rootMargin:'80px'});
   for(const card of newCards)previewObserver.observe(card);
  }else for(const [canvas,url] of previews){if(generation!==renderGeneration||backdrop.hidden)break;await thumbnail(canvas,url,generation);}
 }
 async function open(){backdrop.hidden=false;status.textContent='Preview models from the server or upload your own GLB.';
  let builtins=[];try{const r=await fetch('./assets/avatars/catalog.json');builtins=(await r.json()).avatars||[];}catch{}
  collection=builtins;render();
  // Do not delay built-in thumbnails behind a slow authenticated server query.
  let user=[];try{user=(await window.solviAPI.req('/api/avatars')).avatars||[];}catch{}
  if(backdrop.hidden)return;
  if(user.length){collection=[...builtins,...user];render({append:true});}}
 $('avatarsButton').onclick=open;$('openAvatarGallery').onclick=open;
 $('uploadRobotAvatar').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;
  if(!file.name.toLowerCase().endsWith('.glb')||file.size>20_000_000||file.size<100){status.textContent='Select a GLB under 20 MB';return;}
  try{status.textContent='Uploading '+file.name+'…';const form=new FormData();form.append('avatar',file);
   const result=await window.solviAPI.req('/api/avatars',{method:'POST',body:form});status.textContent='Uploaded: '+result.avatar.label;
   collection.push(result.avatar);await render({append:true});}catch(error){status.textContent='Upload failed: '+error.message;}finally{e.target.value='';}
 };
 return {open};
}
