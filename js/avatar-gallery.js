import {setupLibraryCardSize} from './library-card-size.js';
import {confirmAction} from './app-dialogs.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {renderAvatarPortrait,disposeAvatarPreview,AVATAR_THUMB_WIDTH,AVATAR_THUMB_HEIGHT} from './avatar-thumbnail.js';
import {readThumbnail,writeThumbnail} from './thumbnail-cache.js';
import {filterLibrary,downloadLibrarySelection,deleteLibrarySelection,selectionPrompt} from './library-management.js';
const $=id=>document.getElementById(id);
const loader=new GLTFLoader();const draco=new DRACOLoader();draco.setDecoderPath('./vendor/three/draco/');loader.setDRACOLoader(draco);
const safe=a=>typeof a?.url==='string'&&(a.url.startsWith('./assets/')||/^\/api\/avatars\/[0-9a-f]+\.glb$/.test(a.url));
export function setupAvatarGallery(editor){
 const backdrop=$('avatarGalleryBackdrop'),grid=$('avatarGalleryGrid'),status=$('avatarGalleryStatus');
 const search=$('avatarGallerySearch'),edit=$('avatarGalleryEdit'),bulk=$('avatarGalleryBulk'),count=$('avatarGallerySelected');
 const selected=new Set();
 setupLibraryCardSize(backdrop,grid,'avatars');const notice=$('avatarGalleryNotice');let editing=false,collection=[],renderGeneration=0,previewObserver=null,lanes=[Promise.resolve(),Promise.resolve()],nextLane=0;
 const enqueue=task=>{const lane=nextLane++%lanes.length;lanes[lane]=lanes[lane].catch(()=>{}).then(task);};
 const available=()=>filterLibrary(collection.filter(safe),search.value);
 function selection(){return available().filter(a=>selected.has(a.url));}
 function buttons(){const n=selection().length;count.textContent=n+' selected';$('avatarGalleryExport').disabled=!n;$('avatarGalleryDelete').disabled=!n;bulk.hidden=!editing;edit.setAttribute('aria-pressed',String(editing));edit.textContent=editing?'Done':'Edit';}
 function inform(message,error=false){notice.textContent=message;notice.hidden=!message;notice.classList.toggle('error',error);status.textContent=message;}
 async function refreshAfterChange(){
  const listing=await window.solviAPI.req('/api/avatars',{headers:window.solviLibraryAdminToken?.()?{'X-Solvi-Admin':window.solviLibraryAdminToken()}:{}});
  collection=[...(listing.bundled||[]),...(listing.avatars||[])];render();
 }
 const close=()=>{backdrop.hidden=true;renderGeneration++;previewObserver?.disconnect();previewObserver=null;selected.clear();editing=false;buttons();};
 $('closeAvatarGallery').onclick=close;backdrop.addEventListener('pointerdown',e=>{if(e.target===backdrop)close();});
 const chooser=useSelected=>{const robot=editor.selected?.userData.editorKind==='robot'&&editor.canEdit(editor.selected)?editor.selected:null;return robot&&useSelected?robot:editor.add('robot',false);};
 async function thumbnail(canvas,avatar,generation,meta){
  const url=avatar.url;
  const cached=await readThumbnail(url);
  if(!canvas.isConnected||generation!==renderGeneration||backdrop.hidden)return;
  if(cached){const image=new Image();image.alt='';image.decoding='async';image.src=cached;canvas.replaceWith(image);return;}
  let gltf=null;
  try{
   gltf=await loader.loadAsync(url);
   if(!canvas.isConnected||generation!==renderGeneration||backdrop.hidden)return;
   avatar.actions=gltf.animations?.length??0;
   if(meta)meta.textContent=`${avatar.actions} actions${avatar.ownerName?' · by '+avatar.ownerName:avatar.genderPresentation?' · '+avatar.genderPresentation:''}`;
   const snapshot=renderAvatarPortrait(gltf.scene);
   if(!canvas.isConnected||generation!==renderGeneration||backdrop.hidden)return;
   const image=new Image();image.alt='';image.decoding='async';image.src=snapshot;canvas.replaceWith(image);
   void writeThumbnail(url,snapshot);
  }catch{
   if(canvas.isConnected&&generation===renderGeneration){const parent=canvas.parentElement;if(parent){parent.classList.add('unavailable');parent.textContent='Preview unavailable';}}
  }finally{if(gltf)disposeAvatarPreview(gltf.scene);}
 }
 async function render({append=false}={}){
  const generation=append?renderGeneration:++renderGeneration;
  if(!append){previewObserver?.disconnect();previewObserver=null;grid.replaceChildren();}
  const existing=new Set([...grid.children].map(item=>item._avatar?.url));
  const newCards=[],previews=[];
  for(const avatar of available()){
   if(existing.has(avatar.url))continue;
   const item=document.createElement('div');item.className='library-item';item.setAttribute('role','listitem');item._avatar=avatar;
   const card=document.createElement('button');card.type='button';card.className='avatar-card';card.setAttribute('aria-label',avatar.label||avatar.id);
   const preview=document.createElement('span');preview.className='avatar-preview';const canvas=document.createElement('canvas');canvas.width=AVATAR_THUMB_WIDTH;canvas.height=AVATAR_THUMB_HEIGHT;preview.append(canvas);
   const name=document.createElement('strong');name.textContent=avatar.label||avatar.id;
   const description=document.createElement('small');description.className='library-card-meta';description.textContent=`${Number.isInteger(avatar.actions)?avatar.actions+' actions':'Actions unknown'}${avatar.ownerName?' · by '+avatar.ownerName:avatar.genderPresentation?' · '+avatar.genderPresentation:''}`;
   card.append(preview,name,description);card._avatar=avatar;
   const check=document.createElement('input');check.type='checkbox';check.className='library-check';check.setAttribute('aria-label','Select '+(avatar.label||avatar.id));check.checked=selected.has(avatar.url);check.hidden=!editing;check.disabled=avatar.bundled&&avatar.id==='solvi-character';if(check.disabled)check.title='Required SOLVI fallback avatar';
   check.addEventListener('change',()=>{if(check.checked)selected.add(avatar.url);else selected.delete(avatar.url);item.classList.toggle('selected',check.checked);buttons();});
   card.onclick=()=>{
    if(editing){if(check.disabled)return;check.checked=!check.checked;check.dispatchEvent(new Event('change'));return;}
    if(preview.classList.contains('unavailable')){status.textContent='Avatar file is not on the server. Add it to the release or upload GLB.';return;}
    const obj=chooser(true);if(!obj)return;editor.changeRobotAvatar(obj,avatar.url);editor.select(obj);editor.updateInspector();close();
   };
   item.append(card,check);grid.append(item);newCards.push(item);previews.push([canvas,avatar,description]);existing.add(avatar.url);
  }
  if(typeof IntersectionObserver==='function'){
   if(!previewObserver)previewObserver=new IntersectionObserver(entries=>{
    for(const entry of entries){if(!entry.isIntersecting)continue;
     previewObserver?.unobserve(entry.target);
     const canvas=entry.target.querySelector('canvas'),avatar=entry.target._avatar,meta=entry.target.querySelector('.library-card-meta');
     if(canvas&&avatar)enqueue(()=>generation===renderGeneration&&!backdrop.hidden?thumbnail(canvas,avatar,generation,meta):undefined);
    }
   },{root:grid,rootMargin:'80px'});
   for(const item of newCards)previewObserver.observe(item);
  }else for(const [canvas,avatar,meta] of previews){if(generation!==renderGeneration||backdrop.hidden)break;await thumbnail(canvas,avatar,generation,meta);}
  buttons();
 }
 async function open(){backdrop.hidden=false;selected.clear();editing=false;search.value='';inform('');buttons();status.textContent='Select to place or edit multiple avatars.';
  try{
   const listing=await window.solviAPI.req('/api/avatars',{headers:window.solviLibraryAdminToken?.()?{'X-Solvi-Admin':window.solviLibraryAdminToken()}: {}});
   if(backdrop.hidden)return;
   collection=[...(listing.bundled||[]),...(listing.avatars||[])];render();
  }catch(error){collection=[];render();status.textContent='Cannot load server avatar catalog: '+error.message;}

 }
 edit.onclick=()=>{editing=!editing;selected.clear();render();};
 search.addEventListener('input',()=>{selected.clear();render();});
 $('avatarGallerySelectAll').onclick=()=>{for(const avatar of available().filter(a=>a.id!=='solvi-character').slice(0,40))selected.add(avatar.url);render();};
 $('avatarGalleryExport').onclick=async()=>{try{status.textContent='Preparing selected avatars…';await downloadLibrarySelection('avatars',selection());status.textContent='Avatar ZIP downloaded.';}catch(error){status.textContent=error.message;}};
 $('avatarGalleryDelete').onclick=async()=>{
  const chosen=selection();if(!chosen.length)return;
  const blocked=chosen.filter(a=>a.bundled&&!window.solviLibraryAdminToken?.());
  if(blocked.length){
   inform('Administrator access required. Open Profile → Administrator access, unlock, then retry.',true);
   window.solviOpenAdminProfile?.();return;
  }
  if(!await confirmAction(selectionPrompt(chosen,'avatars'),{title:'Delete avatars permanently',confirmLabel:'Delete selected',danger:true}))return;
  const button=$('avatarGalleryDelete');button.disabled=true;
  let removed=0,replacedRobots=0;const failures=[];
  for(const [i,avatar] of chosen.entries()){
   inform(`Deleting avatar ${i+1} of ${chosen.length}: ${avatar.label||avatar.id}…`);
   try{
    if(!avatar.bundled&&avatar.canManage!==true&&!window.solviLibraryAdminToken?.())throw Error('Not owned by this user; administrator permission required');
    const result=await deleteLibrarySelection('avatars',[avatar]);
    replacedRobots+=Number(result?.replacedRobots||0);
    selected.delete(avatar.url);collection=collection.filter(a=>a.url!==avatar.url);removed++;
   }catch(error){failures.push(`${avatar.label||avatar.id}: ${error.message}`);}
  }
  try{await refreshAfterChange();}catch(error){failures.push('Gallery refresh: '+error.message);render();}
  const message=`${removed} of ${chosen.length} avatars permanently deleted from the server.`+(replacedRobots?` ${replacedRobots} realm robots retained with the default SOLVI avatar.`:'')+(failures.length?' Not deleted: '+failures.join(' | '):'');
  inform(message,failures.length>0);button.disabled=false;buttons();
 };
 window.addEventListener('solvi:admin-changed',()=>{if(!backdrop.hidden)void refreshAfterChange();});
 $('avatarsButton').onclick=open;$('openAvatarGallery').onclick=open;
 $('uploadRobotAvatar').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;
  if(!file.name.toLowerCase().endsWith('.glb')||file.size>20_000_000||file.size<100){status.textContent='Select a GLB under 20 MB';return;}
  try{status.textContent='Uploading '+file.name+'…';const form=new FormData();form.append('avatar',file);
   const result=await window.solviAPI.req('/api/avatars',{method:'POST',body:form});status.textContent='Uploaded: '+result.avatar.label;
   collection.push(result.avatar);await render({append:true});}catch(error){status.textContent='Upload failed: '+error.message;}finally{e.target.value='';}
 };
 return {open};
}
